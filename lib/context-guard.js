/**
 * Conversation turn guardrails — selective compression when history grows too long.
 */

export function getGuardConfig(overrides = {}) {
  return {
    turnThreshold: Number(overrides.turnThreshold ?? process.env.CONTEXT_TURN_THRESHOLD ?? 40),
    keepRecentTurns: Number(overrides.keepRecentTurns ?? process.env.CONTEXT_KEEP_RECENT ?? 10),
    enableLlmSummary: (overrides.enableLlmSummary ?? process.env.CONTEXT_LLM_SUMMARY ?? '0') === '1'
  };
}

/** Coach format: [{ role, content }] */
export function countCoachTurns(history) {
  if (!Array.isArray(history)) return 0;
  return history.filter((m) => m?.role === 'user' && m.content).length;
}

/** Chat followup format: [{ q, a }] */
export function countFollowupTurns(history) {
  if (!Array.isArray(history)) return 0;
  return history.length;
}

/** Extract pinned context from coach intake — kept verbatim during compression. */
export function extractPinnedContext(intake) {
  if (!intake || typeof intake !== 'object') return '';
  const parts = [];
  if (intake.targetRole) parts.push(`目标岗位：${String(intake.targetRole).slice(0, 120)}`);
  if (intake.background) parts.push(`背景：${String(intake.background).slice(0, 400)}`);
  if (intake.resume) parts.push(`简历摘要：${String(intake.resume).slice(0, 600)}`);
  if (intake.jd) parts.push(`JD 要点：${String(intake.jd).slice(0, 400)}`);
  if (intake.extra) parts.push(`补充：${String(intake.extra).slice(0, 300)}`);
  if (intake.weaknesses) parts.push(`薄弱点：${String(intake.weaknesses).slice(0, 300)}`);
  if (intake.projectPrefs) parts.push(`项目偏好：${String(intake.projectPrefs).slice(0, 300)}`);
  return parts.length ? parts.join('\n') : '';
}

function summarizeCoachTurns(turns) {
  const lines = [];
  let turnNum = 0;
  for (let i = 0; i < turns.length; i++) {
    const m = turns[i];
    if (m.role === 'user') {
      turnNum += 1;
      lines.push(`[轮${turnNum}] 用户：${String(m.content).slice(0, 200)}`);
    } else if (m.role === 'assistant') {
      lines.push(`[轮${turnNum}] 教练：${String(m.content).slice(0, 150)}`);
    }
  }
  return lines.join('\n');
}

function summarizeFollowupTurns(turns) {
  return turns
    .map((h, i) => `[轮${i + 1}] 问：${String(h.q || '').slice(0, 120)} / 答：${String(h.a || '').slice(0, 120)}`)
    .join('\n');
}

/**
 * Rule-based compression for coach chat history.
 * @returns {{ history: array, compressed: boolean, meta: object }}
 */
export function guardCoachHistory(history, intake, config = getGuardConfig()) {
  const safeHistory = Array.isArray(history)
    ? history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    : [];
  const turnCount = countCoachTurns(safeHistory);
  if (turnCount <= config.turnThreshold) {
    return { history: safeHistory, compressed: false, meta: { turnCount, keptTurns: turnCount } };
  }

  const keepPairs = config.keepRecentTurns;
  const keepMessages = keepPairs * 2;
  const older = safeHistory.slice(0, -keepMessages);
  const recent = safeHistory.slice(-keepMessages);
  const pinned = extractPinnedContext(intake);
  const summary = summarizeCoachTurns(older);

  const prefix = [];
  const summaryBlock = [
    pinned ? `【用户档案】\n${pinned}` : '',
    `【历史对话摘要 · 共 ${countCoachTurns(older)} 轮】\n${summary}`
  ]
    .filter(Boolean)
    .join('\n\n');

  prefix.push({ role: 'user', content: summaryBlock });
  prefix.push({ role: 'assistant', content: '已了解上述背景与早期对话要点，继续基于最近几轮深入辅导。' });

  return {
    history: [...prefix, ...recent],
    compressed: true,
    meta: {
      turnCount,
      compressedTurns: countCoachTurns(older),
      keptTurns: countCoachTurns(recent),
      threshold: config.turnThreshold
    }
  };
}

/**
 * Rule-based compression for chat followup history (q/a pairs).
 */
export function guardFollowupHistory(history, config = getGuardConfig()) {
  const safeHistory = Array.isArray(history) ? history.filter((h) => h?.q && h?.a) : [];
  const turnCount = safeHistory.length;
  if (turnCount <= config.turnThreshold) {
    return { history: safeHistory, compressed: false, meta: { turnCount, keptTurns: turnCount } };
  }

  const older = safeHistory.slice(0, -config.keepRecentTurns);
  const recent = safeHistory.slice(-config.keepRecentTurns);
  const summary = summarizeFollowupTurns(older);

  const prefix = [
    { q: '[历史追问摘要]', a: `早期 ${older.length} 轮已压缩：\n${summary}` }
  ];

  return {
    history: [...prefix, ...recent],
    compressed: true,
    meta: {
      turnCount,
      compressedTurns: older.length,
      keptTurns: recent.length,
      threshold: config.turnThreshold
    }
  };
}

/**
 * Optional LLM summarization for coach older turns.
 * Falls back to rule-based if summarizeFn fails or is absent.
 */
export async function guardCoachHistoryAsync(history, intake, config, summarizeFn) {
  if (!config.enableLlmSummary || typeof summarizeFn !== 'function') {
    return guardCoachHistory(history, intake, config);
  }
  const base = guardCoachHistory(history, intake, { ...config, turnThreshold: config.turnThreshold - 1 });
  if (!base.compressed) return base;

  const safeHistory = Array.isArray(history)
    ? history.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    : [];
  const keepMessages = config.keepRecentTurns * 2;
  const older = safeHistory.slice(0, -keepMessages);
  const recent = safeHistory.slice(-keepMessages);

  try {
    const llmSummary = await summarizeFn(older);
    const pinned = extractPinnedContext(intake);
    const summaryBlock = [pinned ? `【用户档案】\n${pinned}` : '', `【LLM 历史摘要】\n${llmSummary}`]
      .filter(Boolean)
      .join('\n\n');
    return {
      history: [
        { role: 'user', content: summaryBlock },
        { role: 'assistant', content: '已了解上述背景，继续辅导。' },
        ...recent
      ],
      compressed: true,
      meta: { ...base.meta, summaryMethod: 'llm' }
    };
  } catch {
    return base;
  }
}
