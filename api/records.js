export const config = { runtime: 'edge' };

import { json, getHeader, readJsonBody, verifyUserCredentials, historyEnabled, loadTopicAttempts } from '../lib/store.js';
import {
  listTracesFromStore,
  aggregateTokensFromStore,
  summarizeBadcases
} from '../lib/observation-trace.js';
import { getUserUsageSummary } from '../lib/usage-stats.js';
import { listResumeHistory, RESUME_HISTORY_LABELS } from '../lib/user-profile.js';

const DEFAULT_TOPIC_IDS = [
  'user', 'decision', 'data', 'competitor', 'feature', 'interaction', 'growth', 'retention', 'content', 'crisis',
  'iv-exp', 'iv-self', 'iv-career', 'iv-pm', 'iv-misc', 'iv-skills', 'iv-ops', 'iv-open', 'prod-open',
  'biz-platform', 'biz-vertical', 'biz-monetize', 'map-ride', 'map-local'
];

const TYPE_PATTERNS = [
  ['behavior', /实习|STAR|困难|优势|规划|收获|自我介绍/i],
  ['product_design', /设计|功能|交互|MVP|方案/i],
  ['estimation', /估算|多少|GMV|DAU|量级/i],
  ['case', /案例|分析|为何|为什么/i],
  ['business', /业务|策略|商业化|增长|竞品|数据/i]
];

const TYPE_LABELS = {
  behavior: '行为面',
  product_design: '产品设计',
  estimation: '估算题',
  case: '案例分析',
  business: '业务面'
};

function inferType(scenario) {
  const s = String(scenario || '');
  for (const [type, re] of TYPE_PATTERNS) {
    if (re.test(s)) return type;
  }
  return 'business';
}

async function handleHistory(auth, body) {
  if (!historyEnabled()) {
    return json({ ok: true, historyEnabled: false, modules: [], timeline: [] });
  }

  const topicIds = Array.isArray(body.topicIds) ? body.topicIds : DEFAULT_TOPIC_IDS;
  const modules = [];
  const timeline = [];

  for (const topicId of topicIds.slice(0, 40)) {
    const attempts = await loadTopicAttempts(auth.userId, topicId);
    if (!attempts.length) continue;
    const scored = attempts.filter((a) => a.rubricAvg);
    const avgScore = scored.length
      ? Math.round((scored.reduce((s, a) => s + a.rubricAvg, 0) / scored.length) * 10) / 10
      : null;
    modules.push({
      topicId,
      count: attempts.length,
      avgScore,
      recent: attempts.slice(-2).reverse()
    });
    attempts.slice(-5).forEach((a) => {
      timeline.push({ topicId, ...a });
    });
  }

  timeline.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  return json({
    ok: true,
    historyEnabled: true,
    modules,
    timeline: timeline.slice(0, 30)
  });
}

async function handleAnalytics(auth, body) {
  if (!historyEnabled()) {
    return json({ ok: true, historyEnabled: false, progressCurve: [], weakTypes: [], pmV2: true });
  }

  const topicIds = Array.isArray(body.topicIds) ? body.topicIds : [];
  const ids = topicIds.length ? topicIds.slice(0, 40) : [
    'iv-pm', 'iv-exp', 'iv-self', 'iv-career', 'prod-open', 'iv-skills', 'iv-ops', 'iv-open', 'user', 'competitor'
  ];

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

async function handleTraces(auth, body) {
  if (!historyEnabled()) {
    return json({ ok: true, historyEnabled: false, traces: [], badcases: [] });
  }
  const limit = Math.min(Number(body.limit) || 30, 100);
  const traces = await listTracesFromStore(auth.userId, limit);
  const badcasesOnly = body.badcasesOnly === true;
  const filtered = badcasesOnly ? traces.filter((t) => t.badcase?.tagged) : traces;
  return json({
    ok: true,
    historyEnabled: true,
    count: filtered.length,
    traces: filtered,
    badcases: summarizeBadcases(traces)
  });
}

async function handleTokenAggregate(auth, body) {
  const period = ['day', 'week', 'month'].includes(body.period) ? body.period : 'day';
  const days = Math.min(Number(body.days) || 30, 365);
  const agg = await aggregateTokensFromStore({ period, days });
  return json({ ok: true, userId: auth.userId, ...agg });
}

async function handleMyUsage(auth) {
  const summary = await getUserUsageSummary(auth.userId);
  return json({ ok: true, userId: auth.userId, ...summary });
}

async function handleResumeHistory(auth, body) {
  if (!historyEnabled()) {
    return json({ ok: true, historyEnabled: false, items: [] });
  }
  const limit = Math.min(Number(body.limit) || 30, 50);
  const items = await listResumeHistory(auth.userId, limit);
  return json({
    ok: true,
    historyEnabled: true,
    userId: auth.userId,
    items,
    labels: RESUME_HISTORY_LABELS
  });
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = (await readJsonBody(req)) || {};
  const userId = getHeader(req, 'x-user-id') || body.userId || '';
  const code = getHeader(req, 'x-access-code') || body.accessCode || '';
  const auth = await verifyUserCredentials(userId, code);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const recordType = String(body.recordType || body.type || 'history').trim();
  if (recordType === 'my-usage') return handleMyUsage(auth);
  if (recordType === 'resume-history') return handleResumeHistory(auth, body);
  if (recordType === 'analytics') return handleAnalytics(auth, body);
  if (recordType === 'traces') return handleTraces(auth, body);
  if (recordType === 'token-aggregate' || recordType === 'tokens') return handleTokenAggregate(auth, body);
  return handleHistory(auth, body);
}
