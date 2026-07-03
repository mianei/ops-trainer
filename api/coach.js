export const config = { runtime: 'edge', maxDuration: 60 };

import { json, getHeader, readJsonBody, verifyUserCredentials } from '../lib/store.js';
import { getLlmConfig } from '../lib/scenario-generate.js';
import { VALID_COACH_MODES, detectCoachIntent } from '../lib/coach-modes.js';
import { buildCoachSystemPrompt, buildActionCoachSystemPrompt, buildCoachUserMessage, slimIntakeForAction } from '../lib/coach-prompts.js';
import { resolveCoachAction } from '../lib/coach-actions.js';
import { parseResumeScoreReport, formatResumeScoreReply } from '../lib/resume-score-parse.js';
import { parseResumeOptimizeReport, formatResumeOptimizeReply } from '../lib/resume-optimize-parse.js';
import { parseInterviewPrepReport, formatInterviewPrepReply } from '../lib/interview-prep-parse.js';
import { guardCoachHistory, getGuardConfig } from '../lib/context-guard.js';
import { appendAgentContextToUserMessage } from '../lib/agent-context.js';
import { formatRagContext, ragEnabled, retrieveRagContext } from '../lib/rag.js';
import {
  newTraceId,
  extractTokenUsage,
  buildTraceTurn,
  saveTraceToStore,
  recordTokenUsageToStore
} from '../lib/observation-trace.js';

async function callDeepSeekCoach(cfg, systemPrompt, messages, maxTokens = 4096, temperature = 0.7) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'system', content: systemPrompt }, ...messages]
    })
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data?.error || data);
    return { error: 'DeepSeek API 错误：' + msg, status: res.status };
  }
  const text = data?.choices?.[0]?.message?.content;
  if (!text) return { error: 'DeepSeek 返回为空', status: 502 };
  return { text, tokens: extractTokenUsage(data) };
}

async function callAnthropicCoach(cfg, systemPrompt, messages, maxTokens = 4096) {
  const anthropicMessages = messages.filter(m => m.role !== 'system');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': cfg.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: anthropicMessages.map(m => ({ role: m.role, content: m.content }))
    })
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || JSON.stringify(data?.error || data);
    return { error: 'Anthropic API 错误：' + msg, status: res.status };
  }
  const text = data?.content?.[0]?.text;
  if (!text) return { error: 'Anthropic 返回为空', status: 502 };
  return {
    text,
    tokens: extractTokenUsage(data) || {
      prompt: data?.usage?.input_tokens ?? 0,
      completion: data?.usage?.output_tokens ?? 0,
      total: (data?.usage?.input_tokens ?? 0) + (data?.usage?.output_tokens ?? 0)
    }
  };
}

async function streamCoachDeepSeek(cfg, systemPrompt, chatMessages, maxTokens, temperature, onDone) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: maxTokens,
      temperature,
      stream: true,
      messages: [{ role: 'system', content: systemPrompt }, ...chatMessages]
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
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache'
    }
  });
}

async function persistCoachTrace(auth, payload) {
  const record = buildTraceTurn(payload);
  await saveTraceToStore(auth.userId, record);
  if (payload.tokens?.total) {
    await recordTokenUsageToStore(payload.tokens, payload.source || 'coach');
  }
  return record.traceId;
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const body = await readJsonBody(req);
    const code = body?.accessCode || getHeader(req, 'x-access-code');
    const userId = body?.userId || getHeader(req, 'x-user-id');
    const auth = await verifyUserCredentials(userId, code);
    if (!auth.ok) {
      return json({ error: auth.error || '未授权' }, auth.status || 401);
    }

    const intake = body?.intake && typeof body.intake === 'object' ? body.intake : {};
    const history = Array.isArray(body?.history) ? body.history : [];
    const contextModule = String(body?.contextModule || '').trim();
    const action = String(body?.action || '').trim();

    let mode = String(body?.mode || '').trim();
    let message = String(body?.message || '').trim();

    const resolved = action ? resolveCoachAction(action, intake) : null;
    if (resolved) {
      message = resolved.message;
      mode = resolved.mode;
    }

    if (!message) {
      return json({ error: '消息不能为空' }, 400);
    }

    if (!mode || !VALID_COACH_MODES.includes(mode)) {
      mode = detectCoachIntent(message)
        || (contextModule === 'resume' ? 'resume-diagnosis' : contextModule === 'interview' ? 'interview-defense' : 'ai-pm-qa');
    }

    const cfg = getLlmConfig();
    if (!cfg || cfg.error) {
      return json({
        error: cfg?.error || '请在项目根目录 .env.local 配置 DEEPSEEK_API_KEY 或 ANTHROPIC_API_KEY，然后重启 npx vercel dev'
      }, 503);
    }

    const compact = Boolean(action);
    const actionLimits = {
      'resume-score': { maxTokens: 1100, temperature: 0.25 },
      'resume-optimize': { maxTokens: 1000, temperature: 0.3 },
      'interview-prep': { maxTokens: 1600, temperature: 0.5 }
    };
    const limits = action ? (actionLimits[action] || { maxTokens: 1200, temperature: 0.5 }) : null;
    const maxTokens = limits?.maxTokens ?? (compact ? 2048 : 4096);
    const temperature = limits?.temperature ?? 0.7;
    const actionIntake = action ? slimIntakeForAction(intake, action) : intake;
    const systemPrompt = action
      ? buildActionCoachSystemPrompt(action)
      : buildCoachSystemPrompt(mode, { compact });
    const canvasContext = String(body?.canvasContext || '').trim();
    const crossMemory = String(body?.crossMemory || '').trim();
    let userContent = buildCoachUserMessage(mode, actionIntake, message);
    userContent = appendAgentContextToUserMessage(userContent, canvasContext, crossMemory);
    let ragChunks = Array.isArray(body?.ragChunks) ? body.ragChunks : [];
    if (ragEnabled()) {
      try {
        const origin = new URL(req.url).origin;
        const ragQuery = {
          scenario: [
            message,
            intake.targetRole,
            intake.targetCompany,
            String(intake.jd || '').slice(0, 400),
            String(intake.resume || '').slice(0, 600),
            contextModule === 'resume' ? 'AI产品经理 简历' : contextModule === 'interview' ? 'AI产品经理 面试' : 'AI产品经理'
          ].filter(Boolean).join('\n'),
          topicId: 'iv-pm',
          question: message
        };
        const rag = await retrieveRagContext(origin, ragQuery, { sessionChunks: ragChunks });
        if (rag.chunks?.length) ragChunks = rag.chunks;
      } catch (e) {
        console.warn('[coach] rag retrieve failed', e?.message);
      }
    }
    if (ragChunks.length) {
      const ragBlock = formatRagContext(ragChunks);
      if (ragBlock) userContent = ragBlock + '\n\n' + userContent;
    }
    const guardResult = action
      ? { history: [], compressed: false, meta: { turnCount: 0 } }
      : guardCoachHistory(history, intake, getGuardConfig());
    const chatMessages = [
      ...(action ? [] : guardResult.history
        .slice(-20)
        .filter(m => m && (m.role === 'user' || m.role === 'assistant') && m.content)
        .map(m => ({ role: m.role, content: String(m.content) }))),
      { role: 'user', content: userContent }
    ];

    const wantStream = body?.stream === true && !action && cfg.provider === 'deepseek'
      && (process.env.STREAM_ENABLED || '1').trim() !== '0';

    if (wantStream) {
      const streamed = await streamCoachDeepSeek(cfg, systemPrompt, chatMessages, maxTokens, temperature, async (fullText) => {
        const traceId = await persistCoachTrace(auth, {
          traceId: newTraceId(),
          runId: `coach-${mode}-${new Date().toISOString().slice(0, 10)}`,
          turn: (history?.length || 0) + 1,
          source: 'coach-stream',
          userAnswer: message,
          context: { mode, contextModule, contextGuard: guardResult.meta, streamed: true },
          result: { parseOk: true, textPreview: fullText?.slice(0, 400) || null },
          tokens: null
        });
        return { reply: fullText, mode, traceId };
      });
      if (streamed instanceof Response) return streamed;
      if (streamed?.error) return json({ error: streamed.error }, streamed.status || 502);
    }

    const result =
      cfg.provider === 'anthropic'
        ? await callAnthropicCoach(cfg, systemPrompt, chatMessages, maxTokens)
        : await callDeepSeekCoach(cfg, systemPrompt, chatMessages, maxTokens, temperature);

    if (result.error) {
      return json({ error: result.error }, result.status >= 400 && result.status < 600 ? result.status : 502);
    }

    const traceId = await persistCoachTrace(auth, {
      traceId: newTraceId(),
      runId: `coach-${mode}-${new Date().toISOString().slice(0, 10)}`,
      turn: (history?.length || 0) + 1,
      source: action ? `coach-action-${action}` : 'coach',
      userAnswer: message,
      context: {
        mode,
        action: action || null,
        contextModule,
        contextGuard: guardResult.meta,
        intakePinned: Boolean(intake?.targetRole || intake?.resume)
      },
      result: {
        parseOk: true,
        textPreview: result.text?.slice(0, 400) || null
      },
      tokens: result.tokens || null
    });

    if (action === 'resume-score') {
      const scoreReport = parseResumeScoreReport(result.text);
      return json({
        ok: true,
        reply: scoreReport ? formatResumeScoreReply(scoreReport) : result.text,
        scoreReport: scoreReport || undefined,
        mode,
        action,
        traceId,
        contextGuard: guardResult.compressed ? guardResult.meta : undefined
      });
    }

    if (action === 'resume-optimize') {
      const optimizeReport = parseResumeOptimizeReport(result.text);
      return json({
        ok: true,
        reply: optimizeReport ? formatResumeOptimizeReply(optimizeReport) : result.text,
        optimizeReport: optimizeReport || undefined,
        mode,
        action,
        traceId
      });
    }

    if (action === 'interview-prep') {
      const prepReport = parseInterviewPrepReport(result.text);
      return json({
        ok: true,
        reply: prepReport ? formatInterviewPrepReply(prepReport) : result.text,
        prepReport: prepReport || undefined,
        mode,
        action,
        traceId
      });
    }

    return json({
      ok: true,
      reply: result.text,
      mode,
      action: action || undefined,
      traceId,
      contextGuard: guardResult.compressed ? guardResult.meta : undefined
    });
  } catch (e) {
    console.error('[coach]', e);
    return json({ error: e?.message || '服务内部错误，请稍后重试' }, 500);
  }
}
