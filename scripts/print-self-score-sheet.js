/**
 * 打印自评清单：找不到同学标注时，按 rubric 自己过一遍并核对 humanScores
 * 运行: node scripts/print-self-score-sheet.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const golden = JSON.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../eval/scoring-golden.json'), 'utf8')
);

console.log('# 评测集自评清单（无需外部标注人）\n');
console.log('用法：每题通读 answer，按 dimensionGuide 打 1–5 分，与 humanScores 对比。\n');
console.log('隔 3 天对 5 题重标一次，两次差 ≤1 分视为自洽。\n');

for (const g of golden.dimensionGuide ? Object.entries(golden.dimensionGuide) : []) {
  console.log(`- **${g[0]}**：${g[1]}`);
}
console.log('');

for (const s of golden.samples) {
  console.log('---');
  console.log(`${s.id} · ${s.level} · ${s.type}`);
  console.log(`题：${s.scenario}`);
  console.log(`答：${s.answer.slice(0, 120)}…`);
  console.log('当前 humanScores:', JSON.stringify(s.humanScores));
  console.log('你的自评（填后写入 notes 或改 json）: 逻辑__ 专业__ 流畅__ 匹配__ 密度__');
  console.log('');
}

console.log('跑 AI 对比: DEEPSEEK_API_KEY=xxx node scripts/eval-scoring.js');
