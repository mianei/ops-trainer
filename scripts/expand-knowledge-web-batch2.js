/**
 * 面经扩充第二批知识卡
 * 运行: node scripts/expand-knowledge-web-batch2.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, '../knowledge.json');
const existing = JSON.parse(fs.readFileSync(target, 'utf8'));
const existingIds = new Set();
for (const sec of existing.sections || []) {
  for (const c of sec.cards || []) existingIds.add(c.id);
}

const newSections = [
  {
    id: 'web-interview-batch2',
    title: '面经方法论（第二批）',
    cat: 'interview',
    cards: [
      {
        id: 'gmv-decomposition',
        title: 'GMV 拆解公式',
        tags: ['数据', '电商', '面试'],
        body: '常见拆解：**GMV = 流量 × 转化率 × 客单价**（或 × 复购频次）。\n\n下降时按因子看贡献，再下钻渠道/品类/人群/价格带。\n\n面试要写清「先查哪个因子、用什么维度验证」。'
      },
      {
        id: 'north-star-guardrails',
        title: '北极星与护栏指标',
        tags: ['产品', '数据', '面试'],
        body: '**北极星**：最能代表长期价值的 1 个指标（如留存、有效活跃）。\n**护栏**：体验/质量底线（投诉率、完播、加载时长）。\n\n新功能评估：北极星是否提升 + 护栏是否恶化；避免只看短期点击。'
      },
      {
        id: 'ab-test-design-pm',
        title: 'A/B 测试设计要点',
        tags: ['实验', '面试'],
        body: '明确：**假设—对照组—核心指标—护栏指标—样本量/周期—显著性标准**。\n\n注意：变量尽量单一；周期覆盖完整行为周期；流量层正交避免干扰。\n\n全量后大盘不涨：检查长期效应、指标错位、人群稀释。'
      },
      {
        id: 'saas-version-tiering',
        title: 'SaaS 三档版本切割',
        tags: ['B端', '面试'],
        body: '**免费/引流**：体验核心能力，转化意向客户\n**专业版**：主营收，覆盖主流客户完整工作流\n**企业版**：大客户定制、合规、专属服务\n\n切割原则：解耦核心模块、聚焦客群、集成已有平台能力（消息/日历等）。'
      },
      {
        id: 'churn-layer-ops',
        title: '流失分层运营',
        tags: ['运营', '留存', '面试'],
        body: '**暂未流失**：提升粘性、场景延伸\n**可能即将流失**：预警信号（活跃降、关键行为消失）+ 定向权益\n**已流失**：召回渠道与理由（新内容/价格/社交关系）\n\n每层要有不同触发条件与指标，避免一刀切推送。'
      },
      {
        id: 'marketing-roi-metrics',
        title: '营销活动四类指标',
        tags: ['运营', '面试'],
        body: '**CVR**：转化效率\n**ROI**：投入产出（注意分子分母口径）\n**流量指标**：曝光/点击/到达/留存\n**用户反馈**：满意度、投诉、NPS 变化\n\n复盘要说清每类指标回答什么问题，而非只报 GMV。'
      },
      {
        id: 'influence-without-authority',
        title: '非职权影响力',
        tags: ['面试', '协作'],
        body: '大厂面经常考：资源冲突时你怎么推动？\n\n要点：**调整优先级**、**缩小 MVP**、**用数据对齐**、**人工/运营兜底**、**明确决策人与时间盒**。\n\n避免：「我拉会对齐了」而无具体取舍。'
      },
      {
        id: 'unknown-question-framework',
        title: '陌生业务题五步',
        tags: ['面试', '表达'],
        body: '1. **界定边界**（用户/场景/目标）\n2. **拆解影响因素**\n3. **提出可验证假设**\n4. **设计验证路径**（数据/访谈/小实验）\n5. **小结与取舍**\n\n可坦诚信息不足，但必须展示结构化思考。'
      },
      {
        id: 'ice-priority',
        title: 'ICE 优先级（轻量）',
        tags: ['产品', '面试'],
        body: '**I**mpact 影响 · **C**onfidence 信心 · **E**ase 成本\n\n比 RICE 更轻，适合实习/小团队快速排序。\n\n面试要说清每项打分依据，并接受面试官质疑权重。'
      },
      {
        id: 'arpu-ltv-dau',
        title: 'ARPU / LTV / DAU 分工',
        tags: ['商业化', '面试'],
        body: '**DAU**：规模与活跃（不等于变现能力）\n**ARPU**：单位用户收入\n**LTV**：生命周期总价值（含留存与复购）\n\n商业化讨论常需：**LTV > CAC**；警惕 DAU 涨但 ARPU/LTV 跌的「虚假繁荣」。'
      },
      {
        id: 'written-exam-five-types',
        title: '产运笔试五类题型',
        tags: ['面试', '笔试'],
        body: '1. **估算**：费米分层+校验\n2. **需求分析**：用户/场景/边界/指标\n3. **活动推广**：5W1H+渠道+预算+风险\n4. **产品分析**：定位-价值-竞品-改进\n5. **开放创意**：展示假设与路径，非脑洞\n\n时间紧：先搭框架再填要点。'
      },
      {
        id: 'b-ticket-system-modules',
        title: 'B 端工单系统模块',
        tags: ['B端', '面试'],
        body: '内部：**创建—分派—处理—升级—SLA—权限—报表**\n外部：**提交—进度透明—评价—通知**\n\n强调：标准化、可追溯、多渠道接入；效果看处理时长、一次解决率、满意度。'
      }
    ]
  }
];

let added = 0;
for (const sec of newSections) {
  let targetSec = existing.sections.find((s) => s.id === sec.id);
  if (!targetSec) {
    targetSec = { id: sec.id, title: sec.title, cat: sec.cat, cards: [] };
    existing.sections.push(targetSec);
  }
  for (const card of sec.cards) {
    if (existingIds.has(card.id)) continue;
    targetSec.cards.push(card);
    existingIds.add(card.id);
    added++;
  }
}

existing.version = (existing.version || 1) + 1;
fs.writeFileSync(target, JSON.stringify(existing, null, 2) + '\n', 'utf8');
console.log(`Added ${added} knowledge cards.`);
