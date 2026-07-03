/** Patch index.html: 知识库 RAG 全链路 */
const fs = require('fs');
const path = require('path');
const INDEX = path.join(__dirname, '..', 'index.html');
let h = fs.readFileSync(INDEX, 'utf8');
const crlf = h.includes('\r\n');
if (crlf) h = h.replace(/\r\n/g, '\n');

function rep(from, to, label) {
  if (!h.includes(from)) {
    console.error('MISSING:', label);
    process.exit(1);
  }
  h = h.replace(from, to);
}

rep(
  "    sectionIds: ['platform-aigc', 'web-ai-pm', 'interview-pm-extra']",
  "    sectionIds: ['platform-aigc', 'web-ai-pm', 'interview-pm-extra', 'ai-pm-interview-kb']",
  'knowledge-page'
);

rep(
  `function searchKnowledgeRagLocal(query, limit) {
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
}`,
  `function ragTokenizeLocal(text) {
  const raw = String(text || '').toLowerCase();
  const tokens = [];
  for (const w of raw.match(/[a-z0-9]{2,}/g) || []) tokens.push(w);
  const cjk = raw.replace(/[^\\u4e00-\\u9fff]/g, '');
  for (let i = 0; i < cjk.length - 1; i++) tokens.push(cjk.slice(i, i + 2));
  if (cjk.length === 1) tokens.push(cjk);
  for (const t of raw.split(/[\\s,，、]+/).filter(x => x.length >= 2)) tokens.push(t);
  return [...new Set(tokens)];
}

function buildCoachRagQuery(extra) {
  return [extra, profileTargetRole, profileJd?.slice(0, 300), profileResume?.slice(0, 500), 'AI产品经理 面试'].filter(Boolean).join('\\n');
}

async function resolveCoachRagChunks(query, limit) {
  await loadKnowledge();
  return searchKnowledgeRagLocal(query, limit || 6);
}

function searchKnowledgeRagLocal(query, limit) {
  const qTokens = ragTokenizeLocal(query);
  if (!qTokens.length) return [];
  const hits = [];
  for (const sec of KNOWLEDGE || []) {
    for (const card of sec.cards || []) {
      const text = ((card.title || '') + ' ' + (card.body || '') + ' ' + (card.tags || []).join(' ')).toLowerCase();
      let score = qTokens.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0);
      if (sec.id === 'ai-pm-interview-kb') score += 1.5;
      if (score > 0) {
        hits.push({
          score,
          chunk: {
            id: card.id,
            title: card.title,
            text: (card.body || '').slice(0, 900),
            section: sec.title || sec.id,
            sectionId: sec.id,
            cat: sec.cat || 'interview',
            tags: card.tags || []
          }
        });
      }
    }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit || 6).map(x => x.chunk);
}`,
  'rag-local'
);

rep(
  `      body: JSON.stringify({
        accessCode,
        userId: userAccountId,
        contextModule: 'resume',
        action,
        intake: buildCoachIntakeFromProfile(),
        history: []
      })`,
  `      body: JSON.stringify({
        accessCode,
        userId: userAccountId,
        contextModule: 'resume',
        action,
        intake: buildCoachIntakeFromProfile(),
        history: [],
        ragChunks: await resolveCoachRagChunks(buildCoachRagQuery(isScore ? '简历评分 AI产品信号' : '简历优化 bullet AI产品'), 6)
      })`,
  'resume-rag'
);

rep(
  `        action: 'interview-prep',
        intake: buildCoachIntakeFromProfile(),
        history: []
      })`,
  `        action: 'interview-prep',
        intake: buildCoachIntakeFromProfile(),
        history: [],
        ragChunks: await resolveCoachRagChunks(buildCoachRagQuery('面试准备 AI产品经理'), 6)
      })`,
  'prep-rag'
);

rep(
  `    if (ragChunks?.length) payload.ragChunks = ragChunks;`,
  `    if (!ragChunks?.length && message) {
      payload.ragChunks = await resolveCoachRagChunks(buildCoachRagQuery(message), 6);
    } else if (ragChunks?.length) payload.ragChunks = ragChunks;`,
  'coach-msg-rag'
);

fs.writeFileSync(INDEX, crlf ? h.replace(/\n/g, '\r\n') : h, 'utf8');
console.log('index.html knowledge RAG patched');
