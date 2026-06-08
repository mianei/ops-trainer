/**
 * LLM 仿真出题（Demo）
 * 原规划为 RAG 检索面经后出题；当前 Demo 路径为模型按目标/岗位直接生成题干。
 * 正式 RAG（牛客/小红书/Firecrawl 等）见 docs/agent-roadmap.md
 */

export function getLlmConfig() {
  const provider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (provider === 'anthropic' || (!provider && anthropicKey && !deepseekKey)) {
    if (!anthropicKey) return null;
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
    };
  }
  if (deepseekKey) {
    return {
      provider: 'deepseek',
      apiKey: deepseekKey,
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
    };
  }
  if (anthropicKey) {
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'
    };
  }
  return null;
}

function defaultTopicForRole(roleKey, validIds) {
  const map = {
    ops: 'iv-ops',
    data: 'iv-skills',
    strategy: 'biz-platform',
    monetize: 'biz-monetize',
    growth: 'growth',
    algo: 'iv-skills',
    design: 'interaction',
    eng: 'iv-misc',
    general: 'iv-exp',
    pm_ops: 'iv-pm'
  };
  const id = map[roleKey] || 'iv-pm';
  return validIds.has(id) ? id : 'iv-pm';
}

const GENERATE_SYSTEM = `你是 MindTraining 的仿真出题模块。根据用户学习目标与可选的「检索面经 RAG 摘要」生成面试/业务分析题。

题干格式：
- 有 RAG 依据时：以【RAG面经·公司或行业·题型】开头，改写为独立可答题干，勿照抄 URL
- 无 RAG 时：以【AI生成·行业或公司·题型】开头
- 正文 90-220 字：业务背景 + 明确问题

只返回 JSON：{ "scenarios": [{ "topicId": "catalog中的模块id", "text": "完整题干", "kind": "behavior|case|data|product" }] }`;

function buildGenerateUserContent({ goal, intent, catalog, historySummary, count, ragChunks }) {
  const catalogLines = (catalog || [])
    .slice(0, 60)
    .map(c => `- ${c.id}: ${c.label} (${c.catLabel || c.cat || ''})`)
    .join('\n');
  const weak = historySummary?.weakTopicIds?.length
    ? `用户历史薄弱模块（可针对性加练）：${historySummary.weakTopicIds.join(', ')}`
    : '';
  const intentLine = intent
    ? [
        intent.mode === 'interview' ? '场景：面试备战' : '场景：技能补强',
        intent.roleLabel ? `岗位：${intent.roleLabel}` : '',
        intent.company ? `公司/行业：${intent.company}` : '',
        intent.urgent ? '时间：紧急（明日面试，题目偏实战、少而精）' : ''
      ]
        .filter(Boolean)
        .join('；')
    : '';
  const ragBlock = (ragChunks || []).length
    ? `\n\n以下是从牛客/小红书等检索到的面经摘要（RAG，请优先依据这些内容出题，可改写为独立题干）：\n${ragChunks
        .slice(0, 5)
        .map((c, i) => `${i + 1}. [${c.sourceLabel || '面经'}] ${c.title}\n${String(c.text || '').slice(0, 400)}`)
        .join('\n\n')}`
    : '';
  return `用户目标：${goal}
${intentLine}
${weak}

catalog（topicId 只能从中选）：
${catalogLines}
${ragBlock}

请生成 ${count} 道题。有 RAG 摘要时题干应贴近真实面经表述；无 RAG 时可仿真生成。`;
}

async function callDeepSeekJson(cfg, system, user) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `DeepSeek HTTP ${res.status}`);
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('DeepSeek 返回为空');
  return JSON.parse(text);
}

async function callAnthropicJson(cfg, system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: user + '\n\n只输出 JSON。' }]
    })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error?.message || `Anthropic HTTP ${res.status}`);
  }
  const text = data?.content?.[0]?.text;
  if (!text) throw new Error('Anthropic 返回为空');
  return JSON.parse(text.replace(/^```json?\s*|\s*```$/g, '').trim());
}

function normalizeGenerated(raw, catalog, roleKey, hasRag) {
  const validIds = new Set((catalog || []).map(c => c.id));
  const fallback = defaultTopicForRole(roleKey, validIds);
  return (raw?.scenarios || [])
    .filter(s => s?.text && String(s.text).length >= 50)
    .map(s => {
      let text = String(s.text).trim();
      if (!/^【(AI生成|RAG面经)/.test(text)) {
        const tag = hasRag ? 'RAG面经' : 'AI生成';
        text = `【${tag}·仿真题·${s.kind || 'case'}】${text}`;
      }
      return {
        topicId: validIds.has(s.topicId) ? s.topicId : fallback,
        text: text.slice(0, 900),
        kind: s.kind || 'case'
      };
    });
}

/**
 * @param {{ goal: string, intent?: object, catalog: object[], historySummary?: object, count?: number, cfg?: object }} opts
 */
export async function generateScenarios(opts) {
  const cfg = opts.cfg || getLlmConfig();
  if (!cfg) {
    return { ok: false, scenarios: [], message: '未配置 DEEPSEEK_API_KEY 或 ANTHROPIC_API_KEY' };
  }

  const count = Math.max(1, Math.min(Number(opts.count) || 2, 4));
  const userContent = buildGenerateUserContent({
    goal: opts.goal,
    intent: opts.intent,
    catalog: opts.catalog,
    historySummary: opts.historySummary,
    count,
    ragChunks: opts.ragChunks
  });

  try {
    const raw =
      cfg.provider === 'anthropic'
        ? await callAnthropicJson(cfg, GENERATE_SYSTEM, userContent)
        : await callDeepSeekJson(cfg, GENERATE_SYSTEM, userContent);
    const scenarios = normalizeGenerated(raw, opts.catalog, opts.intent?.roleKey, !!(opts.ragChunks || []).length).slice(0, count);
    if (!scenarios.length) {
      return { ok: false, scenarios: [], message: '模型未返回有效题目' };
    }
    return { ok: true, scenarios, demo: !(opts.ragChunks || []).length, grounded: !!(opts.ragChunks || []).length, message: null };
  } catch (e) {
    return { ok: false, scenarios: [], message: String(e.message || e) };
  }
}

export function injectGeneratedSteps(plan, scenarios, opts = {}) {
  if (!scenarios?.length || !Array.isArray(plan.steps)) return plan;
  const insertAt = plan.steps.findIndex(s => s.type === 'practice');
  const idx = insertAt >= 0 ? insertAt : plan.steps.length;
  const grounded = !!opts.grounded;
  const extra = scenarios.map(s => ({
    type: 'practice',
    topicId: s.topicId,
    scenario: s.text,
    keywords: [],
    generated: true,
    demo: !grounded,
    grounded
  }));
  plan.steps.splice(idx, 0, ...extra);
  return plan;
}
