import {
  RESUME_SCORE_DIM_NAMES,
  dimNameMatches
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

/** @param {string} raw */
export function parseResumeScoreReport(raw) {
  try {
    const parsed = JSON.parse(extractJsonText(raw));
    if (!parsed || typeof parsed !== 'object') return null;

    const overall10 = clampNum(parsed.overallScore, 1, 10);
    const overall100 = overall10 != null ? Math.round(overall10 * 10) : null;

    const srcDims = Array.isArray(parsed.dimensions) ? parsed.dimensions : [];
    /** @type {{ name: string, score: number, diagnosis: string }[]} */
    const dimensions = [];
    for (const name of RESUME_SCORE_DIM_NAMES) {
      const hit = srcDims.find((d) => dimNameMatches(name, d?.name))
        || srcDims[dimensions.length];
      const score = clampNum(hit?.score, 1, 5) ?? 3;
      dimensions.push({
        name,
        score,
        diagnosis: String(hit?.diagnosis || hit?.comment || '').trim()
      });
    }

    const topFixes = (Array.isArray(parsed.topFixes) ? parsed.topFixes : [])
      .map(f => String(f || '').trim())
      .filter(Boolean)
      .slice(0, 5);

    const passRate = clampNum(parsed.passRate, 0, 100);
    const optimizedPassRate = clampNum(parsed.optimizedPassRate, 0, 100);

    return {
      overallScore: overall100,
      overallScore10: overall10,
      passRate: passRate != null ? Math.round(passRate) : null,
      optimizedPassRate: optimizedPassRate != null ? Math.round(optimizedPassRate) : null,
      summary: String(parsed.summary || parsed.oneLiner || '').trim(),
      dimensions,
      topFixes
    };
  } catch {
    return null;
  }
}

/** @param {import('./resume-score-parse.js').parseResumeScoreReport extends (...args: any) => infer R ? R : never} report */
export function formatResumeScoreReply(report) {
  if (!report) return '';
  const lines = [
    `综合评分：${report.overallScore ?? '—'}/100`,
    report.summary && `一句话：${report.summary}`,
    '',
    '五维评分：',
    ...report.dimensions.map(d => `- ${d.name} ${d.score}/5：${d.diagnosis}`),
    '',
    '优先改进：',
    ...report.topFixes.map((f, i) => `${i + 1}. ${f}`)
  ];
  return lines.filter(l => l !== '').join('\n');
}
