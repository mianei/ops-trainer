export const config = { runtime: 'edge' };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

function getHeader(req, name) {
  const h = req.headers;
  if (!h) return '';
  if (typeof h.get === 'function') return h.get(name) || '';
  const lower = name.toLowerCase();
  const val = h[lower] ?? h[name];
  return (Array.isArray(val) ? val[0] : val) || '';
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const expected = (process.env.ACCESS_CODE || '').trim();
  if (!expected) {
    return json({ error: '服务端未配置 ACCESS_CODE' }, 500);
  }

  const provided = getHeader(req, 'x-access-code').trim();
  if (!provided) {
    return json({ ok: false, error: '缺少访问码' }, 401);
  }
  if (provided !== expected) {
    return json({ ok: false, error: '访问码无效' }, 401);
  }

  return json({ ok: true });
}
