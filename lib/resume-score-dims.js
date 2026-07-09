/** 简历评分五维（固定顺序） */
export const RESUME_SCORE_DIM_NAMES = [
  'AI产品匹配度',
  '结果量化度',
  '结构化表达',
  '决策深度',
  '差异化程度'
];

/** 面试准备侧三维（原简历评分维度迁移） */
export const INTERVIEW_PREP_DIM_NAMES = [
  '项目真实性',
  '证据完整度',
  '面试防御力'
];

/** @type {Record<string, string[]>} */
export const RESUME_DIM_ALIASES = {
  AI产品匹配度: ['AI产品匹配', 'AI产品信号', '产品匹配', '岗位匹配'],
  结果量化度: ['结果量化', '量化程度', '项目可信度', '可信度'],
  结构化表达: ['结构化', '叙述结构', '表达结构', 'STAR'],
  决策深度: ['决策', '取舍', 'trade-off', '方案深度'],
  差异化程度: ['差异化', '独特性', '亮点', '面试可防守', '可防守性']
};

/** @type {Record<string, string[]>} */
export const PREP_DIM_ALIASES = {
  项目真实性: ['真实性', '项目可信', '可信度', '参与度'],
  证据完整度: ['证据完整', '证据支撑', '证据链', '材料完整'],
  面试防御力: ['面试防御', '可防守性', '追问抗压', '防守力']
};

/**
 * @param {string} canonical
 * @param {string} rawName
 * @param {Record<string, string[]>} aliases
 */
export function dimNameMatches(canonical, rawName, aliases = RESUME_DIM_ALIASES) {
  const r = String(rawName || '').trim();
  if (!r) return false;
  if (r.includes(canonical) || canonical.includes(r.slice(0, 3))) return true;
  const list = aliases[canonical] || [];
  return list.some((a) => r.includes(a) || a.includes(r.slice(0, 2)));
}
