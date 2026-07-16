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

/**
 * 由五维硬算综合分 / 过筛率，避免模型每次「拍」一个 overall 导致 70↔60 乱跳。
 * 综合分 = round(五维均分 × 20)，例如均分 3.0→60、3.5→70、4.0→80。
 * @param {{ score: number }[]} dimensions
 * @param {{ hasJd?: boolean, fixCount?: number }} [opts]
 */
export function deriveResumeAggregates(dimensions, opts = {}) {
  const scores = (Array.isArray(dimensions) ? dimensions : [])
    .map((d) => clampNum(d?.score, 1, 5))
    .filter((n) => n != null);
  const avg = scores.length
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : 3;
  const overallScore = Math.round(avg * 20);
  const overallScore10 = Math.max(1, Math.min(10, Math.round(overallScore / 10)));
  const hasJd = Boolean(opts.hasJd);
  const weakCount = scores.filter((s) => s <= 2).length;
  // 过筛比综合分略严；有 JD 时再压一档（对齐岗位后才算「能过筛」）
  let passRate = Math.round(overallScore * (hasJd ? 0.88 : 0.92));
  passRate = Math.max(5, Math.min(92, passRate - weakCount * 4 - (hasJd ? 3 : 0)));
  const fixBoost = Math.min(12, Math.max(0, Number(opts.fixCount) || 0) * 3);
  const optimizedPassRate = Math.max(passRate, Math.min(95, passRate + 8 + fixBoost));
  return { overallScore, overallScore10, passRate, optimizedPassRate, dimAvg: Math.round(avg * 100) / 100 };
}

/** @param {string} raw @param {{ hasJd?: boolean }} [opts] */
export function parseResumeScoreReport(raw, opts = {}) {
  try {
    const parsed = JSON.parse(extractJsonText(raw));
    if (!parsed || typeof parsed !== 'object') return null;

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

    const derived = deriveResumeAggregates(dimensions, {
      hasJd: Boolean(opts.hasJd ?? parsed.hasJd),
      fixCount: topFixes.length
    });

    // 若模型仍给了 passRate，仅作参考；最终以五维公式为准（稳定）
    return {
      overallScore: derived.overallScore,
      overallScore10: derived.overallScore10,
      passRate: derived.passRate,
      optimizedPassRate: derived.optimizedPassRate,
      dimAvg: derived.dimAvg,
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
    `综合评分：${report.overallScore ?? '—'}/100（五维均分×20）`,
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
