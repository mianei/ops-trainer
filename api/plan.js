export const config = { runtime: 'edge' };

import {
  json,
  getHeader,
  readJsonBody,
  verifyUserCredentials,
  historyEnabled,
  loadTopicAttempts
} from '../lib/store.js';
import {
  searchInterviewPosts,
  keywordsFromSearchResults
} from '../lib/interview-search.js';
import {
  generateScenarios,
  injectGeneratedSteps,
  getLlmConfig
} from '../lib/scenario-generate.js';
import { buildChunksFromSearchResults, loadInterviewRagFeed, filterFeedChunksByIntent } from '../lib/rag.js';

function interviewSearchEnabled() {
  if (process.env.INTERVIEW_SEARCH_ENABLED === '0') return false;
  if (process.env.INTERVIEW_SEARCH_ENABLED === '1') return true;
  return Boolean(process.env.SERPER_API_KEY?.trim());
}

const PLAN_SYSTEM = `你是 MindTraining 训练智能体的规划模块。用户可能是：
1) 技能补强（如 OTA 产品、SQL 数据分析）；
2) 面试备战（如「明天面字节产品经理」）——需按岗位从 catalog 检索最相关的面经模块与知识卡，优先行为面+岗位专业课。

根据用户目标、解析出的面试意图（若有）、历史薄弱模块、训练 catalog 与知识卡 catalog，制定完整学习任务流。

只返回 JSON：
- focus: string，一句话重点（如「明日字节产品经理面试：行为面+产品题」）
- topicIds: string[]，从 catalog 选 4-10 个模块 id；面试场景务必包含 iv-exp/iv-self 等行为面模块 + 岗位相关模块
- keywords: string[]，1-6 个中文关键词，筛选练习题（面经、STAR、岗位词、行业词）
- cardIds: string[]，从 cardCatalog 选 2-6 张知识卡 id
- count: number，练习数量；明日/紧急面试建议 6-8，技能补强 4-6
- steps: object[]，可选；每项 { "type":"read","cardId" } 或 { "type":"practice","topicId","keywords":[] }

紧急面试（明天面）应少读多练：开头 1-2 张必读卡，随后连续练习题。`;

async function callDeepSeekPlan(cfg, userContent) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PLAN_SYSTEM },
        { role: 'user', content: userContent }
      ]
    })
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data?.error || data);
    throw new Error('DeepSeek API：' + msg);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('DeepSeek 返回为空');
  return JSON.parse(text);
}

async function callAnthropicPlan(cfg, userContent) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 900,
      system: PLAN_SYSTEM,
      messages: [{ role: 'user', content: userContent + '\n\n只输出 JSON。' }]
    })
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data?.error || data);
    throw new Error('Anthropic API：' + msg);
  }
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Anthropic 返回为空');
  return JSON.parse(text.replace(/^```json?\s*|\s*```$/g, '').trim());
}

const ROLE_RULES = [
  { re: /产品经理|产品\s*pm\b|product\s*manager/i, key: 'pm', label: '产品经理' },
  { re: /产品运营|产运|pmo/i, key: 'pm_ops', label: '产品/运营' },
  { re: /用户运营|内容运营|社群运营|活动运营|新媒体运营/i, key: 'ops', label: '运营' },
  { re: /数据分析师|数据分析|数据运营|数分|数据pm/i, key: 'data', label: '数据分析' },
  { re: /策略产品|策略运营|战略|商业分析|咨询/i, key: 'strategy', label: '策略/商业' },
  { re: /商业化|广告产品|变现|bd\b|销售运营/i, key: 'monetize', label: '商业化' },
  { re: /增长产品|增长运营|growth/i, key: 'growth', label: '增长' },
  { re: /算法工程师|算法|推荐系统|机器学习|ml\b/i, key: 'algo', label: '算法/推荐' },
  { re: /交互设计|ux|ui|体验设计|设计师/i, key: 'design', label: '交互/设计' },
  { re: /后端|前端|研发|开发工程师|程序员|技术/i, key: 'eng', label: '技术' },
  { re: /管培|hr|人事|行政|综合/i, key: 'general', label: '通用岗位' },
  { re: /运营(?!产品)/i, key: 'ops', label: '运营' }
];

const ROLE_PROFILES = {
  pm: {
    topicIds: ['iv-exp', 'iv-self', 'iv-career', 'iv-pm', 'prod-open', 'user', 'feature', 'interaction'],
    keywords: ['面经', '产品', '需求', 'STAR'],
    cardIds: ['starr-framework', 'prep-framework', 'circles-framework', 'true-demand-three', 'self-intro-four']
  },
  pm_ops: {
    topicIds: ['iv-exp', 'iv-self', 'iv-pm', 'iv-ops', 'user', 'growth', 'data', 'decision'],
    keywords: ['面经', '产品', '运营'],
    cardIds: ['starr-framework', 'guide-resume-ops-story', 'problem-hypothesis-metric', 'activity-review-loop']
  },
  ops: {
    topicIds: ['iv-exp', 'iv-self', 'iv-career', 'iv-ops', 'growth', 'retention', 'content', 'data'],
    keywords: ['面经', '运营', 'STAR'],
    cardIds: ['starr-framework', 'prep-framework', 'guide-resume-ops-story', 'activity-review-loop', 'aarrr']
  },
  data: {
    topicIds: ['iv-exp', 'iv-self', 'iv-skills', 'data', 'growth', 'retention'],
    keywords: ['面经', '数据', 'SQL', '指标'],
    cardIds: ['starr-framework', 'sql-select-where', 'guide-data-four-questions', 'metric-selection-chain', 'fermi-estimation']
  },
  strategy: {
    topicIds: ['iv-exp', 'iv-self', 'iv-skills', 'biz-platform', 'competitor', 'decision', 'biz-monetize'],
    keywords: ['面经', '策略', '竞品', 'STAR'],
    cardIds: ['starr-framework', 'competitor-four-layers', 'gmv-decomposition', 'goal-path-resource-risk']
  },
  monetize: {
    topicIds: ['iv-exp', 'iv-self', 'iv-ops', 'biz-monetize', 'biz-platform', 'growth'],
    keywords: ['面经', '商业化', '变现'],
    cardIds: ['starr-framework', 'arpu-ltv-dau', 'super-app-logic', 'north-star-guardrails']
  },
  growth: {
    topicIds: ['iv-exp', 'iv-self', 'iv-ops', 'growth', 'retention', 'data'],
    keywords: ['面经', '增长', '留存'],
    cardIds: ['starr-framework', 'aarrr', 'guide-aarrr-leaks', 'metric-selection-chain']
  },
  algo: {
    topicIds: ['iv-exp', 'iv-self', 'iv-skills', 'iv-misc', 'data'],
    keywords: ['面经', '估算', '推荐'],
    cardIds: ['starr-framework', 'fermi-estimation', 'written-exam-five-types', 'prep-framework']
  },
  design: {
    topicIds: ['iv-exp', 'iv-self', 'iv-pm', 'interaction', 'feature', 'prod-open'],
    keywords: ['面经', '交互', '设计'],
    cardIds: ['starr-framework', 'ia-four', 'fitts-law', 'circles-framework']
  },
  eng: {
    topicIds: ['iv-exp', 'iv-self', 'iv-skills', 'iv-misc', 'iv-open'],
    keywords: ['面经', '项目', 'STAR'],
    cardIds: ['starr-framework', 'prep-framework', 'star-full', 'quantify-resume']
  },
  general: {
    topicIds: ['iv-exp', 'iv-self', 'iv-career', 'iv-misc'],
    keywords: ['面经', 'STAR', '自我介绍'],
    cardIds: ['starr-framework', 'prep-framework', 'self-intro-four', 'career-stages']
  }
};

const COMPANY_HINTS = [
  { re: /字节|抖音|tiktok|头条|飞书/i, name: '字节跳动', kw: ['推荐', 'feed', '内容'] },
  { re: /美团|大众点评/i, name: '美团', kw: ['本地生活', 'OTA', '外卖'] },
  { re: /腾讯|微信|qq/i, name: '腾讯', kw: ['社交', '微信'] },
  { re: /阿里|淘宝|天猫|支付宝|蚂蚁/i, name: '阿里', kw: ['电商', '交易'] },
  { re: /拼多多|pdd/i, name: '拼多多', kw: ['电商', '增长', '下沉'] },
  { re: /滴滴/i, name: '滴滴', kw: ['出行', '地图'] },
  { re: /小红书/i, name: '小红书', kw: ['社区', '内容'] },
  { re: /快手/i, name: '快手', kw: ['直播', '社区'] },
  { re: /百度/i, name: '百度', kw: ['搜索', 'AI'] },
  { re: /京东/i, name: '京东', kw: ['电商', '供应链'] },
  { re: /网易/i, name: '网易', kw: ['游戏', '内容'] },
  { re: /b站|哔哩/i, name: 'B站', kw: ['社区', '内容'] }
];

const BEHAVIOR_MODULES = ['iv-exp', 'iv-self', 'iv-career'];

function parseGoalIntent(goal) {
  const text = String(goal || '');
  const interview = /面(?:试|谈|经)|明[天日]|后[天日]|今晚|笔试|终面|hr面|群面|压力面|mock|备战/i.test(text);
  const urgent = /明[天日]|后[天日]|今晚|来不及|冲刺|紧急|快面/i.test(text);

  let roleKey = null;
  let roleLabel = null;
  for (const r of ROLE_RULES) {
    if (r.re.test(text)) {
      roleKey = r.key;
      roleLabel = r.label;
      break;
    }
  }

  let company = null;
  const companyKeywords = [];
  for (const c of COMPANY_HINTS) {
    if (c.re.test(text)) {
      company = c.name;
      companyKeywords.push(...c.kw);
      break;
    }
  }

  const mode = interview || roleKey ? 'interview' : 'skill';
  return { mode, roleKey, roleLabel, company, urgent, companyKeywords };
}

function mergeUnique(arr, extra) {
  const out = [...(arr || [])];
  for (const x of extra || []) {
    if (x && !out.includes(x)) out.push(x);
  }
  return out;
}

function applyIntentToPlan(plan, intent, goal, catalog) {
  const valid = new Set(catalog.map(c => c.id));
  const cardSet = new Set((plan.cardIds || []).map(String));

  if (intent.mode === 'interview' && intent.roleKey && ROLE_PROFILES[intent.roleKey]) {
    const prof = ROLE_PROFILES[intent.roleKey];
    plan.topicIds = mergeUnique(
      mergeUnique(prof.topicIds, plan.topicIds),
      []
    ).filter(id => valid.has(id));
    plan.keywords = mergeUnique(prof.keywords, plan.keywords).slice(0, 8);
    plan.cardIds = mergeUnique(prof.cardIds, plan.cardIds).slice(0, 8);
    if (intent.mode === 'interview') {
      plan.topicIds = mergeUnique(BEHAVIOR_MODULES, plan.topicIds).filter(id => valid.has(id));
    }
  }

  if (intent.companyKeywords?.length) {
    plan.keywords = mergeUnique(plan.keywords, intent.companyKeywords).slice(0, 8);
  }

  if (intent.urgent) {
    plan.count = Math.max(Number(plan.count) || 5, 6);
  } else if (intent.mode === 'interview') {
    plan.count = Math.max(Number(plan.count) || 5, 5);
  }

  if (intent.mode === 'interview' && (intent.roleLabel || intent.company)) {
    const prefix = intent.urgent ? '明日' : '备战';
    const who = [intent.company, intent.roleLabel].filter(Boolean).join(' ');
    plan.focus = `${prefix}${who}面试：行为面+岗位题`.slice(0, 48);
  } else if (!plan.focus) {
    plan.focus = goal.slice(0, 24);
  }

  plan.intent = {
    mode: intent.mode,
    roleLabel: intent.roleLabel || null,
    roleKey: intent.roleKey || null,
    company: intent.company || null,
    urgent: intent.urgent
  };
  return plan;
}

const GOAL_HINTS = [
  { re: /ota|酒店|机票|旅行|出行|地图|本地生活/i, ids: ['biz-platform', 'map-ride', 'map-local', 'biz-vertical'], kw: ['OTA', '酒店', '出行'], cards: ['ota-hotel-modes', 'ota-cross-sell', 'ota-oligopoly'] },
  { re: /sql|数据|指标|分析|漏斗|留存/i, ids: ['data', 'growth', 'retention'], kw: ['数据', 'SQL'], cards: ['sql-select-where', 'guide-data-four-questions', 'metric-selection-chain'] },
  { re: /产品|需求|功能|交互|设计/i, ids: ['user', 'feature', 'interaction', 'prod-open'], kw: ['产品'], cards: ['true-demand-three', 'problem-hypothesis-metric', 'circles-framework'] },
  { re: /面试|star|经历|自我介绍/i, ids: ['iv-exp', 'iv-self', 'iv-pm', 'iv-ops'], kw: ['面试', 'STAR'], cards: ['starr-framework', 'prep-framework', 'guide-resume-ops-story'] },
  { re: /运营|活动|增长|内容|社群/i, ids: ['growth', 'content', 'crisis', 'competitor'], kw: ['运营'], cards: ['ops-plan-5w1h', 'activity-review-loop', 'aarrr'] },
  { re: /商业|变现|平台|行业/i, ids: ['biz-platform', 'biz-monetize', 'biz-vertical'], kw: ['商业'], cards: ['super-app-logic', 'gmv-decomposition', 'arpu-ltv-dau'] }
];

function pickCardForTopic(topicId, keywords, cardCatalog, usedCards) {
  const kw = (keywords || []).map(k => String(k).toLowerCase());
  const scored = [];
  for (const c of cardCatalog) {
    if (usedCards.has(c.id)) continue;
    const hay = `${c.title} ${(c.tags || []).join(' ')} ${c.sectionTitle || ''}`.toLowerCase();
    let score = 0;
    if (Array.isArray(c.tags) && c.tags.some(t => t === topicId)) score += 4;
    for (const k of kw) {
      if (k.length >= 2 && hay.includes(k)) score += 3;
    }
    if (hay.includes(topicId.replace(/-/g, ' '))) score += 1;
    if (score > 0) scored.push({ c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.c || null;
}

function buildStepsFromPlan(plan, cardCatalog, intent) {
  const validTopics = new Set((plan.topicIds || []));
  const cardMap = new Map(cardCatalog.map(c => [c.id, c]));
  const usedCards = new Set();
  const steps = [];
  const maxP = Math.max(1, Math.min(Number(plan.count) || 5, 10));
  const urgentInterview = intent?.mode === 'interview' && intent?.urgent;

  for (const cid of (plan.cardIds || []).slice(0, urgentInterview ? 2 : 6)) {
    const c = cardMap.get(cid);
    if (c && !usedCards.has(c.id)) {
      steps.push({ type: 'read', cardId: c.id, title: c.title });
      usedCards.add(c.id);
    }
  }

  let practiceN = 0;
  for (const topicId of plan.topicIds || []) {
    if (practiceN >= maxP) break;
    if (!validTopics.has(topicId)) continue;
    if (!urgentInterview) {
      const card = pickCardForTopic(topicId, plan.keywords, cardCatalog, usedCards);
      if (card) {
        steps.push({ type: 'read', cardId: card.id, title: card.title });
        usedCards.add(card.id);
      }
    }
    steps.push({ type: 'practice', topicId, keywords: plan.keywords || [] });
    practiceN++;
  }
  return steps;
}

function normalizeSteps(rawSteps, cardCatalog, catalog) {
  const validTopics = new Set(catalog.map(c => c.id));
  const cardMap = new Map(cardCatalog.map(c => [c.id, c]));
  const out = [];
  for (const s of rawSteps || []) {
    if (!s || !s.type) continue;
    if (s.type === 'read' && s.cardId && cardMap.has(s.cardId)) {
      const c = cardMap.get(s.cardId);
      out.push({ type: 'read', cardId: c.id, title: c.title || s.title || c.id });
    } else if (s.type === 'practice' && s.topicId && validTopics.has(s.topicId)) {
      out.push({
        type: 'practice',
        topicId: s.topicId,
        keywords: Array.isArray(s.keywords) ? s.keywords.filter(Boolean) : []
      });
    }
  }
  return out;
}

function heuristicPlan(goal, catalog, cardCatalog, historySummary, intent) {
  const ids = new Set();
  const keywords = [];
  const cardIds = [];
  const weak = historySummary?.weakTopicIds || [];

  if (intent?.roleKey && ROLE_PROFILES[intent.roleKey]) {
    const prof = ROLE_PROFILES[intent.roleKey];
    prof.topicIds.forEach(id => ids.add(id));
    prof.keywords?.forEach(k => keywords.push(k));
    prof.cardIds?.forEach(id => cardIds.push(id));
    if (intent.mode === 'interview') BEHAVIOR_MODULES.forEach(id => ids.add(id));
    if (intent.companyKeywords?.length) keywords.push(...intent.companyKeywords);
  }

  for (const hint of GOAL_HINTS) {
    if (hint.re.test(goal)) {
      hint.ids.forEach(id => ids.add(id));
      hint.kw.forEach(k => keywords.push(k));
      hint.cards.forEach(id => cardIds.push(id));
    }
  }
  const goalLower = goal.toLowerCase();
  for (const item of catalog) {
    const hay = `${item.label} ${item.catLabel || ''} ${item.id}`.toLowerCase();
    if (goalLower.split(/\s+/).some(tok => tok.length >= 2 && hay.includes(tok))) ids.add(item.id);
  }
  weak.forEach(id => ids.add(id));

  const valid = new Set(catalog.map(c => c.id));
  let topicIds = [...ids].filter(id => valid.has(id));
  if (!topicIds.length) topicIds = catalog.slice(0, 6).map(c => c.id);

  const cardSet = new Set(cardCatalog.map(c => c.id));
  const pickedCards = cardIds.filter(id => cardSet.has(id)).slice(0, 6);

  let count = intent?.urgent ? 7 : intent?.mode === 'interview' ? 6 : 5;
  const plan = {
    focus: goal.slice(0, 24),
    topicIds,
    keywords: keywords.length ? [...new Set(keywords)].slice(0, 8) : goal.split(/\s+/).filter(Boolean).slice(0, 3),
    cardIds: pickedCards,
    count
  };
  plan.steps = buildStepsFromPlan(plan, cardCatalog, intent);
  return applyIntentToPlan(plan, intent, goal, catalog);
}

function normalizePlan(raw, goal, catalog, cardCatalog, historySummary, intent) {
  const valid = new Set(catalog.map(c => c.id));
  const topicIds = (Array.isArray(raw?.topicIds) ? raw.topicIds : []).filter(id => valid.has(id));
  const keywords = (Array.isArray(raw?.keywords) ? raw.keywords : [])
    .map(k => String(k).trim())
    .filter(Boolean)
    .slice(0, 8);
  const cardSet = new Set(cardCatalog.map(c => c.id));
  const cardIds = (Array.isArray(raw?.cardIds) ? raw.cardIds : []).filter(id => cardSet.has(id));
  const count = Math.max(3, Math.min(Number(raw?.count) || 5, 10));
  const focus = String(raw?.focus || goal).trim().slice(0, 80);

  if (!topicIds.length) return heuristicPlan(goal, catalog, cardCatalog, historySummary, intent);

  const base = { focus, topicIds, keywords, cardIds, count };
  let steps = normalizeSteps(raw?.steps, cardCatalog, catalog);
  if (!steps.length) steps = buildStepsFromPlan(base, cardCatalog, intent);
  if (!steps.length) return heuristicPlan(goal, catalog, cardCatalog, historySummary, intent);
  return applyIntentToPlan({ ...base, steps }, intent, goal, catalog);
}

async function buildHistorySummary(userId, topicIds) {
  if (!historyEnabled() || !userId) {
    return { enabled: false, weakTopicIds: [], modules: [] };
  }
  const modules = [];
  const weakTopicIds = [];
  for (const topicId of topicIds.slice(0, 40)) {
    const attempts = await loadTopicAttempts(userId, topicId);
    if (!attempts.length) continue;
    const scored = attempts.filter(a => a.rubricAvg != null);
    const avgScore = scored.length
      ? Math.round((scored.reduce((s, a) => s + a.rubricAvg, 0) / scored.length) * 10) / 10
      : null;
    modules.push({ topicId, count: attempts.length, avgScore });
    if (avgScore != null && avgScore < 3.5) weakTopicIds.push(topicId);
  }
  modules.sort((a, b) => (a.avgScore ?? 99) - (b.avgScore ?? 99));
  return { enabled: true, weakTopicIds, modules };
}

const EXTRACT_SCENARIO_SYSTEM = `你是面经整理助手。根据检索到的面经摘要，提炼 1-2 道可独立作答的面试题。
每题格式：以【外部面经·公司或行业·题型】开头，正文 80-200 字，含背景与明确问题。
只返回 JSON：{ "scenarios": [{ "topicId": "模块id", "text": "完整题干" }] }
topicId 优先 iv-pm/iv-ops/iv-exp/iv-skills/prod-open 等与岗位最匹配的 catalog id。`;

async function extractScenariosFromSearch(cfg, posts, roleKey, catalog) {
  const validIds = new Set(catalog.map(c => c.id));
  const defaultTopic = roleKey === 'ops' ? 'iv-ops' : roleKey === 'data' ? 'iv-skills' : 'iv-pm';
  const snippets = (posts || [])
    .filter(p => p.snippet && !p.external)
    .slice(0, 5)
    .map(p => `- [${p.sourceLabel || p.source}] ${p.title}\n  ${p.snippet}`)
    .join('\n');
  if (!snippets || cfg.provider !== 'deepseek') return [];

  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model: cfg.model,
        max_tokens: 800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: EXTRACT_SCENARIO_SYSTEM },
          { role: 'user', content: `面经摘要：\n${snippets}\n\n请提炼 scenarios。` }
        ]
      })
    });
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return [];
    const parsed = JSON.parse(text);
    return (parsed.scenarios || [])
      .filter(s => s?.text && String(s.text).length > 40)
      .slice(0, 2)
      .map(s => ({
        topicId: validIds.has(s.topicId) ? s.topicId : defaultTopic,
        text: String(s.text).trim().slice(0, 800)
      }));
  } catch {
    return [];
  }
}

function injectExternalSteps(plan, externalScenarios) {
  if (!externalScenarios?.length || !Array.isArray(plan.steps)) return plan;
  const insertAt = plan.steps.findIndex(s => s.type === 'practice');
  const idx = insertAt >= 0 ? insertAt : plan.steps.length;
  const extra = externalScenarios.map(s => ({
    type: 'practice',
    topicId: s.topicId,
    scenario: s.text,
    keywords: [],
    external: true,
    fromSearch: true
  }));
  plan.steps.splice(idx, 0, ...extra);
  return plan;
}

async function enrichPlanWithExternalSearch(plan, intent, goal, catalog, cfg) {
  if (intent.mode !== 'interview') return plan;

  if (!interviewSearchEnabled()) {
    plan.externalSearch = {
      enabled: false,
      skipped: true,
      message: '配置 SERPER_API_KEY 后可自动检索；也可编辑 interview-rag-feed.json 手动投喂优质面经'
    };
    plan.ragChunks = [];
    plan.ragSession = { count: 0 };
    return plan;
  }

  const search = await searchInterviewPosts({
    goal,
    company: intent.company || undefined,
    roleLabel: intent.roleLabel || undefined,
    sources: ['nowcoder', 'xiaohongshu', 'zhihu'],
    limit: 8
  });

  plan.externalSearch = {
    enabled: search.enabled,
    query: search.query,
    message: search.message,
    results: (search.results || []).slice(0, 10)
  };

  const extKw = keywordsFromSearchResults(search.results);
  if (extKw.length) {
    plan.keywords = mergeUnique(plan.keywords, extKw).slice(0, 10);
    for (const step of plan.steps || []) {
      if (step.type === 'practice') {
        step.keywords = mergeUnique(step.keywords, extKw).slice(0, 8);
      }
    }
  }

  const realPosts = (search.results || []).filter(r => !r.external);
  plan.ragChunks = buildChunksFromSearchResults(realPosts);
  plan.ragSession = {
    count: plan.ragChunks.length,
    query: search.query,
    sources: [...new Set(plan.ragChunks.map(c => c.sourceLabel).filter(Boolean))]
  };

  if (cfg && realPosts.length >= 2) {
    const extracted = await extractScenariosFromSearch(cfg, realPosts, intent.roleKey, catalog);
    if (extracted.length) {
      plan.externalScenarios = extracted;
      injectExternalSteps(plan, extracted);
    }
  }

  return plan;
}

async function enrichPlanWithInterviewFeed(plan, intent, goal, origin) {
  const feedAll = await loadInterviewRagFeed(origin);
  const feedChunks = filterFeedChunksByIntent(feedAll, intent, goal);
  const searchChunks = plan.ragChunks || [];
  const seen = new Set();
  /** @type {import('./lib/rag.js').RagChunk[]} */
  const merged = [];
  for (const c of [...feedChunks, ...searchChunks]) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push(c);
  }
  plan.ragChunks = merged;
  plan.ragSession = {
    count: merged.length,
    feedCount: feedChunks.length,
    searchCount: searchChunks.length,
    query: plan.ragSession?.query || null,
    sources: [...new Set(merged.map((c) => c.sourceLabel).filter(Boolean))]
  };
  if (feedChunks.length) {
    plan.ragFeed = { enabled: true, count: feedChunks.length, message: '已加载人工投喂面经' };
  }
  return plan;
}

async function enrichPlanWithLlmDemo(plan, intent, goal, catalog, historySummary, cfg) {
  if (process.env.LLM_SCENARIO_DEMO === '0') {
    plan.llmGenerate = { enabled: false, demo: true, message: 'LLM 出题 Demo 已关闭' };
    return plan;
  }

  const interview = intent?.mode === 'interview';
  const count = interview ? (intent?.urgent ? 3 : 2) : 1;
  if (!interview && process.env.LLM_SCENARIO_SKILL !== '1') {
    plan.llmGenerate = { enabled: false, demo: true, message: '非面试目标默认不出 LLM 题（可设 LLM_SCENARIO_SKILL=1）' };
    return plan;
  }

  const gen = await generateScenarios({
    goal,
    intent,
    catalog,
    historySummary,
    count,
    cfg,
    ragChunks: plan.ragChunks || []
  });

  plan.llmGenerate = {
    enabled: gen.ok,
    demo: !gen.grounded,
    grounded: !!gen.grounded,
    count: gen.scenarios?.length || 0,
    message: gen.message || (gen.grounded
      ? '已依据检索面经 RAG 生成题目'
      : gen.ok
        ? 'Demo：以下题目由 AI 根据目标生成（未命中检索 RAG）'
        : null)
  };

  if (gen.ok && gen.scenarios.length) {
    plan.generatedScenarios = gen.scenarios;
    injectGeneratedSteps(plan, gen.scenarios, { grounded: gen.grounded });
  }

  return plan;
}

function buildPlannerUserContent(goal, catalog, cardCatalog, historySummary, intent) {
  const catalogText = catalog
    .slice(0, 80)
    .map(c => `- ${c.id}: ${c.label} (${c.catLabel || c.cat || ''})`)
    .join('\n');
  const cardText = cardCatalog
    .slice(0, 120)
    .map(c => `- ${c.id}: ${c.title}`)
    .join('\n');
  const histText = historySummary.enabled
    ? `历史薄弱模块（avg<3.5，请优先安排）：${historySummary.weakTopicIds.join(', ') || '无'}\n` +
      `各模块得分：${historySummary.modules.map(m => `${m.topicId}:${m.avgScore ?? '?'}/5×${m.count}`).join('; ') || '暂无记录'}`
    : '暂无历史作答记录';
  const intentText = intent
    ? `解析意图：mode=${intent.mode}${intent.roleLabel ? `，岗位=${intent.roleLabel}` : ''}${intent.company ? `，公司=${intent.company}` : ''}${intent.urgent ? '，紧急（明日面试，少读多练）' : ''}`
    : '';
  return `用户目标：${goal}\n${intentText}\n\n${histText}\n\ncatalog:\n${catalogText}\n\ncardCatalog:\n${cardText}\n\n请输出 JSON 计划。`;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const body = (await readJsonBody(req)) || {};
  const userId = getHeader(req, 'x-user-id') || body.userId || '';
  const code = getHeader(req, 'x-access-code') || body.accessCode || '';

  const auth = await verifyUserCredentials(userId, code);
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }

  const goal = String(body.goal || '').trim();
  const catalog = Array.isArray(body.catalog) ? body.catalog : [];
  const cardCatalog = Array.isArray(body.cardCatalog) ? body.cardCatalog : [];
  if (!goal) return json({ error: '请提供学习目标 goal' }, 400);
  if (!catalog.length) return json({ error: '请提供 catalog' }, 400);

  const topicIdsForHistory = catalog.map(c => c.id);
  const historySummary = await buildHistorySummary(auth.userId, topicIdsForHistory);
  const intent = parseGoalIntent(goal);

  const cfg = getLlmConfig();
  let plan;
  if (cfg) {
    try {
      const userContent = buildPlannerUserContent(goal, catalog, cardCatalog, historySummary, intent);
      const raw =
        cfg.provider === 'anthropic'
          ? await callAnthropicPlan(cfg, userContent)
          : await callDeepSeekPlan(cfg, userContent);
      plan = normalizePlan(raw, goal, catalog, cardCatalog, historySummary, intent);
    } catch {
      plan = heuristicPlan(goal, catalog, cardCatalog, historySummary, intent);
    }
  } else {
    plan = heuristicPlan(goal, catalog, cardCatalog, historySummary, intent);
  }

  plan = await enrichPlanWithExternalSearch(plan, intent, goal, catalog, cfg);
  plan = await enrichPlanWithInterviewFeed(plan, intent, goal, new URL(req.url).origin);
  plan = await enrichPlanWithLlmDemo(plan, intent, goal, catalog, historySummary, cfg);

  return json({
    ...plan,
    historyUsed: historySummary.enabled,
    weakTopicIds: historySummary.weakTopicIds
  });
}
