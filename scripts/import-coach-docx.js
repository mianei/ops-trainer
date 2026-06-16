/**
 * 从 coach/面经_去重版.docx 导入 AI PM 面经
 * 运行: node scripts/import-coach-docx.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DOCX = path.join(process.env.USERPROFILE || '', 'Desktop', 'coach', '面经_去重版.docx');
const OUT_BANK = path.join(ROOT, 'interview-bank-ai-pm.json');
const OUT_FEED = path.join(ROOT, 'interview-rag-feed.json');

function extractDocxText(filePath) {
  const buf = fs.readFileSync(filePath);
  // docx = zip; find document.xml
  const endCentral = buf.lastIndexOf(Buffer.from('PK\x05\x06'));
  if (endCentral < 0) throw new Error('not a zip/docx');
  // use powershell Expand-Archive temp approach via node adm-zip alternative: manual unzip with child_process
  const tmp = path.join(ROOT, '.tmp-docx-import');
  fs.mkdirSync(tmp, { recursive: true });
  const zipCopy = path.join(tmp, 'in.zip');
  fs.copyFileSync(filePath, zipCopy);
  execSync(`powershell -NoProfile -Command "Expand-Archive -Path '${zipCopy.replace(/'/g, "''")}' -DestinationPath '${tmp.replace(/'/g, "''")}' -Force"`, { stdio: 'pipe' });
  const xml = fs.readFileSync(path.join(tmp, 'word', 'document.xml'), 'utf8');
  const text = xml.replace(/<w:tab[^/]*\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  fs.rmSync(tmp, { recursive: true, force: true });
  return text;
}

function parseQuestions(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(Boolean);
  const questions = [];
  let buf = '';
  let num = null;
  for (const line of lines) {
    const m = line.match(/^(\d{1,3})[.、．]\s*(.+)/);
    if (m && m[1].length <= 3) {
      if (buf && num) questions.push({ num, text: buf.trim() });
      num = Number(m[1]);
      buf = m[2];
    } else if (num) {
      buf += (buf ? ' ' : '') + line;
    }
  }
  if (buf && num) questions.push({ num, text: buf.trim() });
  return questions.filter(q => q.text.length >= 15);
}

function inferType(text) {
  if (/Prompt|RAG|Agent|LLM|模型|幻觉|Coze|TRAE|ArkClaw/i.test(text)) return 'ai_product';
  if (/设计|MVP|功能|交互|即梦|创作/i.test(text)) return 'product_design';
  if (/评估|衡量|指标|A\/B|数据|ROI|LTV|留存/i.test(text)) return 'business';
  if (/推动|决策|团队|研发|资源/i.test(text)) return 'case';
  return 'ai_product';
}

/** 用户提供的精选10题 + 话术框架 */
const CURATED_10 = [
  {
    num: 1,
    text: '一个需求摆在面前，什么时候适合先调Prompt，什么时候该上RAG，什么时候已经需要Agent了？',
    framework: 'Prompt / RAG / Agent 三分法',
    referenceAnswer: `调 Prompt：单点、确定性高的任务。学伴平台用 Cursor 生成固定样式页面组件——「我只需要固定输出格式，调 Prompt 就能稳定产出。」

上 RAG：知识密集型、需外部信息。MindTraining 结合面试真题与业务知识点点评——「模型不知道最新面试题，我搭知识库 + 检索召回，让点评更专业。」

用 Agent：多步骤、需决策与工具调用。智能家教匹配 Agent：理解家长需求 → 搜老师库 → 发面试邀请 → 跟进结果——「不是单一问答，而是规划-执行-反馈闭环。」`,
    projects: ['MindTraining', '学伴平台']
  },
  {
    num: 2,
    text: '一个Agent在Demo环境里通过率很高，接进真实研发流程后失败率明显上升，你会先把问题切到哪几个层面？',
    framework: '数据层 / 环境层 / 交互层',
    referenceAnswer: `1. 数据层：Demo 是标准数据，真实是脏数据——错别字、口语、多轮上下文丢失。
2. 环境层：Demo 单机理想网络，真实有接口延迟、下游不稳定、并发——Agent 调 API 超时全流程断。
3. 交互层：Demo 单次交互，真实多轮、打断、情绪变化——用户换话题 Agent 能否跟上。`,
    projects: ['通用方法论']
  },
  {
    num: 5,
    text: '如果研发团队想优先做更强的模型能力，但你更想先打磨开发流程体验，你会怎么推动决策？',
    framework: '对齐目标 → 数据说话 → 折中方案 → 设计背景',
    referenceAnswer: `1. 对齐目标：「更强模型」具体解决什么？提升 10% 准确率还是关键 Badcase？
2. 数据说话：Prompt 从构思到上线 3 天，1 天等部署调试；优化流程可缩到半天。
3. 折中：两周搭内部 Prompt 调试工作台，算法同学自助验证；省下的时间再做模型优化。
4. 设计背景 PM：关注流程每个卡点——顺畅的开发流程本身就是最好的「生产力模型」。`,
    projects: ['MindTraining', 'Cursor 工作流']
  },
  {
    num: 8,
    text: '如何低成本且高效地评估模型是否存在「幻觉」或「过度承诺」？',
    framework: '事实性校验 + 风险词检测',
    referenceAnswer: `1. 事实性校验：NER 提取实体（商品名、价格、折扣）→ 与商品库交叉验证 → 实体匹配准确率。
2. 风险词检测：词库「绝对、100%、保证、最」+ 正则 + 人工抽检复核。
3. 成本控制：脚本 + 词库，无需大量标注。MindTraining 评测集也采用类似双层校验思路。`,
    projects: ['MindTraining 评测']
  },
  {
    num: 15,
    text: '上线AI辅助发帖功能，发帖量+20%但举报「内容虚假/营销号」+15%，下线还是迭代？',
    framework: '归因 → 假设验证 → 决策点',
    referenceAnswer: `不下线，先归因：举报增长来自新用户还是老用户？集中在 AI 模板化内容还是本身发广告？
假设：AI 营销号感太强 → 优化 Prompt 降营销感、增加个人化；上线人工润色环节鼓励发布前修改。
决策：迭代后举报率降到可接受（如 10% 内）且发帖量仍正向则继续；否则考虑下线。`,
    projects: ['社区/内容产品']
  },
  {
    num: 106,
    text: '如果用户觉得生成结果很惊艳，但自己不知道怎么继续改，你会怎么优化创作流程？',
    framework: '创作鸿沟 · 可视化编辑',
    referenceAnswer: `1. 可视化编辑：Prompt 参数 → 滑块（创意度、风格强度、细节丰富度）。
2. 以图/文生图迭代：上传参考图或圈定文字，「我想要这种感觉」。
3. 模板化进阶：「更明亮」「复古滤镜」「更口语化」一键优化，让用户理解 AI 边界。
4. 设计背景：好交互不是让人学会工具，而是让工具适应直觉。`,
    projects: ['设计背景', '即梦/AIGC']
  },
  {
    num: 104,
    text: '你会怎么判断一个AI自动化功能到底有没有真正提升用户效率？',
    framework: '任务路径对比 · 时间/步骤/满意度',
    referenceAnswer: `不能只看使用率，要对比完成相同任务的时间与步骤。
例：营销海报——传统 PS 20 步 15 分钟 vs AI 5 步 3 分钟。
核心指标：任务完成时间缩短率、操作步骤简化率、满意度、一次性成功率。
若用户需反复生成 5 次才相当于传统 1 次，则未真正提效。`,
    projects: ['量化思维']
  },
  {
    num: 109,
    text: '如果让你为即梦设计一个提升新用户留存的小功能，你会优先考虑什么方向？',
    framework: '降低首次创作成功门槛',
    referenceAnswer: `方向：AI「灵感生成器」+「一键应用」。
输入一个词（毕业/旅行/可爱猫咪）→ AI 生成 3-5 个风格方向 + 描述 → 一键出初版 → 傻瓜式微调。
解决空白画布恐惧、即时成就感、展示能力边界激发探索。`,
    projects: ['即梦', '设计+运营']
  },
  {
    num: 122,
    text: '如果一个AI产品短期数据还不错，但你觉得它未必能长期成立，你会怎么看？',
    framework: '工具 vs 玩具 · 飞轮 · 护城河',
    referenceAnswer: `1. 工具还是玩具：老用户次周留存，增长靠新用户尝鲜则偏玩具。
2. 网络效应/数据飞轮：用得越多是否越好？
3. 护城河：技术、数据还是品牌？套壳 API 易被复制。
4. 关注复购率与主动传播率，下降则长期不成立。`,
    projects: ['长期视角']
  },
  {
    num: 135,
    text: '你会怎么衡量一个商业化AI产品有没有真正做出价值？',
    framework: '收入 · 成本 · 效率三维',
    referenceAnswer: `价值看「生意多赚」：
收入侧：直接（新付费/ARPU/ROI）与间接（降流失）。
成本侧：替代人工、降运营成本。
效率侧：核心流程周期缩短（如海报 3 天→1 天）。
至少一个维度有可量化、可对比数据。学伴平台同理：匹配效率、转化、人力成本。`,
    projects: ['学伴平台', '商业化']
  }
];

function main() {
  let docQuestions = [];
  if (fs.existsSync(DOCX)) {
    try {
      const text = extractDocxText(DOCX);
      docQuestions = parseQuestions(text);
      fs.writeFileSync(path.join(ROOT, 'coach-docx-extracted.txt'), text.slice(0, 500000));
      console.log('Extracted', docQuestions.length, 'questions from docx');
    } catch (e) {
      console.warn('Docx extract failed:', e.message);
    }
  } else {
    console.warn('Docx not found:', DOCX);
  }

  const curatedIds = new Set(CURATED_10.map(c => c.num));
  const bankFromDoc = docQuestions.map((q, i) => ({
    id: `ai-pm-${String(q.num).padStart(3, '0')}`,
    num: q.num,
    text: q.text.replace(/\s+/g, ' ').slice(0, 500),
    company: '通用',
    type: inferType(q.text),
    typeLabel: 'AI产品经理',
    difficulty: q.text.length > 80 ? 'medium' : 'easy',
    topicId: 'iv-pm',
    source: 'coach面经去重版',
    framework: '',
    referenceOutline: '',
    curated: curatedIds.has(q.num),
    tags: ['AI产品经理', inferType(q.text)]
  }));

  const curatedBank = CURATED_10.map(c => ({
    id: `ai-pm-curated-${String(c.num).padStart(3, '0')}`,
    num: c.num,
    text: c.text,
    company: '通用',
    type: 'ai_product',
    typeLabel: 'AI产品经理',
    difficulty: 'medium',
    topicId: 'iv-pm',
    source: 'coach精选10题',
    framework: c.framework,
    referenceOutline: c.referenceAnswer.slice(0, 200),
    referenceAnswer: c.referenceAnswer,
    projects: c.projects,
    curated: true,
    tags: ['AI产品经理', '精选', ...(c.projects || [])]
  }));

  const bank = {
    version: 2,
    product: 'AI PM Interview Bank (Coach)',
    updated: new Date().toISOString().slice(0, 10),
    total: bankFromDoc.length,
    curatedCount: curatedBank.length,
    questions: bankFromDoc
  };
  fs.writeFileSync(OUT_BANK, JSON.stringify(bank, null, 2));

  const curatedOnly = {
    version: 1,
    title: 'AI PM 精选10题 · 专属话术',
    hint: '结合 MindTraining / 学伴项目改写后口述练习',
    questions: curatedBank
  };
  fs.writeFileSync(path.join(ROOT, 'interview-bank-ai-pm-curated.json'), JSON.stringify(curatedOnly, null, 2));

  // merge curated answers into rag feed
  let feed = { version: 1, hint: '', posts: [] };
  if (fs.existsSync(OUT_FEED)) feed = JSON.parse(fs.readFileSync(OUT_FEED, 'utf8'));

  const newPosts = curatedBank.map(c => ({
    title: `【AI PM·题${c.num}】${c.text.slice(0, 40)}…`,
    sourceLabel: 'AI PM精选话术',
    tags: ['AI产品经理', 'MindTraining', '学伴', `题${c.num}`, ...(c.projects || [])],
    body: `题目：${c.text}\n\n框架：${c.framework}\n\n参考话术（请结合自己的项目改写）：\n${c.referenceAnswer}`
  }));

  const existingTitles = new Set((feed.posts || []).map(p => p.title));
  for (const p of newPosts) {
    if (!existingTitles.has(p.title)) feed.posts.push(p);
  }
  feed.hint = feed.hint || '优质面经 + AI PM 精选话术';
  fs.writeFileSync(OUT_FEED, JSON.stringify(feed, null, 2));

  console.log('Wrote', OUT_BANK, 'questions:', bankFromDoc.length);
  console.log('Wrote interview-bank-ai-pm-curated.json', curatedBank.length);
  console.log('Updated interview-rag-feed.json posts:', feed.posts.length);
}

main();
