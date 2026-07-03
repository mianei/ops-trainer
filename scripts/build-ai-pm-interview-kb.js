/**
 * （可选）将 ai-pm-interview-knowledge.md 解析并合并进 knowledge.json
 * 正常运行时 md 为唯一来源，无需执行本脚本。
 * 用法: node scripts/build-ai-pm-interview-kb.js [md路径]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SECTION_ID,
  SECTION_TITLE,
  MD_FILENAME,
  buildSectionFromMd
} from '../lib/ai-pm-interview-kb.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DEFAULT_MD = path.join(ROOT, MD_FILENAME);
const KNOWLEDGE_PATH = path.join(ROOT, 'knowledge.json');
const MAP_PATH = path.join(ROOT, 'knowledge-map.json');

function main() {
  const mdPath = process.argv[2] || DEFAULT_MD;
  if (!fs.existsSync(mdPath)) {
    console.error('找不到 Markdown:', mdPath);
    process.exit(1);
  }
  const md = fs.readFileSync(mdPath, 'utf8');
  const section = buildSectionFromMd(md);
  if (!section?.cards?.length) {
    console.error('未解析到任何卡片');
    process.exit(1);
  }

  const knowledge = JSON.parse(fs.readFileSync(KNOWLEDGE_PATH, 'utf8'));
  knowledge.version = (knowledge.version || 0) + 1;
  knowledge.sections = (knowledge.sections || []).filter((s) => s.id !== SECTION_ID);
  knowledge.sections.push(section);

  fs.writeFileSync(KNOWLEDGE_PATH, JSON.stringify(knowledge, null, 2) + '\n', 'utf8');

  const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
  const cardIds = section.cards.map((c) => c.id);
  map.readingByNav = map.readingByNav || {};
  map.readingByTopic = map.readingByTopic || {};
  map.readingByNav['ai-pm-kb'] = cardIds;
  map.readingByTopic['iv-pm'] = [...new Set([...(map.readingByTopic['iv-pm'] || []), ...cardIds.slice(0, 20)])];
  fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2) + '\n', 'utf8');

  console.log(`Merged ${section.cards.length} cards into knowledge.json (section ${SECTION_ID}, v${knowledge.version})`);
  console.log('Note: runtime uses', MD_FILENAME, 'directly; rebuild is optional.');
}

main();
