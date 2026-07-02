/** @typedef {'full-report'|'project-direction'|'project-iteration'|'resume-diagnosis'|'ai-pm-qa'|'interview-defense'} CoachMode */

export const VALID_COACH_MODES = [
  'full-report',
  'project-direction',
  'project-iteration',
  'resume-diagnosis',
  'ai-pm-qa',
  'interview-defense'
];

export const COACH_MODES = [
  {
    id: 'full-report',
    title: '完整落地方案',
    subtitle: 'Full Report',
    description: '上传简历，生成结构化 AI 项目落地方案文档',
    icon: '📋',
    intakeFields: [
      { id: 'resume', label: '简历 / 经历', type: 'textarea', required: true, rows: 8, hint: '粘贴简历全文或核心经历' },
      { id: 'targetRole', label: '目标岗位', type: 'text', required: true, hint: '如：AI 产品实习、AIGC 产品' },
      { id: 'materials', label: '已有材料', type: 'textarea', rows: 4, hint: '项目链接、文档、数据样本等' },
      { id: 'timeline', label: '可投入时间', type: 'text', hint: '如：3-7 天可补做证据' }
    ],
    placeholder: '请基于我的简历，生成一份完整的 AI 项目落地方案…'
  },
  {
    id: 'project-direction',
    title: '项目方向',
    subtitle: 'Project Direction',
    description: '没有 AI 项目？从真实经历里找不烂大街的方向',
    icon: '🧭',
    intakeFields: [
      { id: 'background', label: '背景经历', type: 'textarea', required: true, rows: 6 },
      { id: 'targetRole', label: '目标方向', type: 'text', required: true },
      { id: 'constraints', label: '限制条件', type: 'textarea', rows: 3, hint: '时间、技术栈、不能编造的内容' }
    ],
    placeholder: '我没有 AI 项目，帮我从经历里找 1 个主方向 + 1 个备选…'
  },
  {
    id: 'project-iteration',
    title: '项目迭代',
    subtitle: 'Project Iteration',
    description: '已有 demo/RAG/Agent 但无面试？诊断并迭代',
    icon: '🔄',
    intakeFields: [
      { id: 'project', label: '项目描述', type: 'textarea', required: true, rows: 6, hint: '功能、技术栈、当前简历写法' },
      { id: 'problem', label: '当前问题', type: 'textarea', rows: 3, hint: '投简历无回复、面试被追问穿等' },
      { id: 'artifacts', label: '现有材料', type: 'textarea', rows: 3, hint: '链接、截图、eval 数据等' }
    ],
    placeholder: '帮我诊断这个项目为什么看起来弱，并给出 eval + badcase 迭代方案…'
  },
  {
    id: 'resume-diagnosis',
    title: '简历诊断',
    subtitle: 'Resume Diagnosis',
    description: '先诊断再改写，识别 AI 产品信号强弱',
    icon: '🔍',
    intakeFields: [
      { id: 'resume', label: '简历内容', type: 'textarea', required: true, rows: 10 },
      { id: 'targetRole', label: '目标岗位', type: 'text' },
      { id: 'feedback', label: '已收到的反馈', type: 'textarea', rows: 2 }
    ],
    placeholder: '诊断我的简历：前 15 秒能否看出 AI 产品信号？哪些经历该深挖/压缩？'
  },
  {
    id: 'ai-pm-qa',
    title: 'AI PM 答疑',
    subtitle: 'AI PM Q&A',
    description: 'RAG、Agent、Evals、技术深度等产品判断问题',
    icon: '💡',
    intakeFields: [
      { id: 'question', label: '你的问题', type: 'textarea', required: true, rows: 4 },
      { id: 'context', label: '背景（可选）', type: 'textarea', rows: 3 }
    ],
    placeholder: 'AI 产品经理需要懂多少 RAG / Agent / 评测？面试怎么考？'
  },
  {
    id: 'interview-defense',
    title: '面试防御',
    subtitle: 'Interview Defense',
    description: '项目讲述、追问应答、边界与 badcase 准备',
    icon: '🛡️',
    intakeFields: [
      { id: 'project', label: '项目描述', type: 'textarea', required: true, rows: 6 },
      { id: 'role', label: '你的真实参与', type: 'textarea', required: true, rows: 3 },
      { id: 'concerns', label: '担心被问穿的地方', type: 'textarea', rows: 3 }
    ],
    placeholder: '帮我准备这个项目的面试追问、2 个 badcase 和边界防御…'
  }
];

/** @param {string} id */
export function getCoachModeById(id) {
  const mode = COACH_MODES.find(m => m.id === id);
  if (!mode) throw new Error(`Unknown coach mode: ${id}`);
  return mode;
}

const COACH_INTENT_RULES = [
  { re: /完整|落地方案|规划.*AI\s*项目|转\s*AI\s*产品/i, mode: 'full-report' },
  { re: /迭代|无面试|没回复|demo.*弱|优化.*项目/i, mode: 'project-iteration' },
  { re: /简历|诊断|改写/i, mode: 'resume-diagnosis' },
  { re: /面试防御|追问|讲项目|被问穿/i, mode: 'interview-defense' },
  { re: /没有.*项目|项目方向|找方向/i, mode: 'project-direction' },
  { re: /AI\s*产品|RAG|Agent|评测|Eval|badcase|项目教练/i, mode: 'ai-pm-qa' }
];

/** @param {string} text */
export function detectCoachIntent(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  for (const rule of COACH_INTENT_RULES) {
    if (rule.re.test(t)) return rule.mode;
  }
  return null;
}
