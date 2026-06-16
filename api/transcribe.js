export const config = { runtime: 'edge', maxDuration: 60 };

import { json, getHeader, readJsonBody, verifyUserCredentials } from './lib/store.js';

function getWhisperConfig() {
  const key = (process.env.OPENAI_API_KEY || process.env.WHISPER_API_KEY || '').trim();
  if (!key) return { error: '请配置 OPENAI_API_KEY 或 WHISPER_API_KEY（Whisper 语音转写）' };
  return {
    apiKey: key,
    baseUrl: (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.WHISPER_MODEL || 'whisper-1'
  };
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = (await readJsonBody(req)) || {};
  const userId = getHeader(req, 'x-user-id') || body.userId || '';
  const code = getHeader(req, 'x-access-code') || body.accessCode || '';
  const auth = await verifyUserCredentials(userId, code);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const cfg = getWhisperConfig();
  if (cfg.error) return json({ error: cfg.error, hint: '未配置时可继续使用文字输入' }, 503);

  const audioBase64 = body.audioBase64 || body.audio;
  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return json({ error: '缺少 audioBase64' }, 400);
  }

  const mime = body.mimeType || 'audio/webm';
  const bin = Uint8Array.from(atob(audioBase64.replace(/^data:[^;]+;base64,/, '')), c => c.charCodeAt(0));
  if (bin.length > 8 * 1024 * 1024) return json({ error: '音频过大（最大 8MB）' }, 400);

  const ext = mime.includes('mp4') ? 'mp4' : mime.includes('wav') ? 'wav' : 'webm';
  const form = new FormData();
  form.append('file', new Blob([bin], { type: mime }), `recording.${ext}`);
  form.append('model', cfg.model);
  form.append('language', body.language || 'zh');

  const res = await fetch(`${cfg.baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}` },
    body: form
  });
  const data = await res.json();
  if (!res.ok) return json({ error: data?.error?.message || 'Whisper 转写失败' }, res.status);

  return json({ ok: true, text: String(data.text || '').trim(), pmV2: true });
}
