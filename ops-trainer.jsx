import React, { useState, useEffect, useRef } from 'react';
import { Settings, Loader2, X, AlertCircle, Check, ArrowRight, RotateCcw } from 'lucide-react';

// ============================================================
//  内容数据 —— 5 个分类，产品思维扩到 6 个案例
// ============================================================
const CATEGORIES = [
  {
    id: 'needs',
    num: '01',
    title: '用户需求',
    subtitle: 'User Needs',
    desc: '区分用户嘴上说的、和真正想要的。',
    cases: [
      {
        id: 'food-delivery',
        title: '外卖"商品太慢"投诉',
        tag: 'O2O',
        scenario: '外卖平台上，用户重复投诉"商品太慢"，客服数据显示这是第一大投诉类别。运营团队决定向骑手施压、要求提速，KPI 加严，违规扣款上调 30%。',
        question: '用户的核心需求是什么？表面需求和核心需求分别是什么？团队的方案问题在哪？',
      },
      {
        id: 'shortvideo-boring',
        title: '短视频用户的"无聊"信号',
        tag: '内容',
        scenario: '短视频 App 用户人均使用时长连续 3 周下滑，调研中 38% 反馈"刷起来没意思"，但同期点赞率、关注转化率并未明显恶化。产品同学提议在算法中加大热门内容权重。',
        question: '"没意思"这个用户语言到底意味着什么？你会怎么拆？',
      },
      {
        id: 'saas-export',
        title: 'SaaS 用户的"导出 Excel"',
        tag: 'SaaS',
        scenario: '一款 B 端协作 SaaS，用户频繁通过工单要求"支持一键导出 Excel"。销售反馈大客户呼声很高。产品经理犹豫：做了，可能成为流失的助推器；不做，又怕影响续费。',
        question: '用户要的真的是"导出 Excel"吗？拆解这个需求背后的真实诉求。',
      },
    ],
  },
  {
    id: 'decision',
    num: '02',
    title: '业务决策推演',
    subtitle: 'Decision Simulation',
    desc: '把"看似两难"还原成有结构的判断。',
    cases: [
      {
        id: 'surge-pricing',
        title: '网约车的高峰加价',
        tag: '定价',
        scenario: '周五晚高峰打车难，平台后台显示运力缺口达 30%。算法测算：加价 1.5 倍可使应答率从 60% 提升至 85%，但用户评分预计下降 0.3 分，社交媒体投诉量预计翻倍。CEO 让你拍板。',
        question: '加还是不加？写出你的决策路径与关键权衡。',
      },
      {
        id: 'subsidy-allocation',
        title: '复制"百亿补贴"',
        tag: '增长',
        scenario: '电商平台决定复制拼多多"百亿补贴"模式，预算 5 亿，目标 3 个月内 GMV 增长 20%。市场总监主张主攻 3C 数码（客单高、传播性强），COO 主张全品类铺开（覆盖广、防御性强）。',
        question: '你怎么分配这 5 亿？说出最关键的 2–3 个判断依据。',
      },
      {
        id: 'content-moderation',
        title: '"擦边球"内容的两难',
        tag: '内容安全',
        scenario: '内容社区出现一波"擦边球"内容，过去两周 DAU 增长 15%，但两家头部品牌方撤了广告投放。机器审核误杀率 8%，人工审核成本约 200 万 / 月。法务给到风险提示但未要求立刻下线。',
        question: '你会怎么制定这个季度的审核策略？',
      },
    ],
  },
  {
    id: 'data',
    num: '03',
    title: '数据异常分析',
    subtitle: 'Data Anomaly',
    desc: '在没人告诉你答案时，定位真正的问题。',
    cases: [
      {
        id: 'dau-drop',
        title: 'DAU 突然下跌 12%',
        tag: '异常排查',
        scenario: '周一 DAU 较上周同期下跌 12%。无版本更新、无运营活动到期、服务器无故障。新用户与老用户跌幅相当，iOS 跌幅（14%）略大于 Android（10%）。',
        question: '你的排查顺序是什么？请给出至少 4 个假设，并按可能性排序。',
      },
      {
        id: 'funnel-collapse',
        title: '漏斗的"中段塌陷"',
        tag: '转化',
        scenario: '电商详情页 → 加购转化率从 18% 降至 11%，但加购 → 下单转化率反而上升了 2 个百分点。详情页 UV 没变，跳出率上升 6%。',
        question: '加购率掉了 7 个点，但加购后下单率反而涨——这种"中段塌陷"通常意味着什么？',
      },
      {
        id: 'aov-gmv',
        title: '客单价涨，GMV 反跌',
        tag: '多维归因',
        scenario: '本月客单价同比 +9%，但 GMV 同比 -4%，订单量 -12%。新用户数据基本持平，老客占比上升 5 个百分点。',
        question: '拆解这组矛盾的数据，定位真正的问题。',
      },
    ],
  },
  {
    id: 'competitor',
    num: '04',
    title: '竞品拆解',
    subtitle: 'Competitor Analysis',
    desc: '不要列功能差异，要看产品哲学的差异。',
    cases: [
      {
        id: 'pdd-bargain',
        title: '拼多多"砍一刀"',
        tag: '机制',
        scenario: '"砍一刀"——拼多多用一个看似简单的红包机制撬动了数十亿次社交传播。请站在产品设计者视角，拆解它为什么有效。',
        question: '"砍一刀"解决的真问题是什么？它在用户心理上踩中了哪些点？',
      },
      {
        id: 'xhs-vs-douyin',
        title: '小红书 vs 抖音的"种草"',
        tag: '商业化',
        scenario: '同样是"种草"，小红书与抖音在内容机制、推荐逻辑、用户路径上有本质差异。一个偏图文 + 搜索沉淀，一个偏短视频 + 算法分发。',
        question: '如果你是一个新消费品牌，预算只够选一边重投，决策依据是什么？',
      },
      {
        id: 'notion-vs-feishu',
        title: 'Notion vs 飞书文档',
        tag: '协作工具',
        scenario: '同为协作文档工具，Notion 主打"积木式个性化"，飞书文档主打"组织级深度协同"。',
        question: '这两种产品哲学背后，是对客户的什么假设？这个假设决定了什么命运？',
      },
    ],
  },
  {
    id: 'product',
    num: '05',
    title: '产品思维',
    subtitle: 'Product Thinking',
    desc: '取舍、分层、优先级——这些不是技巧，是判断力的具象。',
    cases: [
      {
        id: 'mvp-cut',
        title: 'MVP 的取舍',
        tag: 'MVP',
        scenario: '你计划做一款给小红书博主用的"内容选题助手"。团队 2 人，3 个月时间。预想功能：①选题推荐 ②热度预测 ③文案生成 ④爆款拆解 ⑤数据分析 ⑥多人协作 ⑦灵感库管理。',
        question: '你的 MVP 应该砍到只剩什么？砍掉的理由必须比留下的理由更具体。',
      },
      {
        id: 'user-segmentation',
        title: '用户分层的颗粒度',
        tag: '分层',
        scenario: '一款健身 App 想做用户分层运营。"新人 / 活跃 / 沉默 / 流失"看起来过于粗糙，按 RFM + 行为标签又过于复杂、运营落不下去。',
        question: '你会怎么设计这款产品的用户分层？关键判断标准是什么？',
      },
      {
        id: 'feature-priority',
        title: '功能优先级的判断',
        tag: '优先级',
        scenario: '季度规划中有 5 个候选项：A 个性化首页（用户呼声最高）；B 支付链路优化（数据显示 8% 用户流失在该节点）；C 海外语言支持（CEO 的战略方向）；D 性能优化（开发主导提的）；E 新的会员体系（业务侧主导）。资源只够做 2–3 个。',
        question: '你怎么排优先级？说出你判断的框架，而不只是排序结果。',
      },
      {
        id: 'zero-to-one',
        title: '从 1→10 切到 0→1',
        tag: '方法论',
        scenario: '你被挖到一家公司带新产品线。过去你在 DAU 千万级的成熟产品做迭代，每个版本都有完整的 A/B 数据、用户画像、漏斗分析。现在你面对的是 0 用户、0 数据、创始人在讲愿景，本能反应是"先看数据"。',
        question: '你的工作方式要怎么变？过去哪些"最佳实践"在这个阶段会害死项目？',
      },
      {
        id: 'growth-vs-retention',
        title: '"先增长还是先留存"',
        tag: '伪两难',
        scenario: '一款产品过去 6 个月新增用户每月增长 40%，但 30 日留存从 28% 跌到 19%。CEO 想继续推增长（"先占市场"），产品想先修留存（"漏水的桶往里灌水没用"）。两边都有理。',
        question: '这个二选一的命题本身有什么问题？你会怎么重新切问题？',
      },
      {
        id: 'monetization-timing',
        title: '商业化的时机判断',
        tag: '商业化',
        scenario: '一款工具型 App，免费用户 200 万 DAU，留存稳定。投资人催商业化。团队内部两派：一派主张立刻上付费（"用户基数够了"），一派主张再等半年（"现在上付费会伤口碑"）。',
        question: '判断这件事的关键变量是什么？你需要看哪些数据 / 信号才能拍板？',
      },
    ],
  },
];

// ============================================================
//  System Prompt —— 对话式点评
// ============================================================
const SYSTEM_PROMPT = `你是一位资深的互联网产品与运营导师，深度参与过头部公司（电商 / 内容 / 出行 / SaaS）的产品决策。用户在做"思维训练"——他写下对一个业务场景的分析，你和他对话。

【最重要的事】这是对话，不是 PPT。

风格要求：
- 像真人导师面对面说话，自然语流。绝不列「1. 2. 3.」「首先 / 其次」这类小标题
- 绝不用任何 markdown 标题、加粗、列表符号
- 第一句不要复述他的观点。直接进入有信息量的部分
- 用「你」称呼对方
- 用具体数字、案例、机制论证，不要抽象原则
- 控制在 350–450 字，重质不重量

回应中要做到（但融入对话节奏，不要分段列出来）：
- 指出他分析中真正切中要害的那一句（具体引用他的原话）
- 挑战他的一个隐含假设或盲点（"你这个判断有个前提是……"）
- 提供一个比他更深的拆解视角（"我会这么看……"或"换个角度……"）
- 结尾抛一个让他继续想的问题，或留一句让他记住的话

后续对话（用户追问时）：保持同样风格。如果他问得好，认可但要继续推进他的思考；如果他问得偷懒（比如"那应该怎么办"），不要直接给答案，反问回去。

严格避免：
- "以用户为中心""数据驱动""降本增效""赋能""抓手""闭环""链路"等空话
- "好问题""不错的角度""你说得很对"等空赞美
- "建议从用户调研入手"这种通用废话
- 排比句、对仗工整但没信息量的总结`;

// ============================================================
//  样式
// ============================================================
const STYLES = `
* {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text",
               "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
               system-ui, "Helvetica Neue", sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

.font-mono-sf {
  font-family: "SF Mono", "Monaco", "Cascadia Code", ui-monospace, monospace;
  font-feature-settings: "tnum" 1;
}

.bg-base     { background-color: #FFFFFF; }
.bg-soft     { background-color: #FBFBFD; }
.bg-card     { background-color: #F5F5F7; }
.bg-card-2   { background-color: #F2F2F4; }
.bg-ink      { background-color: #1D1D1F; }
.text-p1     { color: #1D1D1F; }
.text-p2     { color: #6E6E73; }
.text-p3     { color: #86868B; }
.text-accent { color: #0071E3; }
.bg-accent   { background-color: #0071E3; }
.border-c    { border-color: #D2D2D7; }
.border-cs   { border-color: #E8E8ED; }

.tracking-tighter-2 { letter-spacing: -0.022em; }
.tracking-tighter-3 { letter-spacing: -0.03em; }

textarea, input { font-family: inherit; }
textarea:focus, input:focus { outline: none; }

.fade-in     { animation: fadeIn 0.4s ease-out both; }
.slide-up    { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both; }
@keyframes fadeIn  { from{opacity:0} to{opacity:1} }
@keyframes slideUp { from{opacity:0; transform: translateY(10px)} to{opacity:1; transform: translateY(0)} }

.pulse-dot { animation: pulse 1.4s ease-in-out infinite; }
@keyframes pulse {
  0%, 100% { opacity: 0.25; }
  50%      { opacity: 1; }
}

/* Cleaner scrollbars */
::-webkit-scrollbar       { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #D2D2D7; border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: #B0B0B5; }

/* Hide scrollbar on horizontal case strip */
.no-scrollbar::-webkit-scrollbar { display: none; }
.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

/* Backdrop blur fallback */
.backdrop-blur-apple {
  backdrop-filter: saturate(180%) blur(20px);
  -webkit-backdrop-filter: saturate(180%) blur(20px);
  background-color: rgba(255, 255, 255, 0.72);
}
`;

// ============================================================
//  Claude API 流式调用（支持多轮）
// ============================================================
async function streamClaude({ apiKey, messages, system, onChunk, onDone, onError }) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey && apiKey.trim()) {
      headers['x-api-key'] = apiKey.trim();
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        stream: true,
        system,
        messages,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`接口返回 ${res.status}：${text.slice(0, 240)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            onChunk(parsed.delta.text);
          }
        } catch (_) { /* 心跳行等 */ }
      }
    }
    onDone?.();
  } catch (err) {
    onError?.(err.message || String(err));
  }
}

// ============================================================
//  主组件
// ============================================================
export default function App() {
  useEffect(() => {
    const el = document.createElement('style');
    el.textContent = STYLES;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);

  // API Key 状态
  const [apiKey, setApiKey] = useState('');
  const [keyDraft, setKeyDraft] = useState('');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  // 导航状态
  const [activeCatId, setActiveCatId] = useState(CATEGORIES[0].id);
  const [activeCaseId, setActiveCaseId] = useState(CATEGORIES[0].cases[0].id);

  // 对话状态
  const [analysis, setAnalysis] = useState('');
  const [thread, setThread] = useState([]); // [{ role, content, apiContent? }]
  const [followUp, setFollowUp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const threadEndRef = useRef(null);

  const activeCat = CATEGORIES.find((c) => c.id === activeCatId);
  const activeCase = activeCat.cases.find((c) => c.id === activeCaseId);

  // 切换案例时清空
  useEffect(() => {
    setAnalysis('');
    setThread([]);
    setFollowUp('');
    setError('');
  }, [activeCaseId]);

  // 流式期间自动滚到底部
  useEffect(() => {
    if (thread.length > 0) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [thread]);

  const switchCategory = (catId) => {
    setActiveCatId(catId);
    setActiveCaseId(CATEGORIES.find((c) => c.id === catId).cases[0].id);
  };

  const submitInitial = async () => {
    if (!analysis.trim() || loading) return;
    setLoading(true);
    setError('');

    const apiContent = `【场景】${activeCase.scenario}\n\n【思考问题】${activeCase.question}\n\n【我的分析】\n${analysis.trim()}`;
    const userMsg = { role: 'user', content: analysis.trim(), apiContent };
    setThread([userMsg, { role: 'assistant', content: '' }]);

    await streamClaude({
      apiKey,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: apiContent }],
      onChunk: (text) => {
        setThread((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + text };
          return next;
        });
      },
      onDone: () => setLoading(false),
      onError: (msg) => { setError(msg); setLoading(false); },
    });
  };

  const submitFollowUp = async () => {
    if (!followUp.trim() || loading) return;
    const text = followUp.trim();
    setFollowUp('');
    setLoading(true);
    setError('');

    // 用闭包里的 thread 构造 API 消息（旧 thread + 新用户消息）
    const apiMessages = [
      ...thread.map((t) => ({ role: t.role, content: t.apiContent || t.content })),
      { role: 'user', content: text },
    ];

    setThread((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '' },
    ]);

    await streamClaude({
      apiKey,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
      onChunk: (chunk) => {
        setThread((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: last.content + chunk };
          return next;
        });
      },
      onDone: () => setLoading(false),
      onError: (msg) => { setError(msg); setLoading(false); },
    });
  };

  const resetThread = () => {
    setThread([]);
    setAnalysis('');
    setFollowUp('');
    setError('');
  };

  const saveKey = () => {
    setApiKey(keyDraft);
    setKeySaved(true);
    setTimeout(() => { setKeySaved(false); setShowKeyModal(false); }, 900);
  };

  return (
    <div className="min-h-screen bg-base text-p1">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 backdrop-blur-apple border-b border-cs">
        <div className="max-w-5xl mx-auto px-6 md:px-10 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-ink flex items-center justify-center">
              <span className="text-white text-[9px] font-medium tracking-wider">OT</span>
            </div>
            <span className="text-[13px] font-medium text-p1">Ops·Trainer</span>
          </div>
          <button
            onClick={() => { setKeyDraft(apiKey); setShowKeyModal(true); }}
            className="flex items-center gap-1.5 text-[12px] text-p2 hover:text-p1 transition-colors"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${apiKey ? 'bg-accent' : 'bg-p3'}`} />
            <span>API Key</span>
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="px-6 md:px-10 pt-20 pb-16 md:pt-28 md:pb-24">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[13px] text-p2 mb-6 font-medium">操作训练思维器</p>
          <h1 className="text-[44px] md:text-[80px] font-semibold leading-[1.05] tracking-tighter-3 text-p1">
            训练你的判断力。<br />
            <span className="text-p3">不只是生成内容。</span>
          </h1>
          <p className="mt-8 text-[17px] md:text-[19px] text-p2 max-w-xl mx-auto leading-[1.5]">
            18 个真实业务场景。写下你的拆解，让 AI 当你的导师——
            不给标准答案，只指盲点、深化视角、与你对话。
          </p>
        </div>
      </section>

      {/* 分类导航 */}
      <nav className="sticky top-12 z-20 backdrop-blur-apple border-y border-cs">
        <div className="max-w-5xl mx-auto px-6 md:px-10">
          <div className="flex gap-6 md:gap-10 overflow-x-auto no-scrollbar -mx-6 px-6 md:-mx-10 md:px-10">
            {CATEGORIES.map((cat) => {
              const active = cat.id === activeCatId;
              return (
                <button
                  key={cat.id}
                  onClick={() => switchCategory(cat.id)}
                  className="flex-shrink-0 py-4 flex items-center gap-2 relative group"
                >
                  <span className={`text-[11px] font-mono-sf transition-colors ${active ? 'text-p2' : 'text-p3'}`}>
                    {cat.num}
                  </span>
                  <span className={`text-[14px] font-medium transition-colors ${active ? 'text-p1' : 'text-p2 group-hover:text-p1'}`}>
                    {cat.title}
                  </span>
                  {active && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-ink rounded-t-sm" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* 主内容区 */}
      <main className="max-w-3xl mx-auto px-6 md:px-10 py-14 md:py-20">
        {/* 分类描述 */}
        <div className="mb-12 fade-in" key={activeCat.id}>
          <p className="text-[13px] font-mono-sf text-p3 mb-3 tracking-wide">
            {activeCat.subtitle}
          </p>
          <h2 className="text-[34px] md:text-[44px] font-semibold tracking-tighter-3 text-p1 mb-4 leading-[1.1]">
            {activeCat.title}
          </h2>
          <p className="text-[18px] text-p2 leading-relaxed">
            {activeCat.desc}
          </p>
        </div>

        {/* 案例选择卡片（横向滑动） */}
        <div className="mb-14 -mx-6 md:-mx-10">
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-6 md:px-10 pb-3">
            {activeCat.cases.map((cs, idx) => {
              const active = cs.id === activeCaseId;
              return (
                <button
                  key={cs.id}
                  onClick={() => setActiveCaseId(cs.id)}
                  className={`flex-shrink-0 w-[260px] p-5 rounded-2xl text-left transition-all duration-200 ${
                    active
                      ? 'bg-ink text-white scale-[1.02]'
                      : 'bg-card hover:bg-card-2 text-p1'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[11px] font-mono-sf ${active ? 'text-white/60' : 'text-p3'}`}>
                      CASE · 0{idx + 1}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full ${active ? 'bg-white/15 text-white/80' : 'bg-white text-p2'}`}>
                      {cs.tag}
                    </span>
                  </div>
                  <div className={`text-[15px] font-medium leading-snug ${active ? 'text-white' : 'text-p1'}`}>
                    {cs.title}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 场景卡片 */}
        <article key={activeCase.id} className="fade-in mb-12">
          <div className="bg-card rounded-3xl p-7 md:p-10">
            <p className="text-[11px] font-mono-sf text-p3 mb-4 tracking-widest uppercase">
              The Scenario · 场景
            </p>
            <p className="text-[19px] md:text-[21px] text-p1 leading-[1.55] tracking-tighter-2">
              {activeCase.scenario}
            </p>
            <div className="mt-7 pt-6 border-t border-cs">
              <p className="text-[11px] font-mono-sf text-p3 mb-3 tracking-widest uppercase">
                Question · 思考问题
              </p>
              <p className="text-[16px] text-p2 leading-relaxed">
                {activeCase.question}
              </p>
            </div>
          </div>
        </article>

        {/* 分析输入区 / 对话线 切换 */}
        {thread.length === 0 ? (
          // ───── 还没提交：显示输入 ─────
          <section className="slide-up">
            <div className="flex items-baseline justify-between mb-3">
              <label className="text-[14px] font-medium text-p1">
                你的拆解
              </label>
              <span className="text-[12px] text-p3 font-mono-sf">
                {analysis.length} 字
              </span>
            </div>
            <textarea
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
              disabled={loading}
              placeholder="不用追求完美——把你脑子里的拆解结构先写出来。写得越具体（你的判断、你的依据、你的方案），点评越能给你东西。"
              className="w-full bg-card rounded-2xl border-0 px-5 py-4 text-[16px] text-p1 placeholder:text-p3 leading-relaxed resize-y min-h-[200px]"
            />
            <div className="mt-5 flex items-center justify-between flex-wrap gap-3">
              <p className="text-[12px] text-p3">
                {apiKey
                  ? <>已配置 API Key · <span className="text-p2">Sonnet 4 · 流式输出</span></>
                  : <>未填 API Key · <span className="text-p2">预览演示模式</span></>}
              </p>
              <button
                onClick={submitInitial}
                disabled={loading || !analysis.trim()}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-[14px] font-medium transition-all ${
                  loading || !analysis.trim()
                    ? 'bg-card text-p3 cursor-not-allowed'
                    : 'bg-ink text-white hover:bg-black active:scale-[0.98]'
                }`}
              >
                {loading ? (
                  <><Loader2 size={14} className="animate-spin" /> 正在点评</>
                ) : (
                  <>提交点评 <ArrowRight size={14} /></>
                )}
              </button>
            </div>
          </section>
        ) : (
          // ───── 已提交：显示对话线 ─────
          <section className="slide-up">
            <div className="flex items-center justify-between mb-7">
              <p className="text-[13px] font-medium text-p1">
                与导师的对话
              </p>
              <button
                onClick={resetThread}
                className="flex items-center gap-1.5 text-[12px] text-p2 hover:text-p1 transition-colors"
              >
                <RotateCcw size={12} />
                重新开始
              </button>
            </div>

            <div className="space-y-8">
              {thread.map((msg, i) => (
                msg.role === 'user' ? (
                  <div key={i} className="fade-in">
                    <p className="text-[12px] font-medium text-p3 mb-2.5">你</p>
                    <p className="text-[16px] text-p1 leading-[1.65] whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                ) : (
                  <div key={i} className="fade-in">
                    <p className="text-[12px] font-medium text-p3 mb-2.5 flex items-center gap-2">
                      <span className="text-accent">导师</span>
                      {loading && i === thread.length - 1 && (
                        <span className="flex gap-0.5">
                          <span className="w-1 h-1 rounded-full bg-accent pulse-dot" />
                          <span className="w-1 h-1 rounded-full bg-accent pulse-dot" style={{ animationDelay: '0.2s' }} />
                          <span className="w-1 h-1 rounded-full bg-accent pulse-dot" style={{ animationDelay: '0.4s' }} />
                        </span>
                      )}
                    </p>
                    <div className="bg-card rounded-2xl px-6 py-5 text-[16px] text-p1 leading-[1.7] whitespace-pre-wrap tracking-tight">
                      {msg.content || <span className="text-p3 italic text-[14px]">思考中——首字通常在 2 秒内出现…</span>}
                    </div>
                  </div>
                )
              ))}
              <div ref={threadEndRef} />
            </div>

            {/* 追问输入框 */}
            {!loading && thread.length > 0 && thread[thread.length - 1].content && (
              <div className="mt-10 fade-in">
                <p className="text-[12px] font-medium text-p3 mb-3">
                  继续追问
                </p>
                <div className="relative">
                  <textarea
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        submitFollowUp();
                      }
                    }}
                    placeholder='比如："我不太理解你说的XX是什么意思？" 或 "如果换个场景，这个判断还成立吗？"'
                    rows={2}
                    className="w-full bg-card rounded-2xl border-0 px-5 py-3.5 pr-14 text-[15px] text-p1 placeholder:text-p3 leading-relaxed resize-none"
                  />
                  <button
                    onClick={submitFollowUp}
                    disabled={!followUp.trim()}
                    className={`absolute right-2.5 bottom-2.5 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      followUp.trim()
                        ? 'bg-ink text-white hover:bg-black active:scale-95'
                        : 'bg-white text-p3 cursor-not-allowed'
                    }`}
                  >
                    <ArrowRight size={15} />
                  </button>
                </div>
                <p className="text-[11px] text-p3 mt-2.5">
                  <kbd className="font-mono-sf">⌘</kbd> + <kbd className="font-mono-sf">Enter</kbd> 发送
                </p>
              </div>
            )}
          </section>
        )}

        {/* 错误提示 */}
        {error && (
          <div className="mt-8 bg-[#FEF1F0] rounded-2xl px-5 py-4 flex items-start gap-3 fade-in">
            <AlertCircle size={16} className="text-[#D14343] mt-0.5 flex-shrink-0" />
            <div className="text-[14px]">
              <div className="text-[#A02020] font-medium mb-1">调用失败</div>
              <div className="text-p2 text-[13px] leading-relaxed">{error}</div>
              <div className="text-p3 text-[12px] mt-2">
                提示：如果是 401 / 403，请检查右上角填的 API Key；如果是 CORS 错误，说明环境屏蔽了直接浏览器调用，需要走后端转发。
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 页脚 */}
      <footer className="border-t border-cs mt-16">
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-10 flex items-center justify-between flex-wrap gap-3">
          <p className="text-[12px] text-p3">
            Built for thinkers, not generators · 18 cases across 5 categories
          </p>
          <p className="text-[12px] text-p3 font-mono-sf">v0.3</p>
        </div>
      </footer>

      {/* API Key 模态框 */}
      {showKeyModal && (
        <div
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center px-4 fade-in"
          onClick={() => setShowKeyModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-8 relative shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowKeyModal(false)}
              className="absolute top-5 right-5 text-p3 hover:text-p1 transition-colors"
            >
              <X size={18} />
            </button>
            <h3 className="text-[22px] font-semibold tracking-tight text-p1 mb-2">
              Anthropic API Key
            </h3>
            <p className="text-[14px] text-p2 leading-relaxed mb-6">
              Key 仅保存在浏览器内存中，不会上传到任何服务器，刷新页面即清除。
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline ml-1 inline-flex items-center gap-0.5"
              >
                获取 API Key
                <ArrowRight size={12} />
              </a>
            </p>
            <input
              type="password"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-card rounded-xl border-0 px-4 py-3 text-[14px] text-p1 placeholder:text-p3 font-mono-sf"
              onKeyDown={(e) => { if (e.key === 'Enter') saveKey(); }}
              autoFocus
            />
            <div className="mt-6 flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-5 py-2 text-p2 hover:text-p1 text-[14px]"
              >
                取消
              </button>
              <button
                onClick={saveKey}
                className="flex items-center gap-1.5 px-5 py-2 bg-ink text-white text-[14px] font-medium rounded-full hover:bg-black transition-colors"
              >
                {keySaved ? <><Check size={14} /> 已保存</> : <>保存</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
