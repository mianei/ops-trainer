/**
 * 统一 Agent 意图路由（Bot + 首页 goal plan 共用）
 * @typedef {'score_resume'|'optimize_resume'|'jd_rewrite_resume'|'prep_interview'|'next_scenario'|'switch_tab'|'export_doc'|'navigate_scene'|'coach_mode'|'coach_followup'|'goal_plan'|'submit_scenario'|'refine_canvas'} AgentIntentName
 */

import { detectCoachIntent } from './coach-modes.js';

/** @type {Record<string, string>} */
export const AGENT_INTENT_LABELS = {
  score_resume: '简历评分',
  optimize_resume: '简历优化',
  jd_rewrite_resume: '按JD改简历',
  prep_interview: '面试准备',
  next_scenario: '换题',
  switch_tab: '切换 Tab',
  export_doc: '导出文档',
  navigate_scene: '切换模块',
  coach_mode: '教练模式',
  coach_followup: '追问',
  goal_plan: '训练规划',
  submit_scenario: '提交点评',
  refine_canvas: '按要求改画布'
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

/** 用户在改已有结果，而不是发起全新优化/评分 */
export function looksLikeRefineRequest(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  if (/^(优化简历|开始优化|去优化|优化|optimize|评分|打分|准备面试|一键准备|按JD改简历|根据JD改简历)$/i.test(t)) return false;
  return /太长|太短|改短|改长|再来一版|再写一版|再出一版|再.*一版|润色一下|缩短|精简|压缩|简洁|详细一点|展开|写短|写长|少写|多写|内容太长|改写.*长|长了|短了|不满意|重新改|改一下|改成|去掉|删掉|按.*三条|项目真实性|证据完整度|面试防御/.test(t);
}

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

  // 改已有结果优先于「优化/改写」关键词，避免「改写内容太长了」只切 Tab 不重跑
  if (looksLikeRefineRequest(t)) {
    let targetScene = scene;
    if (/项目真实性|证据完整度|面试防御|准备报告|三维|三条/.test(t)) targetScene = 'prep';
    else if (/bullet|简历|改写|优化/.test(t)) targetScene = 'resume';
    return {
      intent: 'refine_canvas',
      tool: 'refine_canvas',
      targetScene,
      confidence: 'high',
      source: 'regex'
    };
  }

  if (/评分|打分|评一下|score/i.test(t)) {
    return { intent: 'score_resume', tool: 'score_resume', targetScene: 'resume', confidence: 'high', source: 'regex' };
  }

  if (/根据.?JD|按.?JD|对照.?JD|一键.*改简历|JD.*改写|改写.*JD|对齐.?JD/i.test(t)) {
    return { intent: 'jd_rewrite_resume', tool: 'jd_rewrite_resume', targetScene: 'resume', confidence: 'high', source: 'regex' };
  }

  // 仅匹配「发起优化」，不要用宽泛的「改写」吞掉 refinement
  if (/优化简历|改写简历|优化 bullet|一键优化|开始优化|去优化|^optimize$/i.test(t)
    || (/^优化$/.test(t))
    || (/优化/.test(t) && !/太长|太短|改短|项目|JD/i.test(t) && t.length <= 12)) {
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
    const targetScene = RESUME_COACH_MODES.has(coachMode) ? 'resume' : (COACH_MODE_TO_SCENE[coachMode] || scene);
    return {
      intent: 'coach_mode',
      tool: 'coach_reply',
      mode: coachMode,
      targetScene,
      confidence: 'medium',
      source: 'regex'
    };
  }

  if (/计划|规划|学习路径|训练计划|goal/i.test(t)) {
    return { intent: 'goal_plan', tool: 'plan_goal', confidence: 'medium', source: 'regex' };
  }

  return { intent: 'coach_followup', tool: 'coach_reply', confidence: 'low', source: 'regex' };
}

export { RESUME_COACH_MODES, COACH_MODE_TO_SCENE };
