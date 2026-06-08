/**
 * 扩充通用面经/方法论知识卡（综合知乎、小红书、抖音、牛客等公开讨论，原创改写）
 * 运行: node scripts/expand-knowledge-web.js
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
    id: 'web-interview-core',
    title: '面经方法论（通用）',
    cat: 'interview',
    cards: [
      {
        id: 'scqa-framework',
        title: 'SCQA 表达结构',
        tags: ['面试', '表达'],
        body: '**S** 情境 · **C** 冲突/变化 · **Q** 核心问题 · **A** 答案/方案。\n\n适用：分析类、汇报类、开放题开场。比先铺 3 分钟背景更能抓住面试官注意力。'
      },
      {
        id: 'starr-framework',
        title: 'STARR（STAR+复盘）',
        tags: ['面试', 'STAR'],
        body: '在 STAR 基础上加 **R** Reflection：若重来会改什么。\n\n行为面要点：**Action 占 50%+ 篇幅**，用「我」写个人贡献；**Result 尽量量化**（基线→结果→观察窗口）。\n\n建议准备 8–12 个故事覆盖：冲突、优先级、失败复盘、跨部门推动、数据驱动决策。'
      },
      {
        id: 'self-intro-four',
        title: '自我介绍四段式',
        tags: ['面试'],
        body: '1. **我是谁**（行业/细分标签对齐 JD）\n2. **我做过什么**（2–3 个项目 + 量化结果）\n3. **人设标签**（与岗位匹配的能力关键词）\n4. **引导追问**（埋 1 个亮点项目让面试官深挖）\n\n控制在 3 分钟内；无完美匹配项目时用「大类匹配」（如 B 端/增长/内容）。'
      },
      {
        id: 'interview-reverse-q',
        title: '反问环节怎么问',
        tags: ['面试'],
        body: '避免薪资福利。可问：\n- 这个岗位目前最大的挑战是什么？\n- 团队如何衡量成功（指标/周期）？\n- 您对我刚才回答有什么建议？\n\n目的：展现好学与岗位理解，而非套近乎。'
      }
    ]
  },
  {
    id: 'web-data-ops',
    title: '数据分析（面经高频）',
    cat: 'ops',
    cards: [
      {
        id: 'impact-coefficient',
        title: '影响系数异动拆解',
        tags: ['数据', '面试'],
        body: '大盘指标涨跌时，按维度拆分计算贡献：\n\n**影响系数** ≈ (该维度今日量−昨日量) / (大盘今日−昨日)\n\n常用维度：城市、人群、渠道、版本、设备、时段。\n\n系数绝对值大者优先排查；再结合口径、外部事件验证。'
      },
      {
        id: 'renhuochang-analysis',
        title: '人货场分析三步',
        tags: ['数据', '运营'],
        body: '**人**：用户属性、分层、行为路径\n**货**：转化漏斗、动销、利润结构\n**场**：渠道、场景、触达时机\n\n步骤：① 穷举描述现实 ② 建立评价标准 ③ 建立指标间逻辑链得出结论。\n\n适用：电商、直播、本地生活复盘，避免只看一个 GMV。'
      },
      {
        id: 'metric-selection-chain',
        title: '指标选取链条',
        tags: ['数据', '产品'],
        body: '**业务目标** → **策略/动作** → **核心指标** → **观察窗口** → **护栏指标**\n\n例：拉新活动不能只看新增，还要看次留、CAC、渠道质量。\n\n功能评估同理：体验指标（时长/留存）+ 过程指标（点击率/完播）+ 业务指标（转化/收入）。'
      },
      {
        id: 'ab-traffic-layers',
        title: 'A/B 流量正交与互斥',
        tags: ['数据', '实验'],
        body: '**正交**：关联度低的实验可同层并行（如 UI vs 推荐算法）。\n**互斥**：同因素多版本需分层（如按钮颜色 vs 按钮大小）。\n\n局限：样本量、短期≠长期、难测心智；需结合 cohort、定性调研补充。'
      }
    ]
  },
  {
    id: 'web-pm-methods',
    title: 'PM 方法（面经高频）',
    cat: 'product',
    cards: [
      {
        id: 'competitor-four-layers',
        title: '竞品四层拆解',
        tags: ['竞品', '面试'],
        body: '1. **交互层**：体验、主路径、信息架构\n2. **业务层**：角色、价值主张、变现\n3. **增长层**：获客回路、留存机制\n4. **战略层**：组织意图、资源投向\n\n结论要落到「对我的业务意味着什么」，避免功能对比表堆砌。'
      },
      {
        id: 'activity-review-loop',
        title: '活动复盘闭环',
        tags: ['运营', '面试'],
        body: '**目标对齐** → **执行回顾** → **数据表现** → **归因分析**（人货场/AARRR）→ **改进沉淀**\n\n重点写「预设 vs 实际偏差」及原因，不是流水账。每条改进要可执行、有负责人与复验指标。'
      },
      {
        id: 'ops-plan-5w1h',
        title: '运营方案 5W1H',
        tags: ['运营', '面试'],
        body: '**Why** 目标与原因 · **What** 对象与内容 · **Where** 渠道/场景 · **When** 节奏 · **Who** 分工 · **How** 机制与预算\n\n适用：活动、冷启动、社群、内容运营方案题；先对齐目标再展开创意。'
      },
      {
        id: 'fermi-estimation',
        title: 'Fermi 估算题思路',
        tags: ['面试', '估算'],
        body: '面试官看**结构化分解**与**合理假设**，非精确数字。\n\n**自顶向下**：总人口→渗透率→频次\n**自底向上**：单店/单用户→规模放大\n\n两者交叉验证；结尾 sanity check 数量级并说明置信度。'
      },
      {
        id: 'analysis-to-action',
        title: '分析结论落地三种模式',
        tags: ['数据', '运营'],
        body: '1. **经营分析会**：指标监控→解读→待办清单→下次复盘\n2. **业务需求驱动**：澄清业务真问题→转化分析题→验证效果\n3. **主动洞察**：分层/标签/过程指标→提建议→拉同行对标\n\n面试答「怎么闭环」时，按场景选一种展开即可。'
      }
    ]
  },
  {
    id: 'web-ai-pm',
    title: 'AI PM（面经高频）',
    cat: 'product',
    cards: [
      {
        id: 'ai-project-four-steps',
        title: 'AI 项目复盘四步法',
        tags: ['AI', '面试'],
        body: '1. **背景与目标**（业务问题，非「上大模型」）\n2. **数据决策**（数据从哪来、质量、标注）\n3. **技术选型与兜底**（为何 RAG/Prompt/微调；幻觉、拒答、人工审核）\n4. **量化与迭代**（业务指标+模型指标；Bad Case 追踪与优先级）\n\n一句「召回率从 X 到 Y」胜过十句「效果挺好」。'
      },
      {
        id: 'llm-output-constraints',
        title: '大模型输出三层约束',
        tags: ['AI', '产品'],
        body: '**Prompt 层**：格式、范围、拒答规则\n**推理层**：JSON mode、grammar、logit 约束\n**后处理层**：规则校验、重试、人工抽检\n\n产品要想清每层解决什么问题，而非「全靠 prompt」。'
      },
      {
        id: 'ai-causal-proof',
        title: 'AI 功能因果验证',
        tags: ['AI', '数据'],
        body: '证明 AI 功能有效：\n- **采纳率/替代率**（用户是否真用）\n- **灰度 vs holdback**（有无对照组）\n- **分 Query 类型**看效果（避免平均数掩盖）\n- **Bad Case 闭环**（失败样本如何驱动迭代）'
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
console.log(`Added ${added} knowledge cards. Total sections: ${existing.sections.length}`);
