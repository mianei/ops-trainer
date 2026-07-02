/**
 * Observation Trace — per-turn context snapshot, badcase auto-tag, token usage.
 * Works in Edge (Upstash) and Node (JSONL under eval/traces/).
 */

import { upstashCall, historyEnabled } from './store.js';

export const DEFAULT_BADCASE_RULES = {
  dimensionDeltaThreshold: 2,
  overallDeltaThreshold: 1.5
};

export function newTraceId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `tr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** @param {object} apiResponse LLM API JSON body */
export function extractTokenUsage(apiResponse) {
  const usage = apiResponse?.usage;
  if (!usage) return null;
  const prompt = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const completion = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const total = usage.total_tokens ?? prompt + completion;
  return { prompt, completion, total };
}

/**
 * Detect badcase from golden vs AI scores or parse/timeout errors.
 * @returns {null | { tagged: true, reasons: string[], details: object[], maxDimensionDelta?: number }}
 */
export function detectBadcase({
  humanScores,
  aiScores,
  dimensions,
  parseOk,
  error,
  rules = DEFAULT_BADCASE_RULES
}) {
  const reasons = [];
  const details = [];
  let maxDimensionDelta = 0;

  if (parseOk === false) {
    reasons.push('parse_failure');
    details.push({ type: 'parse_failure', message: error || 'structured review parse failed' });
  }
  if (error && /timeout|timed out|ETIMEDOUT/i.test(String(error))) {
    reasons.push('timeout');
    details.push({ type: 'timeout', message: String(error) });
  }

  const dims = dimensions || (humanScores ? Object.keys(humanScores) : []);
  if (humanScores && aiScores && dims.length) {
    const dimDiffs = [];
    for (const d of dims) {
      const h = humanScores[d];
      const a = aiScores[d] ?? 3;
      if (h == null) continue;
      const delta = Math.abs(h - a);
      maxDimensionDelta = Math.max(maxDimensionDelta, delta);
      if (delta >= rules.dimensionDeltaThreshold) {
        dimDiffs.push({ dimension: d, human: h, ai: a, delta });
      }
    }
    if (dimDiffs.length) {
      reasons.push('dimension_mismatch');
      details.push({ type: 'dimension_mismatch', threshold: rules.dimensionDeltaThreshold, items: dimDiffs });
    }

    const hVals = dims.map((d) => humanScores[d]).filter((v) => v != null);
    const aVals = dims.map((d) => aiScores[d] ?? 3);
    if (hVals.length === dims.length) {
      const hAvg = hVals.reduce((s, v) => s + v, 0) / dims.length;
      const aAvg = aVals.reduce((s, v) => s + v, 0) / dims.length;
      const overallDelta = Math.abs(hAvg - aAvg);
      if (overallDelta >= rules.overallDeltaThreshold) {
        reasons.push('overall_score_delta');
        details.push({
          type: 'overall_score_delta',
          humanAvg: Math.round(hAvg * 10) / 10,
          aiAvg: Math.round(aAvg * 10) / 10,
          delta: Math.round(overallDelta * 10) / 10,
          threshold: rules.overallDeltaThreshold
        });
      }
    }
  }

  if (!reasons.length) return null;
  return { tagged: true, reasons, details, maxDimensionDelta };
}

/**
 * Build a single trace turn record.
 */
export function buildTraceTurn({
  traceId,
  runId,
  turn = 1,
  source = 'unknown',
  sampleId,
  userAnswer,
  context = {},
  result = {},
  golden,
  badcase,
  tokens,
  meta = {}
}) {
  return {
    traceId: traceId || newTraceId(),
    runId,
    turn,
    at: new Date().toISOString(),
    source,
    sampleId: sampleId || null,
    userAnswer: userAnswer != null ? String(userAnswer).slice(0, 8000) : null,
    context: sanitizeContext(context),
    result,
    golden: golden || null,
    badcase: badcase || null,
    tokens: tokens || null,
    meta
  };
}

function sanitizeContext(ctx) {
  const out = {};
  for (const [k, v] of Object.entries(ctx || {})) {
    if (v == null) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 6000);
    else if (typeof v === 'object') {
      try {
        out[k] = JSON.parse(JSON.stringify(v));
      } catch {
        out[k] = String(v).slice(0, 2000);
      }
    } else out[k] = v;
  }
  return out;
}

function traceIndexKey(userId) {
  return `ops:trace:idx:${userId}`;
}

function traceRecordKey(userId, traceId) {
  return `ops:trace:${userId}:${traceId}`;
}

function tokenDayKey(dateStr) {
  return `ops:token:day:${dateStr}`;
}

/** Persist trace + token usage to Upstash (best-effort). */
export async function saveTraceToStore(userId, record) {
  if (!historyEnabled() || !userId || !record?.traceId) return false;
  const uid = String(userId);
  const payload = JSON.stringify(record);
  const setOk = await upstashCall(['SET', traceRecordKey(uid, record.traceId), payload]);
  if (setOk !== 'OK') return false;
  await upstashCall(['LPUSH', traceIndexKey(uid), record.traceId]);
  await upstashCall(['LTRIM', traceIndexKey(uid), '0', '199']);
  if (record.tokens?.total) {
    await recordTokenUsageToStore(record.tokens, record.source);
  }
  return true;
}

/** Increment daily token counters in Upstash. */
export async function recordTokenUsageToStore(tokens, source = 'unknown') {
  if (!historyEnabled() || !tokens?.total) return false;
  const date = new Date().toISOString().slice(0, 10);
  const key = tokenDayKey(date);
  await upstashCall(['HINCRBY', key, 'prompt', String(tokens.prompt || 0)]);
  await upstashCall(['HINCRBY', key, 'completion', String(tokens.completion || 0)]);
  await upstashCall(['HINCRBY', key, 'total', String(tokens.total || 0)]);
  await upstashCall(['HINCRBY', key, 'requests', '1']);
  await upstashCall(['HSET', key, 'lastSource', String(source).slice(0, 40)]);
  await upstashCall(['EXPIRE', key, String(86400 * 400)]);
  return true;
}

/** List recent traces for a user from Upstash. */
export async function listTracesFromStore(userId, limit = 30) {
  if (!historyEnabled() || !userId) return [];
  const ids = await upstashCall(['LRANGE', traceIndexKey(userId), '0', String(Math.min(limit, 100) - 1)]);
  if (!Array.isArray(ids) || !ids.length) return [];
  const records = [];
  for (const id of ids) {
    const raw = await upstashCall(['GET', traceRecordKey(userId, id)]);
    if (!raw) continue;
    try {
      records.push(JSON.parse(raw));
    } catch {
      /* skip */
    }
  }
  return records;
}

/** Aggregate token usage from Upstash daily hashes. */
export async function aggregateTokensFromStore({ period = 'day', days = 30 } = {}) {
  if (!historyEnabled()) return { ok: false, historyEnabled: false, buckets: [] };

  const buckets = [];
  const now = new Date();
  const dayCount = period === 'month' ? Math.min(days, 365) : period === 'week' ? Math.min(days, 90) : Math.min(days, 90);

  for (let i = 0; i < dayCount; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const hash = await upstashCall(['HGETALL', tokenDayKey(dateStr)]);
    if (!hash || !Array.isArray(hash) || hash.length < 2) continue;
    const obj = {};
    for (let j = 0; j < hash.length; j += 2) obj[hash[j]] = hash[j + 1];
    if (!obj.total || Number(obj.total) === 0) continue;
    buckets.push({
      date: dateStr,
      prompt: Number(obj.prompt || 0),
      completion: Number(obj.completion || 0),
      total: Number(obj.total || 0),
      requests: Number(obj.requests || 0)
    });
  }

  buckets.sort((a, b) => a.date.localeCompare(b.date));

  if (period === 'week') return { ok: true, period, buckets: rollupByWeek(buckets) };
  if (period === 'month') return { ok: true, period, buckets: rollupByMonth(buckets) };
  return { ok: true, period: 'day', buckets };
}

function rollupByWeek(dayBuckets) {
  const map = new Map();
  for (const b of dayBuckets) {
    const d = new Date(b.date + 'T00:00:00Z');
    const weekStart = new Date(d);
    weekStart.setUTCDate(d.getUTCDate() - d.getUTCDay());
    const key = weekStart.toISOString().slice(0, 10);
    const cur = map.get(key) || { weekStart: key, prompt: 0, completion: 0, total: 0, requests: 0 };
    cur.prompt += b.prompt;
    cur.completion += b.completion;
    cur.total += b.total;
    cur.requests += b.requests;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

function rollupByMonth(dayBuckets) {
  const map = new Map();
  for (const b of dayBuckets) {
    const key = b.date.slice(0, 7);
    const cur = map.get(key) || { month: key, prompt: 0, completion: 0, total: 0, requests: 0 };
    cur.prompt += b.prompt;
    cur.completion += b.completion;
    cur.total += b.total;
    cur.requests += b.requests;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Node-only: append trace line to JSONL file. */
export function appendTraceJsonl(filePath, record, fs) {
  const line = JSON.stringify(record) + '\n';
  fs.appendFileSync(filePath, line, 'utf8');
}

/** Node-only: read all traces from JSONL files in a directory. */
export function readTracesFromDir(dirPath, fs, pathMod) {
  if (!fs.existsSync(dirPath)) return [];
  const files = fs.readdirSync(dirPath).filter((f) => f.endsWith('.jsonl'));
  const records = [];
  for (const f of files.sort()) {
    const content = fs.readFileSync(pathMod.join(dirPath, f), 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        records.push(JSON.parse(trimmed));
      } catch {
        /* skip */
      }
    }
  }
  return records;
}

/** Aggregate tokens from trace records (local JSONL). */
export function aggregateTokensFromTraces(records, period = 'day') {
  const dayBuckets = new Map();
  for (const r of records) {
    if (!r.tokens?.total || !r.at) continue;
    const date = r.at.slice(0, 10);
    const cur = dayBuckets.get(date) || { date, prompt: 0, completion: 0, total: 0, requests: 0 };
    cur.prompt += r.tokens.prompt || 0;
    cur.completion += r.tokens.completion || 0;
    cur.total += r.tokens.total || 0;
    cur.requests += 1;
    dayBuckets.set(date, cur);
  }
  const sorted = [...dayBuckets.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (period === 'week') return rollupByWeek(sorted);
  if (period === 'month') return rollupByMonth(sorted);
  return sorted;
}

/** Summarize badcases from trace records. */
export function summarizeBadcases(records) {
  return records
    .filter((r) => r.badcase?.tagged)
    .map((r) => ({
      traceId: r.traceId,
      runId: r.runId,
      sampleId: r.sampleId,
      turn: r.turn,
      reasons: r.badcase.reasons,
      maxDimensionDelta: r.badcase.maxDimensionDelta
    }));
}
