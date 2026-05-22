export const config = { runtime: 'edge' };

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

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
  if (ipCount === 1) {
    await upstashCall(['EXPIRE', ipKey, '172800']);
  }
  if (ipCount > perIp) {
    return { ok: false, reason: 'ip', count: ipCount, limit: perIp };
  }

  const totalCount = await upstashCall(['INCR', totalKey]);
  if (totalCount === 1) {
    await upstashCall(['EXPIRE', totalKey, '172800']);
  }
  if (totalCount > totalCap) {
    return { ok: false, reason: 'total', count: totalCount, limit: totalCap };
  }

  return { ok: true, ipCount, totalCount };
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

  if (body?.action === 'verify' || getHeader(req, 'x-verify-only') === '1') {
    return json({ ok: true });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: '服务端未配置 ANTHROPIC_API_KEY' }, 500);
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

  try {
    const upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `业务场景：${scenario}\n\n我的分析：${answer}` }
        ]
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) {
      return json({ error: data?.error?.message || 'Anthropic API 错误' }, upstream.status);
    }
    const text = data?.content?.[0]?.text;
    if (!text) {
      return json({ error: '模型返回为空' }, 502);
    }
    return json({ text });
  } catch (e) {
    return json({ error: '上游调用失败：' + e.message }, 502);
  }
}
