/**
 * 统一 Agent 意图路由（Bot + 首页 goal plan 共用）
 * @typedef {'score_resume'|'optimize_resume'|'prep_interview'|'next_scenario'|'switch_tab'|'export_doc'|'navigate_scene'|'coach_mode'|'coach_followup'|'goal_plan'|'submit_scenario'} AgentIntentName
 */

import { detectCoachIntent } from './coach-modes.js';

/** @type {Record<string, string>} */
export const AGENT_INTENT_LABELS = {
  score_resume: '简历评分',
  optimize_resume: '简历优化',
  prep_interview: '面试准备',
  next_scenario: '换题',
  switch_tab: '切换 Tab',
  export_doc: '导出文档',
  navigate_scene: '切换模块',
  coach_mode: '教练模式',
  coach_followup: '追问',
  goal_plan: '训练规划',
  submit_scenario: '提交点评'
};

const COACH_MODE_TO_SCENE = {
  'full-report': 'resume',
  'project-direction': 'resume',
  'project-iteration': 'resume',
  'resume-diagnosis': 'resume',
  'ai-pm-qa': 'prep',
  'interview-defense': 'prep'
};

const RESUME_COACH_MODES = new Set(['full-report', 'project-direction', 'project-iteration', 'resume-diagnosis']);

/**
 * @param {string} msg
 * @param {{ scene?: string }} [ctx]
 */
export function resolveAgentIntent(msg, ctx = {}) {
  const t = String(msg || '').trim();
  const scene = ctx.scene || 'resume';
  const lower = t.toLowerCase();
  if (!t) {
    return { intent: 'coach_followup', tool: 'coach_reply', confidence: 'low', source: 'regex' };
  }

  if (/换题|下一题|再来一题|another\s*question|next\s*(question|one)/i.test(t)) {
    return { intent: 'next_scenario', tool: 'pick_scenario', targetScene: 'scenario', confidence: 'high', source: 'regex' };
  }

  if (/提交.*点评|获取点评|提交作答|submit/i.test(t) && (scene === 'scenario' || /业务|场景|题目/.test(t))) {
    return { intent: 'submit_scenario', tool: 'submit_scenario_answer', targetScene: 'scenario', confidence: 'high', source: 'regex' };
  }

  if (/评分|打分|评一下|score/i.test(t)) {
    return { intent: 'score_resume', tool: 'score_resume', targetScene: 'resume', confidence: 'high', source: 'regex' };
  }

  if (/优化简历|改写简历|优化 bullet|optimize/i.test(t) || (/优化|改写/.test(t) && !/项目/.test(t))) {
    return { intent: 'optimize_resume', tool: 'optimize_resume', targetScene: 'resume', confidence: 'high', source: 'regex' };
  }

  if (/准备面试|面试准备|一键准备|prep|备战|根据简历准备/i.test(t)) {
    return { intent: 'prep_interview', tool: 'prepare_interview', targetScene: 'prep', confidence: 'high', source: 'regex' };
  }

  if (/导出|下载|markdown|\.md\b|docx|pdf/i.test(lower)) {
    return { intent: 'export_doc', tool: 'export_markdown', confidence: 'high', source: 'regex' };
  }

  const tabMatch = t.match(/(?:切到|打开|看|切换(?:到)?|去)[「"']?([^「"'\s]+)[」"']?(?:tab|页)?/i);
  if (tabMatch) {
    return { intent: 'switch_tab', tool: 'switch_canvas_tab', tab: tabMatch[1].trim(), confidence: 'high', source: 'regex' };
  }
  if (/解析|框架|标准|rubric/i.test(t) && (scene === 'scenario' || /业务|场景/.test(t))) {
    return { intent: 'switch_tab', tool: 'switch_canvas_tab', tab: '解析', confidence: 'high', source: 'regex' };
  }
  if (/点评|反馈|review/i.test(t) && (scene === 'scenario' || /业务|场景/.test(t))) {
    return { intent: 'switch_tab', tool: 'switch_canvas_tab', tab: '点评', confidence: 'high', source: 'regex' };
  }
  if (/题目|作答|题干/i.test(t) && (scene === 'scenario' || /业务|场景/.test(t))) {
    return { intent: 'switch_tab', tool: 'switch_canvas_tab', tab: '题目', confidence: 'high', source: 'regex' };
  }
  if (/文档|doc/i.test(t) && /看|切|打开|去/.test(t)) {
    return { intent: 'switch_tab', tool: 'switch_canvas_tab', tab: '文档', confidence: 'medium', source: 'regex' };
  }

  if (/业务场景|练题|面经题|场景题|答题/i.test(t)) {
    return { intent: 'navigate_scene', tool: 'navigate_scene', targetScene: 'scenario', confidence: 'high', source: 'regex' };
  }
  if (/知识库|查概念|解释.*概念|阅读卡/i.test(t)) {
    return { intent: 'navigate_scene', tool: 'navigate_scene', targetScene: 'kb', confidence: 'high', source: 'regex' };
  }
  if (/简历\s*agent|简历模块|去简历|评分报告/i.test(t)) {
    return { intent: 'navigate_scene', tool: 'navigate_scene', targetScene: 'resume', confidence: 'high', source: 'regex' };
  }
  if (/面试准备|prep\s*模块|去准备/i.test(t)) {
    return { intent: 'navigate_scene', tool: 'navigate_scene', targetScene: 'prep', confidence: 'high', source: 'regex' };
  }

  const coachMode = detectCoachIntent(t);
  if (coachMode) {
    return {
      intent: 'coach_mode',
      tool: 'coach_mode',
      coachMode,
      targetScene: COACH_MODE_TO_SCENE[coachMode] || 'resume',
      confidence: 'high',
      source: 'regex'
    };
  }

  if (/规划|训练计划|学习计划|帮我安排|明天面|后天面|紧急面试/i.test(t)) {
    return { intent: 'goal_plan', tool: 'goal_plan', confidence: 'medium', source: 'regex' };
  }

  if (/追问|followup|解释|为什么|怎么改|不满意|再.*一版|改短|改长|润色/i.test(t)) {
    return { intent: 'coach_followup', tool: 'coach_reply', confidence: 'medium', source: 'regex' };
  }

  return { intent: 'coach_followup', tool: 'coach_reply', confidence: 'low', source: 'regex' };
}

export { RESUME_COACH_MODES, COACH_MODE_TO_SCENE };
