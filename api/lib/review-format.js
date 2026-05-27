export const STRUCTURED_REVIEW_SUFFIX =
  '\n\n【输出格式】首轮点评必须只输出一个 JSON 对象（不要用 markdown 代码块包裹），字段如下：\n' +
  '{\n' +
  '  "summary": "一句话总评",\n' +
  '  "dimensions": [\n' +
  '    {"name":"结构完整性","score":1-5,"comment":"是否分点、有结论"},\n' +
  '    {"name":"框架运用","score":1-5,"comment":"是否用到正确方法论"},\n' +
  '    {"name":"论据与可验证性","score":1-5,"comment":"有无数据/场景/指标"},\n' +
  '    {"name":"业务洞察","score":1-5,"comment":"是否触及 trade-off 与多方"},\n' +
  '    {"name":"可执行性","score":1-5,"comment":"下一步是否具体"}\n' +
  '  ],\n' +
  '  "strengths": ["亮点1","亮点2"],\n' +
  '  "gaps": ["遗漏1","遗漏2"],\n' +
  '  "actions": ["建议行动1","建议行动2"],\n' +
  '  "growth": "若有以往作答记录则写「思维成长」80-120字，否则空字符串"\n' +
  '}\n' +
  'score 为整数 1-5。各字段合计约 450-600 字。';

export function structuredReviewEnabled() {
  return (process.env.STRUCTURED_REVIEW || '1').trim() !== '0';
}

export function parseStructuredReview(text) {
  const raw = String(text || '').trim();
  if (!raw) return { ok: false, raw };
  try {
    const obj = JSON.parse(raw);
    if (obj && obj.summary && Array.isArray(obj.dimensions)) {
      return { ok: true, review: normalizeReview(obj), raw };
    }
  } catch {
    /* fall through */
  }
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const obj = JSON.parse(m[0]);
      if (obj && obj.summary && Array.isArray(obj.dimensions)) {
        return { ok: true, review: normalizeReview(obj), raw };
      }
    } catch {
      /* */
    }
  }
  return { ok: false, raw };
}

function normalizeReview(obj) {
  const dimensions = (obj.dimensions || []).slice(0, 6).map((d) => ({
    name: String(d.name || '').slice(0, 40),
    score: Math.max(1, Math.min(5, Number(d.score) || 3)),
    comment: String(d.comment || '').slice(0, 300)
  }));
  return {
    summary: String(obj.summary || '').slice(0, 500),
    dimensions,
    strengths: (obj.strengths || []).map((s) => String(s).slice(0, 200)).slice(0, 4),
    gaps: (obj.gaps || []).map((s) => String(s).slice(0, 200)).slice(0, 4),
    actions: (obj.actions || []).map((s) => String(s).slice(0, 200)).slice(0, 4),
    growth: String(obj.growth || '').slice(0, 400)
  };
}

export function reviewToPlainText(review) {
  if (!review) return '';
  const lines = [review.summary, ''];
  for (const d of review.dimensions || []) {
    lines.push(`${d.name} ${d.score}/5：${d.comment}`);
  }
  if (review.strengths?.length) lines.push('\n亮点：' + review.strengths.join('；'));
  if (review.gaps?.length) lines.push('待加强：' + review.gaps.join('；'));
  if (review.actions?.length) lines.push('建议：' + review.actions.join('；'));
  if (review.growth) lines.push('\n思维成长：' + review.growth);
  return lines.join('\n');
}
