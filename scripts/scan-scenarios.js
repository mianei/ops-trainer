const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');
const files = fs.readdirSync(dir).filter(f => f.startsWith('scenarios') && f.endsWith('.json'));
const ok = /请|如何|怎么|你会|写|说明|介绍|判断|简述|对比|列举|若|是否|为什么|分析|论证|按|阐述|示范|解释|归纳|描述|概述|面试官|题目|口述|区分|列出|给出|各写|各举|各配|什么是|怎样|哪些|能否|要不要|从.*写|用「|用"/;
const badPat = /应能回答|应服务最高频|考察抗压与闭环：|训练：把|不放首屏：|是经典框架/;
const bad = [];
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  for (const [k, arr] of Object.entries(j)) {
    if (!Array.isArray(arr)) continue;
    arr.forEach((s, i) => {
      if (typeof s !== 'string') return;
      const t = s.replace(/^【[^】]+】/, '');
      if (badPat.test(s) || (!ok.test(t) && !s.includes('？'))) bad.push({ f, k, i, s });
    });
  }
}
console.log('count', bad.length);
bad.forEach(b => console.log(JSON.stringify(b)));
