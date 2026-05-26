export const config = { runtime: 'edge' };

import {
  json,
  getHeader,
  readJsonBody,
  verifyUserCredentials
} from './lib/store.js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const body = (await readJsonBody(req)) || {};
  const userId = getHeader(req, 'x-user-id') || body.userId || '';
  const code = getHeader(req, 'x-access-code') || body.accessCode || '';

  const auth = verifyUserCredentials(userId, code);
  if (!auth.ok) {
    return json({ ok: false, error: auth.error }, auth.status);
  }

  return json({ ok: true, userId: auth.userId });
}
