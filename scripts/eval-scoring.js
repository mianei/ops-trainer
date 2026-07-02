/**
 * v2.0 评分一致性评测：AI 维度分 vs 人工标注 Spearman 相关
 * 运行: DEEPSEEK_API_KEY=xxx node scripts/eval-scoring.js
 * 可选: EVAL_TRACE=1（默认开启）写入 eval/traces/run-<timestamp>.jsonl
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PM_STRUCTURED_REVIEW_SUFFIX } from '../lib/pm-review.js';
import { parseStructuredReview } from '../lib/review-format.js';
import {
  newTraceId,
  extractTokenUsage,
  detectBadcase,
  buildTraceTurn,
  appendTraceJsonl,
  summarizeBadcases
} from '../lib/observation-trace.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, '../eval/scoring-golden.json'), 'utf8'));
const TRACE_ENABLED = (process.env.EVAL_TRACE ?? '1').trim() !== '0';
const TRACE_DIR = path.join(__dirname, '../eval/traces');

function spearman(x, y) {
  const n = x.length;
  if (n < 2) return NaN;
  const rank = (arr) => {
    const sorted = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(n);
    sorted.forEach(([_, i], ri) => { r[i] = ri + 1; });
    return r;
  };
  const rx = rank(x);
  const ry = rank(y);
  const d2 = rx.reduce((s, ri, i) => s + (ri - ry[i]) ** 2, 0);
  return 1 - (6 * d2) / (n * (n ** 2 - 1));
}

async function scoreWithAi(cfg, scenario, answer) {
  const system = '你是产品经理面试考官，按维度 1-5 打分。' + PM_STRUCTURED_REVIEW_SUFFIX;
  const user = `题目：${scenario}\n\n学员回答：${answer}\n\n请输出 JSON 点评。`;
  const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      max_tokens: 1200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';
  const parsed = parseStructuredReview(text);
  const tokens = extractTokenUsage(data);
  if (!parsed.ok) {
    return { ok: false, text, tokens, error: 'parse_failure' };
  }
  const scores = {};
  for (const d of parsed.review.dimensions || []) {
    scores[d.name] = d.score;
  }
  return {
    ok: true,
    text,
    tokens,
    scores,
    rubricAvg: parsed.review.dimensions?.length
      ? Math.round((parsed.review.dimensions.reduce((s, d) => s + d.score, 0) / parsed.review.dimensions.length) * 10) / 10
      : null,
    structured: parsed.review
  };
}

async function main() {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) {
    console.log('未设置 DEEPSEEK_API_KEY，仅输出人工标注统计：');
    const byLevel = {};
    for (const s of golden.samples) {
      byLevel[s.level] = (byLevel[s.level] || 0) + 1;
    }
    console.log('样本', golden.samples.length, 'byLevel', byLevel);
    process.exit(0);
  }

  const cfg = {
    apiKey: key,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  };

  const runId = `eval-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  const traceFile = path.join(TRACE_DIR, `${runId}.jsonl`);
  if (TRACE_ENABLED && !fs.existsSync(TRACE_DIR)) fs.mkdirSync(TRACE_DIR, { recursive: true });

  const dims = golden.dimensions;
  const humanByDim = Object.fromEntries(dims.map(d => [d, []]));
  const aiByDim = Object.fromEntries(dims.map(d => [d, []]));
  const traceRecords = [];
  let turn = 0;

  for (const sample of golden.samples) {
    turn += 1;
    process.stdout.write(`评分 ${sample.id}… `);
    let aiResult;
    try {
      aiResult = await scoreWithAi(cfg, sample.scenario, sample.answer);
    } catch (e) {
      aiResult = { ok: false, error: e.message, tokens: null };
    }

    const humanScores = sample.humanScores;
    let aiScores = null;
    let maxDiff = 0;

    if (aiResult.ok) {
      aiScores = aiResult.scores;
      for (const d of dims) {
        const h = humanScores[d];
        const a = aiScores[d] ?? 3;
        humanByDim[d].push(h);
        aiByDim[d].push(a);
        maxDiff = Math.max(maxDiff, Math.abs(h - a));
      }
      console.log('ok', sample.level, 'Δmax', maxDiff.toFixed(1));
    } else {
      console.log('FAIL', aiResult.error || 'parse');
    }

    const badcase = detectBadcase({
      humanScores,
      aiScores,
      dimensions: dims,
      parseOk: aiResult.ok,
      error: aiResult.error
    });

    if (TRACE_ENABLED) {
      const record = buildTraceTurn({
        traceId: newTraceId(),
        runId,
        turn,
        source: 'eval-scoring',
        sampleId: sample.id,
        userAnswer: sample.answer,
        context: {
          scenario: sample.scenario,
          level: sample.level,
          type: sample.type,
          tags: sample.tags,
          rubric: golden.dimensionGuide,
          dimensions: dims,
          systemPromptSuffix: PM_STRUCTURED_REVIEW_SUFFIX.slice(0, 500)
        },
        result: {
          parseOk: aiResult.ok,
          scores: aiScores,
          rubricAvg: aiResult.rubricAvg ?? null,
          rawText: aiResult.text ? String(aiResult.text).slice(0, 2000) : null,
          error: aiResult.error || null
        },
        golden: { humanScores },
        badcase,
        tokens: aiResult.tokens,
        meta: { maxDiff, model: cfg.model }
      });
      appendTraceJsonl(traceFile, record, fs);
      traceRecords.push(record);
    }
  }

  console.log('\n=== Spearman 相关系数（AI vs 人工）===');
  const rhos = [];
  for (const d of dims) {
    const rho = spearman(humanByDim[d], aiByDim[d]);
    rhos.push(rho);
    console.log(`${d}: ${Number.isFinite(rho) ? rho.toFixed(3) : 'N/A'}`);
  }
  const finite = rhos.filter(Number.isFinite);
  const avg = finite.length ? finite.reduce((a, b) => a + b, 0) / finite.length : NaN;
  console.log(`平均: ${Number.isFinite(avg) ? avg.toFixed(3) : 'N/A'}`);

  const badSummary = summarizeBadcases(traceRecords);
  if (badSummary.length) {
    console.log(`\n=== Badcases (${badSummary.length}) ===`);
    for (const b of badSummary) {
      console.log(`  ${b.sampleId}  reasons=${b.reasons.join(',')}  Δmax=${b.maxDimensionDelta ?? '?'}`);
    }
  }

  if (TRACE_ENABLED) {
    console.log(`\nTrace 已写入: ${traceFile}`);
    console.log(`聚合 token: node scripts/aggregate-tokens.js --dir eval/traces --badcases`);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
