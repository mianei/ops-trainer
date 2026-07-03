/**
 * 从 v1.0 场景库 + AI PM 面经构建业务场景题库（350 道）
 * 固定配比：200 道 AI产品经理 + 150 道传统产品业务面
 * 运行: node scripts/build-interview-bank-v2.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TARGET = 350;
const AI_TARGET = 200;
const TRADITIONAL_TARGET = 150;

const EXCLUDE_FILES = new Set(['scenarios-sql-practice.json']);

const AI_PM_SOURCES = new Set(['interview-bank-ai-pm', 'interview-bank-ai-pm-curated']);

const COMPANIES = [
  '字节跳动', '美团', '腾讯', '阿里巴巴', '拼多多', '京东', '百度', '网易',
  '小红书', '抖音', '携程', '滴滴', '快手', 'B站', '华为', '小米', 'Shein', '得物'
];

const AI_PRODUCT_RE = /Agent|RAG|Prompt|评测|Eval|大模型|LLM|向量|embedding|微调|badcase|幻觉|生成模型|Copilot|多模态|AI辅助|AI功能/i;

const TRADITIONAL_PRODUCT_RE = /产品|PM|产品经理|面经·产品|【产品|【面经·产品|【面试·PM|【面试·产品|设计|需求|竞品|功能|MVP|用户|增长|策略|方案|商业化|案例|行为|估算|STAR|实习|面经|面试|判断|业务|开放·Q|【面经·策略|【面经·竞品|【面经·危机|【面经·变现|【面试·综合|【面试·深度|【面试·产品设计/i;

/** 纯运营岗面经（非产品经理业务面） */
const OPS_ROLE_TAG_RE = /^【面经·运营】|^【运营·|^【面试·运营】/;

const TYPE_LABELS = {
  ai_product: 'AI产品经理',
  business: '传统产品业务面'
};

const PRODUCT_RE = /产品|PM|面经|面试|设计|需求|竞品|用户|增长|策略|方案|MVP|功能|业务|Agent|RAG|评测|AI|开放·Q|【面经|【面试|【产品|【判断|【设计|【需求|【功能|【竞品|【增长|【决策/i;
const SQL_ONLY_RE = /^【SQL|纯SQL|SELECT |JOIN |窗口函数|写一条SQL/i;

function inferCompany(text, fallback = '通用') {
  for (const c of COMPANIES) {
    if (text.includes(c) || text.includes(c.replace('跳动', ''))) return c;
  }
  const m = text.match(/【[^·]*·([^·】]+)/);
  if (m) {
    const hit = COMPANIES.find(c => m[1].includes(c.slice(0, 2)));
    if (hit) return hit;
  }
  return fallback;
}

function inferDifficulty(text, hint) {
  if (hint && ['easy', 'medium', 'hard'].includes(hint)) return hint;
  const len = text.length;
  if (len > 120 || /开放·Q1[0-9][0-9]/.test(text)) return 'hard';
  if (len > 70) return 'medium';
  return 'easy';
}

function inferTopicId(key, text) {
  if (key && (key.startsWith('iv-') || key.startsWith('prod-'))) return key;
  if (/Agent|RAG|评测|Prompt|LLM/.test(text)) return 'iv-pm';
  if (/数据|SQL|指标|A\/B/.test(text)) return 'iv-skills';
  if (/设计|功能|交互/.test(text)) return 'prod-open';
  return 'iv-pm';
}

function defaultOutline(type, text) {
  if (type === 'ai_product') {
    return '场景→方案选型(Prompt/RAG/Agent)→评测指标→迭代闭环';
  }
  if (/设计|功能|交互|MVP/.test(text)) return '用户场景→痛点→方案对比→MVP→成功指标';
  if (/估算|多少|GMV|DAU|量级/.test(text)) return '明确口径→拆解公式→假设取值→敏感性→结论区间';
  if (/实习|STAR|困难|优势|规划|收获|自我介绍/.test(text)) return '情境→任务→行动→结果→反思；每步含量化指标';
  if (/案例|分析|论证|开放·Q|对比|解读/.test(text)) return '定义问题→拆解维度→假设→验证路径→风险';
  return '结论先行→业务背景→策略选项→取舍理由→验证指标';
}

function defaultFramework(type, text) {
  if (type === 'ai_product') return 'AI产品决策';
  if (/估算|多少|GMV|DAU|量级/.test(text)) return 'Fermi';
  if (/设计|功能|交互|MVP/.test(text)) return 'Design Thinking';
  if (/实习|STAR|困难|优势/.test(text)) return 'STAR';
  return '结构化分析';
}

function collectQuestions() {
  const seen = new Set();
  const items = [];

  const add = (text, meta = {}) => {
    if (typeof text !== 'string') return;
    const norm = text.trim();
    if (norm.length < 15 || seen.has(norm)) return;
    if (SQL_ONLY_RE.test(norm)) return;
    if (!PRODUCT_RE.test(norm)) return;
    seen.add(norm);
    items.push({ text: norm, ...meta });
  };

  const scenarioFiles = fs.readdirSync(ROOT)
    .filter(f => f.startsWith('scenarios') && f.endsWith('.json') && !EXCLUDE_FILES.has(f));

  for (const file of scenarioFiles) {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    for (const [topicKey, list] of Object.entries(data)) {
      if (!Array.isArray(list)) continue;
      for (const text of list) {
        add(text, {
          topicKey,
          source: file.replace('.json', ''),
          sourceChannel: /OTA|电商|社区|行业/.test(text) ? '行业面经' : 'v1.0面经'
        });
      }
    }
  }

  for (const file of ['interview-bank-ai-pm.json', 'interview-bank-ai-pm-curated.json']) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const q of data.questions || []) {
      add(q.text, {
        topicKey: q.topicId || 'iv-pm',
        type: 'ai_product',
        company: q.company,
        difficulty: q.difficulty,
        curated: Boolean(q.curated),
        source: file.replace('.json', ''),
        sourceChannel: q.source || 'coach面经'
      });
    }
  }

  return items;
}

function isAiPmSource(q) {
  return AI_PM_SOURCES.has(q.source);
}

function isScenarioSource(q) {
  return q.source?.startsWith('scenarios');
}

function isAiCandidate(q) {
  return isAiPmSource(q) || AI_PRODUCT_RE.test(q.text);
}

function isTraditionalCandidate(q) {
  if (!isScenarioSource(q)) return false;
  if (isAiPmSource(q)) return false;
  if (AI_PRODUCT_RE.test(q.text)) return false;
  if (OPS_ROLE_TAG_RE.test(String(q.text || '').trim())) return false;
  return TRADITIONAL_PRODUCT_RE.test(q.text);
}

function score(q, bucket) {
  let s = 0;
  if (q.curated) s += 20;
  if (/【面经|【面试|【产品|【PM|产品经理/.test(q.text)) s += 5;
  if (q.company && q.company !== '通用') s += 3;
  if (q.difficulty === 'medium') s += 1;
  if (q.sourceChannel === 'coach面经') s += 1;
  if (bucket === 'ai' && isAiPmSource(q)) s += 4;
  if (bucket === 'ai' && AI_PRODUCT_RE.test(q.text)) s += 2;
  if (bucket === 'trad' && isScenarioSource(q)) s += 2;
  if (bucket === 'trad' && q.sourceChannel === '行业面经') s += 1;
  return s;
}

function pickFromPool(pool, target, seenText, type) {
  const sorted = [...pool].sort((a, b) => score(b, type === 'ai_product' ? 'ai' : 'trad') - score(a, type === 'ai_product' ? 'ai' : 'trad'));
  const picked = [];

  const tryPick = (q) => {
    if (picked.length >= target) return;
    if (seenText.has(q.text)) return;
    seenText.add(q.text);
    picked.push({ ...q, type });
  };

  sorted.filter(q => q.curated).forEach(tryPick);
  sorted.forEach(tryPick);

  return picked;
}

function pickSplit(items) {
  const seenText = new Set();
  const aiPool = items.filter(isAiCandidate);
  const tradPool = items.filter(isTraditionalCandidate);

  let aiPicked = pickFromPool(aiPool, AI_TARGET, seenText, 'ai_product');

  // AI 池不足时，从场景库中补充 AI 向题目
  if (aiPicked.length < AI_TARGET) {
    const extraAi = items.filter(q =>
      isScenarioSource(q) &&
      AI_PRODUCT_RE.test(q.text) &&
      !seenText.has(q.text)
    );
    aiPicked = aiPicked.concat(pickFromPool(extraAi, AI_TARGET - aiPicked.length, seenText, 'ai_product'));
  }

  let tradPicked = pickFromPool(tradPool, TRADITIONAL_TARGET, seenText, 'business');

  // 传统池不足时，从剩余场景题放宽筛选
  if (tradPicked.length < TRADITIONAL_TARGET) {
    const extraTrad = items.filter(q =>
      isScenarioSource(q) &&
      !isAiPmSource(q) &&
      !AI_PRODUCT_RE.test(q.text) &&
      !OPS_ROLE_TAG_RE.test(String(q.text || '').trim()) &&
      TRADITIONAL_PRODUCT_RE.test(q.text) &&
      !seenText.has(q.text)
    );
    tradPicked = tradPicked.concat(pickFromPool(extraTrad, TRADITIONAL_TARGET - tradPicked.length, seenText, 'business'));
  }

  const combined = [...aiPicked, ...tradPicked];
  if (combined.length !== TARGET) {
    console.warn(`WARN: expected ${TARGET}, got ${combined.length} (ai=${aiPicked.length}, trad=${tradPicked.length})`);
  }

  return combined;
}

const all = collectQuestions();
const picked = pickSplit(all);

const questions = picked.map((q, i) => {
  const type = q.type;
  return {
    id: `pm-v2-${String(i + 1).padStart(3, '0')}`,
    num: i + 1,
    text: q.text,
    company: q.company || inferCompany(q.text),
    type,
    typeLabel: TYPE_LABELS[type] || type,
    difficulty: inferDifficulty(q.text, q.difficulty),
    topicId: inferTopicId(q.topicKey, q.text),
    source: q.sourceChannel || 'v1.0面经',
    sourceFile: q.source || '',
    framework: defaultFramework(type, q.text),
    referenceOutline: defaultOutline(type, q.text),
    curated: Boolean(q.curated),
    tags: [TYPE_LABELS[type] || type, q.company || inferCompany(q.text), inferDifficulty(q.text, q.difficulty)].filter(Boolean)
  };
});

const byType = {};
const byCompany = {};
questions.forEach(q => {
  byType[q.type] = (byType[q.type] || 0) + 1;
  byCompany[q.company] = (byCompany[q.company] || 0) + 1;
});

const out = {
  version: 2,
  product: 'CVassistant PM Interview Bank',
  updated: new Date().toISOString().slice(0, 10),
  total: questions.length,
  stats: { byType, byCompany },
  typeLabels: TYPE_LABELS,
  questions
};

fs.writeFileSync(path.join(ROOT, 'interview-bank-v2.json'), JSON.stringify(out, null, 2));
console.log('interview-bank-v2.json:', questions.length, 'questions');
console.log('sources pool:', all.length, 'unique product questions');
console.log('byType', byType);
console.log('sample AI ids', questions.filter(q => q.type === 'ai_product').slice(0, 3).map(q => q.id));
console.log('sample trad ids', questions.filter(q => q.type === 'business').slice(0, 3).map(q => q.id));
console.log('top companies', Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 8));
