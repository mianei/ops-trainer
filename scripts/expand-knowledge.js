/**
 * 合并扩充 knowledge.json（保留现有卡片，追加行业/模块框架）
 * 运行: node scripts/expand-knowledge.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const target = path.join(root, 'knowledge.json');

const existing = JSON.parse(fs.readFileSync(target, 'utf8'));
const existingIds = new Set();
for (const sec of existing.sections || []) {
  for (const c of sec.cards || []) existingIds.add(c.id);
}

const newSections = [
  {
    id: 'industry-ota',
    title: 'OTA / 酒旅',
    cat: 'ops',
    cards: [
      { id: 'ota-hotel-modes', title: '酒店代理 vs 批发', tags: ['OTA', '决策', '商业'], body: '**代理**：入住后抽佣约 13–14%，轻资产，体验可控。\n**批发**：批量拿房加价卖，毛利可更高但占资金、体验波动大。\n\n论证策略时写清：现金流、供给关系、用户体验谁负责。' },
      { id: 'ota-cross-sell', title: '高频打低频（机+酒）', tags: ['OTA', '增长'], body: '火车票/机票佣金低，但可带来 **48h 内订酒店** 等高转化交叉行为。\n\n砍低频业务前要看：**引流价值 vs 账面利润**，用 LTV 而非单业务线 P&L。' },
      { id: 'ota-demand-shift', title: '需求延迟与场景转移', tags: ['OTA', '需求'], body: '需求不会消失，只会 **延迟满足**（长途→暂缓）或 **转移场景**（长途游→周边游）。\n\n产品排期应随场景变：供给结构、SKU、内容形态一起调。' },
      { id: 'ota-review-trust', title: '旅游评价为何更严', tags: ['OTA', '产品'], body: '体验不可逆、评价是决策生命线、刷评博弈更重。\n\n治理：机审信号（时空/IP/文本相似）+ 人审 + 商家申诉闭环。' },
      { id: 'ota-oligopoly', title: 'OTA 一超多强', tags: ['OTA', '竞品'], body: '护城河：供给规模、网络效应、资金与品牌心智。\n\n第二梯队常做 **错位**（下沉/生态/细分），而非正面复制全品类。' }
    ]
  },
  {
    id: 'industry-ecom',
    title: '电商',
    cat: 'ops',
    cards: [
      { id: 'ecom-shelf-vs-content', title: '货架电商 vs 内容电商', tags: ['电商', '需求'], body: '**货架**：人找货，效率/价格/履约优先。\n**内容**：货找人，种草激发需求，信任与内容成本更高。\n\n同一 SKU 详情页应突出不同决策信息。' },
      { id: 'ecom-revenue-formula', title: '平台收入公式', tags: ['电商', '商业'], body: '收入 ≈ **佣金 + 广告 + 服务 + 金融** − 补贴与履约成本。\n\n加广告位要算：GMV 增量 vs 体验损伤 vs 商家流失。' },
      { id: 'ecom-refund-risk', title: '仅退款与风控分层', tags: ['电商', '运营'], body: '识别 → 防控（L1/L2/L3 差异化）→ 补救（误伤挽回）。\n\n长期看：正常高退货类目（服饰）与恶意羊毛党要分开治理。' },
      { id: 'ecom-subsidy-fission', title: '裂变 ROI 粗算', tags: ['电商', '增长'], body: '估算：单用户价值 × 转化率 × 裂变系数 − 补贴成本。\n\n规则要可调：当流失上升时优先收紧裂变系数而非盲目加补贴。' },
      { id: 'ecom-ai-priority', title: '电商 AI 落地优先级', tags: ['电商', 'AI'], body: '常见场景：客服、搜索、供应链预测、视觉、风控、直播。\n\n优先选：**数据基础好 + ROI 可衡量 + 风险可控** 的两项先做。' }
    ]
  },
  {
    id: 'industry-community',
    title: '社区 / 内容平台',
    cat: 'ops',
    cards: [
      { id: 'community-triangle', title: '社区商业化权衡（常称「不可能三角」）', tags: ['社区', '商业'], body: '行业常用启发式：规模增长 · 社区调性 · 商业化效率难同时最优。分析时声明优先保哪两角、牺牲哪一角，并写护栏指标。' },
      { id: 'community-ces', title: '小红书 CES 排序逻辑', tags: ['社区', '数据'], body: 'CES 综合点赞/收藏/评论/分享/关注，强调 **有用与深度互动** 而非纯曝光。\n\n收藏高、点赞低可能偏「干货」而非标题党。' },
      { id: 'community-evolution', title: '社区 1.0→3.0', tags: ['社区', '增长'], body: '1.0 BBS → 2.0 关注流与圈层 → 3.0 算法兴趣分发。\n\n停滞时查：供给质量、分发效率、入圈门槛哪段卡住。' },
      { id: 'community-bilibili-metrics', title: 'B 站互动权重', tags: ['社区', 'B站'], body: '完播 > 投币 > 收藏 > 点赞 > 弹幕。\n\n标题党：点击高、完播低 → 降权/限流，并看 UP 历史质量。' },
      { id: 'community-aigc', title: 'AIGC 与社区治理', tags: ['社区', '危机'], body: '策略：标注透明、分流（工具向鼓励/体验向降权）、AI 作 Copilot 而非替代创作者。' }
    ]
  },
  {
    id: 'growth-retention',
    title: '增长与留存',
    cat: 'ops',
    cards: [
      { id: 'rfm-basics', title: 'RFM 分层思路', tags: ['留存', '运营'], body: '**R** 最近消费 **F** 频次 **M** 金额。\n\n高 R 低 F：唤醒；高 F 低 M：提客单；流失预警：R 骤降。' },
      { id: 'retention-value', title: '留存本质', tags: ['留存'], body: '留存不是发券，是 **持续交付用户愿意留下的价值**。\n\n先修产品/供给，再放大运营动作。' },
      { id: 'cohort-read', title: 'Cohort 怎么看', tags: ['数据', '留存'], body: '按注册周/渠道看留存曲线是否抬升。\n\n对比版本、活动时要控制渠道结构变化。' }
    ]
  },
  {
    id: 'content-ux',
    title: '传播与交互',
    cat: 'product',
    cards: [
      { id: 'aida-hook', title: 'AIDA 与行动文案', tags: ['传播', '文案'], body: '**注意→兴趣→欲望→行动**。信息文案讲清事实；行动文案要有具体利益与低门槛 CTA。' },
      { id: 'ia-four', title: '信息架构四原则', tags: ['交互', '产品'], body: '**近用性、可见性、一致性、防错**。\n\n改引导不如改结构；主/次/危险操作视觉层级要分明。' },
      { id: 'fitts-law', title: '主路径与操作成本', tags: ['交互'], body: '高频操作应 **更大、更近、更少步**。\n\n首屏资源给最高频任务，而非老板喜欢的差异化功能。' }
    ]
  },
  {
    id: 'interview-expr',
    title: '面试表达（扩展）',
    cat: 'interview',
    cards: [
      { id: 'star-full', title: 'STAR 完整结构', tags: ['面试', 'STAR'], body: '**S** 情境 **T** 任务 **A** 行动 **R** 结果 + **反思**（方法论而非「学到了很多」）。\n\n数据要能对应到 A 中的关键动作。' },
      { id: 'advantage-four', title: '优势题四件套', tags: ['面试'], body: '**标签 + 内涵定义 + 可验证 Case + 岗位匹配**。\n\n避免「踏实肯干」等无法追问的空词。' },
      { id: 'career-stages', title: '职业规划分阶段', tags: ['面试', 'HR'], body: '1–3 年可执行技能 → 3–5 年业务深度 → 长期方向与公司是 **契合** 而非空喊专家。\n\n转岗动机基于已验证能力，而非仅薪资/跟风。' },
      { id: 'project-intro', title: '项目介绍结构', tags: ['面试', 'PM'], body: '背景 → 目标/指标 → 你的角色 → 关键决策与 trade-off → 结果 → 复盘。\n\n区分「我做了」与「团队做了」。' }
    ]
  },
  {
    id: 'biz-platform',
    title: '平台与商业',
    cat: 'ops',
    cards: [
      { id: 'super-app-logic', title: '超级 App 逻辑', tags: ['平台', '面试'], body: '高频带低频、交叉引流、统一账号与支付。\n\n子 App 独立与否看：**封禁风险、品牌冲突、协同效率**。' },
      { id: 'cac-ltv', title: 'CAC / LTV 粗判', tags: ['商业'], body: '获客成本要能由用户生命周期价值覆盖。\n\n补贴拉新要看 **留存与复购** 是否跟得上，而非只看 DAU。' },
      { id: 'aigc-product', title: 'AIGC 产品化边界', tags: ['AI', '产品'], body: '关注：幻觉、成本、场景边界、人机协作、风控。\n\n落点要有指标、灰度、回滚方案。' }
    ]
  },
  {
    id: 'instant-retail',
    title: '即时零售',
    cat: 'ops',
    cards: [
      { id: 'instant-grid', title: '3–5km 网格履约', tags: ['即时零售', '履约'], body: '以 **网格密度** 换 T+0.5 时效；拣货、骑手、库存三位一体。\n\n扩城先看单网格 UE，而非全国铺开。' },
      { id: 'instant-vs-ecom', title: '计划购 vs 急用', tags: ['即时零售', '需求'], body: '电商满足 **囤货/比价**；即时零售满足 **急用/忘买**。\n\n品类策略：高频刚需 SKU 优先，低周转慎入。' }
    ]
  },
  {
    id: 'map-local',
    title: '出行与地图',
    cat: 'ops',
    cards: [
      { id: 'ride-supply-demand', title: '出行供需与补贴', tags: ['出行', '决策'], body: '补贴是 **调节供需失衡** 的手段，不是长期战略。\n\n看：应答率、空驶率、司机留存、用户等待时长。' },
      { id: 'local-o2o-triangle', title: '本地生活三角', tags: ['本地生活', 'O2O'], body: '**人找店 / 店找人 / 冲动消费** 对应不同产品与履约。\n\n分析要纳入供给、核销、退款与信任。' }
    ]
  },
  {
    id: 'crisis-content',
    title: '舆情与传播',
    cat: 'ops',
    cards: [
      { id: 'crisis-time-window', title: '危机时间窗口', tags: ['舆情', '危机'], body: '**1h** 首次回应 · **6h** 事实与行动 · **24h** 改进节点。\n\n区分事实/情绪/价值观问题，策略不同。' },
      { id: 'social-currency', title: '传播动因（社交货币）', tags: ['传播'], body: '用户分享因：**社交货币、利他、稀缺、情绪、具体利益**。\n\n机制设计要降低参与门槛并提高可炫耀性。' }
    ]
  },
  {
    id: 'interview-pm-extra',
    title: 'PM 方法',
    cat: 'interview',
    cards: [
      { id: 'ab-test-basics', title: 'A/B 实验要点', tags: ['PM', '数据'], body: '明确 **假设、指标、样本、周期**；排除节假日/渠道污染。\n\n小流量灰度 → 全量，预设回滚条件。' },
      { id: 'prd-not-list', title: 'PRD 不是功能清单', tags: ['PM'], body: '要写清：**问题、用户、成功指标、非目标、风险**。\n\n评审先对齐问题是否 worth solving。' },
      { id: 'priority-rice', title: '优先级 RICE 粗用', tags: ['PM', '排期'], body: 'Reach × Impact × Confidence / Effort。\n\n面试中可简化表述，关键是 **说清取舍理由**。' }
    ]
  },
  {
    id: 'ota-extra',
    title: 'OTA 补充',
    cat: 'ops',
    cards: [
      { id: 'ota-train-profit', title: '火车票盈利结构', tags: ['OTA', '商业'], body: '官方佣金低；利润常来自 **附加服务、会员权益、交叉订酒**。\n\n合规后需重建：**联程、企业差旅、会员打包**。' },
      { id: 'ota-live-package', title: '直播卖套餐', tags: ['OTA', '内容'], body: '内容种草 + 限时套餐核销，适合 **周边游/酒景套餐**。\n\n成功看核销率与复购，而非仅 GMV。' },
      { id: 'ota-booking-diff', title: 'Booking vs 国内 OTA', tags: ['OTA', '竞品'], body: 'Booking 优势常在：**跨境供给、多语言服务、标准化体验**。\n\n国内 OTA 强在 **本地供给深度与履约**。' }
    ]
  },
  {
    id: 'ecom-extra',
    title: '电商补充',
    cat: 'ops',
    cards: [
      { id: 'ecom-search-rank', title: '搜索排序混排', tags: ['电商', '策略'], body: 'GMV、体验、广告、利润常混排。\n\n低价流量暴涨但利润降 → 设 **利润池/保体验权重**。' },
      { id: 'ecom-category-strategy', title: '类目战略取舍', tags: ['电商', '决策'], body: '3C 流量大佣金低；美妆利润高但合规与投放贵。\n\n用 **战略类目 + 现金流类目** 组合论证。' },
      { id: 'ecom-trust', title: '信任与复购', tags: ['电商', '母婴'], body: '母婴/宠物等 **信任权重高**，不能只用价格推荐。\n\n评价、正品、售后、内容专业度同为决策因子。' }
    ]
  },
  {
    id: 'community-extra',
    title: '社区补充',
    cat: 'ops',
    cards: [
      { id: 'zhihu-salt', title: '知乎盐选权衡', tags: ['社区', '商业'], body: '故事会提升变现但可能损伤 **问答品质与精英用户**。\n\n指标：付费转化 vs 核心创作者留存与内容深度。' },
      { id: 'xhs-search', title: '种草即搜索', tags: ['社区', '小红书'], body: '从「来种草买什么」到「搜攻略/怎么装修」。\n\n详情页与搜索入口要承接 **决策型信息结构**。' }
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

existing.version = 2;
const total = existing.sections.reduce((n, s) => n + (s.cards?.length || 0), 0);
fs.writeFileSync(target, JSON.stringify(existing, null, 2) + '\n', 'utf8');
console.log('knowledge.json updated, total cards:', total);
