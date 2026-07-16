/** @type {Record<string, { mode: string, prompt: (ctx: { hasJd?: boolean, refine?: string }) => string }>} */
export const COACH_ACTIONS = {
  'resume-score': {
    mode: 'resume-diagnosis',
    prompt: ({ hasJd }) => `输出简历评分 JSON。${hasJd ? '含 JD 匹配判断，passRate 考虑 JD 对齐。' : ''}`
  },
  'resume-optimize': {
    mode: 'resume-diagnosis',
    prompt: ({ hasJd, refine }) => {
      const base =
        `输出简历优化 JSON。bullets.after 必须是「可直接粘贴进简历」的改写方案，不是分析点评；批判/局限只能写 weakProject 或 detailSupplements。${hasJd ? '对齐 JD。' : ''}`;
      const r = String(refine || '').trim();
      if (!r) return base;
      return `${base}\n\n【用户修改要求，必须遵守，这是最高优先级】\n${r}\n若 intake 含 previousOptimize，必须在上一版 after 基础上改，禁止原样复读上一版。若要求缩短：每条 after 40–70 字。`;
    }
  },
  'resume-jd-rewrite': {
    mode: 'resume-diagnosis',
    prompt: () =>
      '输出按目标 JD 改写后的简历优化 JSON。必须紧扣 JD 关键词与能力要求改写原简历经历；bullets.after 与 outputResume 都要可直接粘贴。'
  },
  'interview-prep': {
    mode: 'interview-defense',
    prompt: () => '输出面试准备 JSON：含 prepDimensions（项目真实性、证据完整度、面试防御力）、opening15s、projects、followUps。'
  }
};

/** @param {string} action */
export function resolveCoachAction(action, intake = {}) {
  const cfg = COACH_ACTIONS[action];
  if (!cfg) return null;
  const hasJd = Boolean(String(intake.jd || '').trim());
  const hasResume = Boolean(String(intake.resume || intake.background || '').trim());
  const refine = String(intake.refine || '').trim();
  return {
    mode: cfg.mode,
    message: cfg.prompt({ hasJd, hasResume, refine })
  };
}
