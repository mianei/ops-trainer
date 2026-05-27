/**
 * 简易 golden set 评测：检查 RAG 检索是否命中期望知识卡
 * 运行: node scripts/eval-golden.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildChunksFromKnowledge, retrieveChunks } from '../api/lib/rag.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const knowledge = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledge.json'), 'utf8'));
const chunks = buildChunksFromKnowledge(knowledge);

const cases = [
  { scenario: '完课率12% 用户说太难', topicId: 'user', expect: ['true-demand-three', 'surface-vs-core'] },
  { scenario: '【OTA·决策】代理模式 vs 批发', topicId: 'decision', expect: ['ota-hotel-modes'] },
  { scenario: '【电商·数据】GMV涨利润降', topicId: 'data', expect: ['data-anomaly-debug', 'ecom-search-rank'] },
  { scenario: '【社区·决策】商业化不可能三角', topicId: 'iv-ops', expect: ['community-triangle'] },
  { scenario: '【知乎·决策】盐选故事会', topicId: 'decision', expect: ['zhihu-salt-tradeoff'] },
  { scenario: '【小红书·数据】CES高GMV低', topicId: 'data', expect: ['community-ces', 'xhs-decision-engine'] },
  { scenario: '【抖音·决策】本地推 vs 补贴', topicId: 'decision', expect: ['douyin-local-push', 'douyin-vs-meituan'] },
  { scenario: '【AI·数据】RAG采纳率下降', topicId: 'iv-pm', expect: ['aigc-rag-debug-layers'] }
];

let pass = 0;
for (const c of cases) {
  const hit = retrieveChunks(chunks, { scenario: c.scenario, answer: '', topicId: c.topicId });
  const ids = hit.map((h) => h.id);
  const ok = c.expect.some((id) => ids.includes(id));
  console.log(ok ? '✓' : '✗', c.scenario.slice(0, 40), '→', ids.join(', '));
  if (ok) pass++;
}
console.log(`\n${pass}/${cases.length} passed`);
process.exit(pass === cases.length ? 0 : 1);
