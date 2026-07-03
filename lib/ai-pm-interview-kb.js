/** AI 产品经理面试知识库 Markdown → knowledge section / RAG chunks */

export const SECTION_ID = 'ai-pm-interview-kb';
export const SECTION_TITLE = 'AI 产品经理面试知识库';
export const MD_FILENAME = 'ai-pm-interview-knowledge.md';

export function slugify(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\u4e00-\u9fffa-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'card';
}

/** @param {string} md */
export function parseAiPmInterviewMd(md) {
  let text = String(md || '');
  if (text.startsWith('---')) {
    const end = text.indexOf('---', 3);
    if (end > 0) text = text.slice(end + 3).trim();
  }

  /** @type {{ part: string, title: string, body: string }[]} */
  const cards = [];
  let part = '';
  let currentTitle = '';
  let bodyLines = [];

  const flush = () => {
    if (!currentTitle) return;
    const body = bodyLines.join('\n').trim();
    if (!body) return;
    cards.push({ part, title: currentTitle, body });
  };

  for (const line of text.split(/\r?\n/)) {
    const partMatch = line.match(/^#\s+(.+)/);
    if (partMatch && /第.+篇|附录/.test(partMatch[1])) {
      flush();
      currentTitle = '';
      bodyLines = [];
      part = partMatch[1].trim();
      continue;
    }
    const secMatch = line.match(/^##\s+(.+)/);
    if (secMatch) {
      flush();
      currentTitle = secMatch[1].trim();
      bodyLines = [];
      continue;
    }
    if (currentTitle) bodyLines.push(line);
  }
  flush();
  return cards;
}

/** @param {{ part: string, title: string, body: string }[]} parsed */
export function cardsFromParsed(parsed) {
  const usedIds = new Set();
  return parsed.map((c, i) => {
    let id = 'aipm-' + slugify(c.title);
    if (usedIds.has(id)) id = id + '-' + i;
    usedIds.add(id);
    const tags = ['AI产品', '面试', 'RAG'];
    if (c.part) tags.push(c.part.replace(/\s+/g, '').slice(0, 12));
    return {
      id,
      title: c.title,
      tags,
      body: (c.part ? `**${c.part}**\n\n` : '') + c.body
    };
  });
}

/** @param {string} md */
export function buildSectionFromMd(md) {
  const parsed = parseAiPmInterviewMd(md);
  if (!parsed.length) return null;
  return {
    id: SECTION_ID,
    title: SECTION_TITLE,
    cat: 'interview',
    cards: cardsFromParsed(parsed)
  };
}
