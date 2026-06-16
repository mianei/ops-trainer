export const config = { runtime: 'edge', maxDuration: 30 };

import { json, getHeader, readJsonBody, verifyUserCredentials, loadTopicAttempts } from './lib/store.js';
import {
  FRAMEWORK_SYSTEM,
  RUBRIC_SYSTEM,
  COMPARE_SYSTEM,
  buildFrameworkUserContent,
  buildRubricUserContent,
  buildCompareUserContent,
  parsePmJson
} from './lib/pm-review.js';

function getLlmConfig() {
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!deepseekKey) return { error: '请配置 DEEPSEEK_API_KEY' };
  return {
    provider: 'deepseek',
    apiKey: deepseekKey,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  };
}

async function callDeepSeekJson(cfg, system, user) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  const data = await res.json();
  if (!res.ok) return { error: data?.error?.message || 'API 错误', status: res.status };
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return { error: '返回为空', status: 502 };
  return { text };
}

export default async function handler(req) {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const body = (await readJsonBody(req)) || {};
  const userId = getHeader(req, 'x-user-id') || body.userId || '';
  const code = getHeader(req, 'x-access-code') || body.accessCode || '';
  const auth = await verifyUserCredentials(userId, code);
  if (!auth.ok) return json({ error: auth.error }, auth.status);

  const mode = body.mode || 'framework';
  const scenario = String(body.scenario || '').trim();
  if (!scenario) return json({ error: '缺少题目 scenario' }, 400);

  const bankMeta = body.bankMeta || null;
  const llm = getLlmConfig();
  if (llm.error) return json({ error: llm.error }, 500);

  let system = FRAMEWORK_SYSTEM;
  let user = buildFrameworkUserContent(scenario, bankMeta);

  if (mode === 'rubric') {
    system = RUBRIC_SYSTEM;
    user = buildRubricUserContent(scenario, bankMeta);
  } else if (mode === 'compare') {
    const answer = String(body.answer || '').trim();
    if (!answer) return json({ error: '对比模式需要 answer' }, 400);
    system = COMPARE_SYSTEM;
    user = buildCompareUserContent(scenario, answer, body.referenceOutline || bankMeta?.referenceOutline);
  } else if (mode !== 'framework') {
    return json({ error: '未知 mode' }, 400);
  }

  const result = await callDeepSeekJson(llm, system, user);
  if (result.error) return json({ error: result.error }, result.status || 502);

  const parsed = parsePmJson(result.text);
  return json({
    ok: true,
    mode,
    structured: parsed.ok ? parsed.data : null,
    text: result.text,
    pmV2: true
  });
}
