/**
 * v2.0 评分一致性评测：AI 维度分 vs 人工标注 Spearman 相关
 * 运行: DEEPSEEK_API_KEY=xxx node scripts/eval-scoring.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PM_STRUCTURED_REVIEW_SUFFIX } from '../api/lib/pm-review.js';
import { parseStructuredReview } from '../api/lib/review-format.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const golden = JSON.parse(fs.readFileSync(path.join(__dirname, '../eval/scoring-golden.json'), 'utf8'));

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
  if (!parsed.ok) return null;
  const scores = {};
  for (const d of parsed.review.dimensions || []) {
    scores[d.name] = d.score;
  }
  return scores;
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

  const dims = golden.dimensions;
  const humanByDim = Object.fromEntries(dims.map(d => [d, []]));
  const aiByDim = Object.fromEntries(dims.map(d => [d, []]));
  const badcases = [];

  for (const sample of golden.samples) {
    process.stdout.write(`评分 ${sample.id}… `);
    const ai = await scoreWithAi(cfg, sample.scenario, sample.answer);
    if (!ai) {
      console.log('FAIL');
      continue;
    }
    let maxDiff = 0;
    for (const d of dims) {
      const h = sample.humanScores[d];
      const a = ai[d] ?? 3;
      humanByDim[d].push(h);
      aiByDim[d].push(a);
      maxDiff = Math.max(maxDiff, Math.abs(h - a));
    }
    console.log('ok', sample.level, 'Δmax', maxDiff.toFixed(1));
    if (maxDiff >= 2) badcases.push({ id: sample.id, level: sample.level, maxDiff });
  }

  console.log('\n=== Spearman 相关系数（AI vs 人工）===');
  const rhos = [];
  for (const d of dims) {
    const rho = spearman(humanByDim[d], aiByDim[d]);
    rhos.push(rho);
    console.log(`${d}: ${Number.isFinite(rho) ? rho.toFixed(3) : 'N/A'}`);
  }
  const avg = rhos.filter(Number.isFinite).reduce((a, b) => a + b, 0) / rhos.filter(Number.isFinite).length;
  console.log(`平均: ${avg.toFixed(3)}`);

  if (badcases.length) {
    console.log('\nBadcases (|diff|>=2):', badcases.map(b => b.id).join(', '));
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
