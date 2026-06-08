/**
 * 产品思维练习题（普通面经格式，无录音包装、无第三方前缀）
 * 输出: scenarios-pm-product-batch3.json
 * 运行: node scripts/build-pm-product-scenarios.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const debriefPath = path.join(__dirname, '../scenarios-pm-debrief.json');
const outPath = path.join(__dirname, '../scenarios-pm-product-batch3.json');

/** 面经标签 → topic id */
const TOPIC_MAP = {
  需求: 'user',
  功能: 'feature',
  竞品: 'competitor',
  设计: 'prod-open',
  AI: 'iv-pm',
  产品: 'iv-pm',
  决策: 'decision',
  增长: 'decision',
  估算: 'prod-open'
};

function mianjingTag(kind) {
  const tagKind = { 判断: '竞品', 开放: '设计', 增长: '决策', 项目: '产品' }[kind] || kind;
  return tagKind;
}

function scenario(kind, question) {
  return `【面经·${mianjingTag(kind)}】${question}`;
}

function normKey(s) {
  return s.replace(/^【[^】]+】/, '').replace(/\s+/g, '').slice(0, 80);
}

function extractQuestion(raw) {
  const m = raw.match(/面试官：「([^」]+)」/);
  if (m) return m[1];
  return raw.replace(/^【[^】]+】[^】]*】/, '').split('\n')[0].trim();
}

function kindFromDebrief(raw) {
  const m = raw.match(/^【产品拆解·([^】]+)】/);
  return m ? m[1] : '需求';
}

const pools = {
  user: [
    scenario('需求', '用户调研里 60% 的人说「希望加 XX 功能」，但样本主要是低频用户。你会如何判断是否立项？'),
    scenario('需求', '外卖用户大量投诉「配送慢」，业务方建议先给骑手加压提速。你会如何分析根因并给出建议？'),
    scenario('需求', '健身 App 商店一星评价集中在「功能少、界面丑」，团队计划大改版。你会如何验证这是否真需求？'),
    scenario('需求', '社交 App 用户反馈「朋友都不用」，运营想加大投放拉新。你会先澄清哪些问题？'),
    scenario('需求', 'B 端大客户要求定制 5 个专属字段，销售称能签百万单。你会如何评估接还是不接？'),
    scenario('需求', '在线教育完课率 12%，用户说「太难」。你会如何区分内容、动机与匹配度问题？'),
    scenario('需求', '一款工具 App 收到大量「希望增加社交分享」反馈，但分享按钮点击率不足 1%。你会如何决策？'),
    scenario('需求', '用户访谈里多人提到「希望 App 更专业」，但「专业」含义模糊。你会如何继续收敛需求？')
  ],
  feature: [
    scenario('功能', '笔记 App 计划在首页用 40% 面积放「AI 一键整理」，设计团队担心干扰「快速记录」主路径。你会如何论证并推进？'),
    scenario('功能', '外卖订单详情页新增「顺手买」默认展开，客单价升 8% 但「找不到物流进度」投诉增多。你会怎么改？'),
    scenario('功能', 'B 端 CRM 客户详情有 27 个 Tab，销售找不到上次跟进记录；合并方案研发估 6 周。你如何分期推进？'),
    scenario('功能', '社交 App 计划上线「已读不回提醒」，一半用户强烈支持、一半认为有社交压力。你会如何设计规则与默认态？'),
    scenario('功能', '上线前 3 天发现核心功能埋点错误，业务方仍希望按时发布。你的上线/延期判断标准是什么？'),
    scenario('功能', '短视频 App 想在评论区置顶「AI 总结本楼观点」，担心带偏讨论。你会如何设计上线范围与风控？'),
    scenario('功能', '地图 App 计划把「打车」入口提升到首页第二屏，导航团队认为会干扰驾车场景。你如何论证优先级？'),
    scenario('功能', '需求评审时研发表示「技术上做不了」，但业务 deadline 不变。你会如何沟通并找替代方案？'),
    scenario('功能', 'Backlog 里 5 个需求只能做 2 个，两个业务方都认为自己的最 urgent。你会如何排序并解释？')
  ],
  competitor: [
    scenario('判断', '微信读书突然推出「全场限时免费」，作为竞品读书 App 运营你会如何解读并应对？'),
    scenario('判断', '头部外卖平台大力推广 15 元/月「月卡」，你认为其战略意图是什么？对商家、骑手、用户分别意味着什么？'),
    scenario('判断', '抖音在视频下方测试「边看边买」，作为货架电商直播运营你会如何应对（短期 + 中期各 1 条）？'),
    scenario('判断', '竞品宣布开放 API 允许第三方接入，这通常意味着什么？对你方产品有什么机会与威胁？'),
    scenario('判断', '请用 3 分钟分析你最喜欢的一款 App：定位、用户、核心价值、短板，以及若你是 PM 会做的 1 个实验。'),
    scenario('判断', '拼多多强调低价白牌供给，自营品牌电商是否应跟进价格战？请给出立场与依据。'),
    scenario('判断', '美团在外卖首页强化「神枪手」低价专区，你会如何解读并制定应对策略？'),
    scenario('判断', 'Notion 推出 AI 全库问答，国内笔记类产品是否应立刻跟进？请给出节奏建议。')
  ],
  'prod-open': [
    scenario('开放', '微信为什么不把「朋友圈」放在 Tab 首屏？请从产品定位、用户任务优先级与生态角度分析。'),
    scenario('开放', '请设计一款面向老年人的打车 App：先澄清场景，再讲 MVP 功能与验证方式。'),
    scenario('开放', '直播间「礼物榜」值得做吗？请分析收入、体验、公平性与合规，并给出结论与护栏。'),
    scenario('开放', '如何提升知乎的回答质量？请选 1 个杠杆（供给/分发/治理）深入，不要泛泛罗列。'),
    scenario('开放', '小红书为什么长期强调双列图文 feed，而不是做成纯短视频？请从用户任务与供给结构分析。'),
    scenario('开放', '如何设计一款帮助应届生准备产品面试的 App？讲目标用户、核心路径、MVP 与指标。'),
    scenario('开放', '若让你优化小红书搜索体验，你会优先改哪 3 件事？每件事配 1 个衡量指标。'),
    scenario('开放', 'App push 通知上线前三天点击率很高、之后明显下降，可能原因有哪些？你会如何排查与优化？'),
    scenario('开放', '如何让更多用户在小红书发布笔记？请从供给侧、分发侧、动机侧各给 1 条可落地策略。'),
    scenario('开放', '同一搜索词在百度、小红书、抖音上，用户预期结果应有何不同？请举例说明。'),
    scenario('开放', '小红书搜索无结果时，目前可能展示弱相关内容。你会如何优化「零结果」体验？'),
    scenario('开放', '微信「听一听」与网易云竞争，微信应做到什么程度、什么不该做？'),
    scenario('估算', '估算中国一线城市白领一年在咖啡上的花费（费米估算，写出假设链）。'),
    scenario('估算', '估算某地铁线路早高峰 1 小时进出站人次（允许合理假设）。'),
    scenario('估算', '估算全国一年外卖订单总量级（说明分解维度与校验方式）。'),
    scenario('估算', '估算一款日 DAU 100 万的工具 App，一天产生多少条埋点日志（数量级即可）。')
  ],
  'iv-pm': [
    scenario('AI', 'AI 功能上线后用户集中吐槽「幻觉/答非所问」，作为产品经理你会设计哪些体验与流程兜底？'),
    scenario('AI', '要在 App 内加「AI 助手」入口，MVP 范围如何定义？请写 2 个成功指标与 1 个护栏指标。'),
    scenario('AI', '业务方希望做「万能 AI 助手」覆盖全场景，研发评估 6 个月。你会如何用 MVP 思路沟通并收敛？'),
    scenario('AI', '内容审核 Agent 回复准确率突然下降，作为产品你会按什么顺序排查？'),
    scenario('AI', '请从产品视角说明 RAG 与微调各自适合什么场景，并各举 1 个「不适合」的反例。'),
    scenario('AI', 'AI 生成 push 文案相比人工撰写，你会如何设计灰度、人工复核点与效果评估？'),
    scenario('AI', '如何设计产品手段降低 Agent 输出风险（幻觉、违规、隐私）？请分层回答。'),
    scenario('AI', 'Agent 哪些任务适合自动化，哪些仍需人工？请结合内容社区场景举例。'),
    scenario('项目', '请描述一个你负责的需求从 0 到 1：问题是否成立、方案取舍、数据验证、个人贡献边界。'),
    scenario('项目', '上线后核心指标未达预期，你会如何组织复盘（假设、埋点、外部因素、下一步实验）？')
  ],
  decision: [
    scenario('增长', '产品增长停滞，手上有 50 万预算。请先诊断 AARRR 哪一环，再给出 2 个可选方向与取舍依据。'),
    scenario('增长', '新用户 7 日留存低于行业 8 个点，注册量靠投放维持。你会先修激活、渠道还是留存？为什么？'),
    scenario('增长', '签到活动带来 DAU 上涨，但核心功能使用时长下降。你会继续、调整还是叫停？判断依据是什么？'),
    scenario('增长', '大促只能选「满减」或「会员专属折扣」二选一，你会如何决策？需要监控哪些指标？'),
    scenario('增长', '产品经理主张全量 push，运营主张分层 push。你会支持哪方？如何设计验证？'),
    scenario('增长', '项目做到 75% 发现核心假设不成立，deadline 不变。你会如何 pivot 并与 stakeholder 对齐？'),
    scenario('增长', '读书 App 发现 30+ 用户留存显著高于年轻人，但运营资源 80% 投向学生。你会如何调整？'),
    scenario('增长', '拉新成本上涨 40%，次留持平。你会先优化获客、激活还是留存？请写出诊断逻辑。'),
    scenario('增长', '活动带来 DAU 峰值但次周回落到活动前。这场活动算成功吗？你如何判断并改进？')
  ]
};

const rebuilt = {};
const seenGlobal = new Set();

function add(topicId, text) {
  const key = normKey(text);
  if (seenGlobal.has(key)) return;
  seenGlobal.add(key);
  if (!rebuilt[topicId]) rebuilt[topicId] = [];
  rebuilt[topicId].push(text);
}

for (const [topicId, list] of Object.entries(pools)) {
  for (const text of list) add(topicId, text);
}

if (fs.existsSync(debriefPath)) {
  const debrief = JSON.parse(fs.readFileSync(debriefPath, 'utf8'));
  for (const list of Object.values(debrief)) {
    for (const raw of list) {
      const kind = kindFromDebrief(raw);
      const topicId = TOPIC_MAP[kind] || TOPIC_MAP[mianjingTag(kind)] || 'user';
      const q = extractQuestion(raw);
      if (!q || q.length < 6) continue;
      add(topicId, scenario(kind, q.endsWith('？') || q.endsWith('?') ? q : q + '？'));
    }
  }
}

fs.writeFileSync(outPath, JSON.stringify(rebuilt, null, 2) + '\n', 'utf8');
let total = 0;
for (const arr of Object.values(rebuilt)) total += arr.length;
console.log('Wrote', outPath, '| scenarios:', total);
for (const [k, arr] of Object.entries(rebuilt)) console.log(' ', k, arr.length);
