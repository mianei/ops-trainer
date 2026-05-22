export const config = { runtime: 'edge' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

/** 兼容 Edge Request 与 Node IncomingMessage */
function getHeader(req, name) {
  const h = req.headers;
  if (!h) return null;
  if (typeof h.get === 'function') return h.get(name);
  const lower = name.toLowerCase();
  const val = h[lower] ?? h[name];
  return Array.isArray(val) ? val[0] : val ?? null;
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
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export default async function handler(req) {
  try {
    if (req.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405);
    }

    const expected = (process.env.ACCESS_CODE || '').trim();
    if (!expected) {
      return json({ error: '服务端未配置 ACCESS_CODE' }, 500);
    }

    let provided = getHeader(req, 'x-access-code');
    if (!provided) {
      const body = await readJsonBody(req);
      provided = body?.accessCode;
    }
    provided = (provided || '').trim();

    if (!provided || provided !== expected) {
      return json({ ok: false, error: '访问码无效' }, 401);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: 'verify 异常: ' + (err?.message || String(err)) }, 500);
  }
}
