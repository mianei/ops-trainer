/**
 * Per-user profile (resume/JD) and resume operation history in Upstash.
 */

import { upstashCall, historyEnabled } from './store.js';

const MAX_RESUME_CHARS = 50000;
const MAX_JD_CHARS = 20000;
const MAX_RESUME_HISTORY = 50;

export const RESUME_HISTORY_LABELS = {
  upload: '上传简历',
  score: '简历评分',
  optimize: '简历优化',
  diagnosis: '简历诊断',
  'full-report': '项目方案',
  'interview-prep': '面试准备',
  coach: '简历教练'
};

function profileKey(userId) {
  return `ops:profile:${userId}`;
}

function resumeHistKey(userId) {
  return `ops:resume-hist:${userId}`;
}

function trimText(value, max) {
  const s = String(value || '').trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
}

export async function trackRegisteredUser(userId) {
  if (!historyEnabled() || !userId || userId === 'guest') return false;
  await upstashCall(['SADD', 'ops:users:all', String(userId)]);
  return true;
}

export async function loadUserProfile(userId) {
  if (!historyEnabled() || !userId || userId === 'guest') {
    return { ok: true, historyEnabled: false, profile: null };
  }
  const raw = await upstashCall(['GET', profileKey(userId)]);
  if (!raw) {
    return { ok: true, historyEnabled: true, profile: null };
  }
  try {
    const profile = JSON.parse(raw);
    return { ok: true, historyEnabled: true, profile };
  } catch {
    return { ok: true, historyEnabled: true, profile: null };
  }
}

export async function saveUserProfile(userId, profile, { recordUpload = false } = {}) {
  if (!historyEnabled() || !userId || userId === 'guest') {
    return { ok: false, error: '云端存储未配置', historyEnabled: false };
  }

  const prev = await loadUserProfile(userId);
  const prevResume = prev.profile?.resume || '';

  const payload = {
    resume: trimText(profile?.resume, MAX_RESUME_CHARS),
    jd: trimText(profile?.jd, MAX_JD_CHARS),
    targetRole: trimText(profile?.targetRole, 120),
    resumeFileName: trimText(profile?.resumeFileName, 200),
    jdFileName: trimText(profile?.jdFileName, 200),
    updatedAt: new Date().toISOString()
  };

  const ok = await upstashCall(['SET', profileKey(userId), JSON.stringify(payload)]);
  if (ok !== 'OK') {
    return { ok: false, error: '保存失败', historyEnabled: true };
  }

  await trackRegisteredUser(userId);

  const resumeChanged = payload.resume && payload.resume !== prevResume;
  if (recordUpload && resumeChanged) {
    await appendResumeHistory(userId, {
      type: 'upload',
      label: RESUME_HISTORY_LABELS.upload,
      summary: payload.resumeFileName
        ? `已上传 ${payload.resumeFileName}（${payload.resume.length.toLocaleString()} 字）`
        : `已保存简历（${payload.resume.length.toLocaleString()} 字）`,
      preview: payload.resume.slice(0, 120)
    });
  }

  return { ok: true, historyEnabled: true, profile: payload };
}

export async function listResumeHistory(userId, limit = 30) {
  if (!historyEnabled() || !userId || userId === 'guest') return [];
  const raw = await upstashCall(['GET', resumeHistKey(userId)]);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.slice(0, Math.min(limit, MAX_RESUME_HISTORY)) : [];
  } catch {
    return [];
  }
}

export async function appendResumeHistory(userId, entry) {
  if (!historyEnabled() || !userId || userId === 'guest') return false;

  const list = await listResumeHistory(userId, MAX_RESUME_HISTORY);
  const item = {
    id: entry.id || `rh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: entry.at || new Date().toISOString(),
    type: String(entry.type || 'coach').slice(0, 32),
    label: String(entry.label || RESUME_HISTORY_LABELS[entry.type] || entry.type || '简历操作').slice(0, 40),
    summary: String(entry.summary || '').slice(0, 500),
    preview: String(entry.preview || '').slice(0, 200)
  };

  list.unshift(item);
  const trimmed = list.slice(0, MAX_RESUME_HISTORY);
  const ok = await upstashCall(['SET', resumeHistKey(userId), JSON.stringify(trimmed)]);
  if (ok === 'OK') {
    await trackRegisteredUser(userId);
  }
  return ok === 'OK';
}
