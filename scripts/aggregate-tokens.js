/**
 * Token usage aggregation from eval trace JSONL files (and optional Upstash).
 * Usage:
 *   node scripts/aggregate-tokens.js
 *   node scripts/aggregate-tokens.js --period week
 *   node scripts/aggregate-tokens.js --period month --dir eval/traces
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  readTracesFromDir,
  aggregateTokensFromTraces,
  summarizeBadcases,
  aggregateTokensFromStore
} from '../lib/observation-trace.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const opts = { period: 'day', dir: path.join(__dirname, '../eval/traces'), badcases: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--period' && argv[i + 1]) opts.period = argv[++i];
    else if (argv[i] === '--dir' && argv[i + 1]) opts.dir = argv[++i];
    else if (argv[i] === '--badcases') opts.badcases = true;
    else if (argv[i] === '--help') opts.help = true;
  }
  return opts;
}

function printBuckets(label, buckets) {
  console.log(`\n=== ${label} ===`);
  if (!buckets.length) {
    console.log('（无数据）');
    return;
  }
  let totalPrompt = 0;
  let totalCompletion = 0;
  let totalTokens = 0;
  let totalRequests = 0;
  for (const b of buckets) {
    const key = b.date || b.weekStart || b.month;
    console.log(
      `${key}  requests=${b.requests}  prompt=${b.prompt}  completion=${b.completion}  total=${b.total}`
    );
    totalPrompt += b.prompt;
    totalCompletion += b.completion;
    totalTokens += b.total;
    totalRequests += b.requests;
  }
  console.log(`\n合计: ${totalRequests} 次请求, ${totalTokens} tokens (prompt ${totalPrompt}, completion ${totalCompletion})`);
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log(`用法: node scripts/aggregate-tokens.js [--period day|week|month] [--dir eval/traces] [--badcases]`);
    process.exit(0);
  }

  const records = readTracesFromDir(opts.dir, fs, path);
  console.log(`读取 ${records.length} 条 trace（${opts.dir}）`);

  const buckets = aggregateTokensFromTraces(records, opts.period);
  printBuckets(`Token 聚合 · ${opts.period}`, buckets);

  if (opts.badcases) {
    const bad = summarizeBadcases(records);
    console.log(`\n=== Badcase 汇总 (${bad.length}) ===`);
    for (const b of bad) {
      console.log(`${b.sampleId || b.traceId}  turn=${b.turn}  reasons=${b.reasons.join(',')}`);
    }
  }

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const remote = await aggregateTokensFromStore({ period: opts.period, days: 90 });
    if (remote.ok && remote.buckets?.length) {
      printBuckets(`Upstash Token 聚合 · ${opts.period}`, remote.buckets);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
