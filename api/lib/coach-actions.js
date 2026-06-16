/** @type {Record<string, { mode: string, prompt: (ctx: { hasJd?: boolean }) => string }>} */
export const COACH_ACTIONS = {
  'resume-score': {
    mode: 'resume-diagnosis',
    prompt: ({ hasJd }) => `请对我的简历做结构化评分（像老师批改作业）：
1. 总评（1-10 分）及一句话结论
2. 分维度评分（1-5）：AI 产品信号、项目可信度、叙述结构、证据完整度、面试可防守性
3. 各维度一句话点评
4. 最该先改的 3 个问题（按优先级排序）
${hasJd ? '请对照 JD 评估岗位匹配度。' : ''}`
  },
  'resume-optimize': {
    mode: 'full-report',
    prompt: ({ hasJd }) => `请像老师一样一步一步教我优化简历（不要空话，每一步都要具体可执行）：

**第一步：诊断** — 标出简历里每个 AI/产品项目的最大不足（逐条列出）

**第二步：改写** — 每个薄弱项目给出 bullet 改前→改后示例（只写能辩护的内容）

**第三步：迭代** — 哪些项目需要补 eval/badcase/证据？给出 3-7 天可执行清单

**第四步：方向** — 若还缺主项目，推荐 1 个主方向 + 1 个备选 + 最小证据计划

${hasJd ? '目标 JD 已提供，请对齐岗位要求。' : ''}`
  },
  'interview-prep': {
    mode: 'interview-defense',
    prompt: ({ hasJd, hasResume }) => `基于我的简历${hasResume ? '' : '（简历未上传，请根据补充说明回答）'}，帮我准备 AI 产品经理面试：
1. 面试官前 15 秒会怎么看我？最强/最弱信号是什么？
2. 每个项目 30 秒讲述结构（开场-任务-方案-评测-结果-边界）
3. 最可能被追问的 5 个问题 + 可防守回答要点
4. 必须准备的 2 个 badcase（现象-归因-改法-复测）
5. 明确不能说的话（避免被问穿）
${hasJd ? '已提供目标 JD，请对齐岗位要求。' : ''}`
  }
};

/** @param {string} action */
export function resolveCoachAction(action, intake = {}) {
  const cfg = COACH_ACTIONS[action];
  if (!cfg) return null;
  const hasJd = Boolean(String(intake.jd || '').trim());
  const hasResume = Boolean(String(intake.resume || intake.background || '').trim());
  return {
    mode: cfg.mode,
    message: cfg.prompt({ hasJd, hasResume })
  };
}
