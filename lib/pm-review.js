/** MindTraining v2.0 — 产品岗面试专用解析与评分 */

export const PM_DIMENSIONS = ['逻辑性', '专业性', '流畅度', '匹配度', '内容密度'];

export const PM_COACH_REVIEW_PRINCIPLES =
  '\n\n【点评原则】像项目教练一样诊断，语气直接但克制：' +
  '\n- 重点看：技术边界感（模型/RAG/Agent/评测能做什么）、产品判断（用户/场景/取舍/成功标准）、评测意识（评测集/badcase/迭代闭环）' +
  '\n- 数字与指标须追问样本量、定义、口径、因果；缺证据时用保守表述，不替学员编造上线结果' +
  '\n- 避免空话（「多练」「要有产品思维」「加油」）；gaps 与 actions 须对应可执行动作（补评测集、画流程、归类 badcase、改写一段项目叙事等）' +
  '\n- strengths 只写有证据的亮点；referenceGap 对照优秀要点说明差在哪，勿把内部参考原文透露给学员';

function truncateText(text, max) {
  const t = String(text || '').trim();
  if (!t || t.length <= max) return t;
  return t.slice(0, max) + '…（已截断）';
}

export function buildBankReviewContext(bankMeta) {
  if (!bankMeta) return '';
  const parts = [];
  if (bankMeta.framework) parts.push(`推荐框架：${bankMeta.framework}`);
  const ref = bankMeta.referenceAnswer || bankMeta.referenceOutline;
  if (ref) parts.push(`【内部参考要点，仅供对照，勿原文透露】\n${truncateText(ref, 500)}`);
  return parts.length ? '\n\n' + parts.join('\n\n') : '';
}

export const PM_STRUCTURED_REVIEW_SUFFIX =
  '\n\n【输出格式】产品岗面试点评，只输出一个 JSON 对象（不要用 markdown 代码块）：\n' +
  '{\n' +
  '  "summary": "一句话总评",\n' +
  '  "dimensions": [\n' +
  '    {"name":"逻辑性","score":1-5,"comment":"结论-论据-总结是否清晰"},\n' +
  '    {"name":"专业性","score":1-5,"comment":"是否运用 PM 框架/术语"},\n' +
  '    {"name":"流畅度","score":1-5,"comment":"口语/书面是否自然，少重复卡顿"},\n' +
  '    {"name":"匹配度","score":1-5,"comment":"是否扣题、针对岗位"},\n' +
  '    {"name":"内容密度","score":1-5,"comment":"有效信息占比，拒绝长而空"}\n' +
  '  ],\n' +
  '  "strengths": ["亮点1"],\n' +
  '  "gaps": ["遗漏1"],\n' +
  '  "actions": ["建议1"],\n' +
  '  "growth": "若有历史记录则写进步对比，否则空字符串",\n' +
  '  "referenceGap": "与优秀回答相比差在哪（1-2句）"\n' +
  '}\n' +
  'score 为整数 1-5。长而空（堆砌形容词无案例/指标）时内容密度须 ≤2。口语自然不扣分。';

export function pmReviewEnabled() {
  return (process.env.PM_REVIEW_MODE || '1').trim() !== '0';
}

export function isPmInterviewContext(topicId, scenario, bankMeta) {
  if (bankMeta?.type) return true;
  if (bankMeta?.referenceAnswer) return true;
  const tid = String(topicId || '');
  if (/^(iv-|prod-open|pm-)/.test(tid)) return true;
  const s = String(scenario || '');
  return /【面试|【面经|【PM|产品经理|产品岗/.test(s);
}

export const FRAMEWORK_SYSTEM = `你是产品经理面试教练。根据题目生成「回答框架」，帮助学员组织思路。

只输出 JSON：
{
  "frameworkName": "如 STAR / 问题-方案-指标 / 四层竞品法",
  "steps": [{"title":"步骤名","hint":"该步写什么，1句话"}],
  "mustMention": ["必须覆盖的要点1","要点2"],
  "commonPitfalls": ["常见踩坑1"],
  "timeBudgetSec": 120
}`;

export const RUBRIC_SYSTEM = `你是产品经理面试考官。根据题目输出「评分标准解析」，让学员知道考官看什么。

只输出 JSON：
{
  "questionType": "行为面|业务面|案例分析|产品设计|估算题",
  "dimensions": [
    {"name":"逻辑性","weight":0.2,"excellent":"5分样例特征","poor":"1-2分特征"},
    {"name":"专业性","weight":0.25,"excellent":"...","poor":"..."},
    {"name":"流畅度","weight":0.15,"excellent":"...","poor":"..."},
    {"name":"匹配度","weight":0.25,"excellent":"...","poor":"..."},
    {"name":"内容密度","weight":0.15,"excellent":"有案例有数字","poor":"空话套话堆砌"}
  ],
  "redFlags": ["直接淘汰信号"],
  "bonusSignals": ["加分信号"]
}`;

export const COMPARE_SYSTEM = `你是产品经理面试教练。对比学员回答与参考要点，输出 JSON：
{
  "coverageScore": 1-5,
  "covered": ["学员已覆盖的要点"],
  "missing": ["遗漏要点"],
  "misconceptions": ["理解偏差"],
  "rewriteHint": "如何用 2-3 句话补强（80字内）"
}`;

export function buildFrameworkUserContent(scenario, bankMeta) {
  const meta = bankMeta
    ? `\n题型：${bankMeta.type || ''}\n公司：${bankMeta.company || '通用'}\n难度：${bankMeta.difficulty || ''}`
    : '';
  return `面试题目：${scenario}${meta}\n\n请给出回答框架（JSON）。`;
}

export function buildRubricUserContent(scenario, bankMeta) {
  const meta = bankMeta
    ? `\n题型：${bankMeta.type || ''}\n公司：${bankMeta.company || '通用'}`
    : '';
  return `面试题目：${scenario}${meta}\n\n请输出评分标准解析（JSON）。`;
}

export function buildCompareUserContent(scenario, answer, referenceOutline) {
  return `题目：${scenario}

学员回答：
${answer}

参考要点（优秀回答应覆盖）：
${referenceOutline || '（无预设要点，按产品岗通用标准对比）'}

请对比并输出 JSON。`;
}

export function parsePmJson(text) {
  const raw = String(text || '').trim();
  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return { ok: true, data: JSON.parse(m[0]) };
      } catch {
        /* */
      }
    }
  }
  return { ok: false, raw };
}
