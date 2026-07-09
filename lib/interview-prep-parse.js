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
  return text;
}

/** @param {unknown} v */
function str(v) {
  return String(v ?? '').trim();
}

/** @param {string} raw */
export function parseInterviewPrepReport(raw) {
  try {
    const parsed = JSON.parse(extractJsonText(raw));
    if (!parsed || typeof parsed !== 'object') return null;

    const srcPrepDims = Array.isArray(parsed.prepDimensions) ? parsed.prepDimensions : [];
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
