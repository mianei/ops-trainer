export const config = { runtime: 'edge' };

import { json, getHeader, readJsonBody, verifyUserCredentials, historyEnabled, loadTopicAttempts } from './lib/store.js';

const DEFAULT_TOPIC_IDS = [
  'user', 'decision', 'data', 'competitor', 'feature', 'interaction', 'growth', 'retention', 'content', 'crisis',
  'iv-exp', 'iv-self', 'iv-career', 'iv-pm', 'iv-misc', 'iv-skills', 'iv-ops', 'iv-open', 'prod-open',
  'biz-platform', 'biz-vertical', 'biz-monetize', 'map-ride', 'map-local'
];

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const body = (await readJsonBody(req)) || {};
  const userId = getHeader(req, 'x-user-id') || body.userId || '';
  const code = getHeader(req, 'x-access-code') || body.accessCode || '';

  const auth = await verifyUserCredentials(userId, code);
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }

  if (!historyEnabled()) {
    return json({ ok: true, historyEnabled: false, modules: [], timeline: [] });
  }

  const topicIds = Array.isArray(body.topicIds) ? body.topicIds : DEFAULT_TOPIC_IDS;
  /** @type {{ topicId: string, count: number, recent: object[], avgScore?: number }[]} */
  const modules = [];
  /** @type {object[]} */
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
