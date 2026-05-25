#!/usr/bin/env node
/** 将框架式/陈述式场景题改为清晰面试提问 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..');

const REPLACEMENTS = [
  [
    '【面试·Q11·本质向】真需求应能回答：解决谁的什么痛点、带来什么可衡量收益、能否用通用能力而非一次性定制解决？',
    '【面试·Q11·本质向】面试官问：如何区分真需求与伪需求？请用下面三个问题逐条回答（各举 1 个例子）：①解决谁的什么痛点 ②带来什么可衡量收益 ③能否用通用能力而非一次性定制解决。'
  ],
  [
    '【面试·深度·Q82】朋友圈不放首屏：首屏应服务最高频核心需求；朋友圈是「拉」式浏览，放首屏会增加 IM 场景噪声。',
    '【面试·深度·Q82】面试官问：微信朋友圈为什么不做首屏入口？请从 IM 核心定位、消息降噪、使用频率与社交压力、发现页导流使命四角度作答。'
  ],
  [
    '【面试·Q5】考察抗压与闭环：困难—压力点—具体行动—结果—T+1 复盘（下次同类问题检查清单 3 条）。',
    '【面试·Q5】请描述你遇到的最大困难之一，并按结构回答：困难是什么 → 压力点 → 你做了什么 → 结果 → T+1 复盘（下次如何避免，列 3 条检查项）。'
  ],
  [
    '【面试·Q5】训练：把「核心城市手工校准 + 非核心降级」换成你自己业务场景的同等结构，勿照抄范文。',
    '【面试·Q5】请把「核心城市手工校准 + 非核心降级」迁移到你自己熟悉的业务：写出等价的风险分级与降级方案（勿照抄范文）。'
  ],
  [
    '【面试·Q12】从 0 运营内容账号：选题方法、对标爆款、质量与偏好迭代、结果数据（粉丝/爆款）—强调过程而非结果数字 alone。',
    '【面试·Q12】请介绍一个你从 0 运营内容账号的经历（可合理虚构）：选题方法、对标爆款、质量迭代、结果数据各 1 句，重点写过程而非只报粉丝数。'
  ],
  [
    '【面试·Q12】面试官要的是「方法论」而非才艺：用 hobby 举例时，写你如何把目标拆成可执行步骤（练习—复盘—外部输入），并映射到产品工作。',
    '【面试·Q12】面试官问：如何用 hobby 证明你有产品方法论？请写：目标拆解步骤（练习—复盘—外部输入）+ 如何映射到 PM 工作。'
  ],
  [
    '【地图·本地生活】短视频入局本地生活的动机：市场潜力、内容+线下闭环、广告收入结构单一需多元化。',
    '【地图·本地生活】面试官问：短视频平台为什么要做本地生活？请从市场潜力、内容线下闭环、广告收入多元化三点分析。'
  ],
  [
    '【面试·深度】应用商店发行游戏：优点（流量转化、安装门槛低）与缺点（渠道成本、用户分散到渠道服）各 2 点。',
    '【面试·深度】请分析：游戏通过应用商店发行的优缺点各 2 点（流量转化/安装门槛 vs 渠道成本/用户分散）。'
  ],
  [
    '【面试·深度】社区产品的 4 个作用：互动闭环留存、活跃玩法、行为反馈优化、强化心智—举 1 个你见过的例子。',
    '【面试·深度】请说明社区产品常见的 4 类作用（互动留存/活跃玩法/行为反馈/强化心智），并各举 1 个你见过的产品例子。'
  ],
  [
    '【面试·深度】电商推荐仍推已购商品：可能原因（特征滞后、缺乏负反馈、探索不足）与 2 个改进策略。',
    '【面试·深度】用户抱怨「已购商品仍被推荐」。请分析 3 个可能原因，并提出 2 条可落地的改进策略。'
  ],
  [
    '【面试·深度】已购商品仍被推荐：除策略失效外，分析「标签脏数据」与「干预只在排序末段、未从召回剔除」两种机制原因，各给 1 个修复思路。',
    '【面试·深度】已购商品仍被推荐：请从「标签脏数据」与「只在排序干预、未从召回剔除」两种机制分析原因，并各给 1 个修复思路。'
  ],
  [
    '【面试·深度】电商 vs 内容推荐异同：用户画像更新频率、排序依据（销量规则 vs 行为算法）、召回（物品协同 vs 用户协同）；相同点：都要平衡用户与内容双侧。',
    '【面试·深度】请对比电商推荐与内容推荐的异同：画像更新、排序逻辑、召回策略各 1 点；并说明两者都要平衡哪「双侧」。'
  ],
  [
    '【面试·产品设计·Q92】朋友圈广告克制、视频号商业化快：从私域社交厌恶、公域刷视频容忍度、腾讯广告增长使命三角解释。',
    '【面试·产品设计·Q92】面试官问：为什么朋友圈广告克制，而视频号商业化更快？请从私域社交厌恶、公域刷视频容忍度、广告增长使命三角解释。'
  ]
];

function normalizeScenario(text) {
  if (typeof text !== 'string') return text;
  for (const [from, to] of REPLACEMENTS) {
    if (text === from) return to;
  }
  const tag = text.match(/^【[^】]+】/)?.[0] || '';
  const body = text.slice(tag.length).trim();
  if (/。设计\s*\d+/.test(body) && !/^请/.test(body)) {
    const parts = body.split(/。设计\s*/);
    if (parts.length === 2) {
      return tag + (parts[0].startsWith('背景') ? parts[0] : '背景：' + parts[0]) + '。请设计 ' + parts[1].replace(/^请/, '');
    }
  }
  const hasAsk = /(?:^|[。；]\s*)请|如何|怎么|你会|为什么|是否|介绍|描述|判断|分析|写|说明|面试官问|题目|口述|区分|列举|给出|各写|各举|若|怎样|哪些|能否|要不要|论证|解释|归纳|对比|简述|从.*写/.test(body);
  if (hasAsk || body.includes('？')) return text;
  if (/作为.{2,12}负责人/.test(body) && !hasAsk) {
    return tag + '假设你' + body.replace(/^作为/, '作为') + '。请按题目要求分点作答。';
  }
  if (/设计\s*\d+/.test(body) && !hasAsk) {
    return tag + '请' + body.replace(/^请/, '');
  }
  if (/：[^：]{8,}[。.]?$/.test(body) && !body.includes('？') && !hasAsk) {
    const head = body.split('：')[0];
    const tail = body.slice(head.length + 1);
    return tag + '请回答「' + head + '」：' + tail.replace(/[。.]$/, '') + '。';
  }
  if (/^[\u4e00-\u9fa5A-Za-z0-9「」\-—：、；，（）]+[。；]$/.test(body) && body.length < 120) {
    return tag + '请阅读以下背景并回答：' + body.replace(/[。；]$/, '') + '？请说明你的观点与理由。';
  }
  return text;
}

let changed = 0;
const files = fs.readdirSync(dir).filter(f => f.startsWith('scenarios') && f.endsWith('.json'));
for (const f of files) {
  const fp = path.join(dir, f);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  let fileChanged = false;
  for (const [key, arr] of Object.entries(data)) {
    if (!Array.isArray(arr)) continue;
    for (let i = 0; i < arr.length; i++) {
      const next = normalizeScenario(arr[i]);
      if (next !== arr[i]) {
        arr[i] = next;
        changed++;
        fileChanged = true;
      }
    }
  }
  if (fileChanged) fs.writeFileSync(fp, JSON.stringify(data, null, 2) + '\n', 'utf8');
}
console.log('Updated scenarios:', changed);
