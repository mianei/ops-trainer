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

export function verifyUserCredentials(userIdRaw, codeRaw) {
  const users = parseAccessUsers();
  if (users.size === 0) {
    return { ok: false, error: '服务端未配置 ACCESS_USERS 或 ACCESS_CODE', status: 500 };
  }
  const code = String(codeRaw || '').trim();
  if (!code) {
    return { ok: false, error: '缺少访问码', status: 401 };
  }

  let userId = String(userIdRaw || '').trim();
  if (!userId) {
    if (users.has('default')) userId = 'default';
    else return { ok: false, error: '请输入账号', status: 401 };
  }

  const entry = users.get(userId.toLowerCase());
  if (!entry || entry.pass !== code) {
    return { ok: false, error: '账号或访问码无效', status: 401 };
  }
  return { ok: true, userId: entry.id };
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

export function priorSameScenario(attempts, scenario, limit = 3) {
  if (!scenario) return [];
  return attempts.filter((a) => a.scenario === scenario).slice(-limit);
}

export async function saveAttempt(userId, topicId, record) {
  if (!historyEnabled() || !userId || !topicId) return false;
  const list = await loadTopicAttempts(userId, topicId);
  list.push({
    scenario: record.scenario,
    answer: record.answer,
    feedback: record.feedback,
    at: record.at || new Date().toISOString()
  });
  const trimmed = list.slice(-MAX_ATTEMPTS_PER_TOPIC);
  const ok = await upstashCall(['SET', historyKey(userId, topicId), JSON.stringify(trimmed)]);
  return ok === 'OK';
}

export const HISTORY_PROMPT_SUFFIX =
  '\n\n若用户消息中包含「以往同题作答」，请在常规点评之后增加一小节「与上次相比」（约 80–120 字）：' +
  '对比结构、洞察深度、可执行性上的变化；肯定进步、指出仍可加强处。不要打分、不要排名、不要用数字评级。' +
  '若没有以往作答或场景不同，则不要写该小节。';

export function formatPriorForPrompt(prior) {
  if (!prior.length) return '';
  const blocks = prior.map((p, i) => {
    const ans = String(p.answer || '').slice(0, 1200);
    const fb = String(p.feedback || '').slice(0, 600);
    const when = p.at ? p.at.slice(0, 10) : '';
    return `【第 ${i + 1} 次 · ${when}】\n作答：${ans}\n当时点评摘要：${fb}`;
  });
  return '\n\n---\n以往同题作答（供对比，勿大段复述）：\n' + blocks.join('\n\n');
}
