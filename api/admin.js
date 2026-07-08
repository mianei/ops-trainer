export const config = { runtime: 'edge' };

import { json, getHeader, readJsonBody } from '../lib/store.js';
import { aggregateTokensFromStore } from '../lib/observation-trace.js';
import { aggregateUsageStats, verifyAdminSecret } from '../lib/usage-stats.js';

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = (await readJsonBody(req)) || {};
  const secret = getHeader(req, 'x-admin-secret') || body.adminSecret || '';
  const auth = verifyAdminSecret(secret);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const action = String(body.action || 'dashboard').trim();
  const days = Math.min(Number(body.days) || 30, 90);

  if (action === 'dashboard') {
    const usage = await aggregateUsageStats({ days });
    const tokens = await aggregateTokensFromStore({ period: 'day', days });
    return json({
      ok: true,
      days,
      ...usage,
      tokenBuckets: tokens.buckets || [],
      tokenTotal: (tokens.buckets || []).reduce((s, b) => s + (Number(b.total) || 0), 0)
    });
  }

  return json({ error: '未知 action' }, 400);
}
