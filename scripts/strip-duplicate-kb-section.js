/** 从 knowledge.json 移除 ai-pm-interview-kb（运行时由 md 提供） */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SECTION_ID } from '../lib/ai-pm-interview-kb.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const KNOWLEDGE_PATH = path.join(ROOT, 'knowledge.json');
const MAP_PATH = path.join(ROOT, 'knowledge-map.json');

const knowledge = JSON.parse(fs.readFileSync(KNOWLEDGE_PATH, 'utf8'));
const before = knowledge.sections?.length || 0;
knowledge.sections = (knowledge.sections || []).filter((s) => s.id !== SECTION_ID);
if (knowledge.sections.length < before) {
  knowledge.version = (knowledge.version || 0) + 1;
  fs.writeFileSync(KNOWLEDGE_PATH, JSON.stringify(knowledge, null, 2) + '\n', 'utf8');
  console.log('Removed', SECTION_ID, 'from knowledge.json, v' + knowledge.version);
} else {
  console.log('Section already absent');
}

const map = JSON.parse(fs.readFileSync(MAP_PATH, 'utf8'));
delete map.readingByNav?.['ai-pm-kb'];
if (map.readingByTopic?.['iv-pm']) {
  map.readingByTopic['iv-pm'] = map.readingByTopic['iv-pm'].filter((id) => !String(id).startsWith('aipm-'));
}
fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2) + '\n', 'utf8');
console.log('Cleaned knowledge-map.json');
