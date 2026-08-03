/** 无效/敷衍作答检测：避免模型借历史或 RAG 脑补高分点评 */

const TRIVIAL_MIN_MEANINGFUL_CHARS = 12;

export function isTrivialAnswer(answer) {
  const raw = String(answer || '').trim();
  if (!raw) return { trivial: true, reason: 'empty' };
  if (raw.length < 4) return { trivial: true, reason: 'too_short' };

  // 去掉空白与常见标点后几乎没有实质字符
  const compact = raw.replace(/[\s\u3000，。！？、；：""''（）【】\[\]{}().,!?;:'"`~\-_=+<>|\\/]+/g, '');
  if (compact.length < 4) return { trivial: true, reason: 'punctuation_only' };

  // 纯数字 / 纯同一字符重复（如 1111、aaaa、。。。）
  if (/^\d{1,40}$/.test(compact)) return { trivial: true, reason: 'digits_only' };
  if (/^(.)\1{2,}$/u.test(compact)) return { trivial: true, reason: 'repeated_char' };

  // 字符种类极少且很短：如 "asdf" "测试测试" 仍可过；但 "1111aaaa" 类
  const unique = new Set([...compact]);
  if (compact.length <= 8 && unique.size <= 2) {
    return { trivial: true, reason: 'low_entropy' };
  }

  // 有效汉字/字母过少
  const meaningful = (compact.match(/[\u4e00-\u9fffA-Za-z]/g) || []).length;
  if (meaningful < TRIVIAL_MIN_MEANINGFUL_CHARS && compact.length < 20) {
    // 短答案且几乎没有中英文字：视为敷衍
    if (meaningful < 6) return { trivial: true, reason: 'no_substance' };
  }

  return { trivial: false, reason: '' };
}

export function buildTrivialReview(answer, opts = {}) {
  const usePm = opts.usePmDims !== false;
  const preview = String(answer || '').trim().slice(0, 40);
  const dimensions = usePm
    ? [
        { name: '逻辑性', score: 1, comment: '未形成可检验的结论与论证结构。' },
        { name: '专业性', score: 1, comment: '未体现产品/技术判断，缺少框架与取舍。' },
        { name: '流畅度', score: 1, comment: '没有完整表述，无法评估表达。' },
        { name: '匹配度', score: 1, comment: '未回应题目要求，答非所问或未作答。' },
        { name: '内容密度', score: 1, comment: '几乎没有有效信息。' }
      ]
    : [
        { name: '结构完整性', score: 1, comment: '无结构。' },
        { name: '框架运用', score: 1, comment: '未使用任何方法论。' },
        { name: '论据与可验证性', score: 1, comment: '无论据。' },
        { name: '业务洞察', score: 1, comment: '无洞察。' },
        { name: '可执行性', score: 1, comment: '无下一步。' }
      ];

  const summary = preview
    ? `本次作答「${preview}${String(answer || '').trim().length > 40 ? '…' : ''}」不具备可点评的实质内容，五维均按最低分计。`
    : '本次未提交有效作答，五维均按最低分计。';

  return {
    summary,
    dimensions,
    strengths: [],
    gaps: ['作答过短或无实质内容，无法体现场景分析与产品判断'],
    actions: ['请围绕题目写清：结论 → 理由/取舍 → 可验证指标或风险，至少几句完整分析'],
    growth: '',
    referenceGap: '与合格回答相比，缺少对题干的任何有效回应'
  };
}

export const TRIVIAL_ANSWER_PROMPT_RULE =
  '\n\n【作答有效性硬规则】只评用户消息里「我的分析」的本次原文。' +
  '若作答无实质内容（过短、乱码、纯数字、无意义重复、明显未答题），五维分数必须全部为 1，' +
  'summary 须写明「未有效作答」，strengths 置空，禁止借用「以往作答记录」或知识库/面经内容编造亮点或中等分数。';
