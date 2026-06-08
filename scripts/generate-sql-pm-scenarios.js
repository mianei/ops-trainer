/**
 * 生成 SQL 练习题库 + 产品拆解（录音拆解题风格）题库
 * node scripts/generate-sql-pm-scenarios.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const sqlScenarios = [
  '【SQL·基础】表 `users(user_id, register_date)`、`event_log(user_id, dt, event)`。请写 SQL 统计 2025-05-20 注册用户的**次日留存率**（写出核心查询 + 1 句口径说明）。',
  '【SQL·基础】表 `orders(order_id, user_id, pay_time, amount)`。请写 SQL：统计 2025-05-21 当天**支付成功订单数**与**支付用户数**（去重）。',
  '【SQL·基础】表 `event_log(user_id, dt, event)`，`event` 含 `app_open`。请写 SQL 得到 2025-05-20 的 **DAU**。',
  '【SQL·基础】同上表，请写 SQL 统计 2025-05-20 各 `event` 的触发次数 Top5（含 event 名与 cnt）。',
  '【SQL·基础】表 `user_register(user_id, channel, register_date)`。请写 SQL 列出 2025-05-20 各渠道**新增用户数**，按人数降序。',
  '【SQL·基础】`WHERE` 与 `COUNT(DISTINCT …)` 区别是什么？结合「统计活跃用户数」各写 1 句适用场景。',
  '【SQL·基础】表 `products(sku_id, category, price)`。请写 SQL 找出 `category=\'数码\'` 且 `price>500` 的 SKU 数量。',
  '【SQL·基础】表 `push_log(user_id, send_time, is_click)`。请写 SQL 计算 2025-05-20 推送的**点击率**（点击用户数/送达用户数，说明去重口径）。',
  '【SQL·基础】为什么要先 `LIMIT 100` 再跑全量？写 2 条运营取数时的安全习惯。',
  '【SQL·基础】表 `users(user_id, city)`、`orders(user_id, order_id)`。请写 SQL 统计**北京用户**在 2025-05 的下单人数（去重 user_id）。',

  '【SQL·分组】表 `user_register(user_id, channel, register_date)`。请写 SQL：按 `channel` 分组统计 2025-05-20 新增，并只保留新增≥100 的渠道（提示：`HAVING`）。',
  '【SQL·分组】表 `event_log(user_id, dt, event)`。请写 SQL：按 `dt` 统计每日 DAU（2025-05-15 至 05-21），按日期升序。',
  '【SQL·分组】表 `orders(user_id, pay_date, amount)`。请写 SQL：按 `pay_date` 汇总每日 GMV（`SUM(amount)`）与订单数。',
  '【SQL·分组】`GROUP BY` 与 `WHERE` 的执行顺序？各举 1 个「先过滤再聚合」的运营例子。',
  '【SQL·分组】表 `lesson_watch(user_id, course_id, watch_minutes)`。请写 SQL：每门课的平均观看时长 Top3 课程。',
  '【SQL·分组】表 `ab_experiment(user_id, exp_id, variant, convert_flag)`。请写 SQL：按 `variant` 统计转化率（转化用户数/进组用户数）。',
  '【SQL·分组】表 `search_log(user_id, keyword, dt)`。请写 SQL：2025-05-20 搜索次数最多的关键词 Top10。',
  '【SQL·分组】表 `coupon_use(user_id, coupon_type, use_time)`。请写 SQL：各券类型在 5 月的使用次数与人均使用次数（说明分子分母）。',

  '【SQL·关联】表 `users(user_id, register_date)`、`orders(user_id, order_id, pay_time)`。请写 SQL：2025-05-20 注册用户中，**当日有支付**的人数占比（思路 + SQL）。',
  '【SQL·关联】`INNER JOIN` 与 `LEFT JOIN` 在「注册用户是否付费」分析中各适合什么？各写 1 句。',
  '【SQL·关联】表 `users(user_id)`、`user_tag(user_id, tag)`。请写 SQL：拥有标签 `高价值` 的用户数（注意重复 user_id）。',
  '【SQL·关联】表 `campaign_user(user_id, campaign_id)`、`event_log(user_id, dt, event)`。请写 SQL：活动 A（campaign_id=\'A\'）参与用户在活动后 7 日内仍有 `app_open` 的人数。',
  '【SQL·关联】表 `sku(sku_id, name)`、`order_item(order_id, sku_id, qty)`。请写 SQL：销量 Top5 商品名及销量（`SUM(qty)`）。',
  '【SQL·关联】多表关联前为什么要先按日期过滤大表？结合 `event_log` 写 1 条性能/口径建议。',
  '【SQL·关联】表 `dim_user(user_id, first_channel)`、`fact_active(user_id, dt)`。请写 SQL：按首访渠道看 2025-05-20 的 DAU 构成。',
  '【SQL·关联】表 `refund(order_id, refund_time)`、`orders(order_id, pay_time)`。请写 SQL：2025-05-21 支付订单中发生退款的订单占比。',

  '【SQL·漏斗】表 `event_log(user_id, dt, event)`，事件序列：`view_item`→`add_cart`→`submit_order`→`pay_success`（同日）。请写 SQL 思路：计算四步漏斗人数与逐步转化率。',
  '【SQL·漏斗】漏斗分析中「按 user_id 去重」与「按事件次数」有何区别？各会导致什么误判？',
  '【SQL·漏斗】表 `page_view(user_id, page, dt)`。请写 SQL：2025-05-20 从 `首页` 到 `商详` 的 UV 转化率（写出分子分母口径）。',
  '【SQL·漏斗】某步转化率突然下跌，除产品 bug 外，列出 3 个**数据口径**层面的排查点。',
  '【SQL·漏斗】表 `trial_start(user_id, dt)`、`subscribe(user_id, dt)`。请写 SQL 思路：注册后 7 日内订阅的转化率（时间窗口如何限定）。',
  '【SQL·漏斗】若 `submit_order` 埋点漏报 20%，漏斗结论会怎样偏？你会如何交叉验证？',

  '【SQL·留存】请用 `WITH` 写简易**次日留存**：D 日新增 LEFT JOIN D+1 活跃，输出 new_cnt、retained_cnt、d1_rate。',
  '【SQL·留存】7 日留存与 30 日留存在 SQL 写法上差在哪？写思路即可（不必完整 SQL）。',
  '【SQL·留存】表 `cohort_register(user_id, cohort_week)`、`weekly_active(user_id, week)`。请写 SQL 思路：按注册周看第 2 周仍活跃的比例。',
  '【SQL·留存】留存分析为什么要看**曲线形态**而不只看 D1 一个点？结合 1 个产品例子说明。',
  '【SQL·留存】表 `users`、`event_log`。新用户定义改为「首次 app_open」而非注册，留存率通常会怎么变？说明原因。',
  '【SQL·留存】同期群表里混入了测试账号，对留存的影响？写 1 条 SQL 过滤建议（如 `is_test=0`）。',

  '【SQL·实战】运营要「昨日分渠道新增 + 次留」日报，你会建哪 2 张结果表或视图？各含哪些字段？',
  '【SQL·实战】表 `push_log(user_id, task_id, send_time, click_time)`。请写 SQL：各 `task_id` 的送达人数、点击人数、点击率。',
  '【SQL·实战】活动页 UV 涨 50% 但下单 UV 不变，写 2 条用 SQL 可验证的假设及对应查询方向。',
  '【SQL·实战】表 `user_level(user_id, level)`、`pay(user_id, amount, dt)`。请写 SQL：各会员等级的 ARPU（5 月，说明是否含未付费用户）。',
  '【SQL·实战】发现两个报表 DAU 差 3%，列举 3 个常见**口径不一致**原因。',
  '【SQL·实战】表 `content_post(post_id, author_id, publish_dt)`、`interaction(user_id, post_id, action)`。请写 SQL：发布 7 日内每帖的曝光 UV 与点赞 UV（思路+关键片段）。',
  '【SQL·实战】面试官问：「你会用 SQL 证明活动有效吗？」请写：指标定义 + 1 段对比查询思路（实验组/对照组或前后对比）。',
  "【SQL·实战】字段 dt 用字符串 '2025-05-20' 与用日期类型，各可能踩什么坑？写 2 条。",
  '【SQL·实战】表 `sku_inventory(sku_id, stock)`、`sales(sku_id, sold_qty, dt)`。请写 SQL：今日售罄 SKU 列表（stock=0 且今日 sold_qty>0）。',
  '【SQL·实战】复杂需求「用户全链路行为序列」SQL 很难写，作为运营你会如何与数据同学分工？写 3 条协作要点。'
];

const pmDebrief = {
  user: [
    '【产品拆解·需求】（录音拆解题）面试官：「调研里 60% 用户说要加 XX，上不上？」\n拆解提示：① 澄清样本是谁、场景频率 ② Want vs Need ③ 上线后验证指标\n请按「澄清→拆解维度→结论→如何验证」作答。',
    '【产品拆解·需求】（录音拆解题）面试官：「外卖用户投诉配送慢，先压骑手提速行吗？」\n拆解提示：① 定义慢的标准与分布 ② 供给侧/需求侧/算法匹配 ③ 短期动作 vs 根因\n请按结构作答，避免直接站队。',
    '【产品拆解·需求】（录音拆解题）面试官：「健身 App 一星评价说功能少、界面丑，要大改版吗？」\n拆解提示：① 评价用户是否目标人群 ② 丑/少是否等于流失原因 ③ 更小验证方案\n请写出你会先问的 3 个澄清问题 + 结论方向。',
    '【产品拆解·需求】（录音拆解题）面试官：「社交 App 用户说朋友都不用，要不要砸钱拉新？」\n拆解提示：① 网络效应冷启动 ② 单用户价值 vs 双边密度 ③ 先修留存还是拉新\n请按「澄清→拆解→结论→验证」作答。',
    '【产品拆解·需求】（录音拆解题）面试官：「B 端客户点名要定制报表，做不做？」\n拆解提示：① 普遍性/付费意愿 ② 定制对主线的机会成本 ③ 标准化替代方案\n请给出是否接单的判断框架。'
  ],
  feature: [
    '【产品拆解·功能】（录音拆解题）面试官：「首页 40% 给 AI 一键整理，上吗？」\n拆解提示：① 首屏服务的核心任务 ② 新老用户影响 ③ MVP 与护栏指标\n请按结构作答。',
    '【产品拆解·功能】（录音拆解题）面试官：「订单详情默认展开顺手买，客单升 8% 但找不到物流，怎么改？」\n拆解提示：① 主路径 vs 收入 ② 信息架构 ③ 可 A/B 的改法\n请给出 2 个方案取舍。',
    '【产品拆解·功能】（录音拆解题）面试官：「CRM 27 个 Tab，销售找不到跟进记录，合并要 6 周，推不推？」\n拆解提示：① 痛点频次 ② 分期交付 ③ 迁移与培训成本\n请写推进策略，不只说「要做」。',
    '【产品拆解·功能】（录音拆解题）面试官：「加已读不回提醒，一半人要一半人骂，规则怎么定？」\n拆解提示：① 社交压力与隐私 ② 默认态/开关 ③ 对不同关系链是否差异化\n请给出可落地的规则设计要点。',
    '【产品拆解·功能】（录音拆解题）面试官：「上线前 3 天发现埋点错了，还发吗？」\n拆解提示：① 决策依赖数据的程度 ② 降级与回补 ③ 复盘防再发\n请写判断标准（可量化）。'
  ],
  competitor: [
    '【产品拆解·竞品】（录音拆解题）面试官：「微信读书突然全场免费，你怎么应对？」\n拆解提示：① 战略意图（拉新/清库存/打击谁）② 我方用户资产 ③ 非对称反击\n请避免只列功能对标。',
    '【产品拆解·竞品】（录音拆解题）面试官：「外卖平台推 15 元月卡，背后逻辑？」\n拆解提示：① LTV 与锁定 ② 补贴结构 ③ 对骑手/商家侧影响\n请按四层竞品法中的业务层+增长层回答。',
    '【产品拆解·竞品】（录音拆解题）面试官：「抖音做边看边买，淘宝直播运营怎么办？」\n拆解提示：① 场景差异（内容 vs 货架）② 核心指标 ③ 合作/差异化\n请给出 1 条短期 + 1 条中期动作。',
    '【产品拆解·竞品】（录音拆解题）面试官：「竞品开放 API，意味着什么？」\n拆解提示：① 平台化意图 ② 生态风险 ③ 我方锁定策略\n请按「对他→对我→怎么做」作答。',
    '【产品拆解·竞品】（录音拆解题）面试官：「分析你最喜欢的一款 App（3 分钟）。」\n拆解提示：定位→用户→场景→价值→短板→若我做 PM 的一个实验\n请模拟口述结构，不要功能说明书。'
  ],
  'prod-open': [
    '【产品拆解·开放】（录音拆解题）面试官：「微信为什么不把朋友圈放首屏？」\n拆解提示：① Tab1 服务的最高频任务 ② 关系链内容 vs IM ③ 产品定位与生态\n请用可验证论据，避免传说式回答。',
    '【产品拆解·开放】（录音拆解题）面试官：「设计一款面向老年人的打车 App，讲思路。」\n拆解提示：① 老年人真需求（安全/简单/代付）② 约束（视力/操作步数）③ MVP\n请先澄清场景再谈功能。',
    '【产品拆解·开放】（录音拆解题）面试官：「直播间礼物榜值得做吗？利弊？」\n拆解提示：① 收入 vs 体验 ② 社区公平 ③ 监管与青少年\n请写结论 + 2 条护栏。',
    '【产品拆解·开放】（录音拆解题）面试官：「如何提升知乎的回答质量？」\n拆解提示：① 供给侧激励 ② 分发机制 ③ 低质内容治理\n请选 1 个杠杆深入，不要全铺。',
    '【产品拆解·开放】（录音拆解题）面试官：「AI 搜索会不会取代传统搜索框？」\n拆解提示：① 任务类型（导航/探索/精确）② 可信度与延迟 ③ 混合形态\n请给出 3 年内的产品形态判断。'
  ],
  'iv-pm': [
    '【产品拆解·产品】（录音拆解题）面试官：「描述一个你负责过的需求从 0 到 1。」\n拆解提示：① 问题是否真 ② 方案取舍 ③ 数据验证 ④ 个人贡献边界\n请用 STAR 但突出「为什么」而非功能列表。',
    '【产品拆解·产品】（录音拆解题）面试官：「需求评审时研发说做不了，你怎么办？」\n拆解提示：① 技术约束本质 ② 分期/替代方案 ③ 业务目标是否可调\n请写沟通过程，不只说「说服了他」。',
    '【产品拆解·产品】（录音拆解题）面试官：「如何排需求优先级？」\n拆解提示：价值×范围×成本×风险；RICE/ICE 任选其一讲透\n请示范排 3 个虚构需求的顺序并解释。',
    '【产品拆解·产品】（录音拆解题）面试官：「上线后数据不达预期，怎么复盘？」\n拆解提示：① 假设是否错 ② 指标/埋点 ③ 外部因素 ④ 下一步实验\n请给复盘 agenda。',
    '【产品拆解·产品】（录音拆解题）面试官：「AI 功能上线后用户吐槽幻觉严重，产品怎么兜底？」\n拆解提示：① 场景边界 ② 人工/规则兜底 ③ 可观测与 Bad Case 闭环\n请按产品设计层回答，不讲模型结构。'
  ],
  decision: [
    '【产品拆解·决策】（录音拆解题）面试官：「50 万预算增长停滞，怎么花？」\n拆解提示：① 先诊断 AARRR 哪一环漏 ② 两方案对比 ③ 实验与止损\n请用目标-路径-资源-风险框架。',
    '【产品拆解·决策】（录音拆解题）面试官：「大促选满减还是会员折扣，二选一？」\n拆解提示：① 目标用户 ② 毛利与复购 ③ 长期会员心智\n请写决策依据与 2 个监控指标。',
    '【产品拆解·决策】（录音拆解题）面试官：「30+ 用户留存更高，但运营全做年轻向，改吗？」\n拆解提示：① 战略人群 ② 资源分配 ③ 分群运营是否可行\n请给出建议，不要两边和稀泥。',
    '【产品拆解·决策】（录音拆解题）面试官：「全量 push 还是分层 push？」\n拆解提示：① 打扰成本 ② 转化 uplift ③ 技术/标签成熟度\n请说明你会支持哪方及验证方式。',
    '【产品拆解·决策】（录音拆解题）面试官：「项目 75% 发现假设不成立，deadline 不变怎么办？」\n拆解提示：① 砍 scope ② 对齐预期 ③ 复盘资产\n请写 pivot 方案与对外沟通要点。'
  ]
};

fs.writeFileSync(
  path.join(root, 'topics-sql.json'),
  JSON.stringify(
    {
      version: 1,
      topics: [
        {
          id: 'sql',
          label: 'SQL 实操',
          fieldLabel:
            '请写出 SQL 核心语句（或清晰伪代码）+ 口径说明；若有业务结论请用 1–2 句话解释「这数字说明什么」。',
          placeholder: 'SELECT …\n-- 口径：…\n-- 解读：…',
          scenarios: [],
          systemPrompt:
            '你是一位耐心的数据分析导师，辅导运营/产品新人写「够用」的 SQL。\n\n点评要求：\n1. SQL 语法与口径是否正确（去重、过滤日期、JOIN 方向）\n2. 是否先 LIMIT/抽样再全量\n3. 业务解读是否超越「算出一个数」\n4. 指出 1–2 处可改进（索引过滤、HAVING、CTE 清晰度等）\n5. 难度保持运营日常取数，不要求leetcode\n\n语气：务实、鼓励。300 字内，中文。',
          cat: 'ops',
          catLabel: '运营思维',
          desc: 'SELECT · 分组 · JOIN · 漏斗留存'
        }
      ]
    },
    null,
    2
  ) + '\n',
  'utf8'
);

fs.writeFileSync(
  path.join(root, 'scenarios-sql-practice.json'),
  JSON.stringify({ sql: sqlScenarios }, null, 2) + '\n',
  'utf8'
);

fs.writeFileSync(
  path.join(root, 'scenarios-pm-debrief.json'),
  JSON.stringify(pmDebrief, null, 2) + '\n',
  'utf8'
);

const debriefCount = Object.values(pmDebrief).reduce((n, a) => n + a.length, 0);
console.log('SQL scenarios:', sqlScenarios.length);
console.log('PM debrief scenarios:', debriefCount);
