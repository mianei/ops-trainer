/**
 * 简易 golden set 评测：检查 RAG 检索是否命中期望知识卡
 * 运行: node scripts/eval-golden.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildChunksFromKnowledge, retrieveChunks } from '../lib/rag.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const knowledge = JSON.parse(fs.readFileSync(path.join(__dirname, '../knowledge.json'), 'utf8'));
const chunks = buildChunksFromKnowledge(knowledge);

const cases = [
  { scenario: '完课率12% 用户说太难', topicId: 'user', expect: ['true-demand-three', 'surface-vs-core'] },
  { scenario: '【OTA·决策】代理模式 vs 批发', topicId: 'decision', expect: ['ota-hotel-modes'] },
  { scenario: '【电商·数据】GMV涨利润降', topicId: 'data', expect: ['data-anomaly-debug', 'renhuochang-analysis'] },
  { scenario: '【社区·决策】商业化不可能三角', topicId: 'iv-ops', expect: ['community-triangle'] },
  { scenario: '【面经·数据】DAU 单日下降 15%', topicId: 'data', expect: ['impact-coefficient', 'data-anomaly-debug'] },
  { scenario: '【面经·竞品】四层法对比两款 App', topicId: 'competitor', expect: ['competitor-four-layers', 'competitor-analysis'] },
  { scenario: '【面经·运营】活动复盘闭环', topicId: 'iv-ops', expect: ['activity-review-loop', 'renhuochang-analysis'] },
  { scenario: '【面经·AI】大模型输出三层约束', topicId: 'iv-pm', expect: ['llm-output-constraints', 'ai-project-four-steps'] },
  { scenario: '【面经·运营】GMV 下降拆解', topicId: 'iv-ops', expect: ['gmv-decomposition'] },
  { scenario: '【面经·数据】商品详情页 A/B 测试', topicId: 'data', expect: ['ab-test-design-pm', 'ab-test-basics', 'ab-traffic-layers'] },
  { scenario: '【面经·变现】直播电商 vs 货架电商', topicId: 'biz-monetize', expect: ['arpu-ltv-dau', 'ecom-shelf-vs-content'] }
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
