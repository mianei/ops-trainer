/**
 * 一次性补丁：Agent 12 项增强 (#2–#12)
 * 运行: node scripts/patch-agent-12.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

let h = fs.readFileSync(INDEX, 'utf8');
const hadCrlf = h.includes('\r\n');
if (hadCrlf) h = h.replace(/\r\n/g, '\n');
const orig = h;

function mustReplace(from, to, label) {
  if (!h.includes(from)) {
    console.error('MISSING anchor:', label);
    process.exit(1);
  }
  h = h.replace(from, to);
}

function mustInsert(anchor, insert, label) {
  if (!h.includes(anchor)) {
    console.error('MISSING insert anchor:', label, 'anchor=', JSON.stringify(anchor.slice(0, 60)));
    process.exit(1);
  }
  if (h.includes(insert.slice(0, 40))) {
    console.log('SKIP (already patched):', label);
    return;
  }
  h = h.replace(anchor, insert + anchor);
}

// --- CSS ---
mustInsert(
  '  .agent-chat-compose {',
  `  .agent-chat-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
  .agent-chip { font-size: 12px; padding: 4px 10px; border-radius: 99px; border: 1px solid var(--frost-border); background: var(--block-bg); cursor: pointer; }
  .agent-chip:hover { border-color: var(--accent); color: var(--accent); }
  .agent-compose-row { display: flex; gap: 6px; align-items: center; width: 100%; }
  .agent-compose-row .agent-chat-input { flex: 1; }
  .agent-compose-icon { width: 34px; height: 34px; border-radius: 8px; border: 1px solid var(--frost-border); background: var(--block-bg); cursor: pointer; font-size: 14px; }
  .agent-compose-icon.recording { background: #fee2e2; border-color: #f87171; }
  .agent-tool-io { margin: 4px 0 0 24px; font-size: 11px; color: var(--ink3); }
  .agent-tool-io summary { cursor: pointer; color: var(--ink2); }
  .agent-retry-btn { margin-top: 6px; font-size: 12px; }
  .agent-undo-btn { margin-left: 8px; font-size: 12px; }
`,
  'css-chips'
);

// --- state vars ---
mustInsert(
  'let agentToolSteps = [];',
  `const CROSS_SCENE_MEM_KEY = 'cvAgentCrossMemory_v1';
const AGENT_UNDO_STACK_KEY = 'cvAgentUndo_v1';
/** @type {{ scene: string, payload: object, message: string } | null} */
let agentLastFailedCoach = null;
let agentVoiceRecorder = null;
`,
  'state-vars'
);

// --- helper block before agentToolStepsHtml ---
mustInsert(
  'function agentToolStepsHtml() {',
  `function buildAgentCanvasContext(scene) {
  const tab = getCanvasTab(scene);
  const parts = ['场景: ' + scene, 'Tab: ' + tab];
  if (scene === 'resume') {
    if (profileTargetRole) parts.push('目标岗位: ' + profileTargetRole);
    if (profileResume.trim()) parts.push('简历摘录: ' + profileResume.trim().slice(0, 500));
    if (resumeScoreResult.scoreReport) {
      const sr = resumeScoreResult.scoreReport;
      parts.push('评分综合: ' + (sr.overallScore ?? '—') + '/5');
      if (resumeScoreResult.content) parts.push('评分报告摘要: ' + resumeScoreResult.content.slice(0, 600));
    }
    if (resumeOptimizeResult.optimizeReport || resumeOptimizeResult.content) {
      parts.push('优化摘要: ' + (resumeOptimizeResult.content || '').slice(0, 500));
    }
  }
  if (scene === 'prep') {
    if (interviewPrepResult.prepReport) parts.push('准备报告: ' + (interviewPrepResult.content || '').slice(0, 600));
  }
  if (scene === 'scenario' && activeBankQuestion) {
    parts.push('当前题: ' + (activeBankQuestion.title || activeBankQuestion.scenario || '').slice(0, 300));
    const tid = activeBankQuestion.topicId || activeTopicId;
    const sess = mentorSessions[tid];
    if (sess?.answer) parts.push('我的作答: ' + sess.answer.slice(0, 400));
    if (sess?.feedback) parts.push('点评摘要: ' + String(sess.feedback).slice(0, 400));
  }
  if (scene === 'kb') {
    const flat = typeof knowledgeFlatCardsForPage === 'function' ? knowledgeFlatCardsForPage(knowledgePageId) : [];
    const card = flat[knowledgeFlatIndex];
    if (card) {
      const body = (card.bodyPages || [''])[knowledgeBodyPageIndex] || card.body || '';
      parts.push('当前知识卡: ' + card.title + '\\n' + body.slice(0, 700));
    }
  }
  return parts.join('\\n\\n');
}

function loadCrossSceneMemoryString() {
  try {
    const raw = localStorage.getItem(CROSS_SCENE_MEM_KEY);
    if (!raw) return '';
    const o = JSON.parse(raw);
    const lines = [];
    if (o.resumeScore) lines.push('[简历评分] ' + o.resumeScore);
    if (o.optimize) lines.push('[简历优化] ' + o.optimize);
    if (o.prep) lines.push('[面试准备] ' + o.prep);
    if (o.scenario) lines.push('[场景练习] ' + o.scenario);
    return lines.join('\\n');
  } catch { return ''; }
}

function persistCrossSceneMemory() {
  try {
    const tid = activeBankQuestion?.topicId || activeTopicId;
    const sess = tid ? mentorSessions[tid] : null;
    localStorage.setItem(CROSS_SCENE_MEM_KEY, JSON.stringify({
      resumeScore: (resumeScoreResult.content || '').slice(0, 500),
      optimize: (resumeOptimizeResult.content || '').slice(0, 500),
      prep: (interviewPrepResult.content || '').slice(0, 500),
      scenario: sess?.feedback ? String(sess.feedback).slice(0, 400) : '',
      at: new Date().toISOString()
    }));
  } catch { /* */ }
}

function pushAgentUndoSnapshot(label) {
  try {
    const stack = JSON.parse(localStorage.getItem(AGENT_UNDO_STACK_KEY) || '[]');
    stack.unshift({
      label,
      at: Date.now(),
      resumeOptimize: JSON.parse(JSON.stringify(resumeOptimizeResult)),
      resumeScore: JSON.parse(JSON.stringify(resumeScoreResult))
    });
    localStorage.setItem(AGENT_UNDO_STACK_KEY, JSON.stringify(stack.slice(0, 5)));
  } catch { /* */ }
}

function popAgentUndoSnapshot() {
  try {
    const stack = JSON.parse(localStorage.getItem(AGENT_UNDO_STACK_KEY) || '[]');
    if (!stack.length) return false;
    const snap = stack.shift();
    localStorage.setItem(AGENT_UNDO_STACK_KEY, JSON.stringify(stack));
    if (snap.resumeOptimize) resumeOptimizeResult = snap.resumeOptimize;
    if (snap.resumeScore) resumeScoreResult = snap.resumeScore;
    renderResumeCanvasPanels();
    pushAgentChatAssistant(agentScene, '已撤销「' + (snap.label || '操作') + '」。');
    return true;
  } catch { return false; }
}

function parseMultiStepMessage(msg) {
  if (!/先.*再|然后|接着|之后|第一步|第二步/.test(msg)) return [];
  const steps = [];
  if (/评分|打分/.test(msg)) steps.push('score_resume');
  if (/优化|改写/.test(msg)) steps.push('optimize_resume');
  if (/准备|备战|prep/.test(msg)) steps.push('prep_interview');
  if (/换题|下一题/.test(msg)) steps.push('next_scenario');
  if (/导出/.test(msg)) steps.push('export_doc');
  return [...new Set(steps)];
}

async function executeMultiStepAgentPlan(msg, scene, steps) {
  pushAgentChatUser(scene, msg);
  pushAgentChatAssistant(scene, '收到，将按顺序执行 ' + steps.length + ' 步…');
  for (const step of steps) {
    const fakeIntent = { intent: step, tool: step, tab: '文档' };
    agentToolSteps = [{ name: 'multi_step', status: 'running', detail: step, input: msg, output: '' }];
    renderAgentToolsPanel();
    if (step === 'score_resume') {
      if (!profileResume.trim()) { pushAgentChatAssistant(scene, '跳过评分：尚未上传简历。'); continue; }
      saveProfileFromDom();
      await runResumeAction('resume-score', 'agentChatSend', '评分');
      persistCrossSceneMemory();
      pushAgentChatAssistant(scene, '✓ 评分完成');
    } else if (step === 'optimize_resume') {
      if (!resumeHasScore()) { pushAgentChatAssistant(scene, '跳过优化：请先评分。'); continue; }
      pushAgentUndoSnapshot('优化前');
      saveProfileFromDom();
      await runResumeAction('resume-optimize', 'agentChatSend', '优化');
      persistCrossSceneMemory();
      pushAgentChatAssistant(scene, '✓ 优化完成');
    } else if (step === 'prep_interview') {
      saveProfileFromDom();
      await runInterviewPrepAction();
      persistCrossSceneMemory();
      pushAgentChatAssistant(scene, '✓ 面试准备完成');
    } else if (step === 'next_scenario') {
      startRandomSense();
      pushAgentChatAssistant(scene, '✓ 已换题');
    } else if (step === 'export_doc') {
      if (scene === 'resume') exportResumeMarkdown();
      else if (scene === 'prep') exportPrepMarkdown();
      pushAgentChatAssistant(scene, '✓ 已触发导出');
    }
    agentToolSteps = [{ name: 'multi_step', status: 'done', detail: step, input: msg, output: 'ok' }];
    renderAgentToolsPanel();
  }
  pushAgentChatAssistant(scene, '多步任务全部执行完毕，请查看 Canvas。');
  renderAgentSuggestionChips(scene);
}

function searchKnowledgeRagLocal(query, limit) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  const tokens = q.split(/[\\s,，、]+/).filter(t => t.length >= 2);
  const hits = [];
  for (const sec of KNOWLEDGE || []) {
    for (const card of sec.cards || []) {
      const text = ((card.title || '') + ' ' + (card.body || '') + ' ' + (card.tags || []).join(' ')).toLowerCase();
      const score = tokens.length
        ? tokens.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0)
        : (text.includes(q) ? 1 : 0);
      if (score > 0) hits.push({ score, chunk: { id: card.id, title: card.title, text: (card.body || '').slice(0, 900), section: sec.title || sec.id } });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit || 4).map(h => h.chunk);
}

function isRefineIntent(text) {
  return /追问|改|润色|再.*一版|改短|改长|不满意|补充|优化这段/.test(String(text || ''));
}

function applyRefineToCanvas(scene, reply, userMsg) {
  if (!isRefineIntent(userMsg) || !reply?.trim()) return;
  const tab = getCanvasTab(scene);
  if (scene === 'resume' && tab === '评分' && resumeScoreResult.content) {
    resumeScoreResult.content += '\\n\\n---\\n**Agent 补充**\\n' + reply.trim();
    renderResumeCanvasPanels();
  } else if (scene === 'resume' && tab === '优化' && resumeOptimizeResult.content) {
    resumeOptimizeResult.content += '\\n\\n---\\n**Agent 补充**\\n' + reply.trim();
    renderResumeCanvasPanels();
  } else if (scene === 'prep' && interviewPrepResult.content) {
    interviewPrepResult.content += '\\n\\n---\\n**Agent 补充**\\n' + reply.trim();
    renderPrepCanvasPanels();
  }
}

function renderAgentSuggestionChips(scene) {
  const host = document.getElementById('agentChatChips');
  if (!host) return;
  const chips = [];
  if (scene === 'resume') {
    if (!profileResume.trim()) chips.push({ label: '上传简历后评分', msg: '帮我评分简历' });
    else if (!resumeScoreResult.content) chips.push({ label: '开始评分', msg: '评分' });
    else if (!resumeOptimizeResult.content) chips.push({ label: '去优化 bullet', msg: '优化简历' });
    else chips.push({ label: '导出文档', msg: '导出 markdown' });
    if (resumeOptimizeResult.content) chips.push({ label: '撤销上次优化', action: 'undo' });
  } else if (scene === 'prep') {
    if (!interviewPrepResult.content) chips.push({ label: '一键准备面试', msg: '准备面试' });
    else chips.push({ label: '导出话术', msg: '导出文档' });
  } else if (scene === 'scenario') {
    chips.push({ label: '换一题', msg: '换题' });
    if (activeBankQuestion) chips.push({ label: '看点评', msg: '切到点评' });
  } else if (scene === 'kb') {
    chips.push({ label: '解释当前卡片', msg: '用一句话解释当前知识卡' });
  }
  if (!chips.length) { host.innerHTML = ''; host.hidden = true; return; }
  host.hidden = false;
  host.innerHTML = chips.map((c, i) =>
    '<button type="button" class="agent-chip" data-chip-i="' + i + '">' + escapeHtml(c.label) + '</button>'
  ).join('');
  host.querySelectorAll('[data-chip-i]').forEach(btn => {
    btn.onclick = async () => {
      const c = chips[Number(btn.dataset.chipI)];
      if (c.action === 'undo') { popAgentUndoSnapshot(); return; }
      const input = document.getElementById('agentChatInput');
      if (input) input.value = c.msg;
      document.getElementById('agentChatSend')?.click();
    };
  });
}

async function consumeCoachStream(res, messages, threadId, onDelta) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      let row;
      try { row = JSON.parse(t); } catch { continue; }
      if (row.type === 'delta' && row.text) {
        full += row.text;
        if (onDelta) onDelta(full);
      } else if (row.type === 'error') throw new Error(row.error || '流式错误');
      else if (row.type === 'done' && row.reply) full = row.reply;
    }
  }
  messages.push({ role: 'assistant', content: full });
  renderModuleThread(threadId, messages);
  return full;
}

function bindAgentVoiceAttach(scene) {
  const mic = document.getElementById('agentChatMic');
  const file = document.getElementById('agentChatFile');
  const input = document.getElementById('agentChatInput');
  if (mic) {
    mic.onclick = async () => {
      if (agentVoiceRecorder?.recording) { agentVoiceRecorder.recorder.stop(); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks = [];
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = async () => {
          mic.classList.remove('recording');
          agentVoiceRecorder = { recording: false };
          stream.getTracks().forEach(tr => tr.stop());
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const b64 = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result).split(',')[1]);
            r.onerror = reject;
            r.readAsDataURL(blob);
          });
          mic.textContent = '…';
          try {
            const res = await fetch('/api/chat', {
              method: 'POST', headers: authHeaders(),
              body: JSON.stringify({ accessCode, userId: userAccountId, tool: 'transcribe', audioBase64: b64, mimeType: 'audio/webm' })
            });
            const data = await res.json();
            if (res.ok && data.text && input) input.value = (input.value ? input.value + ' ' : '') + data.text;
            else alert(data.error || '转写失败');
          } catch (e) { alert(e.message); }
          mic.textContent = '🎤';
        };
        recorder.start();
        agentVoiceRecorder = { recording: true, recorder };
        mic.classList.add('recording');
        mic.textContent = '■';
      } catch { alert('无法访问麦克风'); }
    };
  }
  if (file && input) {
    file.onchange = async () => {
      const f = file.files?.[0];
      if (!f) return;
      file.value = '';
      try {
        const text = await f.text();
        const snippet = text.slice(0, 8000);
        input.value = (input.value ? input.value + '\\n' : '') + snippet;
        if (scene === 'resume' && !profileResume.trim()) {
          profileResume = snippet;
          localStorage.setItem('profileResume', profileResume);
          saveProfileFromDom();
          renderResumeCanvasPanels();
        }
      } catch (e) { alert('读取附件失败: ' + e.message); }
    };
  }
}

function appendAgentRetryBubble(scene) {
  if (!agentLastFailedCoach || agentLastFailedCoach.scene !== scene) return;
  const el = document.getElementById('agentChatMsgs');
  if (!el) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-frost agent-retry-btn';
  btn.textContent = '重试上次请求';
  btn.onclick = async () => {
    const fail = agentLastFailedCoach;
    agentLastFailedCoach = null;
    btn.remove();
    await sendModuleCoachMessage(fail.payload);
  };
  el.appendChild(btn);
}

`,
  'helper-block'
);

// --- agentToolStepsHtml expandable ---
mustReplace(
  `function agentToolStepsHtml() {
  if (!agentToolSteps.length) return '';
  return agentToolSteps.map(s =>
    \`<div class="agent-tool-row"><span class="agent-tool-pill\${s.status === 'running' ? ' run' : ''}">\${escapeHtml(s.status)}</span><span>\${escapeHtml(s.name)}</span><span style="color:var(--ink3);font-size:11px">\${escapeHtml(s.detail || '')}</span></div>\`
  ).join('');
}`,
  `function agentToolStepsHtml() {
  if (!agentToolSteps.length) return '';
  return agentToolSteps.map(s => {
    const io = (s.input || s.output) ? '<details class="agent-tool-io"><summary>I/O</summary>' +
      (s.input ? '<pre style="white-space:pre-wrap;margin:4px 0">' + escapeHtml(String(s.input).slice(0, 400)) + '</pre>' : '') +
      (s.output ? '<pre style="white-space:pre-wrap;margin:4px 0">' + escapeHtml(String(s.output).slice(0, 400)) + '</pre>' : '') +
      '</details>' : '';
    return '<div class="agent-tool-row"><span class="agent-tool-pill' + (s.status === 'running' ? ' run' : '') + '">' + escapeHtml(s.status) + '</span><span>' + escapeHtml(s.name) + '</span><span style="color:var(--ink3);font-size:11px">' + escapeHtml(s.detail || '') + '</span></div>' + io;
  }).join('');
}`,
  'tool-steps-html'
);

// --- handleGlobalAgentMessage: multi-step + kb ---
mustReplace(
  `async function handleGlobalAgentMessage(msg, scene) {
  const intent = recognizeAgentIntent(msg, scene);
  agentToolSteps = [{ name: 'recognize_intent', status: 'done', detail: intent.intent }, { name: intent.tool, status: 'running', detail: '' }];
  renderAgentToolsPanel();`,
  `async function handleGlobalAgentMessage(msg, scene) {
  const multi = parseMultiStepMessage(msg);
  if (multi.length > 1) {
    await executeMultiStepAgentPlan(msg, scene, multi);
    return;
  }
  const intent = recognizeAgentIntent(msg, scene);
  agentToolSteps = [{ name: 'recognize_intent', status: 'done', detail: intent.intent, input: msg, output: intent.intent }, { name: intent.tool, status: 'running', detail: '', input: msg }];
  renderAgentToolsPanel();`,
  'handle-global-multi'
);

mustReplace(
  `    pushAgentChatAssistant(scene, '收到，正在 Canvas 优化简历 bullet…');
    await runResumeAction('resume-optimize', 'agentChatSend', '优化');`,
  `    pushAgentChatAssistant(scene, '收到，正在 Canvas 优化简历 bullet…');
    pushAgentUndoSnapshot('优化前');
    await runResumeAction('resume-optimize', 'agentChatSend', '优化');
    persistCrossSceneMemory();`,
  'undo-optimize'
);

mustReplace(
  `    pushAgentChatAssistant(scene, resumeScoreResult.content ? '评分完成，请查看 Canvas「评分」Tab。' : '评分流程已触发，请查看 Canvas。');
    return;`,
  `    persistCrossSceneMemory();
    pushAgentChatAssistant(scene, resumeScoreResult.content ? '评分完成，请查看 Canvas「评分」Tab。' : '评分流程已触发，请查看 Canvas。');
    renderAgentSuggestionChips(scene);
    return;`,
  'persist-score'
);

mustReplace(
  `    pushAgentChatAssistant(scene, '优化完成，请查看 Canvas「优化」Tab。');
    return;`,
  `    pushAgentChatAssistant(scene, '优化完成，请查看 Canvas「优化」Tab。');
    renderAgentSuggestionChips(scene);
    return;`,
  'chips-after-opt'
);

mustReplace(
  `    await sendModuleCoachMessage({
      module: 'resume', message: msg, mode: '',
      messages, threadId: 'resumeThread',
      errId: 'resumeScoreError', btnId: 'agentChatSend', inputId: 'agentChatInput',
      restoreInputOnError: true
    });`,
  `    await sendModuleCoachMessage({
      module: 'resume', message: msg, mode: '',
      messages, threadId: 'resumeThread',
      errId: 'resumeScoreError', btnId: 'agentChatSend', inputId: 'agentChatInput',
      restoreInputOnError: true, stream: true, agentScene: scene, applyRefine: true
    });`,
  'resume-coach-opts'
);

mustReplace(
  `    await sendModuleCoachMessage({
      module: 'interview', message: msg, mode: '',
      messages, threadId: 'interviewPrepThread',
      errId: 'interviewPrepError', btnId: 'agentChatSend', inputId: 'agentChatInput'
    });`,
  `    await sendModuleCoachMessage({
      module: 'interview', message: msg, mode: '',
      messages, threadId: 'interviewPrepThread',
      errId: 'interviewPrepError', btnId: 'agentChatSend', inputId: 'agentChatInput',
      stream: true, agentScene: scene, applyRefine: true
    });`,
  'prep-coach-opts'
);

mustReplace(
  `  if (scene === 'kb') {
    pushAgentChatAssistant(scene, '知识库模式：请在 Canvas 阅读卡片；概念解释功能即将接入 RAG 追问。');
    agentToolSteps = [{ name: 'coach_reply', status: 'done', detail: 'kb' }];
    renderAgentToolsPanel();
  }
}`,
  `  if (scene === 'kb') {
    pushAgentChatUser(scene, msg);
    await loadKnowledge();
    const ragChunks = searchKnowledgeRagLocal(msg, 4);
    agentToolSteps = [{ name: 'kb_rag', status: 'running', detail: ragChunks.length + ' 条', input: msg }];
    renderAgentToolsPanel();
    const messages = kbAgentMessages;
    await sendModuleCoachMessage({
      module: 'interview', message: msg, mode: 'ai-pm-qa',
      messages, threadId: 'kbThread',
      errId: 'kbAgentError', btnId: 'agentChatSend', inputId: 'agentChatInput',
      stream: true, agentScene: scene, ragChunks,
      emptyHint: '可以问我任何 AI 产品概念'
    });
    agentToolSteps = [{ name: 'kb_rag', status: 'done', detail: ragChunks.length + ' 条', input: msg, output: 'coach' }];
    renderAgentToolsPanel();
    persistAgentChatSnapshot(scene, messages);
    renderAgentSuggestionChips(scene);
  }
}`,
  'kb-rag'
);

// --- mountAgentWorkspace compose ---
mustReplace(
  `        <div class="agent-chat-msgs" id="agentChatMsgs"></div>
        <div class="agent-tools" hidden></div>
        <div class="agent-chat-compose">
          <input type="text" class="agent-chat-input" id="agentChatInput" placeholder="对 Agent 下指令…" />
          <button type="button" class="btn-primary" id="agentChatSend">发送</button>
        </div>`,
  `        <div class="agent-chat-msgs" id="agentChatMsgs"></div>
        <div class="agent-chat-chips" id="agentChatChips" hidden></div>
        <div class="agent-tools" hidden></div>
        <div class="agent-chat-compose">
          <div class="agent-compose-row">
            <button type="button" class="agent-compose-icon" id="agentChatMic" title="语音输入">🎤</button>
            <input type="file" id="agentChatFile" accept=".txt,.md,.json" hidden />
            <button type="button" class="agent-compose-icon" id="agentChatAttach" title="附加文本文件">📎</button>
            <input type="text" class="agent-chat-input" id="agentChatInput" placeholder="对 Agent 下指令…" />
            <button type="button" class="btn-primary" id="agentChatSend">发送</button>
          </div>
        </div>`,
  'compose-ui'
);

mustReplace(
  `  bindAgentWorkspace(scene);
  renderAgentChatBubbles(scene);
  updateCanvasChrome(scene);
}`,
  `  bindAgentWorkspace(scene);
  renderAgentChatBubbles(scene);
  renderAgentSuggestionChips(scene);
  bindAgentVoiceAttach(scene);
  document.getElementById('agentChatAttach')?.addEventListener('click', () => document.getElementById('agentChatFile')?.click());
  updateCanvasChrome(scene);
}`,
  'mount-chips'
);

mustReplace(
  `  document.getElementById('agentChatReset')?.addEventListener('click', () => {
    const msgs = agentChatMessagesForScene(scene);
    if (msgs.length) persistAgentChatSnapshot(scene, msgs);
    msgs.length = 0;
    agentToolSteps = [];
    renderAgentToolsPanel();
    renderAgentChatBubbles(scene);
  });`,
  `  document.getElementById('agentChatReset')?.addEventListener('click', () => {
    const msgs = agentChatMessagesForScene(scene);
    if (msgs.length && !confirm('确定重置当前会话？可先点「历史对话」保留记录。')) return;
    if (msgs.length) persistAgentChatSnapshot(scene, msgs);
    msgs.length = 0;
    agentToolSteps = [];
    agentLastFailedCoach = null;
    renderAgentToolsPanel();
    renderAgentChatBubbles(scene);
    renderAgentSuggestionChips(scene);
  });`,
  'reset-confirm'
);

// --- sendModuleCoachMessage full replace ---
const OLD_SEND = `async function sendModuleCoachMessage(opts) {
  const {
    module, message, mode, action, messages, threadId,
    errId, btnId, inputId,
    displayMessage, restoreInputOnError = true,
    triggerBtnId, triggerBtnLabel
  } = opts;
  const errEl = document.getElementById(errId);
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  const triggerBtn = triggerBtnId ? document.getElementById(triggerBtnId) : null;
  const threadLabel = displayMessage || (action ? (triggerBtnLabel || '处理中') : message);

  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  messages.push({ role: 'user', content: threadLabel });
  if (input) input.value = '';
  renderModuleThread(threadId, messages);
  if (btn && !triggerBtnId) { btn.disabled = true; btn.textContent = '生成中…'; }
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.dataset.prevLabel = triggerBtn.textContent;
    triggerBtn.textContent = (triggerBtnLabel || '处理中') + '…';
  }
  syncExtraNotesFromDom();
  saveProfileFromDom();
  try {
    const payload = {
      accessCode,
      userId: userAccountId,
      contextModule: module,
      intake: buildCoachIntakeFromProfile(),
      history: module === 'resume'
        ? getResumeCoachHistory(messages.slice(0, -1))
        : module === 'interview'
          ? getInterviewCoachHistory(messages.slice(0, -1))
          : messages.slice(0, -1)
    };
    if (action) payload.action = action;
    else {
      payload.message = message;
      payload.mode = mode || '';
    }
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const raw = await res.text();
    let data = {};
    try {
      data = raw ? JSON.parse(raw) : {};
    } catch {
      if (!res.ok) throw new Error(raw.slice(0, 300) || '请求失败（HTTP ' + res.status + '）');
    }
    if (!res.ok) {
      throw new Error(data.error || raw.slice(0, 300) || '请求失败（HTTP ' + res.status + '）');
    }
    messages.push({ role: 'assistant', content: data.reply || '' });
    renderModuleThread(threadId, messages);
  } catch (e) {
    if (errEl) {
      errEl.hidden = false;
      errEl.textContent = e.message || '发送失败';
    }
    messages.pop();
    renderModuleThread(threadId, messages, opts.emptyHint);
    if (restoreInputOnError && input && message) input.value = message;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btnId === 'resumeSendBtn' || btnId === 'interviewSendBtn' ? '追问' : '发送'; }
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = triggerBtn.dataset.prevLabel || triggerBtnLabel || '完成';
    }
  }
}`;

const NEW_SEND = `async function sendModuleCoachMessage(opts) {
  const {
    module, message, mode, action, messages, threadId,
    errId, btnId, inputId,
    displayMessage, restoreInputOnError = true,
    triggerBtnId, triggerBtnLabel,
    stream = false, agentScene: coachScene, applyRefine = false, ragChunks
  } = opts;
  const errEl = document.getElementById(errId);
  const btn = document.getElementById(btnId);
  const input = document.getElementById(inputId);
  const triggerBtn = triggerBtnId ? document.getElementById(triggerBtnId) : null;
  const threadLabel = displayMessage || (action ? (triggerBtnLabel || '处理中') : message);
  const sceneForCtx = coachScene || agentScene || module;

  if (errEl) { errEl.hidden = true; errEl.textContent = ''; }
  if (!action) {
    messages.push({ role: 'user', content: threadLabel });
    if (input) input.value = '';
    renderModuleThread(threadId, messages);
    if (coachScene) renderAgentChatBubbles(coachScene);
  } else {
    renderModuleThread(threadId, messages);
  }
  if (btn && !triggerBtnId) { btn.disabled = true; btn.textContent = '生成中…'; }
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.dataset.prevLabel = triggerBtn.textContent;
    triggerBtn.textContent = (triggerBtnLabel || '处理中') + '…';
  }
  syncExtraNotesFromDom();
  saveProfileFromDom();
  agentLastFailedCoach = null;
  const useStream = stream && !action;
  try {
    const payload = {
      accessCode,
      userId: userAccountId,
      contextModule: module,
      intake: buildCoachIntakeFromProfile(),
      history: module === 'resume'
        ? getResumeCoachHistory(messages.slice(0, -1))
        : module === 'interview'
          ? getInterviewCoachHistory(messages.slice(0, -1))
          : messages.slice(0, -1),
      canvasContext: buildAgentCanvasContext(sceneForCtx),
      crossMemory: loadCrossSceneMemoryString()
    };
    if (action) payload.action = action;
    else {
      payload.message = message;
      payload.mode = mode || '';
      if (useStream) payload.stream = true;
    }
    if (ragChunks?.length) payload.ragChunks = ragChunks;
    agentToolSteps = agentToolSteps.concat([{ name: 'coach_api', status: 'running', detail: useStream ? 'stream' : 'json', input: JSON.stringify({ mode: payload.mode, msg: message?.slice(0, 80) }) }]);
    renderAgentToolsPanel();
    const res = await fetch('/api/coach', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload)
    });
    const ctype = res.headers.get('content-type') || '';
    if (useStream && res.ok && ctype.includes('ndjson')) {
      messages.push({ role: 'assistant', content: '' });
      const idx = messages.length - 1;
      if (coachScene) renderAgentChatBubbles(coachScene);
      const reply = await consumeCoachStream(res, messages, threadId, full => {
        messages[idx].content = full;
        renderModuleThread(threadId, messages);
        if (coachScene) renderAgentChatBubbles(coachScene);
      });
      if (applyRefine && coachScene) applyRefineToCanvas(coachScene, reply, message);
      agentToolSteps = agentToolSteps.map(s => s.name === 'coach_api' ? { ...s, status: 'done', output: (reply || '').slice(0, 200) } : s);
      renderAgentToolsPanel();
    } else {
      const raw = await res.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch {
        if (!res.ok) throw new Error(raw.slice(0, 300) || '请求失败（HTTP ' + res.status + '）');
      }
      if (!res.ok) throw new Error(data.error || raw.slice(0, 300) || '请求失败（HTTP ' + res.status + '）');
      messages.push({ role: 'assistant', content: data.reply || '' });
      renderModuleThread(threadId, messages);
      if (coachScene) {
        renderAgentChatBubbles(coachScene);
        if (applyRefine) applyRefineToCanvas(coachScene, data.reply, message);
      }
      agentToolSteps = agentToolSteps.map(s => s.name === 'coach_api' ? { ...s, status: 'done', output: (data.reply || '').slice(0, 200) } : s);
      renderAgentToolsPanel();
    }
  } catch (e) {
    const errMsg = e.message || '发送失败';
    if (errEl) { errEl.hidden = false; errEl.textContent = errMsg; }
    if (!action) {
      messages.pop();
      renderModuleThread(threadId, messages, opts.emptyHint);
      if (coachScene) {
        pushAgentChatAssistant(coachScene, '请求失败：' + errMsg + '。可点下方重试。');
        agentLastFailedCoach = { scene: coachScene, payload: opts, message };
        appendAgentRetryBubble(coachScene);
      }
    }
    if (restoreInputOnError && input && message) input.value = message;
    agentToolSteps = agentToolSteps.map(s => s.name === 'coach_api' ? { ...s, status: 'done', detail: 'error', output: errMsg } : s);
    renderAgentToolsPanel();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = btnId === 'resumeSendBtn' || btnId === 'interviewSendBtn' ? '追问' : '发送'; }
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = triggerBtn.dataset.prevLabel || triggerBtnLabel || '完成';
    }
    if (coachScene) renderAgentSuggestionChips(coachScene);
  }
}`;

if (h.includes(OLD_SEND)) {
  h = h.replace(OLD_SEND, NEW_SEND);
} else if (h.includes('canvasContext: buildAgentCanvasContext')) {
  console.log('SKIP sendModuleCoachMessage (already patched)');
} else {
  console.error('MISSING sendModuleCoachMessage block');
  process.exit(1);
}

if (h === orig) {
  console.log('No changes applied (already up to date?)');
} else {
  const out = hadCrlf ? h.replace(/\n/g, '\r\n') : h;
  fs.writeFileSync(INDEX, out, 'utf8');
  if (!/[\u4e00-\u9fff]/.test(h)) {
    console.error('UTF-8 Chinese check FAILED');
    process.exit(1);
  }
  console.log('index.html patched OK');
}
