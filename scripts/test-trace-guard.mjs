import { detectBadcase, buildTraceTurn, aggregateTokensFromTraces } from '../lib/observation-trace.js';
import { guardCoachHistory, guardFollowupHistory, getGuardConfig } from '../lib/context-guard.js';

const dims = ['逻辑性', '专业性'];
const bc = detectBadcase({
  humanScores: { 逻辑性: 5, 专业性: 3 },
  aiScores: { 逻辑性: 2, 专业性: 3 },
  dimensions: dims,
  parseOk: true
});
console.log('badcase reasons:', bc?.reasons?.join(','));

const cfg = getGuardConfig({ turnThreshold: 3, keepRecentTurns: 2 });
const hist = Array.from({ length: 5 }, (_, i) => ({
  role: i % 2 ? 'user' : 'assistant',
  content: 'msg' + i
}));
const g = guardCoachHistory(hist, { targetRole: 'AI PM' }, cfg);
console.log('coach guard compressed:', g.compressed, 'messages:', g.history.length);

const fh = Array.from({ length: 5 }, (_, i) => ({ q: 'q' + i, a: 'a' + i }));
const fg = guardFollowupHistory(fh, cfg);
console.log('followup guard compressed:', fg.compressed, 'turns:', fg.history.length);

const rec = buildTraceTurn({
  runId: 'test',
  source: 'test',
  at: new Date().toISOString(),
  tokens: { prompt: 10, completion: 20, total: 30 }
});
console.log('trace id:', rec.traceId);
console.log('token buckets:', aggregateTokensFromTraces([rec]).length);
