// api/plan.js
// 「目标 → 自主编排」前门：把一句话学习目标，路由成一份定制练习卷。
//
// 设计原则：LLM 只负责「听懂目标 → 输出结构化筛选条件」，
// 真正的选题由下面的 JS 从你已有的题库里挑。AI 不造题，
// 内容源始终是你写死的 topics/scenarios，既便宜又零幻觉题。
//
// 依赖：与现有 /api/chat 一致——DEEPSEEK_API_KEY、（可选）Upstash Redis。
// 部署后前端 POST /api/plan { username, goal } 即可。

const fs = require('fs');
const path = require('path');

// ── 1. 题库加载 ────────────────────────────────────────────────
// ⚠️ 按你仓库实际的题库文件名调整这个列表。
//    README 里提到 topics.json 及配套 scenarios-*.json。
const QUESTION_FILES = [
  'topics.json',
  'scenarios-extra.json',
  'scenarios-industry-ota.json',
  'scenarios-industry-ecommerce.json',
  'scenarios-industry-community.json',
  'scenarios-industry-instant-retail.json',
  'scenarios-platform-content.json',
  'scenarios-interview-pm.json',
  'scenarios-interview-ops.json',
  'scenarios-interview-biz.json',
  'scenarios-interview-skills.json',
  'scenarios-interview-open.json',
  'scenarios-interview-misc.json',
];

// 把一个题库文件里的题目数组抽出来（兼容几种常见结构）
function extractItems(raw) {
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.questions)) return raw.questions;
  if (Array.isArray(raw.scenarios)) return raw.scenarios;
  if (Array.isArray(raw.items)) return raw.items;
  // 形如 { "OTA": [...], "电商": [...] } 的分组结构
  return Object.values(raw).filter(Array.isArray).flat();
}

// ⚠️ 按你题目对象的真实字段名调整这三行（见 topics.json）。
function normalize(q) {
  return {
    id: q.id ?? q.qid ?? q.key ?? q.title,
    module: q.module ?? q.category ?? q.section ?? '未分类',
    title: q.title ?? q.question ?? q.prompt ?? q.scenario ?? '',
    tags: q.tags ?? q.labels ?? (q.scenario ? [q.scenario] : []),
  };
}

let _bank = null; // 进程内缓存，避免每次冷读盘
function loadBank() {
  if (_bank) return _bank;
  const root = process.cwd();
  const all = [];
  for (const f of QUESTION_FILES) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
      for (const it of extractItems(raw)) {
        const n = normalize(it);
        if (n.id && n.title) all.push({ ...n, _raw: it });
      }
    } catch (_) { /* 文件不存在就跳过 */ }
  }
  _bank = all;
  return all;
}

// 给 LLM 看的「能选什么」目录：去重后的 模块 + 标签
function buildCatalog(bank) {
  const modules = [...new Set(bank.map(q => q.module))];
  const tags = [...new Set(bank.flatMap(q => q.tags))].slice(0, 120);
  return { modules, tags };
}

// ── 2. 取用户薄弱画像（best-effort，没配 Redis 就跳过）──────────
async function getWeakProfile(username) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !username) return null;
  try {
    // ⚠️ 这里的 key 要对上你 /api/chat 存历史时用的格式（README 说是「用户名+模块」）。
    //    下面用通配扫描兜底；若你有固定 key，直接 GET 更省。
    const scan = await fetch(`${url}/keys/ans:${encodeURIComponent(username)}:*`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).catch(() => null);
    const keys = scan?.result || [];
    if (!keys.length) return null;
    // 这里只做一个轻量信号：按模块统计历史作答条数，越多说明练得越多
    // （真正的对错/评分若你 Redis 里有，按同样方式聚合即可）
    const counts = {};
    for (const k of keys) {
      const mod = k.split(':')[2] || '';
      counts[mod] = (counts[mod] || 0) + 1;
    }
    return counts; // { '运营·OTA': 5, ... }
  } catch (_) {
    return null;
  }
}

// ── 3. LLM 路由：目标 → 结构化筛选条件 ─────────────────────────
async function routeGoal(goal, catalog, weak) {
  const sys = `你是产运训练系统的编排器。用户给出一句学习目标，你要把它映射到题库里【已存在】的模块和标签上，并输出一份训练计划。
只能从下面的候选里选，不要发明新模块或新标签。
可选模块：${JSON.stringify(catalog.modules)}
可选标签：${JSON.stringify(catalog.tags)}
${weak ? `用户历史练习分布（数字越小=越薄弱，应优先）：${JSON.stringify(weak)}` : ''}
严格只输出 JSON，结构：
{"focus":"一句话学习重点","module":"选中的主模块","tags":["命中的标签..."],"count":本次出题数量(5-10)}`;

  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: goal },
      ],
    }),
  });
  const data = await res.json();
  const txt = data?.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(txt);
  } catch (_) {
    return { focus: goal, module: catalog.modules[0], tags: [], count: 6 };
  }
}

// ── 4. 选题：按筛选条件 + 薄弱优先，从题库里挑 ─────────────────
function selectQuestions(bank, plan, weak) {
  const wantTags = new Set(plan.tags || []);
  const count = Math.min(Math.max(plan.count || 6, 3), 12);

  const scored = bank
    .filter(q => !plan.module || q.module === plan.module || q.tags.some(t => wantTags.has(t)))
    .map(q => {
      let score = 0;
      const hit = q.tags.filter(t => wantTags.has(t)).length;
      score += hit * 10;                                   // 标签命中越多越靠前
      if (weak && weak[q.module] != null) score += (10 - Math.min(weak[q.module], 10)); // 越薄弱加分
      score += Math.random() * 2;                          // 同分打散，避免每次同一批
      return { q, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(s => s.q);

  return scored;
}

// ── 5. HTTP handler ───────────────────────────────────────────
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST only' });
    return;
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { username, goal } = body;
    if (!goal || !goal.trim()) {
      res.status(400).json({ error: '缺少 goal' });
      return;
    }

    const bank = loadBank();
    if (!bank.length) {
      res.status(500).json({ error: '题库为空，请检查 QUESTION_FILES 列表与字段映射' });
      return;
    }

    const catalog = buildCatalog(bank);
    const weak = await getWeakProfile(username);
    const plan = await routeGoal(goal.trim(), catalog, weak);
    const questions = selectQuestions(bank, plan, weak);

    res.status(200).json({
      plan: { goal: goal.trim(), focus: plan.focus, module: plan.module, tags: plan.tags },
      questions: questions.map(q => ({ id: q.id, module: q.module, title: q.title, tags: q.tags })),
      // 复用你现有的「作答前推荐阅读」：把命中的标签传回前端，让它走原有的知识卡推荐逻辑
      readingTags: plan.tags,
    });
  } catch (e) {
    res.status(500).json({ error: String(e?.message || e) });
  }
};
