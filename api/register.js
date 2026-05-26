export const config = { runtime: 'edge' };

import { json, readJsonBody, registerUser } from './lib/store.js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const body = (await readJsonBody(req)) || {};
  const username = body.username || body.userId || '';
  const password = body.password || body.accessCode || '';
  const inviteCode = body.inviteCode || body.invite || '';

  const result = await registerUser(username, password, inviteCode);
  if (!result.ok) {
    return json({ ok: false, error: result.error }, result.status);
  }
  return json({ ok: true, userId: result.userId });
}
