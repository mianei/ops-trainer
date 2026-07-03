export const config = { runtime: 'edge', maxDuration: 15 };

import { json, getHeader, readJsonBody, verifyUserCredentials } from '../lib/store.js';
import { getLlmConfig } from '../lib/scenario-generate.js';
import { resolveAgentIntent, AGENT_INTENT_LABELS } from '../lib/agent-intent.js';

const INTENT_SYSTEM = `你是 CVassistant 全局 Agent 的意图分类器。根据用户一句话，返回 JSON：
{
  "intent": "score_resume|optimize_resume|prep_interview|next_scenario|switch_tab|export_doc|navigate_scene|coach_mode|coach_followup|goal_plan|submit_scenario",
  "targetScene": "resume|prep|scenario|kb 或 null",
  "tab": "评分|优化|文档|题目|点评|解析|准备报告|追问清单 或 null",
  "coachMode": "full-report|project-direction|project-iteration|resume-diagnosis|ai-pm-qa|interview-defense 或 null",
  "confidence": "high|low"
}
只返回 JSON，不要解释。`;

async function classifyWithLlm(cfg, msg, scene) {
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 200,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: INTENT_SYSTEM },
        { role: 'user', content: `当前场景: ${scene}\n用户: ${msg}` }
      ]
    })
  });
  const data = await res.json();
  if (!res.ok) return null;
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const intent = parsed.intent || 'coach_followup';
    return {
      intent,
      tool: intent === 'coach_mode' ? 'coach_mode' : (AGENT_INTENT_LABELS[intent] ? intent.replace(/_/g, '_') : 'coach_reply'),
      targetScene: parsed.targetScene || undefined,
      tab: parsed.tab || undefined,
      coachMode: parsed.coachMode || undefined,
      confidence: parsed.confidence === 'high' ? 'high' : 'low',
      source: 'llm'
    };
  } catch {
    return null;
  }
}

export default async function handler(req) {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const auth = await verifyUserCredentials(getHeader(req, 'x-access-code'), getHeader(req, 'x-user-id'));
  if (!auth.ok) return json({ error: auth.error }, 401);

  const body = await readJsonBody(req);
  const msg = String(body.message || body.text || '').trim();
  const scene = String(body.scene || 'resume');
  const useLlm = body.useLlm !== false;

  const regexResult = resolveAgentIntent(msg, { scene });
  if (regexResult.confidence === 'high' || !useLlm) {
    return json({ ...regexResult, labels: AGENT_INTENT_LABELS });
  }

  const cfg = getLlmConfig();
  if (cfg?.apiKey) {
    const llmResult = await classifyWithLlm(cfg, msg, scene);
    if (llmResult?.intent) {
      const toolMap = {
        score_resume: 'score_resume',
        optimize_resume: 'optimize_resume',
        prep_interview: 'prepare_interview',
        next_scenario: 'pick_scenario',
        switch_tab: 'switch_canvas_tab',
        export_doc: 'export_markdown',
        navigate_scene: 'navigate_scene',
        coach_mode: 'coach_mode',
        coach_followup: 'coach_reply',
        goal_plan: 'goal_plan',
        submit_scenario: 'submit_scenario_answer'
      };
      return json({ ...llmResult, tool: toolMap[llmResult.intent] || 'coach_reply', labels: AGENT_INTENT_LABELS });
    }
  }

  return json({ ...regexResult, labels: AGENT_INTENT_LABELS });
}
