export function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export function getHeader(req, name) {
  const h = req.headers;
  if (!h) return '';
  if (typeof h.get === 'function') return h.get(name) || '';
  const lower = name.toLowerCase();
  const val = h[lower] ?? h[name];
  return (Array.isArray(val) ? val[0] : val) || '';
}

export async function readJsonBody(req) {
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

/** @returns {Map<string, string>} userId -> password */
export function parseAccessUsers() {
  const raw = (process.env.ACCESS_USERS || '').trim();
  const map = new Map();
  if (raw) {
    if (raw.startsWith('{')) {
      try {
        const obj = JSON.parse(raw);
        for (const [id, pass] of Object.entries(obj)) {
          const uid = String(id).trim();
          const pw = String(pass).trim();
          if (uid && pw) map.set(uid.toLowerCase(), { id: uid, pass: pw });
        }
      } catch {
        /* fall through */
      }
    } else {
      raw.split(',').forEach((pair) => {
        const idx = pair.indexOf(':');
        if (idx <= 0) return;
        const uid = pair.slice(0, idx).trim();
        const pw = pair.slice(idx + 1).trim();
        if (uid && pw) map.set(uid.toLowerCase(), { id: uid, pass: pw });
      });
    }
  }
  if (map.size === 0) {
    const single = (process.env.ACCESS_CODE || '').trim();
    if (single) map.set('default', { id: 'default', pass: single });
  }
  return map;
}

export function multiUserMode() {
  const users = parseAccessUsers();
  return users.size > 1 || (users.size === 1 && !users.has('default'));
}

export function getRegisterInviteCode() {
  return (process.env.REGISTER_INVITE_CODE || process.env.ACCESS_CODE || '').trim();
}

export function registrationAllowed() {
  return historyEnabled() && Boolean(getRegisterInviteCode());
}

export function validateUsername(userIdRaw) {
  const s = String(userIdRaw || '').trim();
  if (s.length < 2 || s.length > 24) return null;
  if (!/^[a-zA-Z0-9_]+$/.test(s)) return null;
  return s;
}

export async function hashPassword(password) {
  const pepper = (process.env.AUTH_PEPPER || getRegisterInviteCode() || 'ops-trainer').trim();
  const data = new TextEncoder().encode(`${pepper}:${password}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function accountKey(usernameLower) {
  return `ops:acct:${usernameLower}`;
}

export async function lookupRegisteredUser(userId) {
  if (!historyEnabled()) return null;
  const uid = String(userId || '').trim();
  if (!uid) return null;
  const raw = await upstashCall(['GET', accountKey(uid.toLowerCase())]);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return obj && obj.id && obj.hash ? obj : null;
  } catch {
    return null;
  }
}

export async function registerUser(userIdRaw, passwordRaw, inviteRaw) {
  if (!registrationAllowed()) {
    return {
      ok: false,
      error: '注册未开放：请在 Vercel 配置 Upstash Redis 与 REGISTER_INVITE_CODE',
      status: 503
    };
  }
  const userId = validateUsername(userIdRaw);
  if (!userId) {
    return { ok: false, error: '用户名 2–24 位，仅字母、数字、下划线', status: 400 };
  }
  const password = String(passwordRaw || '');
  if (password.length < 6) {
    return { ok: false, error: '密码至少 6 位', status: 400 };
  }
  const invite = String(inviteRaw || '').trim();
  const expected = getRegisterInviteCode();
  if (!invite || invite !== expected) {
    return { ok: false, error: '邀请码无效', status: 401 };
  }
  const envUsers = parseAccessUsers();
  if (envUsers.has(userId.toLowerCase())) {
    return { ok: false, error: '该用户名已被占用', status: 409 };
  }
  const hash = await hashPassword(password);
  const record = JSON.stringify({ id: userId, hash });
  const setOk = await upstashCall(['SET', accountKey(userId.toLowerCase()), record, 'NX']);
  if (setOk !== 'OK') {
    return { ok: false, error: '用户名已被占用', status: 409 };
  }
  return { ok: true, userId };
}

export function authDisabled() {
  const users = parseAccessUsers();
  // 未配置 ACCESS_CODE / ACCESS_USERS 时始终访客模式，不因鉴权 misconfig 返回 500
  if (users.size === 0) return true;
  const flag = (process.env.AUTH_DISABLED || '').trim();
  if (flag === '1') return true;
  if (flag === '0') return false;
  return false;
}

export async function verifyUserCredentials(userIdRaw, codeRaw) {
  if (authDisabled()) {
    const userId = String(userIdRaw || '').trim() || 'guest';
    return { ok: true, userId, guest: true };
  }
  const users = parseAccessUsers();
  if (users.size === 0) {
    const userId = String(userIdRaw || '').trim() || 'guest';
    return { ok: true, userId, guest: true };
  }
  const code = String(codeRaw || '').trim();
  if (!code) {
    return { ok: false, error: '请输入密码', status: 401 };
  }

  let userId = String(userIdRaw || '').trim();
  if (!userId) {
    if (users.has('default')) {
      const entry = users.get('default');
      if (entry.pass === code) return { ok: true, userId: 'default' };
      return { ok: false, error: '密码无效', status: 401 };
    }
    return { ok: false, error: '请输入用户名', status: 401 };
  }

  const envEntry = users.get(userId.toLowerCase());
  if (envEntry && envEntry.pass === code) {
    return { ok: true, userId: envEntry.id };
  }

  const reg = await lookupRegisteredUser(userId);
  if (reg) {
    const hash = await hashPassword(code);
    if (reg.hash === hash) return { ok: true, userId: reg.id };
    return { ok: false, error: '用户名或密码无效', status: 401 };
  }

  if (users.size === 0) {
    return { ok: false, error: '用户名或密码无效', status: 401 };
  }
  return { ok: false, error: '用户名或密码无效', status: 401 };
}

export async function upstashCall(command) {
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

const MAX_ATTEMPTS_PER_TOPIC = 40;

export function historyEnabled() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

function historyKey(userId, topicId) {
  return `ops:hist:${userId}:${topicId}`;
}

export async function loadTopicAttempts(userId, topicId) {
  if (!historyEnabled() || !userId || !topicId) return [];
  const raw = await upstashCall(['GET', historyKey(userId, topicId)]);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** 本模块内最近若干次作答（不限是否同一道题），用于对比思维深度 */
export function priorRecentAttempts(attempts, limit = 3) {
  if (!attempts.length) return [];
  return attempts.slice(-limit);
}

export async function saveAttempt(userId, topicId, record) {
  if (!historyEnabled() || !userId || !topicId) return false;
  const list = await loadTopicAttempts(userId, topicId);
  list.push({
    scenario: record.scenario,
    answer: record.answer,
    feedback: record.feedback,
    at: record.at || new Date().toISOString(),
    rubricAvg: record.rubricAvg ?? null,
    dimensions: record.dimensions ?? null
  });
  const trimmed = list.slice(-MAX_ATTEMPTS_PER_TOPIC);
  const ok = await upstashCall(['SET', historyKey(userId, topicId), JSON.stringify(trimmed)]);
  return ok === 'OK';
}

export const HISTORY_PROMPT_SUFFIX =
  '\n\n若用户消息中包含「以往作答记录」，请在常规点评之后增加一小节「思维成长」（约 80–120 字）：' +
  '对照该学员在本模块的近期作答（题目可以不同），看本次是否想到更多角度、更深一层或更可执行的细节，思路是否更结构化。' +
  '点出具体进步与仍可加强处。不要打分、不要排名、不要用数字评级。若没有以往记录，则不要写该小节。';

export function formatPriorForPrompt(prior) {
  if (!prior.length) return '';
  const blocks = prior.map((p, i) => {
    const scene = String(p.scenario || '').slice(0, 200);
    const ans = String(p.answer || '').slice(0, 1000);
    const fb = String(p.feedback || '').slice(0, 400);
    const when = p.at ? p.at.slice(0, 10) : '';
    return `【近期第 ${i + 1} 次 · ${when}】\n当时题目：${scene}\n作答：${ans}\n当时点评摘要：${fb}`;
  });
  return '\n\n---\n以往在本模块的作答记录（题目可能不同，供对比思维是否越答越好）：\n' + blocks.join('\n\n');
}
