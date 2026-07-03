/**
 * Vercel build hook：校验根目录 ai-pm-interview-knowledge.md 可解析，无需重建 knowledge.json
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MD_FILENAME, buildSectionFromMd } from '../lib/ai-pm-interview-kb.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const mdPath = path.join(ROOT, MD_FILENAME);

if (!fs.existsSync(mdPath)) {
  console.error('Missing', MD_FILENAME, 'at project root');
  process.exit(1);
}

const section = buildSectionFromMd(fs.readFileSync(mdPath, 'utf8'));
if (!section?.cards?.length) {
  console.error('No cards parsed from', MD_FILENAME);
  process.exit(1);
}

console.log(`OK: ${section.cards.length} cards in ${MD_FILENAME} (runtime source of truth)`);
