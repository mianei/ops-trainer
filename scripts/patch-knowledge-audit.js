/**
 * 知识卡准确性修订（2025 审计）
 * 运行: node scripts/patch-knowledge-audit.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, '../knowledge.json');
const k = JSON.parse(fs.readFileSync(target, 'utf8'));

/** @type {Record<string, { title?: string, body: string, tags?: string[] }>} */
const PATCHES = {
  'moments-not-home': {
    body:
      '微信 **Tab1 是 IM 消息列表**，服务最高频的「处理沟通」任务（产品分析常见结论，含张小龙公开阐述的逻辑）。\n\n朋友圈放在「发现」而非首屏，常见解释包括：\n- 避免 IM 首屏被「拉式浏览」干扰\n- 用朋友圈等高粘功能为发现页其他能力导流\n- 朋友圈命中率依赖关系链强度，全屏信息流体验未必更好\n\n面试作答：从**产品定位、用户任务优先级、商业生态**论证，避免单点臆测。'
  },
  'ads-mission-triangle': {
    title: '微信系广告取舍（分析框架）',
    body:
      '分析微信生态商业化时的**启发式三角**（非官方术语）：\n\n- **私域/熟人场景**：强广告易伤关系链（朋友圈等）\n- **公域/内容消费场景**：视频号等偏「刷内容」，广告容忍度相对更高\n- **集团广告增长目标**：需在体验与收入间动态平衡\n\n用于解释「朋友圈克制、视频号更快商业化」等**取舍**，需结合阶段与数据，非绝对规律。'
  },
  'community-ces': {
    title: '小红书 CES（社区常用热度口径）',
    body:
      '**CES**（Community Engagement Score）在运营资料/第三方数据中常用来描述笔记热度，**具体权重会迭代，非固定官方白皮书**。\n\n常见参考口径：点赞×1、收藏×1、评论×4、转发×4、关注×8（各渠道表述略有出入）。\n\n解读：评论/关注代表更深互动；**收藏高、点赞相对低**可能偏干货/决策型内容，而非单纯标题党。\n\n面试用途：解释种草与互动结构，**勿背死数字**，并说明真实排序还受账号、类目、时效衰减等影响。'
  },
  'community-bilibili-metrics': {
    title: 'B 站互动与热度（参考口径）',
    body:
      'B 站**未公开**完整推荐公式。行业分析常引用**早年泄露的分站热度参考代码**（可能已改版）：\n\n硬币、收藏、弹幕、评论、点赞、分享、播放等各有加权；**分享权重相对较高**；24h 内新稿可能有加成。\n\n**不宜**记成「完播 > 投币 > 收藏」——完播率在内容质量讨论中重要，但与上述泄露公式不是同一套变量。\n\n分析时：看互动结构、播放与推荐是否匹配、UP 历史质量；并声明**权重以平台为准**。'
  },
  'community-evolution': {
    title: '社区演进（行业通俗说法）',
    body:
      '业内通俗分期（**非学术标准版本号**）：\n\n- **1.0** BBS/论坛：版区+搜索，弱社交关系\n- **2.0** 社交网络：关注、圈层、KOL\n- **3.0** 算法分发：兴趣 feed、推荐主导\n\n用于判断「卡在供给、关系还是分发」；具体分析产品不必生硬贴版本标签。'
  },
  'ota-hotel-modes': {
    body:
      '**代理模式**：平台撮合，入住后按协议抽佣，资产较轻，体验规则由平台与酒店协同。\n**批发/包房**：提前拿房再售卖，毛利可能更高，但占用资金、库存与价格波动风险更大。\n\n抽佣比例**因品类、直采/代理、协议而异**（常见讨论为低双位数百分比量级），面试用结构论证，勿写死单一百分比除非有出处。'
  },
  'crisis-time-window': {
    body:
      '舆情回应常用**节奏参考**（非法律或行业铁律，按公司 PR 规范调整）：\n\n- **尽快**首次发声（常见目标 1h 内，视严重性）\n- **数小时内**补充可核实事实与已采取动作\n- **24–48h** 给出改进节点或复盘入口\n\n仍须区分：事实问题 / 情绪问题 / 价值观问题，策略不同。'
  },
  'social-currency': {
    body:
      '传播动机常借用 **Jonah Berger** 等总结的框架，包括：社交货币、诱因、情绪、公开性、实用价值、故事性（STEPPS）。\n\n面试可简化为：**用户分享能获得什么身份/利益/情绪释放**。\n\n机制设计：降低参与门槛 + 提高可炫耀/可转述性；避免把单一理论当成唯一真理。'
  },
  'impact-coefficient': {
    body:
      '大盘指标涨跌时，常用**贡献度/影响系数**做维度拆解（各公司口径可能不同）：\n\n近似思路：某维度变化量 / 大盘变化量，绝对值大者优先排查。\n\n常用维度：城市、人群、渠道、版本、设备、时段。\n\n须结合**口径是否变化、外部事件**验证，避免机械套公式。'
  },
  'zhihu-salt': {
    title: '知乎盐选权衡（社区补充）',
    body:
      '与「盐选与社区氛围」同主题。盐选/故事会提升变现，可能削弱**专业问答占比与精英用户心智**。\n\n取舍看：付费与会员收入、核心创作者留存、问答/搜索质量、举报与低质内容率等护栏指标。'
  },
  'xhs-search': {
    body:
      '小红书用户行为常从「被动种草」延伸到「主动搜索决策」（行业观察，非唯一路径）。\n\n产品含义：搜索、收藏、回访、截图等行为权重上升；详情页需承载**决策信息结构**（对比、价格、踩坑、步骤）。'
  },
  'local-o2o-triangle': {
    title: '本地生活分析三角（启发式）',
    body:
      '分析本地生活时的**启发式**（非统一定理）：\n\n- **人找店**：主动搜索、列表、地图（意图强）\n- **店找人/内容找人**：推荐、直播、团购券（激发需求）\n- **冲动/即时消费**：短视频种草、限时优惠、距离近\n\n须纳入：供给覆盖、核销履约、退款信任与 UE。'
  },
  'community-four-roles': {
    body:
      '社区在产品中的常见作用（归纳框架）：\n\n1. **互动与留存**：评论、关注、私信\n2. **活跃与玩法**：话题、活动、UGC 激励\n3. **信号反哺**：互动数据改进推荐/搜索\n4. **心智与归属**：品牌、文化、身份认同\n\n分析时先明确本轮要达成哪一类，再设计机制与指标。'
  },
  'ecom-vs-content-rec': {
    body:
      '| 维度 | 电商推荐 | 内容推荐 |\n|------|----------|----------|\n| 画像更新 | 相对慢（购买周期长） | 快（行为密集） |\n| 排序侧重 | 转化、GMV、规则、供给 | 时长、互动、兴趣 |\n| 召回 | 物品协同、类目 | 用户协同、兴趣标签 |\n\n共同点：平衡**用户体验**与**供给/创作者/商家**利益；具体算法因平台而异。'
  },
  'aarrr': {
    body:
      '**AARRR**（Dave McClure 提出的增长框架）：Acquisition 获取 · Activation 激活 · Retention 留存 · Revenue 收入 · Referral 推荐。\n\n注意：留存差时先修产品价值，不必从拉新做起。各环节需对应可观测指标与实验，框架是**分析工具**而非唯一方法论。'
  },
  'priority-rice': {
    body:
      '**RICE**：Reach × Impact × Confidence / Effort（Intercom 推广的分析框架）。\n\n面试可简化打分，关键是**说清每项依据与取舍**；小团队也可用更轻的 ICE。'
  },
  'circles-framework': {
    body:
      '**CIRCLES** 为 Lewis Lin 等产品面试材料中常用的产品设计框架（字母略有不同版本）：\n\nComprehend 背景 · Identify 用户 · Report 需求 · Cut 优先级 · List 方案 · Evaluate 权衡 · Summarize 总结。\n\n适用「设计某功能」类题，强制落到用户、MVP 与指标。'
  },
  'prep-framework': {
    body:
      '**PREP**：结论（Point）→ 理由（Reason）→ 示例（Example）→ 结论（Point）。\n\n适用开放题、优缺点、方案选择；避免先铺 3 分钟背景。'
  },
  'douyin-local-push': {
    body:
      '**补贴**可短期拉高 GMV，但过高易伤商家与平台 UE。\n\n**本地推/巨量本地推**等：按 POI、半径、人群做付费触达，常用于提升核销 ROI。\n\n中长期靠供给、POI 信息准确性与商家运营，而非长期纯烧钱（具体产品名与规则以平台为准）。'
  }
};

let n = 0;
for (const sec of k.sections) {
  for (const card of sec.cards || []) {
    const p = PATCHES[card.id];
    if (!p) continue;
    if (p.title) card.title = p.title;
    if (p.body) card.body = p.body;
    if (p.tags) card.tags = p.tags;
    n++;
  }
}

k.version = (k.version || 1) + 1;
fs.writeFileSync(target, JSON.stringify(k, null, 2) + '\n', 'utf8');
console.log('Patched', n, 'cards. knowledge version', k.version);
