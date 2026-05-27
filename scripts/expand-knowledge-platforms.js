/**
 * 扩充知乎/小红书/抖音/AIGC 相关知识卡（原创框架，非原文搬运）
 * 运行: node scripts/expand-knowledge-platforms.js
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
    id: 'interview-frameworks',
    title: '面试表达框架',
    cat: 'interview',
    cards: [
      {
        id: 'prep-framework',
        title: 'PREP 法则',
        tags: ['面试', '表达'],
        body: '**P** 结论先行 · **R** 理由 · **E** 示例/数据 · **P** 总结扣题。\n\n适用：开放题、优缺点、方案选择。避免先背景 3 分钟还没结论。'
      },
      {
        id: 'circles-framework',
        title: 'CIRCLES 产品题',
        tags: ['产品', '面试'],
        body: '**C** 背景 · **I** 用户 · **R** 需求/痛点 · **C** 方案 · **L** 优先级 · **E** 指标 · **S** 总结。\n\n适用：「设计某功能」类题，强制落到指标与 MVP。'
      },
      {
        id: 'quantify-resume',
        title: '量化表达三要素',
        tags: ['面试', 'STAR'],
        body: '每个项目尽量写清：**基线**（原来多少）→ **动作**（你改了什么）→ **结果**（提升多少，观察窗口多长）。\n\n避免只写「负责 XX 模块」无数字。'
      }
    ]
  },
  {
    id: 'platform-zhihu',
    title: '知乎生态',
    cat: 'ops',
    cards: [
      {
        id: 'zhihu-qa-vs-content',
        title: '问答 vs 想法/故事',
        tags: ['知乎', '社区'],
        body: '知乎从 **强问答** 扩展到想法、视频、盐选故事。\n\n风险：专业回答占比下降、精英用户流失。\n\n分析时要问：该功能服务谁、如何衡量「品质」而非只看 DAU。'
      },
      {
        id: 'zhihu-salt-tradeoff',
        title: '盐选与社区氛围',
        tags: ['知乎', '商业化'],
        body: '盐选故事提升变现，但可能稀释「专业讨论」心智。\n\n取舍看：**收入结构、核心创作者留存、搜索/问答质量指标** 是否同步护栏。'
      },
      {
        id: 'zhihu-creator-ops',
        title: '创作者运营关注点',
        tags: ['知乎', '运营'],
        body: '分层：头部专业答主 vs 长尾创作者。\n\n评估质量：**专业度、互动深度、举报/违规率**，而非仅发文量。\n\n跨平台差异：图文深度 vs 短视频完播 vs 双列 CES。'
      }
    ]
  },
  {
    id: 'platform-xhs',
    title: '小红书',
    cat: 'ops',
    cards: [
      {
        id: 'xhs-decision-engine',
        title: '种草决策引擎',
        tags: ['小红书', '产品'],
        body: '用户从「来种草买什么」→「搜攻略/怎么选」。\n\n产品含义：**搜索权重上升、收藏/截图/回访** 比纯曝光更重要。\n\n详情页要承接「决策信息结构」而非娱乐刷法。'
      },
      {
        id: 'xhs-note-structure',
        title: '爆款笔记结构',
        tags: ['小红书', '内容'],
        body: '常见要素：**选题（人群+场景）→ 封面/标题钩子 → 首图信息 → 正文干货/体验 → CTA（收藏/评论）**。\n\n图文重「可收藏干货」；短视频重前 3 秒钩子与完播。'
      },
      {
        id: 'xhs-vs-douyin-creator',
        title: '小红书 vs 抖音达人运营',
        tags: ['小红书', '抖音', '运营'],
        body: '| 维度 | 小红书 | 抖音 |\n| 内容 | 图文+短图文为主 | 短视频为主 |\n| 算法 | CES、收藏权重高 | 完播、互动密集 |\n| 达人诉求 | 种草、品牌合作 | 流量、直播带货 |\n| ROI | 看种草→搜索→转化链 | 看播放→转化/核销 |'
      },
      {
        id: 'xhs-creator-tier',
        title: '达人分层激励',
        tags: ['小红书', '运营'],
        body: 'L1 潜力：扶持冷启动流量包；L2 稳定：任务+佣金；L3 头部：定制 IP 与独家。\n\n质量信号：收藏率、搜索引流、违规率，而非只看粉丝。'
      }
    ]
  },
  {
    id: 'platform-douyin',
    title: '抖音 / 本地生活',
    cat: 'ops',
    cards: [
      {
        id: 'douyin-local-loop',
        title: '本地生活种草闭环',
        tags: ['抖音', '本地生活'],
        body: '路径：**短视频/直播种草 → POI/团购页 → 下单 → 到店核销**。\n\n适合决策链短、即时性不强的 **到店团购**；复杂服务需强化 POI 信息与信任。'
      },
      {
        id: 'douyin-vs-meituan',
        title: '抖音 vs 美团本地生活',
        tags: ['抖音', '美团'],
        body: '| 维度 | 抖音 | 美团 |\n| 入口 | 内容推荐、搜索 | 主动找服务 |\n| 优势 | 兴趣激发、内容供给 | 履约、供给深度 |\n| 指标 | 核销率、POI 覆盖 | 订单、复购、UE |\n\n抖音靠 **内容+POI 基建+本地推** 提升 ROI，而非长期纯补贴。'
      },
      {
        id: 'douyin-poi-ia',
        title: 'POI 页信息结构',
        tags: ['抖音', '产品'],
        body: '决策型用户：位置/评分/人均/团购套餐/核销规则优先。\n\n闲逛型用户：短视频、评价、相似店推荐。\n\n电商 vs 本地：**服务同时生产消费**，信息准确性比 SKU 列表更关键。'
      },
      {
        id: 'douyin-local-push',
        title: '本地推 vs 纯补贴',
        tags: ['抖音', '商业化'],
        body: '补贴拉 GMV 有「最佳折扣率」，过高伤 UE。\n\n**巨量本地推** 等工具：按 POI 半径精准投放，提升 ROI。\n\n中长期：商家数量增加后流量成本上升，需靠运营能力而非只烧钱。'
      }
    ]
  },
  {
    id: 'platform-aigc',
    title: 'AIGC / AI 产品',
    cat: 'product',
    cards: [
      {
        id: 'aigc-eval-dims',
        title: '大模型效果评估维度',
        tags: ['AI', 'PM'],
        body: '常见维度：**准确率/有用性、完整性、安全合规、延迟成本、采纳率**。\n\nOffline：benchmark + 人工标注；Online：采纳率、重试率、用户反馈、A/B。'
      },
      {
        id: 'aigc-hallucination-guard',
        title: '幻觉与兜底策略',
        tags: ['AI', '产品'],
        body: '手段：**引用溯源、低置信拒答、人工审核队列、敏感词/事实库校验**。\n\n产品要定义：哪些场景必须「不知道就说不知道」。'
      },
      {
        id: 'aigc-rag-debug-layers',
        title: 'RAG/Agent 效果下降排查',
        tags: ['AI', 'RAG'],
        body: '1. **数据层**：知识库更新、索引异常\n2. **模型层**：版本/Prompt/Token 限制\n3. **用户层**：是否某类 Query 集中失败\n4. **环境层**：API 超时、缓存过期\n5. **对比 bad case** 定位环节'
      },
      {
        id: 'query-tagging-framework',
        title: 'Query 标签体系思路',
        tags: ['AI', '搜索'],
        body: '按 **意图**（事实/推荐/对比/操作）× **领域** × **难度** 打标。\n\n用途：分策略路由（搜索/RAG/Agent）、评估分层、监控各段准确率。'
      },
      {
        id: 'ai-agent-boundary',
        title: 'Agent 落地边界',
        tags: ['AI', 'Agent'],
        body: '适合：**多步工具调用、可验证中间结果** 的任务。\n\n谨慎：**强合规、强实时、低容错** 场景。\n\n面试要答：工作流设计、失败回退、人机协同点。'
      }
    ]
  }
];

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
  }
}

existing.version = 3;
const total = existing.sections.reduce((n, s) => n + (s.cards?.length || 0), 0);
fs.writeFileSync(target, JSON.stringify(existing, null, 2) + '\n', 'utf8');
console.log('knowledge.json platform cards added, total:', total);
