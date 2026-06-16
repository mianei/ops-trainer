export const config = { runtime: 'edge' };

import { json, getHeader, readJsonBody, verifyUserCredentials, historyEnabled, loadTopicAttempts } from './lib/store.js';

const TYPE_PATTERNS = [
  ['behavior', /实习|STAR|困难|优势|规划|收获|自我介绍/i],
  ['product_design', /设计|功能|交互|MVP|方案/i],
  ['estimation', /估算|多少|GMV|DAU|量级/i],
  ['case', /案例|分析|为何|为什么/i],
  ['business', /业务|策略|商业化|增长|竞品|数据/i]
];

function inferType(scenario) {
  const s = String(scenario || '');
  for (const [type, re] of TYPE_PATTERNS) {
    if (re.test(s)) return type;
  }
  return 'business';
}

const TYPE_LABELS = {
  behavior: '行为面',
  product_design: '产品设计',
  estimation: '估算题',
  case: '案例分析',
  business: '业务面'
};

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = (await readJsonBody(req)) || {};
  const userId = getHeader(req, 'x-user-id') || body.userId || '';
  const code = getHeader(req, 'x-access-code') || body.accessCode || '';
  const auth = await verifyUserCredentials(userId, code);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  if (!historyEnabled()) {
    return json({ ok: true, historyEnabled: false, progressCurve: [], weakTypes: [], pmV2: true });
  }

  const topicIds = Array.isArray(body.topicIds) ? body.topicIds : [];
  const ids = topicIds.length ? topicIds.slice(0, 40) : [
    'iv-pm', 'iv-exp', 'iv-self', 'iv-career', 'prod-open', 'iv-skills', 'iv-ops', 'iv-open', 'user', 'competitor'
  ];

  /** @type {{ at: string, rubricAvg: number, topicId: string, type: string }[]} */
  const points = [];
  const typeScores = {};
  const typeCounts = {};

  for (const topicId of ids) {
    const attempts = await loadTopicAttempts(auth.userId, topicId);
    for (const a of attempts) {
      if (!a.rubricAvg || !a.at) continue;
      const type = inferType(a.scenario);
      points.push({ at: a.at, rubricAvg: a.rubricAvg, topicId, type, typeLabel: TYPE_LABELS[type] });
      typeScores[type] = (typeScores[type] || 0) + a.rubricAvg;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
  }

  points.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  const weakTypes = Object.entries(typeCounts)
    .map(([type, count]) => ({
      type,
      typeLabel: TYPE_LABELS[type] || type,
      count,
      avgScore: Math.round((typeScores[type] / count) * 10) / 10
    }))
    .filter(t => t.count >= 1)
    .sort((a, b) => a.avgScore - b.avgScore);

  const progressCurve = points.slice(-30).map((p, i) => ({
    index: i + 1,
    at: p.at.slice(0, 10),
    score: p.rubricAvg,
    typeLabel: p.typeLabel
  }));

  let trend = 'flat';
  if (progressCurve.length >= 4) {
    const half = Math.floor(progressCurve.length / 2);
    const early = progressCurve.slice(0, half).reduce((s, p) => s + p.score, 0) / half;
    const late = progressCurve.slice(half).reduce((s, p) => s + p.score, 0) / (progressCurve.length - half);
    if (late - early >= 0.4) trend = 'up';
    else if (early - late >= 0.4) trend = 'down';
  }

  return json({
    ok: true,
    historyEnabled: true,
    pmV2: true,
    totalAttempts: points.length,
    progressCurve,
    trend,
    weakTypes: weakTypes.slice(0, 5),
    summary: weakTypes.length
      ? `最薄弱题型：${weakTypes[0].typeLabel}（均分 ${weakTypes[0].avgScore}/5，${weakTypes[0].count} 次）`
      : '暂无足够作答记录，多练几题后可看进步曲线'
  });
}
