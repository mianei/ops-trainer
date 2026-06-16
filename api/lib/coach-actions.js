/** @type {Record<string, { mode: string, prompt: (ctx: { hasJd?: boolean }) => string }>} */
export const COACH_ACTIONS = {
  'resume-score': {
    mode: 'resume-diagnosis',
    prompt: ({ hasJd }) => `简历结构化评分：1) 总评 1-10 + 一句话 2) 五维各 1-5（AI产品信号、项目可信度、叙述结构、证据完整度、面试可防守性）各一句 3) 优先改的 3 点${hasJd ? ' 4) JD 匹配度' : ''}`
  },
  'resume-optimize': {
    mode: 'full-report',
    prompt: ({ hasJd }) => `四步优化简历：①诊断薄弱项目 ②bullet 改前→改后 ③补 eval/badcase 清单 ④缺主项目则给 1 主 + 1 备方向${hasJd ? '；对齐 JD' : ''}`
  },
  'interview-prep': {
    mode: 'interview-defense',
    prompt: ({ hasJd, hasResume }) => `基于简历准备 AI PM 面试：1) 前 15 秒印象 2) 每项目 30 秒结构 3) 5 个追问 + 防守要点 4) 2 个 badcase 5) 不能说的话${hasResume ? '' : '（简历未上传，据补充说明）'}${hasJd ? '；对齐 JD' : ''}`
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
