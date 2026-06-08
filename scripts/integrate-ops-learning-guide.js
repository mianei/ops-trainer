/**
 * 整合《简历优化_运营学习指南》为知识库章节 + 运营向 SQL 入门
 * 运行: node scripts/integrate-ops-learning-guide.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(__dirname, '../knowledge.json');
const existing = JSON.parse(fs.readFileSync(target, 'utf8'));
const existingIds = new Set();
for (const sec of existing.sections || []) {
  for (const c of sec.cards || []) existingIds.add(c.id);
}

const newSections = [
  {
    id: 'ops-learning-guide',
    title: '运营学习指南（体系课）',
    cat: 'ops',
    cards: [
      {
        id: 'guide-metrics-core',
        title: '规模与粘性：DAU / MAU / DAU÷MAU',
        tags: ['运营', '指标', '入门'],
        body:
          '**DAU**：当日打开/使用去重用户数，看「今天有多热」。\n**MAU**：近 30 日活跃去重，看「月盘子」。\n**DAU/MAU**：粘性，越高说明月活里天天来的人越多（社交/内容常 30%+，工具类偏低要警惕）。\n\n**异常排查顺序**：① 口径/埋点是否变 ② 分端/分渠道 ③ 外部事件（节假日/竞品）④ 运营动作（push/活动）⑤ 产品版本。\n\n面试表达：先说指标定义与观察窗口，再说你做的动作与结果（基线→结果）。'
      },
      {
        id: 'guide-retention-benchmarks',
        title: '留存率：次留 / 7留 / 30留怎么理解',
        tags: ['运营', '留存', '指标'],
        body:
          '**次日留存** = D+1 仍活跃 ÷ D 日新增。参考：>40% 较好，20–40% 需优化，<20% 要查产品价值。\n**7 日留存**、**30 日留存**同理拉长窗口。\n\n**留存曲线形态**（比单点更重要）：\n- **微笑曲线**：前期跌后回升 → 习惯养成（微信/Keep 类）\n- **一路下滑**：首日就没留住 → 查核心价值\n- **阶梯下降后走平**：常见健康态\n- **周期性波动**：周末/开学季等产品要分周期看\n\n案例口径：教育类 7 留 35%、长周期用户 30 日回访 70%+ 可写进项目。'
      },
      {
        id: 'guide-conversion-ltv',
        title: '转化漏斗 · ARPU · LTV / CAC',
        tags: ['运营', '转化', '商业化'],
        body:
          '**转化漏斗**：把「曝光→点击→下单→支付」每步算转化率，找**掉量最大的一步**优先优化（常配合 A/B）。\n\n**ARPU** = 总收入 ÷ 总用户；**ARPPU** = 总收入 ÷ 付费用户。\n**LTV** ≈ 平均生命周期（月）× 月 ARPU；**CAC** = 营销总花费 ÷ 新增用户。\n\n**LTV/CAC**：<1 亏钱；1–3 勉强；3–5 健康；>5 有放大空间（要结合回本周期与现金流）。\n\n面试忌只背公式，要说：你优化了哪一步漏斗、LTV/CAC 从多少到多少、观察了多久。'
      },
      {
        id: 'guide-acquisition-channels',
        title: '获客渠道全景（怎么选）',
        tags: ['运营', '增长', '渠道'],
        body:
          '按成本与可控性粗分：\n\n**自然/内容**：SEO、ASO、自媒体/小红书/抖音内容——适合长期、可沉淀。\n**付费**：信息流、搜索、开屏——要盯 ROI/CPA。\n**裂变/社交**：拼团、助力、分销——适合低客单、强社交产品。\n**线下/BD**：地推、校园、异业——教育/本地生活常见。\n\n选型三问：① 目标用户在哪 ② 单用户 CAC 能否承受 ③ 能否做归因与迭代。案例：校园地推拿家长线索 + 老带新降 CAC + 内容号占自然量 40%。'
      },
      {
        id: 'guide-aarrr-leaks',
        title: 'AARRR 与「漏桶」思维',
        tags: ['运营', '增长', 'AARRR'],
        body:
          '**A** 获取 · **A** 激活 · **R** 留存 · **R** 收入 · **R** 推荐。\n\n常见误区：只砸拉新，激活/留存没修好 → 漏桶。正确顺序往往是：**先证明核心价值（激活+次留）再放大获客**。\n\n**激活（Onboarding）**：让用户尽快到达 **Aha Moment**（如「找到合适老师并完成首次预约」）。好的引导：价值前置、步骤少、即时反馈、少填表。\n\n增长投放看 **ROI、CPA、留存、ARPU**，小预算试渠道再放量。'
      },
      {
        id: 'guide-user-tier-recall',
        title: '用户分层促活（别一套 Push 打全员）',
        tags: ['运营', '促活', '分层'],
        body:
          '按活跃分层，策略不同：\n\n**高活**：权益/荣誉/内测、社群、榜单——维护忠诚度。\n**中活**：任务、签到、内容 push、简化路径。\n**低活/沉默**：券/礼包、降价提醒、流失预警（卸载前触达）。\n**流失**：短信/邮件/大促召回，强调「你错过什么」。\n\n原则：高活少打扰，低活给理由回来；所有触达要可衡量（到达率、点击率、召回留存）。'
      },
      {
        id: 'guide-retention-aha',
        title: '留存：产品价值 · 习惯 · 关系',
        tags: ['运营', '留存'],
        body:
          '留存本质：用户是否持续获得价值。\n\n产品类型比喻：**止痛药**（低频刚需，留存难）→ **维生素**（周期性）→ **奢侈品**（强依赖，留存高）。\n\n提升留存三板斧：\n1. **强化核心功能**（找到并优化 Aha Moment）\n2. **习惯设计**（签到、周期目标、固定推送）\n3. **关系链**（关注、社群、等级/积分）\n\n分析工具：**同期群（Cohort）** 对比不同批次留存；看流失前行为（投诉未处理、竞品、使用骤降）。'
      },
      {
        id: 'guide-data-four-questions',
        title: '数据分析四连问',
        tags: ['运营', '数据', '分析'],
        body:
          '指标异常或汇报时按顺序问：\n\n1. **是什么**：指标定义、口径、对比基线（同比/环比/分群）\n2. **为什么**：拆解维度（渠道/版本/人群/页面）找主因\n3. **怎么办**：对应产品/运营/投放动作，谁负责、何时复验\n4. **效果如何**：AB 或前后对比，观察窗口是否足够\n\n常用手法：**漏斗**找掉点、**同期群**看留存、**维度下钻**看 DAU/转化。避免只报数字不给结论。'
      },
      {
        id: 'guide-daily-metrics-board',
        title: '运营日报 / 周报看什么',
        tags: ['运营', '数据'],
        body:
          '**日报**：DAU/MAU、新增、次留异常、核心转化、活动与 push 效果。\n**周报**：留存趋势、渠道 ROI、同期群、重点实验结论。\n**月报**：LTV/CAC、战略指标、下月计划。\n\n异常排查链：**口径 → 分维度 → 外部因素 → 运营动作 → 产品变更 → 假设验证**。\n\n面试可答：「我每天先看大盘与转化波动，异常按维度拆到渠道/版本，再对齐当天发版与活动日历。」'
      },
      {
        id: 'guide-resume-ops-story',
        title: '简历与面试：运营项目怎么写',
        tags: ['运营', '面试', '简历'],
        body:
          '项目描述用 **背景-目标-动作-结果**（尽量量化）：\n\n- 背景：产品阶段、你负责模块\n- 目标：要提升的指标（次留、转化、CAC…）\n- 动作：分层、活动、渠道、AB、内容策略（写「我」做了什么）\n- 结果：基线→结果 + 时间窗口\n\n能力侧重：**会看数、能拆解、能落地**；SQL/Excel 写「能独立取数」即可，不必冒充数据工程师。\n\n少背概念多讲：**为什么做、怎么验证、下一步是什么**。'
      },
      {
        id: 'guide-30day-plan',
        title: '30 天运营入门路径（简版）',
        tags: ['运营', '学习'],
        body:
          '**第 1 周·指标**：DAU/留存/转化/LTV 定义 + 自己画一张指标关系图 + 跟一个产品画漏斗。\n**第 2 周·增长**：渠道类型、AARRR、写一份拉新/激活方案 + 拆一个 App 的促活手段。\n**第 3 周·留存与数据**：同期群练习、异常排查 SOP、做一张运营看板（Excel 即可）。\n**第 4 周·沉淀**：《运营之光》/《增长黑客》选读 + 整理知识图谱 + 3 个可讲的项目故事。\n\n每天 1–2 小时坚持比周末突击有效；配合本站「练习」模块刷题。'
      },
      {
        id: 'guide-reading-list',
        title: '书单速查（按目标选）',
        tags: ['运营', '学习'],
        body:
          '**入门框架**：《运营之光》\n**增长模型**：《增长黑客》\n**用户心理**：《上瘾》《用户增长方法论》\n**数据思维**：《精益数据分析》\n**表达/结构**：《金字塔原理》\n\n路径建议：先《增长黑客》+ 本站指标卡 → 转岗加强《上瘾》+ 习惯设计；数据弱加 SQL 入门卡 + Excel 透视。不必一次读完，和练题结合。'
      }
    ]
  },
  {
    id: 'ops-sql-basics',
    title: 'SQL 入门（运营向·够用即可）',
    cat: 'ops',
    cards: [
      {
        id: 'sql-why-ops',
        title: '运营为什么要学一点 SQL',
        tags: ['SQL', '数据', '运营'],
        body:
          '目标不是当数据工程师，而是：**自己取数、快速验证想法**，少排期等分析师。\n\n能覆盖的场景：看昨日 DAU、分渠道新增、活动参与人数、简单留存 cohort。\n\n入门标准：会 `SELECT`、过滤、分组计数、两表关联即可；复杂建模交给数仓。配合 Excel 透视或 BI 看板做可视化。'
      },
      {
        id: 'sql-select-where',
        title: 'SELECT · WHERE · 去重计数',
        tags: ['SQL', '入门'],
        body:
          '```sql\n-- 昨日活跃用户数（示例表 event_log）\nSELECT COUNT(DISTINCT user_id) AS dau\nFROM event_log\nWHERE dt = \'2025-05-21\'\n  AND event = \'app_open\';\n```\n\n要点：\n- `WHERE` 筛行；日期常用 `dt` 分区字段\n- `COUNT(*)` 计行数；`COUNT(DISTINCT user_id)` 计人数\n- 先 `LIMIT 100` 看样例，再跑全量'
      },
      {
        id: 'sql-group-by',
        title: 'GROUP BY：按渠道 / 版本看数',
        tags: ['SQL', '入门'],
        body:
          '```sql\nSELECT channel,\n       COUNT(DISTINCT user_id) AS new_users\nFROM user_register\nWHERE register_date = CURRENT_DATE - 1\nGROUP BY channel\nORDER BY new_users DESC;\n```\n\n规则：**SELECT 里的非聚合字段都要出现在 GROUP BY**。\n常用聚合：`COUNT` `SUM` `AVG` `MAX`/`MIN`。\n\n运营常用：按渠道、活动 id、版本号分组看转化与留存分子。'
      },
      {
        id: 'sql-join-left',
        title: 'LEFT JOIN：用户 + 行为拼在一起',
        tags: ['SQL', '入门'],
        body:
          '```sql\nSELECT u.user_id, u.channel, e.event_time\nFROM users u\nLEFT JOIN event_log e\n  ON u.user_id = e.user_id\n AND e.dt = \'2025-05-21\'\n AND e.event = \'purchase\'\nWHERE u.register_date = \'2025-05-20\';\n```\n\n**LEFT JOIN**：保留左表全部用户，右表没匹配则为 NULL（适合看「注册用户里谁买了」）。\n\n注意：先想清楚**主表是谁**；大表关联先按日期过滤再 JOIN，避免全表扫。'
      },
      {
        id: 'sql-retention-simple',
        title: '简易次日留存 SQL 思路',
        tags: ['SQL', '留存'],
        body:
          '逻辑：D 日新增用户集合 → 看 D+1 是否还有活跃事件。\n\n```sql\nWITH new_users AS (\n  SELECT user_id FROM user_register WHERE register_date = \'2025-05-20\'\n),\n day1_active AS (\n  SELECT DISTINCT user_id FROM event_log\n  WHERE dt = \'2025-05-21\' AND event = \'app_open\'\n)\nSELECT COUNT(DISTINCT n.user_id) AS new_cnt,\n       COUNT(DISTINCT a.user_id) AS retained_cnt,\n       COUNT(DISTINCT a.user_id) * 1.0 / COUNT(DISTINCT n.user_id) AS d1_rate\nFROM new_users n\nLEFT JOIN day1_active a ON n.user_id = a.user_id;\n```\n\n实际表名/字段因公司而异；理解 **CTE（WITH）+ LEFT JOIN** 即可，难的可让分析师封装成报表。'
      },
      {
        id: 'sql-ops-tips',
        title: '写 SQL 的三条纪律',
        tags: ['SQL', '运营'],
        body:
          '1. **先小后大**：`LIMIT`、抽样日期，确认口径再跑全量。\n2. **写注释/存模板**：渠道日报、活动效果等固定查询存成文件，改日期复用。\n3. **和埋点文档对齐**：event 名、属性字段以数据字典为准，避免「数是对的但问的不是一回事」。\n\n面试说法：「我能用 SQL 独立完成日常取数与漏斗拆分，复杂数仓建模会与数据同学协作。」'
      }
    ]
  }
];

let added = 0;
for (const sec of newSections) {
  const dup = existing.sections.find(s => s.id === sec.id);
  if (dup) {
    for (const card of sec.cards) {
      if (existingIds.has(card.id)) continue;
      dup.cards.push(card);
      existingIds.add(card.id);
      added++;
    }
    continue;
  }
  const cards = sec.cards.filter(c => !existingIds.has(c.id));
  cards.forEach(c => existingIds.add(c.id));
  added += cards.length;
  existing.sections.push({ ...sec, cards });
}

existing.version = (existing.version || 0) + 1;
fs.writeFileSync(target, JSON.stringify(existing, null, 2) + '\n', 'utf8');
console.log('knowledge.json version', existing.version, '| new cards', added);
