export const config = { runtime: 'edge' };

import { json, getHeader, readJsonBody, verifyUserCredentials } from './lib/store.js';
import { generateScenarios, getLlmConfig } from './lib/scenario-generate.js';

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

  const goal = String(body.goal || '').trim();
  const catalog = Array.isArray(body.catalog) ? body.catalog : [];
  if (!goal) return json({ error: '请提供 goal' }, 400);
  if (!catalog.length) return json({ error: '请提供 catalog' }, 400);

  const cfg = getLlmConfig();
  const result = await generateScenarios({
    goal,
    intent: body.intent || null,
    catalog,
    historySummary: body.historySummary || null,
    count: body.count,
    cfg
  });

  return json({
    ok: result.ok,
    demo: true,
    scenarios: result.scenarios,
    message: result.message
  });
}
