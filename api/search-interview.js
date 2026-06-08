export const config = { runtime: 'edge' };

import { json, getHeader, readJsonBody, verifyUserCredentials } from './lib/store.js';
import { searchInterviewPosts, keywordsFromSearchResults } from './lib/interview-search.js';

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

  const goal = String(body.goal || body.query || '').trim();
  const company = String(body.company || '').trim() || null;
  const roleLabel = String(body.roleLabel || body.role || '').trim() || null;
  const sources = Array.isArray(body.sources) ? body.sources : undefined;

  if (!goal && !company && !roleLabel) {
    return json({ error: '请提供 goal、company 或 roleLabel' }, 400);
  }

  const search = await searchInterviewPosts({
    goal,
    company: company || undefined,
    roleLabel: roleLabel || undefined,
    sources,
    limit: body.limit
  });

  const keywords = keywordsFromSearchResults(search.results);

  return json({
    ok: true,
    ...search,
    suggestedKeywords: keywords
  });
}
