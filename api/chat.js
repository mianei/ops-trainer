export const config = { runtime: 'edge' };

import {
  json,
  getHeader,
  readJsonBody,
  verifyUserCredentials,
  historyEnabled,
  loadTopicAttempts,
  priorSameScenario,
  saveAttempt,
  HISTORY_PROMPT_SUFFIX,
  formatPriorForPrompt,
  upstashCall
} from './lib/store.js';

function getClientIp(req) {
  const xff = getHeader(req, 'x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return getHeader(req, 'x-real-ip') || 'unknown';
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function checkAndIncrLimit(ip) {
  const perIp = Number(process.env.DAILY_LIMIT_PER_IP || 30);
  const totalCap = Number(process.env.DAILY_TOTAL_LIMIT || 500);

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { ok: true, skipped: true };
  }

  const date = todayKey();
  const ipKey = `ops:ip:${date}:${ip}`;
  const totalKey = `ops:total:${date}`;

  const ipCount = await upstashCall(['INCR', ipKey]);
  if (ipCount === 1) await upstashCall(['EXPIRE', ipKey, '172800']);
  if (ipCount > perIp) {
    return { ok: false, reason: 'ip', count: ipCount, limit: perIp };
  }

  const totalCount = await upstashCall(['INCR', totalKey]);
  if (totalCount === 1) await upstashCall(['EXPIRE', totalKey, '172800']);
  if (totalCount > totalCap) {
    return { ok: false, reason: 'total', count: totalCount, limit: totalCap };
  }

  return { ok: true, ipCount, totalCount };
}

function getLlmConfig() {
  const provider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (provider === 'anthropic' || (!provider && anthropicKey && !deepseekKey)) {
    if (!anthropicKey) return { error: '请在 Vercel 配置 ANTHROPIC_API_KEY' };
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
    };
  }

  if (deepseekKey) {
    return {
      provider: 'deepseek',
      apiKey: deepseekKey,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
    };
  }

  if (anthropicKey) {
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
    };
  }

  return { error: '请在 Vercel 配置 DEEPSEEK_API_KEY（推荐）或 ANTHROPIC_API_KEY' };
}

const FOLLOWUP_SYSTEM_SUFFIX =
  '\n\n你已完成对学员首轮作答的结构化点评。学员会继续追问，请紧扣本题场景与其原答案，回答简洁可执行（约 300 字内），可补 1 个追问引导其深化思考。';

function buildChatMessages(systemPrompt, userContent, multiTurn) {
  const sys = systemPrompt + (multiTurn ? FOLLOWUP_SYSTEM_SUFFIX : '');
  if (!multiTurn) {
    return [
      { role: 'system', content: sys },
      { role: 'user', content: userContent }
    ];
  }
  const messages = [{ role: 'system', content: sys }];
  for (const turn of multiTurn) {
    messages.push({ role: turn.role, content: turn.content });
  }
  return messages;
}

async function callDeepSeek(cfg, systemPrompt, userContent, multiTurn) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1200,
      messages: buildChatMessages(systemPrompt, userContent, multiTurn)
    })
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || JSON.stringify(data?.error || data);
    return { error: 'DeepSeek API 错误：' + msg, status: res.status };
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return { error: 'DeepSeek 返回为空', status: 502 };
  return { text };
}

async function callAnthropic(cfg, systemPrompt, userContent, multiTurn) {
  const sys = systemPrompt + (multiTurn ? FOLLOWUP_SYSTEM_SUFFIX : '');
  const messages = multiTurn
    ? multiTurn.filter((m) => m.role === 'user' || m.role === 'assistant')
    : [{ role: 'user', content: userContent }];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1200,
      system: sys,
      messages
    })
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data?.error?.message || 'Anthropic API 错误', status: res.status };
  }
  const text = data?.content?.[0]?.text;
  if (!text) return { error: 'Anthropic 返回为空', status: 502 };
  return { text };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const body = (await readJsonBody(req)) || {};
  const userId = getHeader(req, 'x-user-id') || body.userId || '';
  const code = getHeader(req, 'x-access-code') || body.accessCode || '';

  const auth = verifyUserCredentials(userId, code);
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }

  if (body?.action === 'verify') {
    return json({ ok: true, userId: auth.userId });
  }

  const llm = getLlmConfig();
  if (llm.error) {
    return json({ error: llm.error }, 500);
  }

  const mode = body?.mode === 'followup' ? 'followup' : 'review';
  const { systemPrompt, scenario, answer } = body || {};
  const topicId = body.topicId || body.topic || '';

  if (!systemPrompt || !scenario) {
    return json({ error: '参数缺失' }, 400);
  }

  let userContent = '';
  let multiTurn = null;
  let reviewSystemPrompt = systemPrompt;
  let attemptNumber = 1;
  let comparedWith = 0;

  if (mode === 'followup') {
    const { priorFeedback, question, history } = body;
    if (!answer || !priorFeedback || !question) {
      return json({ error: '追问参数缺失' }, 400);
    }
    if (typeof question !== 'string' || question.length > 800) {
      return json({ error: '追问过长或格式错误' }, 400);
    }
    if (!Array.isArray(history) || history.length > 12) {
      return json({ error: '对话历史异常' }, 400);
    }
    for (const h of history) {
      if (!h?.q || !h?.a || String(h.q).length > 800 || String(h.a).length > 4000) {
        return json({ error: '对话历史格式错误' }, 400);
      }
    }
    if (typeof answer !== 'string' || answer.length > 4000) {
      return json({ error: '答案过长或格式错误' }, 400);
    }

    multiTurn = [
      { role: 'user', content: `业务场景：${scenario}\n\n学员初答：${answer}` },
      { role: 'assistant', content: priorFeedback }
    ];
    for (const h of history) {
      multiTurn.push({ role: 'user', content: h.q });
      multiTurn.push({ role: 'assistant', content: h.a });
    }
    multiTurn.push({ role: 'user', content: question });
    userContent = question;
  } else {
    if (!answer) {
      return json({ error: '参数缺失' }, 400);
    }
    if (typeof answer !== 'string' || answer.length > 4000) {
      return json({ error: '答案过长或格式错误' }, 400);
    }

    if (historyEnabled() && topicId) {
      const all = await loadTopicAttempts(auth.userId, topicId);
      const prior = priorSameScenario(all, scenario);
      comparedWith = prior.length;
      attemptNumber = prior.length + 1;
      if (prior.length) {
        reviewSystemPrompt = systemPrompt + HISTORY_PROMPT_SUFFIX;
        userContent = `业务场景：${scenario}\n\n我的分析：${answer}${formatPriorForPrompt(prior)}`;
      } else {
        userContent = `业务场景：${scenario}\n\n我的分析：${answer}`;
      }
    } else {
      userContent = `业务场景：${scenario}\n\n我的分析：${answer}`;
    }
  }

  const ip = getClientIp(req);
  const limit = await checkAndIncrLimit(ip);
  if (!limit.ok) {
    if (limit.reason === 'ip') {
      return json({ error: `今日已达个人使用上限（${limit.limit} 次/天），明天再来吧。` }, 429);
    }
    return json({ error: '今日全站使用量已达上限，请明天再来。' }, 429);
  }

  try {
    const result =
      llm.provider === 'deepseek'
        ? await callDeepSeek(llm, reviewSystemPrompt, userContent, multiTurn)
        : await callAnthropic(llm, reviewSystemPrompt, userContent, multiTurn);

    if (result.error) {
      return json({ error: result.error }, result.status || 502);
    }

    if (mode === 'review' && historyEnabled() && topicId) {
      await saveAttempt(auth.userId, topicId, {
        scenario,
        answer,
        feedback: result.text
      });
    }

    return json({
      text: result.text,
      attemptNumber,
      comparedWith,
      historyEnabled: historyEnabled()
    });
  } catch (e) {
    return json({ error: '上游调用失败：' + e.message }, 502);
  }
}
