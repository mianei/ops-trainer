export const config = { runtime: 'edge' };

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function getClientIp(req) {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') || req.ip || 'unknown';
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

  const expected = process.env.ACCESS_CODE;
  if (!expected) {
    return json({ error: '服务端未配置 ACCESS_CODE' }, 500);
  }
  const provided = req.headers.get('x-access-code');
  if (!provided || provided !== expected) {
    return json({ error: '访问码无效' }, 401);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: '服务端未配置 ANTHROPIC_API_KEY' }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: '请求体格式错误' }, 400);
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
