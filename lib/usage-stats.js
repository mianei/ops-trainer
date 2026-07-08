/**
 * Feature usage counters for admin dashboard + per-user activity (Upstash).
 */

import { upstashCall, historyEnabled } from './store.js';

export const FEATURE_LABELS = {
  'chat-review': '场景点评',
  'chat-followup': '追问对话',
  analyze: '框架解析',
  transcribe: '语音转写',
  plan: '训练计划',
  coach: '项目教练',
  'coach-action-resume-score': '简历评分',
  'coach-action-resume-optimize': '简历优化',
  'coach-action-interview-prep': '面试准备',
  'coach-action-resume-diagnosis': '简历诊断',
  'coach-action-interview-defense': '面试防御',
  'coach-action-ai-pm-qa': 'AI PM 问答',
  'coach-stream': '教练流式'
};

function usageDayKey(dateStr) {
  return `ops:usage:day:${dateStr}`;
}

function dauKey(dateStr) {
  return `ops:dau:${dateStr}`;
}

function userUsageKey(userId) {
  return `ops:user:${userId}:usage`;
}

export function normalizeFeature(source) {
  const s = String(source || 'unknown').slice(0, 64);
  if (s.startsWith('coach-action-')) return s;
  if (s === 'coach-stream') return s;
  if (s.startsWith('coach')) return 'coach';
  return s;
}

/** Increment daily feature counter + DAU + per-user usage (best-effort). */
export async function recordUsageEvent(userId, feature) {
  if (!historyEnabled() || !userId) return false;
  const uid = String(userId);
  const feat = normalizeFeature(feature);
  const date = new Date().toISOString().slice(0, 10);

  await upstashCall(['HINCRBY', usageDayKey(date), feat, '1']);
  await upstashCall(['EXPIRE', usageDayKey(date), String(86400 * 400)]);
  await upstashCall(['SADD', dauKey(date), uid]);
  await upstashCall(['EXPIRE', dauKey(date), String(86400 * 400)]);
  await upstashCall(['SADD', 'ops:users:all', uid]);
  await upstashCall(['HINCRBY', userUsageKey(uid), feat, '1']);

  return true;
}

/** Admin: aggregate feature usage over recent days. */
export async function aggregateUsageStats({ days = 30 } = {}) {
  if (!historyEnabled()) {
    return { historyEnabled: false, features: [], dailyActive: [], totalUsers: 0 };
  }

  const dayCount = Math.min(Math.max(Number(days) || 30, 1), 90);
  const featureTotals = {};
  const dailyActive = [];
  const now = new Date();

  for (let i = 0; i < dayCount; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const hash = await upstashCall(['HGETALL', usageDayKey(dateStr)]);
    if (hash && Array.isArray(hash)) {
      for (let j = 0; j < hash.length; j += 2) {
        const f = hash[j];
        const c = Number(hash[j + 1]) || 0;
        featureTotals[f] = (featureTotals[f] || 0) + c;
      }
    }

    const dauCount = await upstashCall(['SCARD', dauKey(dateStr)]);
    if (dauCount && Number(dauCount) > 0) {
      dailyActive.push({ date: dateStr, users: Number(dauCount) });
    }
  }

  dailyActive.sort((a, b) => a.date.localeCompare(b.date));
  const totalUsers = Number(await upstashCall(['SCARD', 'ops:users:all']) || 0);

  const features = Object.entries(featureTotals)
    .map(([feature, count]) => ({
      feature,
      label: FEATURE_LABELS[feature] || feature,
      count
    }))
    .sort((a, b) => b.count - a.count);

  return { historyEnabled: true, features, dailyActive, totalUsers };
}

/** Per-user feature usage counts (for「我的记录」). */
export async function getUserUsageSummary(userId) {
  if (!historyEnabled() || !userId) return { historyEnabled: false, usage: [] };
  const hash = await upstashCall(['HGETALL', userUsageKey(userId)]);
  const usage = [];
  if (hash && Array.isArray(hash)) {
    for (let j = 0; j < hash.length; j += 2) {
      const feature = hash[j];
      usage.push({
        feature,
        label: FEATURE_LABELS[feature] || feature,
        count: Number(hash[j + 1]) || 0
      });
    }
  }
  usage.sort((a, b) => b.count - a.count);
  return { historyEnabled: true, usage };
}

export function verifyAdminSecret(secret) {
  const expected = (process.env.ADMIN_SECRET || '').trim();
  if (!expected) {
    return { ok: false, error: 'ADMIN_SECRET 未配置', status: 503 };
  }
  if (String(secret || '').trim() !== expected) {
    return { ok: false, error: '管理密钥无效', status: 401 };
  }
  return { ok: true };
}
