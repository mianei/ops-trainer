export const config = { runtime: 'edge' };

import {
  json,
  getHeader,
  readJsonBody,
  verifyUserCredentials,
  historyEnabled,
  loadTopicAttempts,
  priorRecentAttempts,
  saveAttempt,
  HISTORY_PROMPT_SUFFIX,
  formatPriorForPrompt,
  upstashCall
} from './lib/store.js';
import { ragEnabled, retrieveRagContext } from './lib/rag.js';
import {
  structuredReviewEnabled,
  STRUCTURED_REVIEW_SUFFIX,
  parseStructuredReview,
  reviewToPlainText
} from './lib/review-format.js';
import { resolveSystemPrompt } from './lib/prompt-route.js';

function getClientIp(req) {
  const xff = getHeader(req, 'x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return getHeader(req, 'x-real-ip') || 'unknown';
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function checkAndIncrLimit(ip) {
  const perIp = Number(process.env.DAILY_LIMIT_PER_IP || 30);
  const totalCap = Number(process.env.DAILY_TOTAL_LIMIT || 500);

  if (!process.env.UPSTASH_REDIS_REST_URL) {
    return { ok: true, skipped: true };
  }

  const date = todayKey();
  const ipKey = `ops:ip:${date}:${ip}`;
  const totalKey = `ops:total:${date}`;

  const ipCount = await upstashCall(['INCR', ipKey]);
  if (ipCount === 1) await upstashCall(['EXPIRE', ipKey, '172800']);
  if (ipCount > perIp) {
    return { ok: false, reason: 'ip', count: ipCount, limit: perIp };
  }

  const totalCount = await upstashCall(['INCR', totalKey]);
  if (totalCount === 1) await upstashCall(['EXPIRE', totalKey, '172800']);
  if (totalCount > totalCap) {
    return { ok: false, reason: 'total', count: totalCount, limit: totalCap };
  }

  return { ok: true, ipCount, totalCount };
}

function getLlmConfig() {
  const provider = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();
  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();

  if (provider === 'anthropic' || (!provider && anthropicKey && !deepseekKey)) {
    if (!anthropicKey) return { error: '请在 Vercel 配置 ANTHROPIC_API_KEY' };
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

  return { error: '请在 Vercel 配置 DEEPSEEK_API_KEY（推荐）或 ANTHROPIC_API_KEY' };
}

const FOLLOWUP_SYSTEM_SUFFIX =
  '\n\n你已完成对学员首轮作答的结构化点评。学员会继续追问，请紧扣本题场景与其原答案，回答简洁可执行（约 300 字内），可补 1 个追问引导其深化思考。';

function buildChatMessages(systemPrompt, userContent, multiTurn) {
  const sys = systemPrompt + (multiTurn ? FOLLOWUP_SYSTEM_SUFFIX : '');
  if (!multiTurn) {
    return [
      { role: 'system', content: sys },
      { role: 'user', content: userContent }
    ];
  }
  const messages = [{ role: 'system', content: sys }];
  for (const turn of multiTurn) {
    messages.push({ role: turn.role, content: turn.content });
  }
  return messages;
}

async function callDeepSeek(cfg, systemPrompt, userContent, multiTurn, jsonMode) {
  const body = {
    model: cfg.model,
    max_tokens: 1600,
    messages: buildChatMessages(systemPrompt, userContent, multiTurn)
  };
  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || data?.message || JSON.stringify(data?.error || data);
    return { error: 'DeepSeek API 错误：' + msg, status: res.status };
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return { error: 'DeepSeek 返回为空', status: 502 };
  return { text };
}

function streamEnabled(body, mode) {
  return body.stream === true && mode === 'review' && (process.env.STREAM_ENABLED || '1').trim() !== '0';
}

async function streamDeepSeek(cfg, systemPrompt, userContent, onDone) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1600,
      stream: true,
      messages: buildChatMessages(systemPrompt, userContent, null)
    })
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const msg = data?.error?.message || 'DeepSeek 流式错误';
    return { error: msg, status: res.status };
  }
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      let buffer = '';
      let fullText = '';
      try {
        const reader = res.body.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const json = JSON.parse(payload);
              const delta = json.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                controller.enqueue(encoder.encode(JSON.stringify({ type: 'delta', text: delta }) + '\n'));
              }
            } catch {
              /* skip */
            }
          }
        }
        const meta = await onDone(fullText);
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'done', ...meta }) + '\n'));
        controller.close();
      } catch (e) {
        controller.enqueue(encoder.encode(JSON.stringify({ type: 'error', error: e.message }) + '\n'));
        controller.close();
      }
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache'
    }
  });
}

function buildTopicMapFromBody(body) {
  const map = new Map();
  const list = body.topicPrompts;
  if (Array.isArray(list)) {
    for (const t of list) {
      if (t?.id && t?.systemPrompt) map.set(t.id, { systemPrompt: t.systemPrompt });
    }
  }
  return map;
}

function finalizeReviewText(rawText, useStructured) {
  if (!useStructured) return { text: rawText, structured: null, rubricAvg: null, dimensions: null };
  const parsed = parseStructuredReview(rawText);
  if (!parsed.ok) return { text: rawText, structured: null, rubricAvg: null, dimensions: null };
  const dims = parsed.review.dimensions || [];
  const rubricAvg = dims.length
    ? Math.round((dims.reduce((s, d) => s + d.score, 0) / dims.length) * 10) / 10
    : null;
  return {
    text: reviewToPlainText(parsed.review),
    structured: parsed.review,
    rubricAvg,
    dimensions: dims
  };
}

async function callAnthropic(cfg, systemPrompt, userContent, multiTurn) {
  const sys = systemPrompt + (multiTurn ? FOLLOWUP_SYSTEM_SUFFIX : '');
  const messages = multiTurn
    ? multiTurn.filter((m) => m.role === 'user' || m.role === 'assistant')
    : [{ role: 'user', content: userContent }];

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
      system: sys,
      messages
    })
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data?.error?.message || 'Anthropic API 错误', status: res.status };
  }
  const text = data?.content?.[0]?.text;
  if (!text) return { error: 'Anthropic 返回为空', status: 502 };
  return { text };
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const body = (await readJsonBody(req)) || {};
  const userId = getHeader(req, 'x-user-id') || body.userId || '';
  const code = getHeader(req, 'x-access-code') || body.accessCode || '';

  const auth = await verifyUserCredentials(userId, code);
  if (!auth.ok) {
    return json({ error: auth.error }, auth.status);
  }

  if (body?.action === 'verify') {
    return json({ ok: true, userId: auth.userId });
  }

  const llm = getLlmConfig();
  if (llm.error) {
    return json({ error: llm.error }, 500);
  }

  const mode = body?.mode === 'followup' ? 'followup' : 'review';
  const { systemPrompt, scenario, answer } = body || {};
  const topicId = body.topicId || body.topic || '';

  if (!systemPrompt || !scenario) {
    return json({ error: '参数缺失' }, 400);
  }

  let userContent = '';
  let multiTurn = null;
  let reviewSystemPrompt = systemPrompt;
  let attemptNumber = 1;
  let comparedWith = 0;

  if (mode === 'followup') {
    const { priorFeedback, question, history } = body;
    if (!answer || !priorFeedback || !question) {
      return json({ error: '追问参数缺失' }, 400);
    }
    if (typeof question !== 'string' || question.length > 800) {
      return json({ error: '追问过长或格式错误' }, 400);
    }
    if (!Array.isArray(history) || history.length > 12) {
      return json({ error: '对话历史异常' }, 400);
    }
    for (const h of history) {
      if (!h?.q || !h?.a || String(h.q).length > 800 || String(h.a).length > 4000) {
        return json({ error: '对话历史格式错误' }, 400);
      }
    }
    if (typeof answer !== 'string' || answer.length > 4000) {
      return json({ error: '答案过长或格式错误' }, 400);
    }

    multiTurn = [
      { role: 'user', content: `业务场景：${scenario}\n\n学员初答：${answer}` },
      { role: 'assistant', content: priorFeedback }
    ];
    for (const h of history) {
      multiTurn.push({ role: 'user', content: h.q });
      multiTurn.push({ role: 'assistant', content: h.a });
    }
    multiTurn.push({ role: 'user', content: question });
    userContent = question;
  } else {
    if (!answer) {
      return json({ error: '参数缺失' }, 400);
    }
    if (typeof answer !== 'string' || answer.length > 4000) {
      return json({ error: '答案过长或格式错误' }, 400);
    }

    if (historyEnabled() && topicId) {
      const all = await loadTopicAttempts(auth.userId, topicId);
      const prior = priorRecentAttempts(all, 3);
      comparedWith = prior.length;
      attemptNumber = all.length + 1;
      if (prior.length) {
        reviewSystemPrompt = systemPrompt + HISTORY_PROMPT_SUFFIX;
        userContent = `业务场景：${scenario}\n\n我的分析：${answer}${formatPriorForPrompt(prior)}`;
      } else {
        userContent = `业务场景：${scenario}\n\n我的分析：${answer}`;
      }
    } else {
      userContent = `业务场景：${scenario}\n\n我的分析：${answer}`;
    }
  }

  const ip = getClientIp(req);
  const limit = await checkAndIncrLimit(ip);
  if (!limit.ok) {
    if (limit.reason === 'ip') {
      return json({ error: `今日已达个人使用上限（${limit.limit} 次/天），明天再来吧。` }, 429);
    }
    return json({ error: '今日全站使用量已达上限，请明天再来。' }, 429);
  }

  let ragRefs = [];
  let interviewRagCount = 0;
  if (ragEnabled()) {
    const origin = new URL(req.url).origin;
    const ragQuery =
      mode === 'followup'
        ? { scenario, answer, topicId, question: body.question || '' }
        : { scenario, answer, topicId };
    const rag = await retrieveRagContext(origin, ragQuery, {
      sessionChunks: body.ragChunks
    });
    if (rag.context) {
      reviewSystemPrompt += rag.context;
      ragRefs = rag.chunks.map((c) =>
        c.sourceLabel ? `${c.title}（${c.sourceLabel}）` : c.title
      );
      interviewRagCount = rag.interviewRagCount || 0;
    }
  }

  const topicMap = buildTopicMapFromBody(body);
  if (mode === 'review' && topicMap.size > 0) {
    reviewSystemPrompt = resolveSystemPrompt(scenario, reviewSystemPrompt, topicMap);
  }

  const useStructured = mode === 'review' && structuredReviewEnabled();
  if (useStructured) {
    reviewSystemPrompt += STRUCTURED_REVIEW_SUFFIX;
  }

  const wantStream = streamEnabled(body, mode) && llm.provider === 'deepseek';

  if (wantStream) {
    const streamed = await streamDeepSeek(llm, reviewSystemPrompt, userContent, async (fullText) => {
      const fin = finalizeReviewText(fullText, useStructured);
      if (historyEnabled() && topicId) {
        await saveAttempt(auth.userId, topicId, {
          scenario,
          answer,
          feedback: fin.text,
          rubricAvg: fin.rubricAvg,
          dimensions: fin.dimensions
        });
      }
      return {
        text: fin.text,
        structured: fin.structured,
        rubricAvg: fin.rubricAvg,
        attemptNumber,
        comparedWith,
        historyEnabled: historyEnabled(),
        ragEnabled: ragEnabled(),
        ragRefs,
        interviewRagCount
      };
    });
    if (streamed instanceof Response) return streamed;
    if (streamed?.error) return json({ error: streamed.error }, streamed.status || 502);
  }

  try {
    const jsonMode = useStructured && llm.provider === 'deepseek';
    const result =
      llm.provider === 'deepseek'
        ? await callDeepSeek(llm, reviewSystemPrompt, userContent, multiTurn, jsonMode)
        : await callAnthropic(llm, reviewSystemPrompt, userContent, multiTurn);

    if (result.error) {
      return json({ error: result.error }, result.status || 502);
    }

    const fin =
      mode === 'review' ? finalizeReviewText(result.text, useStructured) : { text: result.text, structured: null, rubricAvg: null, dimensions: null };

    if (mode === 'review' && historyEnabled() && topicId) {
      await saveAttempt(auth.userId, topicId, {
        scenario,
        answer,
        feedback: fin.text,
        rubricAvg: fin.rubricAvg,
        dimensions: fin.dimensions
      });
    }

    return json({
      text: fin.text,
      structured: fin.structured,
      rubricAvg: fin.rubricAvg,
      attemptNumber,
      comparedWith,
      historyEnabled: historyEnabled(),
      ragEnabled: ragEnabled(),
      ragRefs,
      interviewRagCount
    });
  } catch (e) {
    return json({ error: '上游调用失败：' + e.message }, 502);
  }
}
