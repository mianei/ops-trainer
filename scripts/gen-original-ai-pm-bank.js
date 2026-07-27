/**
 * 生成 CVassistant 原创 AI 产品经理面试题库（100 题）
 * 运行: node scripts/gen-original-ai-pm-bank.js
 *
 * 说明：题目为产品原创，不引用第三方面经平台内容。
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TODAY = new Date().toISOString().slice(0, 10);

/** @type {{ text: string, difficulty: 'easy'|'medium'|'hard', curated?: boolean, framework?: string, outline?: string }[]} */
const RAW = [
  // —— 选型与架构 ——
  { text: '用户要「自动整理周报」，你会先用固定模板填空、Prompt 生成，还是直接上能调日历/文档的 Agent？怎么论证？', difficulty: 'easy', curated: true, framework: '复杂度 × 确定性 × 工具依赖', outline: '先判任务是否可模板化；再看是否需要实时外部状态；最后用失败成本决定是否上 Agent。' },
  { text: '同样是「知识问答」，什么产品形态适合纯 Prompt，什么时候必须上 RAG，什么时候该做成可编排的工作流？', difficulty: 'easy', curated: true, framework: '知识边界 / 更新频率 / 多步决策', outline: '封闭事实+低更新→Prompt；长尾/企业私域→RAG；跨系统动作与审批→工作流/Agent。' },
  { text: '团队想把「一次对话搞定办证」做成 Agent。你会用哪些信号判断现在还不该做，而应先做表单+规则引擎？', difficulty: 'medium' },
  { text: '设计一个「会议纪要助手」：要不要接公司日历、录音、IM？你会如何切 MVP 边界？', difficulty: 'medium', curated: true, framework: '价值路径 / 权限成本 / 评测可测性', outline: 'MVP 只做录音→结构化纪要；日历/IM 作为第二期，因权限与评测更难。' },
  { text: '产品里既有检索增强，又有工具调用。你会怎么划分「该查知识库」与「该调 API」的决策权？', difficulty: 'hard' },
  { text: '多租户 SaaS 里做企业知识助手：索引按租户隔离还是混合检索后过滤？你会怎么权衡召回与合规？', difficulty: 'hard' },
  { text: '一个「写作 Copilot」要不要长期记忆用户风格？你会如何设计记忆写入、覆盖与遗忘策略？', difficulty: 'medium' },
  { text: '当业务方要求「一个超级 Agent 打通所有后台」，你会如何拆成多个窄能力并定义编排层？', difficulty: 'hard', curated: true, framework: '能力边界 / 编排契约 / 失败隔离', outline: '按域拆窄 Agent；编排层只做路由与状态；单点失败可降级到人工。' },

  // —— 评测与质量 ——
  { text: 'AI 功能 Demo 准确率 92%，上线一周用户投诉「不准」。你会先查哪几类评测盲区？', difficulty: 'easy', curated: true, framework: '分布偏移 / 任务定义 / 用户期望', outline: '检查评测集是否过干净；线上意图是否比标注更模糊；用户是否把「建议」当「事实」。' },
  { text: '如何为「简历点评」设计一套可复现的评测：维度、抽样、打分一致性与回归门槛？', difficulty: 'medium' },
  { text: '业务说「幻觉率要降到接近 0」。你会如何把口号拆成可验收的指标与阶段目标？', difficulty: 'medium', curated: true, framework: '风险分级 / 可接受错误 / 阻断策略', outline: '高风险字段零容忍；低风险可标注不确定；用拦截+人工复核换阶段目标。' },
  { text: '离线指标变好了，但线上留存没动。你会如何拆「模型变好」与「产品没变好」？', difficulty: 'medium' },
  { text: '设计 badcase 运营机制：谁发现、怎么分级、多久回流训练/提示词、如何防重复踩坑？', difficulty: 'hard' },
  { text: '两个模型在盲测里打平，你会用什么产品实验设计决定是否换模？', difficulty: 'medium' },
  { text: '评测集被团队「考前刷到满分」。你会如何重建评测可信度？', difficulty: 'hard' },
  { text: '多模态生成（图文）的质量很难用单一分数衡量。你会怎么定「可发布」门槛？', difficulty: 'hard' },

  // —— 体验与交互 ——
  { text: '用户抱怨「第一次结果惊艳，改不下去」。你会如何改生成→编辑闭环？', difficulty: 'easy', curated: true, framework: '可控编辑 / 局部重写 / 约束输入', outline: '提供段落级重写、风格滑杆与引用约束，避免整篇重抽。' },
  { text: '流式输出中途发现答错了，产品该立刻打断、悄悄纠正，还是事后标注？如何取舍？', difficulty: 'medium' },
  { text: '如何设计「不确定时」的交互：反问、给选项、给置信度，还是直接拒答？', difficulty: 'easy' },
  { text: 'AI 助手在 IM 里被当成客服。你会如何管理预期，避免「什么都能办」？', difficulty: 'medium' },
  { text: '同样的能力，做成侧边栏 Copilot、独立聊天页，还是嵌入表单字段？怎么选？', difficulty: 'medium' },
  { text: '用户频繁点「重新生成」。这是功能信号还是体验失败？你会怎么验证？', difficulty: 'easy' },
  { text: '设计「一键应用 AI 建议」到正式文档的确认流：哪些必须人工确认？', difficulty: 'medium' },
  { text: '长任务 Agent 跑 3 分钟无反馈，用户会关掉。你会设计怎样的进度与可中断体验？', difficulty: 'medium', curated: true, framework: '阶段可见 / 可取消 / 部分结果', outline: '分阶段进度条+中间产物预览；随时停并保留已完成步骤。' },

  // —— 数据与飞轮 ——
  { text: '没有标注团队时，你如何用产品交互低成本积累高质量反馈数据？', difficulty: 'medium' },
  { text: '用户点赞/点踩噪声很大。你会如何设计反馈信号，让它真能改进模型或 Prompt？', difficulty: 'hard' },
  { text: '冷启动：新垂直领域几乎没有语料。你会按什么顺序建设数据资产？', difficulty: 'medium' },
  { text: '企业客户不愿上传私有文档进云端索引。你会如何设计本地/混合部署下的产品能力边界？', difficulty: 'hard' },
  { text: '如何判断「该微调」而不是继续堆 Prompt 与 RAG？给出决策清单。', difficulty: 'hard', curated: true, framework: '稳定失败模式 / 成本曲线 / 数据可控性', outline: '当失败模式稳定且可标注、Prompt 边际失效、数据可合规训练时再微调。' },
  { text: '竞品靠「用户生成内容反哺模型」。你的产品若没有同等规模，还能靠什么建立护城河？', difficulty: 'hard' },

  // —— 成本、时延与工程约束 ——
  { text: '高峰期 API 费用超预算。你会从缓存、路由小模型、缩短上下文、限流里怎么排优先级？', difficulty: 'easy' },
  { text: 'P95 延迟从 1.2s 涨到 4s，转化掉了。你会如何定位是检索、推理还是前端渲染？', difficulty: 'medium' },
  { text: '为省钱把复杂任务切到小模型，质量下滑。你会设计怎样的「路由策略」而不是一刀切？', difficulty: 'medium' },
  { text: '上下文窗口快满了：摘要压缩、滑动窗口、还是外部记忆？如何选？', difficulty: 'medium' },
  { text: '同一功能要支持「快而不准」与「慢而准」两种模式，产品上怎么表达与默认？', difficulty: 'easy' },
  { text: '供应商突然涨价 40%。你会如何在产品层做降级方案，而不是只砍功能？', difficulty: 'hard' },

  // —— 安全、合规与信任 ——
  { text: '生成内容被用户直接发给客户，事后发现事实错误。产品侧该预置哪些防护？', difficulty: 'medium', curated: true, framework: '风险分级 / 出处 / 人工闸门', outline: '对外发送强制引用来源或人工确认；高风险字段禁止一键外发。' },
  { text: '如何定义并处理「有害但用户主动要求」的生成请求？', difficulty: 'medium' },
  { text: 'RAG 召回了过期政策文档，助手据此给了错误建议。责任在检索、排序还是产品承诺？', difficulty: 'hard' },
  { text: '做儿童/教育场景的 AI，和做职场效率工具，安全策略会有哪些结构性差异？', difficulty: 'medium' },
  { text: '用户要求「完全按我说的语气」生成，但可能涉及冒充他人。你如何设产品红线？', difficulty: 'hard' },
  { text: '审计要求能解释「为什么推荐了这条答案」。你会如何设计可追溯链路？', difficulty: 'hard' },

  // —— 商业化与优先级 ——
  { text: '免费额度用完后转化率低。你会改定价、改能力分层，还是改首次价值体验？', difficulty: 'medium' },
  { text: '销售想卖「私有模型微调大单」，研发觉得维护不起。你会如何定产品化边界？', difficulty: 'hard' },
  { text: 'AI 功能提升了 DAU，但毛利为负。你会如何设定「可继续投入」的财务门槛？', difficulty: 'hard' },
  { text: '三个需求：提升准确率、降低成本、做新垂直模板。资源只够一个，怎么论证取舍？', difficulty: 'medium' },
  { text: '竞品免费开放同类能力。你会用差异化体验、工作流深度还是行业数据回应？', difficulty: 'medium' },
  { text: '如何衡量一个商业化 AI 功能是否「真的创造了客户愿意付费的价值」？', difficulty: 'easy' },

  // —— 组织协作与落地 ——
  { text: '算法同学想先训更强模型，你想先改交互与评测。你会如何推动对齐？', difficulty: 'medium' },
  { text: '业务方给了 50 条「必须支持」的口语需求。你会如何收敛成可交付的能力地图？', difficulty: 'medium' },
  { text: '上线后运营每天提 20 个 Prompt 修改。你会如何建立变更流程，避免线上抖动？', difficulty: 'hard' },
  { text: '跨部门对「成功」定义不同：准确率 vs 工单关闭率 vs NPS。你怎么统一北极星？', difficulty: 'hard' },
  { text: '外包标注质量不稳。你会在产品与流程上做什么，而不是只换供应商？', difficulty: 'medium' },

  // —— 场景设计题 ——
  { text: '为电商客服设计「退款协商助手」：哪些步骤可自动，哪些必须人工接管？', difficulty: 'medium' },
  { text: '为招聘平台设计「JD 与简历匹配解释」功能：如何避免歧视性表述与虚假匹配？', difficulty: 'hard' },
  { text: '为内部研发设计「根据报错建议修复」助手：如何控制它改代码的权限范围？', difficulty: 'hard' },
  { text: '为内容社区设计「AI 辅助发帖」：增长与虚假/营销内容风险如何同时管理？', difficulty: 'medium' },
  { text: '为销售设计「通话后自动填 CRM」：字段准确率与销售信任怎么同时建立？', difficulty: 'medium' },
  { text: '为医院导诊做对话助手：你会如何处理「像诊断但不是诊断」的产品表述？', difficulty: 'hard' },
  { text: '为在线教育设计「错题讲解 Agent」：如何保证讲解与教材版本一致？', difficulty: 'medium' },
  { text: '为本地生活设计「自然语言找店」：结构化筛选项与自由对话如何共存？', difficulty: 'medium' },

  // —— Agent 专项 ——
  { text: 'Agent 规划了 8 步但第 3 步失败。你会如何设计重试、跳过与向用户解释？', difficulty: 'medium' },
  { text: '工具调用返回脏数据时，Agent 仍继续往下走。产品层该加哪些护栏？', difficulty: 'hard' },
  { text: '多 Agent 协作（调研/写作/审核）时，如何避免互相改稿导致无限循环？', difficulty: 'hard' },
  { text: '用户说「帮我把这件事办完」但目标模糊。Agent 该追问到什么程度再执行？', difficulty: 'easy' },
  { text: '如何评测 Agent「是否真正完成任务」，而不是只评中间自然语言质量？', difficulty: 'hard' },
  { text: '给 Agent 开放「发邮件」工具。你会如何做权限、二次确认与审计日志？', difficulty: 'medium' },

  // —— RAG 专项 ——
  { text: '检索召回很多相关段落，但答案仍答非所问。你会优先改切块、排序还是生成约束？', difficulty: 'medium' },
  { text: '知识库每周更新，线上偶发引用旧版。你会如何做版本感知检索？', difficulty: 'hard' },
  { text: '用户问「对比 A 和 B」，单段检索不够。你会如何改查询规划？', difficulty: 'medium' },
  { text: '混合检索（关键词+向量）效果波动大。你会如何定义调参实验与回滚标准？', difficulty: 'hard' },
  { text: '企业文档有大量表格与截图。纯文本 RAG 不够，你会如何扩展产品能力？', difficulty: 'hard' },
  { text: '召回命中了，但生成时忽略关键约束。你会在 Prompt 还是后处理里强制？', difficulty: 'medium' },

  // —— Prompt / 模型产品化 ——
  { text: '运营想把 Prompt 做成可视化配置后台。你如何防止「人人可改线上提示词」？', difficulty: 'medium' },
  { text: '同一 Prompt 在不同模型上表现差很多。产品要不要暴露「模型选择」给用户？', difficulty: 'easy' },
  { text: '结构化输出（JSON）经常缺字段。你会用校验重试、约束解码还是改产品表单？', difficulty: 'medium' },
  { text: '如何把「专家经验」沉淀成可版本管理的 Prompt/技能包，而不是聊天记录？', difficulty: 'medium' },

  // —— 增长与增长实验 ——
  { text: '新用户首次使用 AI 功能完成率低。你会设计怎样的引导，而不是塞教程？', difficulty: 'easy' },
  { text: 'AI 功能让核心路径变短，但老用户觉得「失控」。如何做渐进披露？', difficulty: 'medium' },
  { text: '你要用什么实验设计验证「AI 推荐」是否伤害多样性与长期生态？', difficulty: 'hard' },

  // —— 指标与策略 ——
  { text: '定义「AI 采纳率」时，点开、生成、应用、次日复用，你会选哪个作核心？', difficulty: 'easy' },
  { text: '准确率提升 2 个点但耗时翻倍。你会如何做产品侧的可接受区间？', difficulty: 'medium' },
  { text: '如何把「人工审核通过率」设计成驱动模型改进的指标，而不是绩效考核游戏？', difficulty: 'hard' },
  { text: '北星指标选「节省工时」还是「任务成功率」？在 ToB AI 里怎么论证？', difficulty: 'medium' },

  // —— 开放综合 ——
  { text: '如果只能用 4 周做一个可演示的 AI 产品 MVP，你会选什么场景，砍掉什么？', difficulty: 'easy' },
  { text: '一个 AI 功能短期数据好看，但你怀疑不可持续。你会看哪些先行指标？', difficulty: 'medium' },
  { text: '当法规要求「高风险 AI 决策可人工推翻」，你会如何改产品信息架构？', difficulty: 'hard' },
  { text: '团队争论「先做通用助手还是垂直场景」。你会用什么框架拍板？', difficulty: 'medium' },
  { text: '如何向非技术高管解释：为什么「换更大模型」不一定能解决当前产品问题？', difficulty: 'easy' },
  { text: '设计「人机协同」岗位：AI 出初稿，专家终审。如何避免专家变成廉价校对？', difficulty: 'hard' },
  { text: '若核心供应商模型能力突然被开源追上，你的产品护城河还剩什么？', difficulty: 'hard' },
  { text: '做一个「面试模拟」AI：如何避免它只会背标准答案，而能练追问与应变？', difficulty: 'medium' },
  { text: '产品要支持多语言，但评测集只有中文。你会如何扩展评测与发布策略？', difficulty: 'medium' },
  { text: '用户把隐私信息粘进对话框。你会在前端、服务端、模型侧分别做什么？', difficulty: 'medium' },
  { text: '如何判断一个「看起来很智能」的功能其实只是规则+模板，值不值得用大模型？', difficulty: 'easy' },
  { text: '上线后发现 30% 请求是闲聊。你会限流、引导回主场景，还是单独产品化？', difficulty: 'easy' },
  { text: '为内部知识助手定 SLA：可用性、正确性、响应时间，哪项最该先写进合同级承诺？', difficulty: 'hard' },
  { text: '当业务要求「必须引用内部 Wiki 原文」时，生成自由度与合规如何平衡？', difficulty: 'medium' },
  { text: '设计失败挽回：AI 答错后，怎样的道歉与补偿动作能恢复信任且可规模化？', difficulty: 'medium' },
  { text: '如果你负责把「评测平台」产品化给非算法同学用，最小可用功能集是什么？', difficulty: 'medium' }
];

if (RAW.length !== 100) {
  console.error('Expected 100 questions, got', RAW.length);
  process.exit(1);
}

const seen = new Set();
for (const q of RAW) {
  const t = q.text.trim();
  if (seen.has(t)) {
    console.error('Duplicate:', t.slice(0, 40));
    process.exit(1);
  }
  seen.add(t);
}

const questions = RAW.map((q, i) => {
  const n = i + 1;
  return {
    id: `ai-pm-${String(n).padStart(3, '0')}`,
    num: n,
    text: q.text.trim(),
    company: '通用',
    type: 'ai_product',
    typeLabel: 'AI产品经理',
    difficulty: q.difficulty,
    topicId: 'iv-pm',
    source: 'CVassistant原创',
    framework: q.framework || '',
    referenceOutline: q.outline || '',
    curated: Boolean(q.curated),
    tags: ['AI产品经理', 'ai_product', 'CVassistant原创']
  };
});

const curated = questions.filter(q => q.curated).map((q, i) => ({
  ...q,
  id: `ai-pm-curated-${String(i + 1).padStart(3, '0')}`,
  num: i + 1,
  source: 'CVassistant精选',
  referenceAnswer: q.referenceOutline || '',
  projects: ['通用方法论'],
  tags: ['AI产品经理', '精选', 'CVassistant原创']
}));

const bank = {
  version: 3,
  product: 'CVassistant AI PM Interview Bank (Original)',
  updated: TODAY,
  total: questions.length,
  curatedCount: curated.length,
  note: '本题库为 CVassistant 产品原创，非第三方面经搬运。',
  questions
};

const curatedBank = {
  version: 2,
  title: 'AI PM 精选题 · 原创框架提示',
  hint: '结合自己的项目经历改写后口述练习',
  updated: TODAY,
  questions: curated
};

fs.writeFileSync(path.join(ROOT, 'interview-bank-ai-pm.json'), JSON.stringify(bank, null, 2));
fs.writeFileSync(path.join(ROOT, 'interview-bank-ai-pm-curated.json'), JSON.stringify(curatedBank, null, 2));
console.log('Wrote interview-bank-ai-pm.json', questions.length);
console.log('Wrote interview-bank-ai-pm-curated.json', curated.length);
