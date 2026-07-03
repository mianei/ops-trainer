import { buildSectionFromMd, MD_FILENAME, SECTION_ID } from './ai-pm-interview-kb.js';

/** @typedef {{ id: string, title: string, section: string, sectionId: string, cat: string, tags: string[], text: string, sourceUrl?: string, sourceLabel?: string, ragKind?: string }} RagChunk */

const TOPIC_CARD_BOOST = {
  user: ['true-demand-three', 'surface-vs-core', 'problem-hypothesis-metric', 'ecom-shelf-vs-content', 'ota-demand-shift'],
  feature: ['problem-hypothesis-metric', 'surface-vs-core', 'ia-four', 'fitts-law'],
  interaction: ['ia-four', 'fitts-law', 'problem-hypothesis-metric'],
  decision: ['goal-path-resource-risk', 'priority-rice', 'ota-hotel-modes', 'ecom-revenue-formula'],
  data: ['guide-data-four-questions', 'sql-select-where', 'sql-group-by', 'data-anomaly-debug', 'impact-coefficient', 'metric-selection-chain', 'renhuochang-analysis', 'cohort-read'],
  sql: ['sql-why-ops', 'sql-select-where', 'sql-group-by', 'sql-join-left', 'sql-retention-simple', 'sql-ops-tips'],
  growth: ['guide-aarrr-leaks', 'guide-acquisition-channels', 'aarrr', 'metric-selection-chain', 'ota-cross-sell', 'ecom-subsidy-fission'],
  retention: ['rfm-basics', 'retention-value', 'cohort-read'],
  competitor: ['competitor-four-layers', 'competitor-analysis', 'ota-oligopoly'],
  crisis: ['crisis-response-frame', 'crisis-time-window', 'community-aigc'],
  content: ['ops-plan-5w1h', 'activity-review-loop', 'aida-hook', 'social-currency'],
  'iv-pm': ['circles-framework', 'ai-project-four-steps', 'true-demand-three', 'llm-output-constraints', 'aipm-2-3-rag-检索增强生成', 'aipm-1-3-rag-vs-微调', 'aipm-2-5-agent-评测', 'aipm-3-2-ai-产品经理的核心能力'],
  'iv-ops': ['guide-resume-ops-story', 'guide-user-tier-recall', 'activity-review-loop', 'renhuochang-analysis', 'analysis-to-action', 'aarrr'],
  'iv-open': ['star-pressure', 'crisis-response-frame'],
  'iv-skills': ['fermi-estimation', 'competitor-four-layers', 'priority-rice', 'competitor-analysis'],
  'iv-exp': ['starr-framework', 'star-full', 'quantify-resume'],
  'iv-self': ['starr-framework', 'prep-framework', 'star-pressure'],
  'iv-career': ['self-intro-four', 'career-stages'],
  'iv-misc': ['interview-reverse-q', 'scqa-framework'],
  'biz-platform': ['super-app-logic', 'gmv-decomposition', 'scqa-framework'],
  'biz-vertical': ['renhuochang-analysis', 'community-triangle', 'churn-layer-ops'],
  'biz-monetize': ['arpu-ltv-dau', 'north-star-guardrails', 'aigc-eval-dims'],
  'map-ride': ['ride-supply-demand', 'goal-path-resource-risk'],
  'map-local': ['local-o2o-triangle'],
  'prod-open': ['circles-framework', 'ai-agent-boundary', 'moments-not-home']
};

const INDUSTRY_TAG_BOOST = {
  OTA: ['ota-hotel-modes', 'ota-cross-sell', 'ota-oligopoly'],
  电商: ['ecom-shelf-vs-content', 'ecom-revenue-formula', 'ecom-refund-risk'],
  社区: ['community-triangle', 'community-ces', 'community-bilibili-metrics'],
  即时零售: ['instant-grid', 'instant-vs-ecom', 'retail-three-eras'],
  面经: ['starr-framework', 'prep-framework', 'guide-resume-ops-story', 'metric-selection-chain', 'competitor-four-layers'],
  SQL: ['sql-why-ops', 'sql-select-where', 'sql-group-by', 'sql-join-left', 'sql-retention-simple']
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
  const n = Number(process.env.RAG_TOP_K || 4);
  return Number.isFinite(n) ? Math.max(1, Math.min(6, n)) : 4;
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

/** 将外部面经检索结果转为 RAG 切片（会话级，随 Agent 任务下发） */
export function buildChunksFromSearchResults(results) {
  /** @type {RagChunk[]} */
  const chunks = [];
  for (const r of results || []) {
    if (!r || r.external || !r.snippet) continue;
    const title = String(r.title || '').trim();
    const snippet = String(r.snippet || '').trim();
    const url = String(r.url || '').trim();
    if (!title || !snippet) continue;
    const sourceLabel = String(r.sourceLabel || r.source || '面经');
    const slug = url.replace(/[^a-zA-Z0-9]/g, '').slice(-24) || String(chunks.length);
    chunks.push({
      id: `interview-rag-${slug}`,
      title: title.slice(0, 120),
      section: `${sourceLabel} · 检索面经`,
      sectionId: 'interview-rag',
      cat: 'interview',
      tags: [sourceLabel, r.source].filter(Boolean),
      text: `${title}\n${snippet}${url ? `\n来源：${url}` : ''}`.trim(),
      sourceUrl: url || undefined,
      sourceLabel,
      ragKind: 'interview-search'
    });
  }
  return chunks;
}

/** 从项目根目录 interview-rag-feed.json 加载人工整理面经（无需 Serper） */
export async function loadInterviewRagFeed(origin) {
  try {
    const url = `${String(origin || '').replace(/\/$/, '')}/interview-rag-feed.json?t=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    const posts = (Array.isArray(data.posts) ? data.posts : []).map((p) => ({
      title: p.title,
      snippet: p.body || p.snippet || p.content || '',
      url: p.url,
      source: p.source || 'feed',
      sourceLabel: p.sourceLabel || '整理面经',
      external: false
    }));
    return buildChunksFromSearchResults(posts).map((c) => ({
      ...c,
      ragKind: 'interview-feed',
      section: `${c.sourceLabel || '整理面经'} · 投喂`
    }));
  } catch {
    return [];
  }
}

/** 按目标/岗位简单筛选投喂面经 */
export function filterFeedChunksByIntent(chunks, intent, goal) {
  if (!chunks.length) return [];
  const hay = [goal, intent?.company, intent?.roleLabel].filter(Boolean).join(' ').toLowerCase();
  if (!hay.trim()) return chunks.slice(0, 10);
  const tokens = hay.split(/[\s,，、]+/).filter((t) => t.length >= 2);
  const scored = chunks.map((c) => {
    const text = `${c.title} ${c.text} ${(c.tags || []).join(' ')}`.toLowerCase();
    const score = tokens.reduce((s, t) => s + (text.includes(t) ? 1 : 0), 0);
    return { c, score };
  });
  const hit = scored.filter((s) => s.score > 0);
  const pick = (hit.length ? hit : scored).sort((a, b) => b.score - a.score);
  return pick.slice(0, 10).map((s) => s.c);
}

/** @param {unknown[]} raw */
export function normalizeSessionRagChunks(raw) {
  if (!Array.isArray(raw)) return [];
  /** @type {RagChunk[]} */
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const title = String(item.title || '').trim();
    const text = String(item.text || item.snippet || '').trim();
    if (!title || !text) continue;
    out.push({
      id: String(item.id || `session-${out.length}`),
      title,
      section: String(item.section || '检索面经'),
      sectionId: String(item.sectionId || 'interview-rag'),
      cat: String(item.cat || 'interview'),
      tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
      text: text.includes(title) ? text : `${title}\n${text}`,
      sourceUrl: item.sourceUrl ? String(item.sourceUrl) : undefined,
      sourceLabel: item.sourceLabel ? String(item.sourceLabel) : undefined,
      ragKind: item.ragKind || 'interview-search'
    });
  }
  return out;
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
    if (chunk.sectionId === 'ai-pm-interview-kb') score += 2.5;
    if (boostCat && chunk.cat === boostCat) score += 1.5;
    if (chunk.ragKind === 'interview-search' || chunk.ragKind === 'interview-feed') score += 2;
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

function truncateChunkBody(text, max = 400) {
  const t = String(text || '').trim();
  if (!t || t.length <= max) return t;
  return t.slice(0, max) + '…';
}

export function formatRagContext(chunks) {
  if (!chunks.length) return '';
  const blocks = chunks.map((c, i) => {
    const raw = c.text.split('\n').slice(1).join('\n').trim() || c.text;
    const body = truncateChunkBody(raw, 400);
    const src = c.sourceLabel ? ` · ${c.sourceLabel}` : c.ragKind === 'interview-search' ? ' · 检索面经' : '';
    return `【参考 ${i + 1}：${c.title} · ${c.section}${src}】\n${body}`;
  });
  return (
    '\n\n---\n知识库与面经检索（RAG，供对齐框架与真实面经表述；请结合本题场景与学员作答，勿生硬照搬）：\n' +
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
  const base = String(origin || '').replace(/\/$/, '');
  const [jsonRes, mdRes] = await Promise.all([
    fetch(`${base}/knowledge.json`, { cache: 'force-cache' }),
    fetch(`${base}/${MD_FILENAME}?t=${now}`, { cache: 'no-store' })
  ]);

  /** @type {unknown[]} */
  let sections = [];
  if (jsonRes.ok) {
    const data = await jsonRes.json();
    sections = (Array.isArray(data?.sections) ? data.sections : []).filter(
      (s) => s && s.id !== SECTION_ID
    );
  }

  if (mdRes.ok) {
    const md = await mdRes.text();
    const kbSection = buildSectionFromMd(md);
    if (kbSection) sections.push(kbSection);
  }

  const chunks = buildChunksFromKnowledge({ sections });
  knowledgeCache = { at: now, chunks };
  return chunks;
}

export async function retrieveRagContext(origin, query, options = {}) {
  if (!ragEnabled()) return { chunks: [], context: '', interviewRagCount: 0 };

  let sessionChunks = normalizeSessionRagChunks(options.sessionChunks);
  if (!sessionChunks.length) {
    const feed = await loadInterviewRagFeed(origin);
    if (feed.length) {
      const fromFeed = retrieveChunks(feed, query);
      sessionChunks = fromFeed.length ? fromFeed : feed.slice(0, 3);
    }
  }
  const knowledge = await loadKnowledgeChunks(origin);
  const fromKnowledge = retrieveChunks(knowledge, query);
  const fromSession = sessionChunks.length ? retrieveChunks(sessionChunks, query) : [];

  const k = ragTopK();
  const sessionTake = Math.min(fromSession.length, Math.max(1, Math.ceil(k / 2)));
  const knowTake = Math.max(1, k - sessionTake);
  const seen = new Set();
  /** @type {RagChunk[]} */
  const merged = [];

  for (const c of fromSession.slice(0, sessionTake)) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push(c);
  }
  for (const c of fromKnowledge) {
    if (merged.length >= k) break;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    merged.push(c);
    if (merged.length >= sessionTake + knowTake) break;
  }

  return {
    chunks: merged,
    context: formatRagContext(merged),
    interviewRagCount: merged.filter((c) => c.ragKind === 'interview-search' || c.ragKind === 'interview-feed').length
  };
}
