export const config = { runtime: 'edge' };

import {
  authDisabled,
  json,
  readJsonBody,
  registerUser,
  registrationAllowed,
  verifyUserCredentials
} from '../lib/store.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const body = (await readJsonBody(req)) || {};
  const action = String(body.action || '').trim();

  try {
    if (action === 'config') {
      return json({
        ok: true,
        authRequired: !authDisabled(),
        registrationEnabled: registrationAllowed()
      });
    }

    if (action === 'register') {
      const username = String(body.username || '').trim();
      const password = String(body.password || '').trim();
      const inviteCode = String(body.inviteCode || body.invite || '').trim();
      const result = await registerUser(username, password, inviteCode);
      if (!result.ok) return json(result, result.status || 400);
      return json({ ok: true, userId: result.userId, username: result.userId });
    }

    if (action === 'login') {
      const username = String(body.username || '').trim();
      const password = String(body.password || '').trim();
      const result = await verifyUserCredentials(username, password);
      if (!result.ok) return json(result, result.status || 401);
      return json({ ok: true, userId: result.userId, username: result.userId, guest: !!result.guest });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('[auth]', err);
    return json({ ok: false, error: 'Internal error' }, 500);
  }
}
