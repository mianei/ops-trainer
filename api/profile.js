export const config = { runtime: 'edge' };

import { json, getHeader, readJsonBody, verifyUserCredentials } from '../lib/store.js';
import { loadUserProfile, saveUserProfile } from '../lib/user-profile.js';

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Access-Code'
      }
    });
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);

  const body = (await readJsonBody(req)) || {};
  const userId = getHeader(req, 'x-user-id') || body.userId || '';
  const code = getHeader(req, 'x-access-code') || body.accessCode || '';
  const auth = await verifyUserCredentials(userId, code);
  if (!auth.ok) return json({ ok: false, error: auth.error }, auth.status || 401);
  if (auth.guest) {
    return json({ ok: false, error: '访客模式不支持云端简历同步', historyEnabled: false }, 403);
  }

  const action = String(body.action || 'get').trim();

  try {
    if (action === 'get') {
      const result = await loadUserProfile(auth.userId);
      return json({ ok: true, userId: auth.userId, ...result });
    }

    if (action === 'save') {
      const result = await saveUserProfile(
        auth.userId,
        {
          resume: body.resume,
          jd: body.jd,
          targetRole: body.targetRole,
          resumeFileName: body.resumeFileName,
          jdFileName: body.jdFileName
        },
        { recordUpload: body.recordUpload === true }
      );
      if (!result.ok) return json(result, result.status || 500);
      return json({ ok: true, userId: auth.userId, ...result });
    }

    return json({ ok: false, error: 'Unknown action' }, 400);
  } catch (err) {
    console.error('[profile]', err);
    return json({ ok: false, error: 'Internal error' }, 500);
  }
}
