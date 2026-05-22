export const config = { runtime: 'edge' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function getHeader(req, name) {
  const h = req.headers;
  if (!h) return null;
  if (typeof h.get === 'function') return h.get(name);
  const lower = name.toLowerCase();
  const val = h[lower] ?? h[name];
  return Array.isArray(val) ? val[0] : val ?? null;
}

function getClientIp(req) {
  const xff = getHeader(req, 'x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return getHeader(req, 'x-real-ip') || 'unknown';
}

async function readJsonBody(req) {
  if (typeof req.json === 'function') {
    try {
      return await req.json();
    } catch {
      return null;
    }
  }
  if (typeof req.text === 'function') {
    try {
      const raw = await req.text();
      return raw ? JSON.parse(raw) : {};
    } catch {
      return null;
    }
  }
  return {};
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function upstashCall(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const res = await fetch(`${url}/${command.map(encodeURIComponent).join('/')}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.result;
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

/** 优先 DeepSeek，其次 Anthropic；也可用 AI_PROVIDER=deepseek|anthropic 指定 */
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

  return {
    error: '请在 Vercel 配置 DEEPSEEK_API_KEY（推荐）或 ANTHROPIC_API_KEY'
  };
}

async function callDeepSeek(cfg, systemPrompt, userContent) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1000,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent }
      ]
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

async function callAnthropic(cfg, systemPrompt, userContent) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }]
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

  const expected = (process.env.ACCESS_CODE || '').trim();
  if (!expected) {
    return json({ error: '服务端未配置 ACCESS_CODE' }, 500);
  }

  const body = (await readJsonBody(req)) || {};
  const provided = ((getHeader(req, 'x-access-code') || body.accessCode || '') + '').trim();
  if (!provided || provided !== expected) {
    return json({ error: '访问码无效' }, 401);
  }

  if (body?.action === 'verify') {
    return json({ ok: true });
  }

  const llm = getLlmConfig();
  if (llm.error) {
    return json({ error: llm.error }, 500);
  }

  const { systemPrompt, scenario, answer } = body || {};
  if (!systemPrompt || !scenario || !answer) {
    return json({ error: '参数缺失' }, 400);
  }
  if (typeof answer !== 'string' || answer.length > 4000) {
    return json({ error: '答案过长或格式错误' }, 400);
  }

  const ip = getClientIp(req);
  const limit = await checkAndIncrLimit(ip);
  if (!limit.ok) {
    if (limit.reason === 'ip') {
      return json({ error: `今日已达个人使用上限（${limit.limit} 次/天），明天再来吧。` }, 429);
    }
    return json({ error: '今日全站使用量已达上限，请明天再来。' }, 429);
  }

  const userContent = `业务场景：${scenario}\n\n我的分析：${answer}`;

  try {
    const result =
      llm.provider === 'deepseek'
        ? await callDeepSeek(llm, systemPrompt, userContent)
        : await callAnthropic(llm, systemPrompt, userContent);

    if (result.error) {
      return json({ error: result.error }, result.status || 502);
    }
    return json({ text: result.text });
  } catch (e) {
    return json({ error: '上游调用失败：' + e.message }, 502);
  }
}
