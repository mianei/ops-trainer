/** @typedef {{ id: string, title: string, section: string, sectionId: string, cat: string, tags: string[], text: string }} RagChunk */

const TOPIC_CARD_BOOST = {
  user: ['true-demand-three', 'surface-vs-core', 'problem-hypothesis-metric', 'ecom-shelf-vs-content', 'ota-demand-shift'],
  feature: ['problem-hypothesis-metric', 'surface-vs-core', 'ia-four', 'fitts-law'],
  interaction: ['ia-four', 'fitts-law', 'problem-hypothesis-metric'],
  decision: ['goal-path-resource-risk', 'ota-hotel-modes', 'ecom-revenue-formula', 'ecom-category-strategy'],
  data: ['data-anomaly-debug', 'cohort-read', 'ecom-search-rank'],
  growth: ['aarrr', 'ota-cross-sell', 'ecom-subsidy-fission'],
  retention: ['rfm-basics', 'retention-value', 'cohort-read'],
  competitor: ['competitor-analysis', 'ota-oligopoly', 'ota-booking-diff'],
  crisis: ['crisis-response-frame', 'crisis-time-window', 'community-aigc'],
  content: ['aida-hook', 'social-currency', 'community-four-roles'],
  'iv-pm': ['circles-framework', 'query-tagging-framework', 'aigc-eval-dims', 'aigc-rag-debug-layers'],
  'iv-ops': ['xhs-creator-tier', 'xhs-vs-douyin-creator', 'zhihu-creator-ops', 'community-triangle'],
  'iv-open': ['star-pressure', 'crisis-response-frame'],
  'iv-skills': ['star-full', 'competitor-analysis', 'priority-rice'],
  'iv-exp': ['star-full', 'prep-framework', 'quantify-resume'],
  'biz-platform': ['zhihu-qa-vs-content', 'prep-framework', 'super-app-logic'],
  'biz-vertical': ['xhs-decision-engine', 'douyin-local-loop', 'community-triangle'],
  'biz-monetize': ['zhihu-salt-tradeoff', 'aigc-eval-dims', 'douyin-local-push'],
  'map-ride': ['ride-supply-demand', 'goal-path-resource-risk'],
  'map-local': ['local-o2o-triangle', 'douyin-local-loop'],
  'prod-open': ['circles-framework', 'ai-agent-boundary', 'moments-not-home'],
  content: ['xhs-note-structure', 'aida-hook', 'social-currency']
};

const INDUSTRY_TAG_BOOST = {
  OTA: ['ota-hotel-modes', 'ota-cross-sell', 'ota-oligopoly'],
  电商: ['ecom-shelf-vs-content', 'ecom-revenue-formula', 'ecom-refund-risk'],
  社区: ['community-triangle', 'community-ces', 'community-bilibili-metrics'],
  即时零售: ['instant-grid', 'instant-vs-ecom', 'retail-three-eras'],
  知乎: ['zhihu-qa-vs-content', 'zhihu-salt-tradeoff', 'zhihu-creator-ops'],
  小红书: ['xhs-decision-engine', 'xhs-note-structure', 'community-ces'],
  抖音: ['douyin-local-loop', 'douyin-vs-meituan', 'douyin-poi-ia'],
  AI: ['aigc-rag-debug-layers', 'aigc-eval-dims', 'query-tagging-framework'],
  创作者运营: ['xhs-creator-tier', 'xhs-vs-douyin-creator', 'zhihu-creator-ops']
};

const TOPIC_CAT_BOOST = {
  user: 'product',
  feature: 'product',
  competitor: 'product',
  decision: 'ops',
  data: 'ops',
  growth: 'ops',
  retention: 'ops',
  crisis: 'ops',
  content: 'ops'
};

export function ragEnabled() {
  return (process.env.RAG_ENABLED || '1').trim() !== '0';
}

export function ragTopK() {
  const n = Number(process.env.RAG_TOP_K || 3);
  return Number.isFinite(n) ? Math.max(1, Math.min(5, n)) : 3;
}

/** @param {unknown} knowledge */
export function buildChunksFromKnowledge(knowledge) {
  /** @type {RagChunk[]} */
  const chunks = [];
  const sections = knowledge?.sections;
  if (!Array.isArray(sections)) return chunks;

  for (const sec of sections) {
    const cards = sec.cards || [];
    for (const card of cards) {
      const body = String(card.body || '').replace(/\*\*/g, '');
      const tags = Array.isArray(card.tags) ? card.tags : [];
      chunks.push({
        id: String(card.id || card.title || ''),
        title: String(card.title || ''),
        section: String(sec.title || ''),
        sectionId: String(sec.id || ''),
        cat: String(sec.cat || ''),
        tags,
        text: `${card.title}\n${tags.join(' ')}\n${body}`.trim()
      });
    }
  }
  return chunks;
}

function tokenize(text) {
  const raw = String(text || '').toLowerCase();
  /** @type {string[]} */
  const tokens = [];
  for (const w of raw.match(/[a-z0-9]{2,}/g) || []) tokens.push(w);
  const cjk = raw.replace(/[^\u4e00-\u9fff]/g, '');
  for (let i = 0; i < cjk.length - 1; i++) tokens.push(cjk.slice(i, i + 2));
  if (cjk.length === 1) tokens.push(cjk);
  return tokens;
}

function termFreq(tokens) {
  /** @type {Record<string, number>} */
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  return tf;
}

/**
 * @param {RagChunk[]} chunks
 * @param {{ scenario: string, answer?: string, topicId?: string, question?: string }} query
 */
export function retrieveChunks(chunks, query) {
  if (!chunks.length) return [];

  const qText = [query.scenario, query.answer, query.question, query.topicId]
    .filter(Boolean)
    .join('\n');
  const qTokens = tokenize(qText);
  if (!qTokens.length) return chunks.slice(0, ragTopK());

  const qTf = termFreq(qTokens);
  const topicId = String(query.topicId || '');
  const boostIds = TOPIC_CARD_BOOST[topicId] || [];
  const boostCat = TOPIC_CAT_BOOST[topicId] || '';

  const docLens = chunks.map((c) => tokenize(c.text).length || 1);
  const avgLen = docLens.reduce((a, b) => a + b, 0) / docLens.length;
  const k1 = 1.2;
  const b = 0.75;

  const scored = chunks.map((chunk, i) => {
    const dTokens = tokenize(chunk.text);
    const dTf = termFreq(dTokens);
    const dl = docLens[i];
    let score = 0;
    for (const [term, qf] of Object.entries(qTf)) {
      const df = dTf[term] || 0;
      if (!df) continue;
      const idf = Math.log(1 + chunks.length / (1 + chunks.filter((c) => tokenize(c.text).includes(term)).length));
      const denom = df + k1 * (1 - b + (b * dl) / avgLen);
      score += idf * ((df * (k1 + 1)) / (denom || 1)) * qf;
    }
    if (boostIds.includes(chunk.id)) score += 4;
    if (boostCat && chunk.cat === boostCat) score += 1.5;
    for (const [ind, ids] of Object.entries(INDUSTRY_TAG_BOOST)) {
      if (qText.includes(ind) && ids.includes(chunk.id)) score += 3;
    }
    for (const tag of chunk.tags) {
      if (qText.includes(tag)) score += 0.8;
    }
    return { chunk, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, ragTopK())
    .map((s) => s.chunk);
}

export function formatRagContext(chunks) {
  if (!chunks.length) return '';
  const blocks = chunks.map((c, i) => {
    const body = c.text.split('\n').slice(1).join('\n').trim();
    return `【参考 ${i + 1}：${c.title} · ${c.section}】\n${body}`;
  });
  return (
    '\n\n---\n知识库检索（RAG，供对齐框架用；请结合本题场景与学员作答，勿生硬照搬）：\n' +
    blocks.join('\n\n')
  );
}

let knowledgeCache = /** @type {{ at: number, chunks: RagChunk[] } | null} */ (null);
const CACHE_MS = 10 * 60 * 1000;

export async function loadKnowledgeChunks(origin) {
  const now = Date.now();
  if (knowledgeCache && now - knowledgeCache.at < CACHE_MS) {
    return knowledgeCache.chunks;
  }
  const url = `${origin.replace(/\/$/, '')}/knowledge.json`;
  const res = await fetch(url, { cache: 'force-cache' });
  if (!res.ok) return knowledgeCache?.chunks || [];
  const data = await res.json();
  const chunks = buildChunksFromKnowledge(data);
  knowledgeCache = { at: now, chunks };
  return chunks;
}

export async function retrieveRagContext(origin, query) {
  if (!ragEnabled()) return { chunks: [], context: '' };
  const all = await loadKnowledgeChunks(origin);
  const chunks = retrieveChunks(all, query);
  return { chunks, context: formatRagContext(chunks) };
}
