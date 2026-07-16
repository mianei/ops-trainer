import {
  INTERVIEW_PREP_DIM_NAMES,
  dimNameMatches,
  PREP_DIM_ALIASES
} from './resume-score-dims.js';

/** @param {unknown} v @param {number} min @param {number} max */
function clampNum(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

/** @param {string} raw */
function extractJsonText(raw) {
  const text = String(raw || '').trim();
  if (!text) return '';
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  if (start >= 0) return text.slice(start);
  return text;
}

/** 尝试修复被截断的 JSON（补全括号、去掉尾部残缺字段） */
function repairTruncatedJson(text) {
  let t = String(text || '').trim();
  if (!t) return '';
  // 去掉末尾未闭合的键值
  t = t.replace(/,\s*"[^"]*"\s*:\s*("[^"]*)?$/u, '');
  t = t.replace(/,\s*"[^"]*"\s*:\s*\[[^\]]*$/u, '');
  t = t.replace(/,\s*"[^"]*"\s*:\s*\{[^}]*$/u, '');
  t = t.replace(/,\s*"[^"]*$/u, '');
  t = t.replace(/,\s*$/u, '');
  // 未闭合的字符串：截到最后一个完整引号对之后的安全点
  const quoteCount = (t.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 === 1) {
    const last = t.lastIndexOf('"');
    if (last > 0) t = t.slice(0, last);
    t = t.replace(/,\s*$/u, '');
  }
  const openCurly = (t.match(/\{/g) || []).length;
  const closeCurly = (t.match(/\}/g) || []).length;
  const openSquare = (t.match(/\[/g) || []).length;
  const closeSquare = (t.match(/\]/g) || []).length;
  t += ']'.repeat(Math.max(0, openSquare - closeSquare));
  t += '}'.repeat(Math.max(0, openCurly - closeCurly));
  return t;
}

/** @param {string} raw */
function parseJsonLoose(raw) {
  const extracted = extractJsonText(raw);
  if (!extracted) return null;
  try {
    return JSON.parse(extracted);
  } catch {
    /* continue */
  }
  try {
    return JSON.parse(repairTruncatedJson(extracted));
  } catch {
    return null;
  }
}

/** @param {unknown} v */
function str(v) {
  return String(v ?? '').trim();
}

/**
 * 从残缺文本里尽量抠出三维诊断（解析全量 JSON 失败时的兜底）
 * @param {string} raw
 */
function extractPrepDimsFallback(raw) {
  const text = String(raw || '');
  /** @type {{ name: string, score: number, diagnosis: string }[]} */
  const dims = [];
  for (const name of INTERVIEW_PREP_DIM_NAMES) {
    const re = new RegExp(
      `"name"\\s*:\\s*"${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"\\s*,\\s*"score"\\s*:\\s*(\\d+)\\s*,\\s*"diagnosis"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`,
      'u'
    );
    const m = text.match(re);
    if (m) {
      dims.push({
        name,
        score: clampNum(m[1], 1, 5) ?? 3,
        diagnosis: str(m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"'))
      });
    } else {
      dims.push({ name, score: 3, diagnosis: '' });
    }
  }
  if (!dims.some((d) => d.diagnosis)) return null;
  return dims;
}

/** @param {string} raw */
export function parseInterviewPrepReport(raw) {
  try {
    const parsed = parseJsonLoose(raw);
    if (!parsed || typeof parsed !== 'object') {
      const fallbackDims = extractPrepDimsFallback(raw);
      if (!fallbackDims) return null;
      return {
        opening15s: '',
        prepDimensions: fallbackDims,
        projects: [],
        followUps: [],
        badcases: [],
        doNotSay: [],
        summary: ''
      };
    }

    const srcPrepDims = Array.isArray(parsed.prepDimensions)
      ? parsed.prepDimensions
      : (Array.isArray(parsed.dimensions) ? parsed.dimensions : []);
    /** @type {{ name: string, score: number, diagnosis: string }[]} */
    const prepDimensions = [];
    for (const name of INTERVIEW_PREP_DIM_NAMES) {
      const hit = srcPrepDims.find((d) => dimNameMatches(name, d?.name, PREP_DIM_ALIASES))
        || srcPrepDims[prepDimensions.length];
      const score = clampNum(hit?.score, 1, 5) ?? 3;
      prepDimensions.push({
        name,
        score,
        diagnosis: str(hit?.diagnosis || hit?.comment)
      });
    }
    if (!prepDimensions.some((d) => d.diagnosis)) {
      const fallbackDims = extractPrepDimsFallback(raw);
      if (fallbackDims) {
        for (let i = 0; i < 3; i++) {
          if (!prepDimensions[i].diagnosis && fallbackDims[i]?.diagnosis) {
            prepDimensions[i] = fallbackDims[i];
          }
        }
      }
    }

    const projects = (Array.isArray(parsed.projects) ? parsed.projects : [])
      .slice(0, 4)
      .map(p => ({
        name: str(p?.name) || '项目',
        structure30s: str(p?.structure30s || p?.structure),
        keyEvidence: str(p?.keyEvidence || p?.evidence)
      }))
      .filter(p => p.structure30s || p.keyEvidence);

    const followUps = (Array.isArray(parsed.followUps) ? parsed.followUps : [])
      .slice(0, 6)
      .map(f => ({
        question: str(f?.question || f?.q),
        defense: str(f?.defense || f?.answer)
      }))
      .filter(f => f.question);

    const badcases = (Array.isArray(parsed.badcases) ? parsed.badcases : [])
      .map(b => str(typeof b === 'string' ? b : b?.text))
      .filter(Boolean)
      .slice(0, 4);

    const doNotSay = (Array.isArray(parsed.doNotSay) ? parsed.doNotSay : [])
      .map(s => str(s))
      .filter(Boolean)
      .slice(0, 6);

    const opening15s = str(parsed.opening15s || parsed.opening);
    if (!opening15s && !projects.length && !followUps.length && !prepDimensions.some(d => d.diagnosis)) {
      return null;
    }

    return {
      opening15s,
      prepDimensions,
      projects,
      followUps,
      badcases,
      doNotSay,
      summary: str(parsed.summary)
    };
  } catch {
    return null;
  }
}

/** @param {ReturnType<typeof parseInterviewPrepReport>} report */
export function formatInterviewPrepReply(report) {
  if (!report) return '';
  const lines = [];
  if (report.summary) lines.push(report.summary);
  if (report.prepDimensions?.length) {
    lines.push('【面试就绪度】');
    report.prepDimensions.forEach((d) => {
      lines.push(`- ${d.name} ${d.score}/5：${d.diagnosis || '—'}`);
    });
  }
  if (report.opening15s) lines.push('【前 15 秒】' + report.opening15s);
  report.projects.forEach(p => {
    lines.push(`【${p.name}】${p.structure30s}`);
  });
  return lines.join('\n');
}
