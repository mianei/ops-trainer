import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {string | null} */
let skillRootCache = null;

function resolveSkillRoot() {
  if (skillRootCache) return skillRootCache;
  const candidates = [
    join(process.cwd(), 'skills', 'ai-product-project-coach'),
    join(process.cwd(), '.cursor', 'skills', 'ai-product-project-coach'),
    join(__dirname, '..', '..', 'skills', 'ai-product-project-coach'),
    join(__dirname, '..', '..', '.cursor', 'skills', 'ai-product-project-coach')
  ];
  for (const p of candidates) {
    if (existsSync(join(p, 'SKILL.md'))) {
      skillRootCache = p;
      return p;
    }
  }
  throw new Error('未找到 ai-product-project-coach skill（skills/ 或 .cursor/skills/）');
}

/** @param {string} name */
function readReference(name) {
  const path = join(resolveSkillRoot(), 'references', name);
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

/** @type {Record<string, string>} */
const MODE_INSTRUCTIONS = {
  'full-report': `当前模式：Full Report（完整落地方案）
- 使用 output-template.md 的完整结构输出
- 诊断简历 → 选 1 主项目 + 1 备选 → 底层逻辑 → 架构 → eval → badcase → 简历 bullet → 边界 → 行动项
- 信息不足时最多问 5 个高影响问题，否则直接输出`,

  'project-direction': `当前模式：Project Direction（项目方向）
- 给 1 个强方向 + 1-2 个备选，不要假装已可写进简历
- 结构：推荐方向 / 为什么 fit / 底层逻辑 / 架构选择 / 3-7 天证据计划 / 简历草稿 / 边界提醒`,

  'project-iteration': `当前模式：Project Iteration（项目迭代）
- 先诊断项目为何看起来弱（常见：功能列表无 AI 决策、无 eval、无 badcase、无口径、无面试防御）
- 结构：当前问题 / 缺失的 AI 产品价值 / 重建链路 / eval + MECE rubric / badcase 迭代 / 简历 bullet 重写`,

  'resume-diagnosis': `当前模式：Resume Diagnosis（简历诊断）
- 先诊断再改写，不要直接全文重写除非用户要求
- 分类经历：深挖 / 辅助 / 压缩删除 / 不适合 AI 包装
- 结构：总诊断 / 最强信号 / 最弱风险 / 经历分类 / 调整建议 / 项目机会`,

  'ai-pm-qa': `当前模式：AI PM Q&A（概念答疑）
- 直接回答，用具体产品工作例子
- 框架：你不必是工程师，但必须知道每个节点的 input/output/评价标准/失败模式
- 涵盖 RAG、Agent、Prompt、Evals 等产品判断视角`,

  'interview-defense': `当前模式：Interview Defense（面试防御）
- 结构：核心故事 / 3 个 likely questions / 可防御回答 / 2 个 badcase / 不能说的话
- 强调边界与真实参与，准备 metric 口径`
};

/** @param {string} mode */
export function buildCoachSystemPrompt(mode) {
  const intentRouting = readReference('intent-routing.md');
  const judgment = readReference('judgment-principles.md');
  const harness = readReference('harness-project-logic.md');
  const assessment = readReference('assessment-framework.md');
  const patterns = readReference('project-patterns.md');
  const outputTemplate = readReference('output-template.md');
  const cases = readReference('anonymized-cases.md');

  /** @type {string[]} */
  const refs = [
    '## Intent Routing\n' + intentRouting,
    '## Judgment Principles\n' + judgment,
    MODE_INSTRUCTIONS[mode] || MODE_INSTRUCTIONS['ai-pm-qa']
  ];

  if (mode === 'full-report' || mode === 'project-direction' || mode === 'project-iteration') {
    refs.push('## Harness Project Logic\n' + harness);
    refs.push('## Project Patterns\n' + patterns);
  }

  if (mode === 'full-report' || mode === 'resume-diagnosis') {
    refs.push('## Assessment Framework\n' + assessment);
  }

  if (mode === 'full-report') {
    refs.push('## Output Template\n' + outputTemplate);
    refs.push('## Anonymized Cases\n' + cases);
  }

  return `你是 AI 产品项目教练，专门帮助想拿 AI 产品实习或需要 AI 产品项目叙事的用户。

## 核心立场
- 从真实经历出发，安全包装边界是「在真实业务基础上向前推一步」
- 绝不编造内部权限、上线结果、算法归属、私有数据或增长指标
- 优先 AI 产品判断力：每个推荐项目必须包含评测集、badcase、支撑材料、面试防御
- 语气：直接但克制，像付费咨询交付物

## 项目底层逻辑（必须体现）
功能点/用户任务 → AI 技术方案 → 评测集+MECE 评分 → 跑评测定位链路问题 → 迭代链路 → 复测指标提升

## 参考文档
${refs.join('\n\n')}

## 输出规则
- 匹配意图深度：窄问题简洁具体；完整报告按模板结构
- 至少 2 个 badcase（从低分维度 → 链路归因 → 修改节点 → 复测）
- 不确定数据用 XX 占位并说明测量口径
- 无真实证据时明确说不要写上线、AB 测试、内部库访问等
- 使用简体中文回复，多用表格和 checklist`;
}

/**
 * @param {string} mode
 * @param {Record<string, string>} intake
 * @param {string} message
 */
export function buildCoachUserMessage(mode, intake, message) {
  const filled = Object.entries(intake || {})
    .filter(([, v]) => String(v || '').trim())
    .map(([k, v]) => `【${k}】\n${v}`)
    .join('\n\n');

  return [filled && `## 用户提供的信息\n${filled}`, `## 用户请求\n${message}`]
    .filter(Boolean)
    .join('\n\n');
}
