/**
 * 从 AI PM 题库构建 30 条评分评测集 → eval/scoring-golden.json + eval/评测集说明.md
 * 运行: node scripts/build-eval-golden.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const META = {
  version: 2,
  description: 'CVassistant AI PM 业务场景点评评测集（30 条 × 5 维度，来自 interview-bank-ai-pm.json）',
  dimensions: ['逻辑性', '专业性', '流畅度', '匹配度', '内容密度'],
  annotation: {
    method: 'author_rubric',
    annotator: 'CVassistant 评测集 v2',
    date: '2026-06-16',
    note: 'humanScores 按 dimensionGuide 自标，用于 AI 点评与人工分 Spearman 对齐；优/中/差各 10 条',
    rubricVersion: 2,
    levels: { excellent: 5, average: 3, poor: 2 }
  },
  dimensionGuide: {
    逻辑性: '1=混乱无结构 3=有结构但跳跃 5=结论-论据-总结清晰',
    专业性: '1=无 AI PM 框架 3=提到 RAG/Agent/评测但无展开 5=技术边界+产品判断+评测闭环',
    流畅度: '1=重复卡顿 3=可读 5=自然口语/书面皆可',
    匹配度: '1=跑题 3=部分扣题 5=紧扣 AI PM 题干',
    内容密度: '1=空话堆砌 3=有观点无证据 5=案例/指标/步骤/badcase 具体'
  }
};

/** @type {Array<{id:string,level:string,type:string,bankNum:number,bankId:string,tags:string[],scenario:string,answer:string,humanScores:Record<string,number>}>} */
const SAMPLES = [
  // ── excellent ×10 ──
  {
    id: 'eval-001', level: 'excellent', type: 'ai_product', bankNum: 1, bankId: 'ai-pm-001',
    tags: ['prompt', 'rag', 'agent'],
    scenario: '一个需求摆在面前，什么时候适合先调Prompt，什么时候该上RAG，什么时候已经需要Agent了？',
    answer: '我会按任务复杂度与不确定性三分：①调 Prompt——单步、格式固定、知识在上下文内，如固定样式组件生成；②上 RAG——需要外部/私有知识且答案应 grounded，如面试题库点评要引用面经；③上 Agent——多步决策+工具调用+状态，如匹配家教：理解需求→检索→发邀请→跟进。判断标准：能否用一次 completion 稳定完成？是否需要检索证据？是否需要规划-执行-反馈闭环。MVP 优先 Prompt/RAG，Agent 只在链路 badcase 证明单轮不够时再上。',
    humanScores: { 逻辑性: 5, 专业性: 5, 流畅度: 4, 匹配度: 5, 内容密度: 5 }
  },
  {
    id: 'eval-002', level: 'excellent', type: 'ai_product', bankNum: 8, bankId: 'ai-pm-008',
    tags: ['eval', 'hallucination'],
    scenario: '在推荐系统中引入LLM生成「个性化推荐理由」时，如何低成本且高效地评估模型是否存在「幻觉」或「过度承诺」？请给出一个可落地的评测方案。',
    answer: '双层评测：事实层+表达层。事实层：NER 抽商品名/价格/折扣→与商品库交叉验证，算实体匹配率；表达层：风险词库（绝对、100%、保证）+正则+人工抽检。样本来源：线上 badcase 50 条+合成对抗 30 条。指标：幻觉率、过度承诺率、CTR 不下降前提下投诉率。执行：脚本自动跑 80% case，PM 每周抽 20 条校准 rubric。迭代：幻觉集中在价格→加强 grounding prompt；过度承诺→模板约束+拒答策略。',
    humanScores: { 逻辑性: 5, 专业性: 5, 流畅度: 4, 匹配度: 5, 内容密度: 5 }
  },
  {
    id: 'eval-003', level: 'excellent', type: 'ai_product', bankNum: 2, bankId: 'ai-pm-002',
    tags: ['agent', 'badcase'],
    scenario: '一个Agent在Demo环境里通过率很高，接进真实研发流程后失败率明显上升，你会先把问题切到哪几个层面？',
    answer: '三层归因：①数据层——Demo 标准输入 vs 真实脏数据（错别字、口语、多轮丢失）；②环境层——接口超时、下游不稳定、并发导致工具调用失败；③交互层——Demo 单轮 vs 真实打断/换题/情绪。先拉失败 trace 分桶，看失败集中在哪一步（规划/检索/工具/生成）。48h 内：冻结版本、抽样 100 条真实链路、对比 Demo 同题通过率。产品动作：加澄清策略、超时重试、人工兜底节点，并用同一评测集复测。',
    humanScores: { 逻辑性: 5, 专业性: 5, 流畅度: 5, 匹配度: 5, 内容密度: 4 }
  },
  {
    id: 'eval-004', level: 'excellent', type: 'ai_product', bankNum: 5, bankId: 'ai-pm-005',
    tags: ['decision', 'workflow'],
    scenario: '如果研发团队想优先做更强的模型能力，但你更想先打磨开发流程体验，你会怎么推动决策？',
    answer: '对齐目标：更强模型要解什么 Badcase？提升 10% 准确率还是覆盖 3 类关键失败？数据说话：Prompt 从构思到上线 3 天、1 天等部署——优化调试工作台可缩到半天，算法同学自助验证。折中：两周做内部 Prompt 调试台+评测集一键跑分，省下的联调时间再做模型优化。成功标准：迭代周期、Badcase 关闭率，而非只看模型榜单分。',
    humanScores: { 逻辑性: 5, 专业性: 5, 流畅度: 4, 匹配度: 5, 内容密度: 5 }
  },
  {
    id: 'eval-005', level: 'excellent', type: 'ai_product', bankNum: 104, bankId: 'ai-pm-104',
    tags: ['efficiency', 'metrics'],
    scenario: '你会怎么判断一个AI自动化功能到底有没有真正提升用户效率？',
    answer: '不能只看 DAU/使用率，要做任务路径对比：同一任务（如营销海报）传统路径步骤数、耗时 vs AI 路径。核心指标：任务完成时间缩短率、步骤简化率、一次性成功率、满意度。若用户平均生成 5 次才相当于传统 1 次，则未真正提效。验证：5 用户走查录屏+10 条真实任务前后对比，设阈值：时间缩短≥30% 且一次性成功率≥60% 才算有效自动化。',
    humanScores: { 逻辑性: 5, 专业性: 5, 流畅度: 4, 匹配度: 5, 内容密度: 5 }
  },
  {
    id: 'eval-006', level: 'excellent', type: 'ai_product', bankNum: 89, bankId: 'ai-pm-089',
    tags: ['eval', 'llmops'],
    scenario: '你觉得在LLM应用开发流程里，评测产品最应该卡住哪几个关键节点？',
    answer: '四个卡点：①Prompt/链路变更前——回归评测集门禁，防退化；②上线前——离线 eval + 小流量 shadow；③上线后——线上采样+人工校准，发现 drift；④Badcase 闭环——归因到节点（检索/规划/生成）再迭代。每节点定义 owner 和通过标准：如回归集核心 case 通过率≥95%。评测不是报告，是 release gate。',
    humanScores: { 逻辑性: 5, 专业性: 5, 流畅度: 4, 匹配度: 5, 内容密度: 4 }
  },
  {
    id: 'eval-007', level: 'excellent', type: 'business', bankNum: 40, bankId: 'ai-pm-040',
    tags: ['eval', 'product_judgment'],
    scenario: '你会怎么判断一套评测体系是否真的有用，而不只是指标看起来很完整？',
    answer: '看三件事：①能否驱动迭代——低分维度能否定位到链路节点并复测提升；②业务决策是否引用——上线/回滚是否看 eval 而非只看感觉；③标注成本可持续——LLM-as-judge 与人工校准误差可控。反例：指标很多但没人 action、分数与用户体验投诉无关。我会选 10 个历史争议 case，看 eval 能否预测最终人工结论。',
    humanScores: { 逻辑性: 5, 专业性: 5, 流畅度: 5, 匹配度: 5, 内容密度: 4 }
  },
  {
    id: 'eval-008', level: 'excellent', type: 'product_design', bankNum: 84, bankId: 'ai-pm-084',
    tags: ['agent', 'safety'],
    scenario: '工具调用链路设计里，什么动作适合自动执行，什么动作一定要让用户确认？',
    answer: '自动：只读、可逆、低风险的——查库存、草稿生成、预览。必须确认：写操作、资金/权限、对外发送、不可逆——下单、退款、发邮件、删数据。判断轴：后果严重度×可逆性×用户预期。产品形态：高风险默认二次确认+摘要展示；低风险静默执行但可撤销。Agent 场景还要 log trace 便于审计。',
    humanScores: { 逻辑性: 5, 专业性: 5, 流畅度: 4, 匹配度: 5, 内容密度: 5 }
  },
  {
    id: 'eval-009', level: 'excellent', type: 'business', bankNum: 122, bankId: 'ai-pm-122',
    tags: ['strategy', 'flywheel'],
    scenario: '如果一个AI产品短期数据还不错，但你觉得它未必能长期成立，你会怎么看？',
    answer: '拆三层：①工具 vs 玩具——用户来是为完成任务还是尝鲜；②飞轮——数据/分发/供给能否越用越强；③护城河——切换成本、专有数据、工作流嵌入。短期好可能是投放或 novelty，看留存曲线、任务完成率、付费意愿。若留存平、复访靠 push，则偏玩具。产品动作：找 10 个重度用户深访，验证是否替代原有工作流。',
    humanScores: { 逻辑性: 5, 专业性: 5, 流畅度: 5, 匹配度: 5, 内容密度: 5 }
  },
  {
    id: 'eval-010', level: 'excellent', type: 'ai_product', bankNum: 50, bankId: 'ai-pm-050',
    tags: ['latency', 'architecture'],
    scenario: '在TikTok的视频流里做AI导购，怎么解决LLM推理延迟导致用户流失的问题？',
    answer: '体验分层：①预计算——热门商品推荐理由离线生成缓存；②流式——首 token 快出摘要，详情异步补全；③非阻塞——导购卡片先展示规则/检索结果，LLM 润色后替换；④降级——超时则展示模板文案。指标：P95 首屏时间、滑动流失率、导购 CTR。MVP 先缓存+模板，LLM 只负责 20% 长尾个性化。',
    humanScores: { 逻辑性: 5, 专业性: 5, 流畅度: 4, 匹配度: 5, 内容密度: 5 }
  },
  // ── average ×10 ──
  {
    id: 'eval-011', level: 'average', type: 'ai_product', bankNum: 4, bankId: 'ai-pm-004',
    tags: ['eval', 'growth'],
    scenario: '如果一套评测能力技术上很完整，但业务增长并不明显，你会怎么看这个问题？',
    answer: '可能是评测和业务发展阶段不匹配，或者研发觉得好用但业务方不知道价值。可以多做推广，让业务用起来，同时看是不是指标没对齐。也要考虑评测是不是太复杂，接入成本高。后续可以优化产品体验，增加培训。',
    humanScores: { 逻辑性: 3, 专业性: 3, 流畅度: 4, 匹配度: 4, 内容密度: 2 }
  },
  {
    id: 'eval-012', level: 'average', type: 'ai_product', bankNum: 7, bankId: 'ai-pm-007',
    tags: ['adoption'],
    scenario: '如果开发者觉得评测平台很好用，但研发团队接入意愿不高，你会怎么分析这个问题？',
    answer: '可能是接入流程太麻烦，或者和现有 CI 不兼容。也可以调研一下是不是缺少激励。我会组织分享会介绍价值，并简化文档。还可以找几个标杆团队先接入，做案例宣传。',
    humanScores: { 逻辑性: 3, 专业性: 3, 流畅度: 3, 匹配度: 4, 内容密度: 2 }
  },
  {
    id: 'eval-013', level: 'average', type: 'product_design', bankNum: 15, bankId: 'ai-pm-015',
    tags: ['tradeoff'],
    scenario: '如果上线一个AI辅助发帖功能，数据显示发帖量提升了20%，但用户举报「内容虚假/营销号」的比例也上升了15%，作为PM你决定下线该功能还是继续迭代？请给出你的判断依据。',
    answer: '发帖量提升说明功能有吸引力，但举报上升是风险。我倾向于先迭代，优化模型减少虚假内容，同时加强审核。如果举报继续上升再考虑下线。也会看公司战略是否重视内容生态。',
    humanScores: { 逻辑性: 3, 专业性: 3, 流畅度: 4, 匹配度: 4, 内容密度: 2 }
  },
  {
    id: 'eval-014', level: 'average', type: 'ai_product', bankNum: 25, bankId: 'ai-pm-025',
    tags: ['eval'],
    scenario: '选品分析和营销素材生成，这两个场景的评测重点会有什么不一样？',
    answer: '选品更看数据分析准不准，素材生成更看创意好不好。选品可以比预测销量，素材可以看点击率和转化。两者都要用户满意度。评测都可以用一些标准指标，具体要看业务目标。',
    humanScores: { 逻辑性: 3, 专业性: 3, 流畅度: 3, 匹配度: 4, 内容密度: 2 }
  },
  {
    id: 'eval-015', level: 'average', type: 'ai_product', bankNum: 30, bankId: 'ai-pm-030',
    tags: ['llm_product'],
    scenario: '你认为大模型产品和传统互联网产品最大的区别是什么？',
    answer: '大模型产品更智能，可以对话，传统产品多是固定功能。大模型有不确定性，需要更多测试。商业模式也可能不同，按 token 计费。用户体验上更自然，但也可能出错，需要提示用户。',
    humanScores: { 逻辑性: 3, 专业性: 3, 流畅度: 4, 匹配度: 4, 内容密度: 2 }
  },
  {
    id: 'eval-016', level: 'average', type: 'product_design', bankNum: 85, bankId: 'ai-pm-085',
    tags: ['research'],
    scenario: '用户访谈里大家都觉得这个功能挺有帮助，但上线后核心数据没明显变化，你会怎么判断问题？',
    answer: '可能是访谈样本有偏差，或者用户说的和做的不一样。也会看是不是功能入口太深，用户没找到。可以再做 A/B 测试，或者看漏斗哪一步流失。可能需要加大运营推广。',
    humanScores: { 逻辑性: 3, 专业性: 3, 流畅度: 4, 匹配度: 4, 内容密度: 2 }
  },
  {
    id: 'eval-017', level: 'average', type: 'ai_product', bankNum: 86, bankId: 'ai-pm-086',
    tags: ['cross_team'],
    scenario: '同一个能力，算法更关注效果上限，后端更关注稳定性，产品更关注体验闭环，这种分歧你会怎么推进？',
    answer: '先开会大家对齐目标，列出各自优先级。产品讲用户价值，算法讲效果，后端讲 SLA。找一个都能接受的方案，比如先上稳定版本再迭代效果。领导层必要时拍板。',
    humanScores: { 逻辑性: 3, 专业性: 2, 流畅度: 3, 匹配度: 4, 内容密度: 2 }
  },
  {
    id: 'eval-018', level: 'average', type: 'product_design', bankNum: 100, bankId: 'ai-pm-100',
    tags: ['eval'],
    scenario: '你会怎么设计一个更贴近真实业务场景的效果评估体系？',
    answer: '收集真实用户数据做测试集，覆盖各种场景。指标除了准确率还有响应时间。可以分阶段评估，先离线再在线。要和业务同学一起定义什么是好效果。',
    humanScores: { 逻辑性: 3, 专业性: 3, 流畅度: 3, 匹配度: 4, 内容密度: 2 }
  },
  {
    id: 'eval-019', level: 'average', type: 'ai_product', bankNum: 153, bankId: 'ai-pm-153',
    tags: ['metrics'],
    scenario: '假设你负责的海外购物助手上线后，CTR提升了15%，但用户投诉率也上升了5%，主要抱怨是「推荐不精准」。业务方想继续推以保KPI，你怎么办？',
    answer: 'CTR 提升说明有吸引力，但投诉也要重视。可以先缩小推广范围，优化推荐算法，同时跟业务沟通风险。如果投诉继续增加，可能需要暂停扩量。平衡短期 KPI 和长期口碑。',
    humanScores: { 逻辑性: 3, 专业性: 3, 流畅度: 4, 匹配度: 4, 内容密度: 2 }
  },
  {
    id: 'eval-020', level: 'average', type: 'ai_product', bankNum: 202, bankId: 'ai-pm-202',
    tags: ['coding_agent'],
    scenario: '如果用户反馈TRAE生成的结果能写代码，但不够稳定，你会怎么看这个问题？',
    answer: '说明模型有能力但质量不稳定，可能是 prompt 或上下文不够。可以收集 badcase 优化，增加测试。也要管理用户预期，告诉用户需要 review。长期看模型会越来越好。',
    humanScores: { 逻辑性: 3, 专业性: 3, 流畅度: 3, 匹配度: 4, 内容密度: 2 }
  },
  // ── poor ×10 ──
  {
    id: 'eval-021', level: 'poor', type: 'ai_product', bankNum: 3, bankId: 'ai-pm-003',
    tags: ['multimodal'],
    scenario: '你会怎么判断一个广告场景适不适合用文本、图片或视频生成模型来做产品化？',
    answer: '看哪个效果好就用哪个，文本简单，视频更炫。现在 AI 很强，都可以试试。图片适合海报，视频适合抖音。根据预算和团队能力选。',
    humanScores: { 逻辑性: 2, 专业性: 2, 流畅度: 3, 匹配度: 3, 内容密度: 1 }
  },
  {
    id: 'eval-022', level: 'poor', type: 'product_design', bankNum: 6, bankId: 'ai-pm-006',
    tags: ['mvp'],
    scenario: '业务背景提到要落地「动态卡片生成」和「实时穿搭建议」，第一版MVP你会砍掉哪些功能来保证上线质量？',
    answer: '两个功能都很重要，尽量都做。如果来不及可以少做几个样式，但实时建议不能砍，因为这是核心卖点。质量不行就延期。',
    humanScores: { 逻辑性: 2, 专业性: 1, 流畅度: 3, 匹配度: 2, 内容密度: 1 }
  },
  {
    id: 'eval-023', level: 'poor', type: 'ai_product', bankNum: 20, bankId: 'ai-pm-020',
    tags: ['aigc'],
    scenario: '业务背景里特别提到要降低「AIGC感」。在你过往的经验中，除了提升画面分辨率，还有哪些细节手段能让用户感觉视频更真实、更像人做的？',
    answer: '加滤镜，调色调，加字幕和配乐。也可以多拍实拍素材混在一起。让用户参与编辑会更真实。分辨率越高越好。',
    humanScores: { 逻辑性: 2, 专业性: 2, 流畅度: 3, 匹配度: 3, 内容密度: 1 }
  },
  {
    id: 'eval-024', level: 'poor', type: 'ai_product', bankNum: 60, bankId: 'ai-pm-060',
    tags: ['agent'],
    scenario: 'OpenAI强调ChatGPT正从对话界面重构为整合服务的Agent平台，如果要把这种「从问答到执行」的能力引入小红书，你觉得哪个具体场景最适合做第一个切入点？为什么？',
    answer: '可以做购物助手，帮用户买东西。或者旅游攻略，一键下单。小红书用户年轻，喜欢新功能。Agent 是趋势，先做再说，迭代会很快。',
    humanScores: { 逻辑性: 2, 专业性: 2, 流畅度: 3, 匹配度: 2, 内容密度: 1 }
  },
  {
    id: 'eval-025', level: 'poor', type: 'ai_product', bankNum: 80, bankId: 'ai-pm-080',
    tags: ['abuse'],
    scenario: '大量免费用户利用脚本高频调用视频生成接口，导致付费用户等待从30秒涨到3分钟，投诉激增。只有两天调整策略，你会怎么做？',
    answer: '封禁脚本用户，限流。提高免费用户门槛，鼓励付费。加班维护服务器。通知用户系统升级中。',
    humanScores: { 逻辑性: 2, 专业性: 2, 流畅度: 3, 匹配度: 3, 内容密度: 1 }
  },
  {
    id: 'eval-026', level: 'poor', type: 'ai_product', bankNum: 157, bankId: 'ai-pm-157',
    tags: ['agent'],
    scenario: '超级智能体想成为万能助手，第一阶段最不该急着做的是什么？',
    answer: '第一阶段应该什么都做一点，展示能力。不要限制太多，否则用户觉得不智能。万能助手就要全能，慢慢优化就行。',
    humanScores: { 逻辑性: 1, 专业性: 1, 流畅度: 3, 匹配度: 2, 内容密度: 1 }
  },
  {
    id: 'eval-027', level: 'poor', type: 'ai_product', bankNum: 205, bankId: 'ai-pm-205',
    tags: ['coze'],
    scenario: '如果让你向一个没接触过Coze的人介绍这个产品，你会怎么说？',
    answer: 'Coze 是字节出的 AI 产品，可以做 bot，很好用。不用写代码就能搭 agent，适合所有人。现在 AI 很火，值得试试。',
    humanScores: { 逻辑性: 2, 专业性: 2, 流畅度: 3, 匹配度: 3, 内容密度: 1 }
  },
  {
    id: 'eval-028', level: 'poor', type: 'ai_product', bankNum: 204, bankId: 'ai-pm-204',
    tags: ['coding'],
    scenario: '你觉得AI编程产品和普通代码补全工具的区别是什么？',
    answer: 'AI 编程更智能，能写整段代码。补全只是几个词。AI 编程是下一代 IDE，以后程序员可能不需要了。区别就是 AI 更强。',
    humanScores: { 逻辑性: 2, 专业性: 1, 流畅度: 3, 匹配度: 3, 内容密度: 1 }
  },
  {
    id: 'eval-029', level: 'poor', type: 'business', bankNum: 135, bankId: 'ai-pm-135',
    tags: ['commercial'],
    scenario: '你怎么衡量一个商业化AI产品有没有真正做出价值？',
    answer: '看收入和用户数。赚钱就说明有价值。也可以看融资和估值。用户好评多就是有 value。',
    humanScores: { 逻辑性: 2, 专业性: 2, 流畅度: 3, 匹配度: 2, 内容密度: 1 }
  },
  {
    id: 'eval-030', level: 'poor', type: 'ai_product', bankNum: 154, bankId: 'ai-pm-154',
    tags: ['workflow'],
    scenario: '做AI应用时，工作流一旦变复杂，产品最容易失控的地方在哪里？',
    answer: '人太多容易乱，沟通问题。技术太难也会失控。要简化流程，少开会不会就不会失控了。',
    humanScores: { 逻辑性: 2, 专业性: 1, 流畅度: 3, 匹配度: 2, 内容密度: 1 }
  }
];

function avgScore(scores) {
  const v = Object.values(scores);
  return Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10;
}

function buildMarkdown(golden) {
  const lines = [
    '# CVassistant 评测集说明（v2）',
    '',
    `> 生成日期：${golden.annotation.date} · 共 **${golden.samples.length}** 条 · 优/中/差各 10 条`,
    '',
    '## 用途',
    '',
    '验证 **业务场景作答 → AI 五维点评** 与人工 rubric 是否一致。跑 `scripts/eval-scoring.js` 计算 Spearman；`|diff|≥2` 的样本用于迭代 prompt。',
    '',
    '## 五维评分标准',
    ''
  ];
  for (const [dim, guide] of Object.entries(golden.dimensionGuide)) {
    lines.push(`- **${dim}**：${guide}`);
  }
  lines.push('', '## 样本分布', '', '| 档位 | 数量 | 均分（五维平均） |', '|------|------|------------------|');
  for (const level of ['excellent', 'average', 'poor']) {
    const subset = golden.samples.filter(s => s.level === level);
    const avg = subset.reduce((s, x) => s + avgScore(x.humanScores), 0) / subset.length;
    lines.push(`| ${level} | ${subset.length} | ${avg.toFixed(1)} |`);
  }
  lines.push('', '## 全量样本（题目 · 作答 · 人工分）', '');

  for (const s of golden.samples) {
    lines.push(`### ${s.id} · 题${s.bankNum} · ${s.level}`, '');
    lines.push(`**题型**：${s.type} · **标签**：${(s.tags || []).join(' / ')}`, '');
    lines.push('**题目**', '', s.scenario, '', '**模拟作答**', '', s.answer, '', '**人工五维分**', '');
    lines.push('| 维度 | 分数 |', '|------|------|');
    for (const d of golden.dimensions) {
      lines.push(`| ${d} | ${s.humanScores[d]} |`);
    }
    lines.push(`| **均分** | **${avgScore(s.humanScores)}** |`, '', '---', '');
  }

  lines.push('## 如何跑评测', '', '```bash', 'DEEPSEEK_API_KEY=sk-xxx node scripts/eval-scoring.js', '```', '', '无 API Key 时脚本仅输出样本统计。', '');
  return lines.join('\n');
}

const golden = { ...META, samples: SAMPLES };
const jsonPath = path.join(ROOT, 'eval/scoring-golden.json');
const mdPath = path.join(ROOT, 'eval/评测集说明.md');

fs.writeFileSync(jsonPath, JSON.stringify(golden, null, 2) + '\n');
fs.writeFileSync(mdPath, buildMarkdown(golden), 'utf8');

console.log('Wrote', jsonPath, 'samples:', golden.samples.length);
console.log('Wrote', mdPath);
