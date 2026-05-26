#!/usr/bin/env node
/** 扫描 scenarios：知识当题、缺少明确提问 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');

const knowledgePat = /应能回答|应服务最高频|考察抗压|训练：把|不放首屏：|是经典框架/;
const askPat = /请|如何|怎么|你会|为什么|是否|介绍|描述|判断|分析|写|说明|面试官问|口述|区分|列举|给出|各写|各举|若|怎样|哪些|能否|要不要|论证|解释|归纳|对比|简述|列出|写出|各\s*[\d一二三四五六七八九十]+|示范|阐述|设计\s*\d/;

const files = fs.readdirSync(dir).filter((f) => f.startsWith('scenarios') && f.endsWith('.json'));
const items = [];

for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const [topicId, arr] of Object.entries(j)) {
    if (!Array.isArray(arr)) continue;
    arr.forEach((s, i) => {
      if (typeof s !== 'string') return;
      const body = s.replace(/^【[^】]+】/, '').trim();
      const hasQ = body.includes('？') || askPat.test(body);
      let issue = null;
      if (knowledgePat.test(s)) issue = 'knowledge-as-prompt';
      else if (!hasQ && body.length > 12) issue = 'missing-clear-question';
      else if (/：[^：]{8,}[。.；]$/.test(body) && !hasQ) issue = 'colon-statement';
      if (issue) items.push({ issue, file: f, topicId, index: i, text: s });
    });
  }
}

const by = {};
items.forEach((x) => {
  by[x.issue] = (by[x.issue] || 0) + 1;
});

console.log('# Content audit report');
console.log('Total flagged:', items.length);
console.log('By type:', by);
console.log('');
items.forEach((x) => {
  console.log(`[${x.issue}] ${x.file} · ${x.topicId} · #${x.index}`);
  console.log('  ' + x.text.slice(0, 120) + (x.text.length > 120 ? '…' : ''));
  console.log('');
});
