/**
 * 将 AI产品经理面试知识库.md 解析并合并进 knowledge.json
 * 用法: node scripts/build-ai-pm-interview-kb.js [md路径]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEFAULT_MD = path.join(ROOT, 'docs', 'ai-pm-interview-knowledge.md');
const KNOWLEDGE_PATH = path.join(ROOT, 'knowledge.json');
const MAP_PATH = path.join(ROOT, 'knowledge-map.json');

const SECTION_ID = 'ai-pm-interview-kb';
const SECTION_TITLE = 'AI 产品经理面试知识库';

function slugify(text) {
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

function main() {
  const mdPath = process.argv[2] || DEFAULT_MD;
  if (!fs.existsSync(mdPath)) {
    console.error('找不到 Markdown:', mdPath);
    process.exit(1);
  }
  const md = fs.readFileSync(mdPath, 'utf8');
  const parsed = parseAiPmInterviewMd(md);
  if (!parsed.length) {
    console.error('未解析到任何卡片');
    process.exit(1);
  }

  const usedIds = new Set();
  const cards = parsed.map((c, i) => {
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

  const knowledge = JSON.parse(fs.readFileSync(KNOWLEDGE_PATH, 'utf8'));
  knowledge.version = (knowledge.version || 0) + 1;
  knowledge.sections = (knowledge.sections || []).filter((s) => s.id !== SECTION_ID);
  knowledge.sections.push({
    id: SECTION_ID,
    title: SECTION_TITLE,
    cat: 'interview',
    cards
  });

  fs.writeFileSync(KNOWLEDGE_PATH, JSON.stringify(knowledge, null, 2) + '\n', 'utf8');

  const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const cardIds = cards.map((c) => c.id);
  map.readingByNav = map.readingByNav || {};
  map.readingByTopic = map.readingByTopic || {};
  map.readingByNav['ai-pm-kb'] = cardIds;
  map.readingByTopic['iv-pm'] = [...new Set([...(map.readingByTopic['iv-pm'] || []), ...cardIds.slice(0, 20)])];
  fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2) + '\n', 'utf8');

  console.log(`Merged ${cards.length} cards into knowledge.json (section ${SECTION_ID}, v${knowledge.version})`);
}

main();
