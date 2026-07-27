/**
 * 将评测金标对齐到原创 AI PM 题库（替换搬来的题干与话术痕迹）
 * 运行: node scripts/resync-scoring-golden.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const bank = JSON.parse(fs.readFileSync(path.join(ROOT, 'interview-bank-ai-pm.json'), 'utf8'));
const goldenPath = path.join(ROOT, 'eval', 'scoring-golden.json');
const golden = JSON.parse(fs.readFileSync(goldenPath, 'utf8'));

const byId = Object.fromEntries(bank.questions.map(q => [q.id, q]));

/** 旧题号 → 新题号（语义相近映射；旧库已删除） */
const MAP = {
  1: 2,
  2: 9,
  3: 56,
  4: 12,
  5: 49,
  6: 29,
  7: 31,
  8: 11,
  104: 82,
  106: 17,
  109: 78,
  122: 87,
  135: 48
};

function scrubAnswer(ans) {
  return String(ans || '')
    .replace(/MindTraining/g, '本产品')
    .replace(/学伴平台/g, '垂直业务产品')
    .replace(/学伴/g, '垂直业务')
    .replace(/即梦/g, 'AIGC 创作工具')
    .replace(/匹配家教：理解需求→检索→发邀请→跟进/g, '多步业务办理：理解意图→查库→提交→跟进')
    .replace(/面试题库点评要引用面经/g, '企业知识问答要引用内部文档');
}

let mapped = 0;
for (const s of golden.samples) {
  const nextNum = MAP[s.bankNum] || ((s.bankNum - 1) % 100) + 1;
  const q = bank.questions.find(x => x.num === nextNum) || byId[`ai-pm-${String(nextNum).padStart(3, '0')}`];
  if (!q) continue;
  s.bankNum = q.num;
  s.bankId = q.id;
  s.scenario = q.text;
  s.answer = scrubAnswer(s.answer);
  mapped += 1;
}

golden.version = 3;
golden.description = 'CVassistant AI PM 业务场景点评评测集（对齐原创 interview-bank-ai-pm.json）';
golden.annotation = {
  ...golden.annotation,
  date: new Date().toISOString().slice(0, 10),
  note: (golden.annotation?.note || '') + '；2026-07-27 题干已切换为 CVassistant 原创题库'
};

fs.writeFileSync(goldenPath, JSON.stringify(golden, null, 2));
console.log('resync samples', mapped, '/', golden.samples.length);

const notePath = path.join(ROOT, 'eval', '评测集说明.md');
if (fs.existsSync(notePath)) {
  let md = fs.readFileSync(notePath, 'utf8');
  md = md.replace(
    /一个需求摆在面前，什么时候适合先调Prompt，什么时候该上RAG，什么时候已经需要Agent了？/g,
    bank.questions[1].text
  );
  fs.writeFileSync(notePath, md);
}
