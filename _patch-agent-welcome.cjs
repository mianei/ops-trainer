const fs = require('fs');
const path = 'index.html';
let h = fs.readFileSync(path, 'utf8');

const OLD_DEFAULT = '全局 Agent 控制台：识别意图、调用工具。中间 Canvas 结果不满意，在此继续追问即可。';
const NEW_DEFAULT = '我可以帮你评分简历、优化表述、准备面试或换题练习。左边结果不满意，直接说你想怎么改。';

const OLD_KB = '知识库模式：知识卡在中间 Canvas；在此可追问概念解释，Agent 会识别意图并调用工具。';
const NEW_KB = '可以帮你查概念、解释知识点。阅读卡片时有不懂的，直接问我。';

const OLD_SUB = '发指令 · 看工具步骤 · 结果在 Canvas';
const NEW_SUB = '直接说需求 · 左边看结果 · 不满意继续聊';

const OLD_BADGE = '<span class="agent-nav-badge">控制台</span>';
const NEW_BADGE = '<span class="agent-nav-badge">随时问</span>';

if (!h.includes(OLD_DEFAULT)) throw new Error('default welcome text not found');
if (!h.includes(OLD_KB)) throw new Error('kb welcome text not found');

h = h.split(OLD_DEFAULT).join(NEW_DEFAULT);
h = h.split(OLD_KB).join(NEW_KB);
if (h.includes(OLD_SUB)) h = h.split(OLD_SUB).join(NEW_SUB);
if (h.includes(OLD_BADGE)) h = h.split(OLD_BADGE).join(NEW_BADGE);

fs.writeFileSync(path, h, 'utf8');
console.log('OK — agent welcome messages updated (user-facing)');
