/**
 * 从现有 interview 场景构建 v2.0 产品岗题库（50+，含公司/题型/难度）
 * 运行: node scripts/build-interview-bank-v2.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const SOURCE_FILES = [
  'scenarios-interview-pm.json',
  'scenarios-interview-open.json',
  'scenarios-interview-skills.json',
  'scenarios-interview-misc.json',
  'scenarios-interview-ops.json',
  'scenarios-pm-debrief.json',
  'scenarios-pm-product-batch3.json',
  'scenarios-interview-biz.json'
];

const COMPANIES = [
  '字节跳动', '美团', '腾讯', '阿里巴巴', '拼多多', '京东', '百度', '网易',
  '小红书', '抖音', '携程', '滴滴', '快手', 'B站', '华为', '小米'
];

const TYPE_RULES = [
  ['behavior', /实习|STAR|困难|优势|规划|收获|自我介绍|为什么做产品|ToB|ToC/i],
  ['product_design', /设计|功能|交互|MVP|方案|原型|需求/i],
  ['estimation', /估算|多少|GMV|DAU|量级|测算|漏斗/i],
  ['case', /案例|分析|论证|开放·Q|为何|为什么.*推|为何.*做/i],
  ['business', /业务|策略|商业化|增长|竞品|数据|运营|平台/i]
];

const TYPE_LABELS = {
  behavior: '行为面',
  business: '业务面',
  case: '案例分析',
  product_design: '产品设计',
  estimation: '估算题'
};

function inferCompany(text) {
  for (const c of COMPANIES) {
    if (text.includes(c) || text.includes(c.replace('跳动', ''))) return c;
  }
  const m = text.match(/【[^·]*·([^·】]+)/);
  if (m && COMPANIES.some(c => m[1].includes(c.slice(0, 2)))) {
    return COMPANIES.find(c => m[1].includes(c.slice(0, 2))) || '通用';
  }
  return '通用';
}

function inferType(text) {
  for (const [type, re] of TYPE_RULES) {
    if (re.test(text)) return type;
  }
  return 'business';
}

function inferDifficulty(text) {
  const len = text.length;
  if (len > 120 || /开放·Q1[0-9][0-9]/.test(text)) return 'hard';
  if (len > 70) return 'medium';
  return 'easy';
}

function inferTopicId(key, text) {
  if (key.startsWith('iv-') || key.startsWith('prod-')) return key;
  if (/数据|SQL|指标|A\/B/.test(text)) return 'iv-skills';
  if (/设计|功能|交互/.test(text)) return 'prod-open';
  return 'iv-pm';
}

function defaultOutline(type) {
  const map = {
    behavior: '情境→任务→行动→结果→反思；每步含量化指标',
    business: '结论先行→业务背景→策略选项→取舍理由→验证指标',
    case: '定义问题→拆解维度→假设→验证路径→风险',
    product_design: '用户场景→痛点→方案对比→MVP→成功指标',
    estimation: '明确口径→拆解公式→假设取值→敏感性→结论区间'
  };
  return map[type] || map.business;
}

function collectQuestions() {
  const seen = new Set();
  const items = [];
  for (const file of SOURCE_FILES) {
    const p = path.join(ROOT, file);
    if (!fs.existsSync(p)) continue;
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const [topicKey, list] of Object.entries(data)) {
      if (!Array.isArray(list)) continue;
      for (const text of list) {
        if (typeof text !== 'string' || text.length < 20) continue;
        const norm = text.trim();
        if (seen.has(norm)) continue;
        seen.add(norm);
        const type = inferType(norm);
        items.push({
          topicKey,
          text: norm,
          type,
          company: inferCompany(norm),
          difficulty: inferDifficulty(norm),
          source: file.replace('.json', ''),
          sourceChannel: /OTA|电商|社区/.test(norm) ? '整理' : '公开面经整理'
        });
      }
    }
  }
  return items;
}

function prioritize(items) {
  const score = (q) => {
    let s = 0;
    if (/【面试|【面经|【PM|产品经理/.test(q.text)) s += 3;
    if (q.company !== '通用') s += 2;
    if (q.type === 'behavior' || q.type === 'product_design') s += 1;
    if (q.difficulty === 'medium') s += 1;
    return s;
  };
  return [...items].sort((a, b) => score(b) - score(a));
}

const all = collectQuestions();
const picked = prioritize(all).slice(0, 55);

const questions = picked.map((q, i) => ({
  id: `pm-v2-${String(i + 1).padStart(3, '0')}`,
  text: q.text,
  company: q.company,
  type: q.type,
  typeLabel: TYPE_LABELS[q.type],
  difficulty: q.difficulty,
  topicId: inferTopicId(q.topicKey, q.text),
  source: q.sourceChannel,
  sourceFile: q.source,
  framework: q.type === 'behavior' ? 'STAR' : q.type === 'estimation' ? 'Fermi' : '结构化分析',
  referenceOutline: defaultOutline(q.type),
  tags: [q.typeLabel, q.company, q.difficulty].filter(Boolean)
}));

const byType = {};
const byCompany = {};
questions.forEach(q => {
  byType[q.type] = (byType[q.type] || 0) + 1;
  byCompany[q.company] = (byCompany[q.company] || 0) + 1;
});

const out = {
  version: 2,
  product: 'MindTraining PM Interview Bank',
  updated: new Date().toISOString().slice(0, 10),
  total: questions.length,
  stats: { byType, byCompany },
  typeLabels: TYPE_LABELS,
  questions
};

fs.writeFileSync(path.join(ROOT, 'interview-bank-v2.json'), JSON.stringify(out, null, 2));
console.log('interview-bank-v2.json:', questions.length, 'questions');
console.log('byType', byType);
