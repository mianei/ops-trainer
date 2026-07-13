#!/usr/bin/env node
/**
 * 将 ops-trainer / cvassistant 主仓的业务更新同步到开源镜像 cvassistantai。
 *
 * 用法:
 *   node scripts/sync-to-cvassistantai.mjs
 *   CVASSISTANTAI_DIR=../cvassistantai node scripts/sync-to-cvassistantai.mjs
 *
 * 同步后进入目标目录 commit & push:
 *   cd ../cvassistantai && git add -A && git commit -m "Sync from ops-trainer" && git push
 */
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TARGET = resolve(process.env.CVASSISTANTAI_DIR || join(ROOT, '..', 'cvassistantai'));

/** 从主仓覆盖到 cvassistantai 的路径（相对仓库根） */
const COPY_PATHS = [
  'index.html',
  'agent-intent.browser.js',
  'favicon.svg',
  'logo-dark.png',
  'logo-light.png',
  'logo-dark.svg',
  'logo-light.svg',
  'vercel.json',
  'ai-pm-interview-knowledge.md',
  'knowledge.json',
  'knowledge-map.json',
  'interview-bank-v2.json',
  'interview-bank-ai-pm.json',
  'interview-bank-ai-pm-curated.json',
  'interview-rag-feed.json',
  'topics-interview.json',
  'topics.json',
  'topics-map.json',
  'topics-biz.json',
  'topics-sql.json',
  'scenarios-interview-pm.json',
  'scenarios-interview-open.json',
  'scenarios-interview-misc.json',
  'scenarios-interview-skills.json',
  'scenarios-interview-biz.json',
  'scenarios-interview-ops.json',
  'scenarios-industry-ecommerce.json',
  'scenarios-industry-community.json',
  'scenarios-industry-map.json',
  'scenarios-industry-ota.json',
  'scenarios-industry-instant-retail.json',
  'scenarios-platform-content.json',
  'scenarios-pm-debrief.json',
  'scenarios-pm-product-batch3.json',
  'scenarios-web-curated.json',
  'scenarios-web-curated-batch2.json',
  'scenarios-sql-practice.json',
  'scenarios-extra.json',
  'lib/agent-context.js',
  'lib/agent-intent.js',
  'lib/ai-pm-interview-kb.js',
  'lib/analyze-tool.js',
  'lib/coach-actions.js',
  'lib/coach-modes.js',
  'lib/coach-prompts.js',
  'lib/context-guard.js',
  'lib/interview-prep-parse.js',
  'lib/interview-search.js',
  'lib/observation-trace.js',
  'lib/pm-review.js',
  'lib/prompt-route.js',
  'lib/rag.js',
  'lib/resume-optimize-parse.js',
  'lib/resume-score-dims.js',
  'lib/resume-score-parse.js',
  'lib/review-format.js',
  'lib/scenario-generate.js',
  'lib/store.js',
  'lib/transcribe-tool.js',
  'lib/usage-stats.js',
  'lib/user-profile.js',
  'api/ai-pm-interview-kb.js',
  'api/intent.js',
  'scripts/build-agent-intent-browser.js'
];

/** 目标仓保留不动（BYOK 开源版专用） */
const PRESERVE_IN_TARGET = new Set([
  'README.md',
  'package.json',
  '.env.example',
  'lib/llm-config.js',
  'lib/llm-client.js',
  'scripts/smoke.js',
  'api/chat.js',
  'api/coach.js',
  'api/plan.js',
  'api/records.js'
]);

function ensureTargetRepo() {
  if (existsSync(join(TARGET, '.git'))) return;
  console.log(`Cloning cvassistantai → ${TARGET}`);
  mkdirSync(TARGET, { recursive: true });
  execSync('git clone https://github.com/mianei/cvassistantai.git .', {
    cwd: TARGET,
    stdio: 'inherit'
  });
}

function patchCoachActionsForMirror() {
  const coachActionsPath = join(TARGET, 'lib/coach-actions.js');
  if (!existsSync(coachActionsPath)) return;
  let text = readFileSync(coachActionsPath, 'utf8');
  if (!text.includes('detailSupplements')) {
    text = text.replace(/evalBadcase/g, 'detailSupplements');
    writeFileSync(coachActionsPath, text);
    console.log('patched lib/coach-actions.js (detailSupplements)');
  }
}

function main() {
  ensureTargetRepo();
  let copied = 0;
  let skipped = 0;
  for (const rel of COPY_PATHS) {
    if (PRESERVE_IN_TARGET.has(rel)) {
      skipped++;
      continue;
    }
    const src = join(ROOT, rel);
    const dest = join(TARGET, rel);
    if (!existsSync(src)) {
      console.warn(`skip missing source: ${rel}`);
      continue;
    }
    mkdirSync(dirname(dest), { recursive: true });
    cpSync(src, dest);
    copied++;
  }
  patchCoachActionsForMirror();
  console.log(`sync ok → ${TARGET}`);
  console.log(`copied ${copied} paths, preserved ${skipped} BYOK-specific files`);
  console.log('\nNext:');
  console.log(`  cd "${TARGET}"`);
  console.log('  git status');
  console.log('  git add -A && git commit -m "Sync features from ops-trainer" && git push');
}

main();
