export const config = { runtime: 'nodejs', maxDuration: 60 };

import { json, getHeader, readJsonBody, verifyUserCredentials } from './lib/store.js';
import { getLlmConfig } from './lib/scenario-generate.js';
import { VALID_COACH_MODES, detectCoachIntent } from './lib/coach-modes.js';
import { buildCoachSystemPrompt, buildCoachUserMessage } from './lib/coach-prompts.js';
import { resolveCoachAction } from './lib/coach-actions.js';

async function callDeepSeekCoach(cfg, systemPrompt, messages, maxTokens = 4096) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    })
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data?.error || data);
    return { error: 'DeepSeek API 错误：' + msg, status: res.status };
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return { error: 'DeepSeek 返回为空', status: 502 };
  return { text };
}

async function callAnthropicCoach(cfg, systemPrompt, messages, maxTokens = 4096) {
  const anthropicMessages = messages.filter(m => m.role !== 'system');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: anthropicMessages.map(m => ({ role: m.role, content: m.content }))
    })
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data?.error || data);
    return { error: 'Anthropic API 错误：' + msg, status: res.status };
  }
  const text = data?.content?.[0]?.text;
  if (!text) return { error: 'Anthropic 返回为空', status: 502 };
  return { text };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await readJsonBody(req);
    const code = body?.accessCode || getHeader(req, 'x-access-code');
    const userId = body?.userId || getHeader(req, 'x-user-id');
    const auth = await verifyUserCredentials(userId, code);
    if (!auth.ok) {
      return json({ error: auth.error || '未授权' }, auth.status || 401);
    }

    const intake = body?.intake && typeof body.intake === 'object' ? body.intake : {};
    const history = Array.isArray(body?.history) ? body.history : [];
    const contextModule = String(body?.contextModule || '').trim();
    const action = String(body?.action || '').trim();

    let mode = String(body?.mode || '').trim();
    let message = String(body?.message || '').trim();

    const resolved = action ? resolveCoachAction(action, intake) : null;
    if (resolved) {
      message = resolved.message;
      mode = resolved.mode;
    }

    if (!message) {
      return json({ error: '消息不能为空' }, 400);
    }

    if (!mode || !VALID_COACH_MODES.includes(mode)) {
      mode = detectCoachIntent(message)
        || (contextModule === 'resume' ? 'resume-diagnosis' : contextModule === 'interview' ? 'interview-defense' : 'ai-pm-qa');
    }

    const cfg = getLlmConfig();
    if (!cfg || cfg.error) {
      return json({
        error: cfg?.error || '请在项目根目录 .env.local 配置 DEEPSEEK_API_KEY 或 ANTHROPIC_API_KEY，然后重启 npx vercel dev'
      }, 503);
    }

    const compact = Boolean(action);
    const maxTokens = compact ? 2048 : 4096;
    const systemPrompt = buildCoachSystemPrompt(mode, { compact });
    const userContent = buildCoachUserMessage(mode, intake, message);
    const chatMessages = [
      ...history
        .slice(-6)
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .map(m => ({ role: m.role, content: String(m.content) })),
      { role: 'user', content: userContent }
    ];

    const result =
      cfg.provider === 'anthropic'
        ? await callAnthropicCoach(cfg, systemPrompt, chatMessages, maxTokens)
        : await callDeepSeekCoach(cfg, systemPrompt, chatMessages, maxTokens);

    if (result.error) {
      return json({ error: result.error }, result.status >= 400 && result.status < 600 ? result.status : 502);
    }

    return json({ ok: true, reply: result.text, mode, action: action || undefined });
  } catch (e) {
    console.error('[coach]', e);
    return json({ error: e?.message || '服务内部错误，请稍后重试' }, 500);
  }
}
