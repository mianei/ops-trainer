import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const promptsPath = join(root, 'api', 'lib', 'coach-prompts.js');
const source = readFileSync(promptsPath, 'utf8');

if (/from\s+['"]node:fs['"]/.test(source) || /readFileSync/.test(source)) {
  throw new Error('coach-prompts.js must not import or use fs (Vercel-safe)');
}

const prompts = await import(pathToFileURL(promptsPath).href);
const coach = await import(pathToFileURL(join(root, 'api', 'coach.js')).href);

const actionPrompt = prompts.buildActionCoachSystemPrompt('resume-score');
if (!actionPrompt || actionPrompt.length < 200) {
  throw new Error('buildActionCoachSystemPrompt returned empty or too short');
}
if (!/评分/.test(actionPrompt)) {
  throw new Error('action prompt missing expected content');
}
if (typeof coach.default !== 'function') {
  throw new Error('coach handler not exported');
}

console.log('import ok (no fs), action prompt length:', actionPrompt.length);
