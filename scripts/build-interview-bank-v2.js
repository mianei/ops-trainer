/**
 * 从 v1.0 场景库 + AI PM 面经构建业务场景题库（350 道产品向真题）
 * 运行: node scripts/build-interview-bank-v2.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TARGET = 350;

const EXCLUDE_FILES = new Set(['scenarios-sql-practice.json']);

const COMPANIES = [
  '字节跳动', '美团', '腾讯', '阿里巴巴', '拼多多', '京东', '百度', '网易',
  '小红书', '抖音', '携程', '滴滴', '快手', 'B站', '华为', '小米', 'Shein', '得物'
];

const TYPE_RULES = [
  ['ai_product', /Agent|RAG|Prompt|评测|Eval|大模型|LLM|向量|embedding|微调|badcase|幻觉/i],
  ['behavior', /实习|STAR|困难|优势|规划|收获|自我介绍|为什么做产品|ToB|ToC|经历|复盘/i],
  ['product_design', /设计|功能|交互|MVP|方案|原型|需求|上线|改版|入口|Tab/i],
  ['estimation', /估算|多少|GMV|DAU|量级|测算|漏斗|口径/i],
  ['case', /案例|分析|论证|开放·Q|为何|为什么.*推|为何.*做|对比|解读/i],
  ['business', /业务|策略|商业化|增长|竞品|数据|运营|平台|定价|留存/i]
];

const TYPE_LABELS = {
  ai_product: 'AI产品经理',
  behavior: '行为面',
  business: '业务面',
  case: '案例分析',
  product_design: '产品设计',
  estimation: '估算题'
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

function inferType(text, hint) {
  if (hint && TYPE_LABELS[hint]) return hint;
  for (const [type, re] of TYPE_RULES) {
    if (re.test(text)) return type;
  }
  return 'business';
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

function defaultOutline(type) {
  const map = {
    ai_product: '场景→方案选型(Prompt/RAG/Agent)→评测指标→迭代闭环',
    behavior: '情境→任务→行动→结果→反思；每步含量化指标',
    business: '结论先行→业务背景→策略选项→取舍理由→验证指标',
    case: '定义问题→拆解维度→假设→验证路径→风险',
    product_design: '用户场景→痛点→方案对比→MVP→成功指标',
    estimation: '明确口径→拆解公式→假设取值→敏感性→结论区间'
  };
  return map[type] || map.business;
}

function defaultFramework(type) {
  const map = {
    ai_product: 'AI产品决策',
    behavior: 'STAR',
    estimation: 'Fermi',
    product_design: 'Design Thinking',
    case: '结构化分析',
    business: '结构化分析'
  };
  return map[type] || '结构化分析';
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
        type: q.type || 'ai_product',
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

function score(q) {
  let s = 0;
  if (q.curated) s += 20;
  if (/【面经|【面试|【产品|【PM|产品经理/.test(q.text)) s += 5;
  if (q.company && q.company !== '通用') s += 3;
  if (q.type === 'ai_product' || q.type === 'product_design' || q.type === 'case') s += 2;
  if (q.difficulty === 'medium') s += 1;
  if (q.sourceChannel === 'coach面经') s += 1;
  return s;
}

function pickBalanced(items, target) {
  const sorted = [...items].sort((a, b) => score(b) - score(a));
  const picked = [];
  const seenText = new Set();
  const typeCap = {
    ai_product: 80,
    product_design: 90,
    case: 80,
    business: 70,
    behavior: 60,
    estimation: 30
  };
  const typeCount = {};

  const tryPick = (q) => {
    if (picked.length >= target) return false;
    if (seenText.has(q.text)) return false;
    const type = inferType(q.text, q.type);
    const cap = typeCap[type] || 50;
    if ((typeCount[type] || 0) >= cap) return false;
    seenText.add(q.text);
    typeCount[type] = (typeCount[type] || 0) + 1;
    picked.push({ ...q, type });
    return true;
  };

  // 精选优先
  sorted.filter(q => q.curated).forEach(tryPick);
  sorted.forEach(tryPick);

  // 不足则放宽 type cap
  if (picked.length < target) {
    for (const q of sorted) {
      if (picked.length >= target) break;
      if (seenText.has(q.text)) continue;
      seenText.add(q.text);
      picked.push({ ...q, type: inferType(q.text, q.type) });
    }
  }

  return picked.slice(0, target);
}

const all = collectQuestions();
const picked = pickBalanced(all, TARGET);

const questions = picked.map((q, i) => {
  const type = q.type || inferType(q.text);
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
    framework: defaultFramework(type),
    referenceOutline: defaultOutline(type),
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
console.log('top companies', Object.entries(byCompany).sort((a, b) => b[1] - a[1]).slice(0, 8));
