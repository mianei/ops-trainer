# 知识库准确性审计报告

审计时间：2025（v4.49）  
范围：`knowledge.json` 全部 **108** 张卡  
方法：逐卡对照公开资料、产品常识与面试可用性；高风险卡（平台算法、比例、三角框架）做检索核实。

## 总结

| 结论 | 数量 | 说明 |
|------|------|------|
| 准确可用 | ~78 | 经典框架（STAR/RICE/AARRR）、分析方法、面试结构 |
| 已修订 | 22 | 见 `scripts/patch-knowledge-audit.js` |
| 需注意（未改正文，使用时口头声明） | ~8 | 见下表「使用注意」 |

**原则**：知识库定位是**面试/练习辅助**，不是财报或平台官方文档。凡平台算法、佣金比例、舆情时间表等，均已改为「启发式 / 参考口径 / 可能迭代」。

---

## 已修订卡片（22 张）

| ID | 原问题 | 处理 |
|----|--------|------|
| `community-triangle` | 「不可能三角」易被当成定理 | 已在上轮改为「社区商业化权衡」+ 启发式说明 |
| `community-ces` | 未写 CES 公式来源，易被当成官方唯一算法 | 补充常见权重 + 非官方固定口径声明 |
| `community-bilibili-metrics` | **错误**：「完播>投币>收藏」与泄露公式不符 | 改为泄露代码参考口径，删除错误排序 |
| `community-evolution` | 1.0/2.0/3.0 易被当成标准分类 | 标明行业通俗说法 |
| `community-bilibili-metrics` | 同上 | — |
| `moments-not-home` | 含「知识用于理解」等元话术；论据可更完整 | 重写为产品分析结论 + 面试用法 |
| `ads-mission-triangle` | 易被当成微信官方术语 | 标明启发式分析框架 |
| `ota-hotel-modes` | 「13–14%」过于绝对 | 改为因协议而异、低双位数量级 |
| `crisis-time-window` | 1h/6h/24h 像铁律 | 改为 PR 节奏参考 |
| `social-currency` | 未注明理论来源 | 注明 Berger/STEPPS 等 |
| `impact-coefficient` | 公式各公司口径不一 | 注明近似思路 |
| `zhihu-salt` | 与 `zhihu-salt-tradeoff` 重复 | 补充交叉引用 |
| `xhs-search` | 与 `xhs-decision-engine` 部分重复 | 收紧表述、避免绝对化 |
| `local-o2o-triangle` | 「三角」易被当成定理 | 标明启发式 |
| `community-four-roles` | 无问题，略润色 | 标明归纳框架 |
| `ecom-vs-content-rec` | 表格在 JSON 中单行，内容 OK | 恢复换行表格 |
| `aarrr` | 未注明提出者 | 补充 Dave McClure |
| `priority-rice` | 未注明来源 | 补充 Intercom/RICE |
| `circles-framework` | 未注明来源 | 补充 Lewis Lin 等 |
| `prep-framework` | 无问题 | 展开 PREP 全称 |
| `douyin-local-push` | 产品名需声明以平台为准 | 补充说明 |

运行修订：`node scripts/patch-knowledge-audit.js`

---

## 分类清单（全部 108 张）

### 产品 / 需求 / 决策（准确）

`true-demand-three` · `surface-vs-core` · `problem-hypothesis-metric` · `goal-path-resource-risk` · `data-anomaly-debug`

### 增长 / 留存 / 传播（准确）

`rfm-basics` · `retention-value` · `cohort-read` · `aida-hook` · `ia-four` · `fitts-law`

### 面试表达（准确）

`star-pressure` · `crisis-response-frame` · `competitor-analysis` · `star-full` · `advantage-four` · `career-stages` · `project-intro` · `prep-framework` · `circles-framework` · `quantify-resume` · `scqa-framework` · `starr-framework` · `self-intro-four` · `interview-reverse-q`

### 面经方法论批次（准确）

`impact-coefficient`（已修订）· `renhuochang-analysis` · `metric-selection-chain` · `ab-traffic-layers` · `competitor-four-layers` · `activity-review-loop` · `ops-plan-5w1h` · `fermi-estimation` · `analysis-to-action` · `ai-project-four-steps` · `llm-output-constraints` · `ai-causal-proof` · `gmv-decomposition` · `north-star-guardrails` · `ab-test-design-pm` · `saas-version-tiering` · `churn-layer-ops` · `marketing-roi-metrics` · `influence-without-authority` · `unknown-question-framework` · `ice-priority` · `arpu-ltv-dau` · `written-exam-five-types` · `b-ticket-system-modules`

### PM 方法（准确）

`ab-test-basics` · `prd-not-list` · `priority-rice`（已修订）

### 电商 / OTA / 出行（基本准确，偏行业归纳）

`ecom-shelf-vs-content` · `ecom-revenue-formula` · `ecom-refund-risk` · `ecom-subsidy-fission` · `ecom-ai-priority` · `ecom-search-rank` · `ecom-category-strategy` · `ecom-trust` · `purchased-still-rec` · `ecom-vs-content-rec`（已修订）

`ota-hotel-modes`（已修订）· `ota-cross-sell` · `ota-demand-shift` · `ota-review-trust` · `ota-oligopoly` · `ota-train-profit` · `ota-live-package` · `ota-booking-diff`

`short-video-local-life` · `retail-three-eras` · `instant-grid` · `instant-vs-ecom` · `ride-supply-demand` · `local-o2o-triangle`（已修订）

### 社区 / 平台（已重点修订）

`community-triangle`（已修订）· `community-ces`（已修订）· `community-bilibili-metrics`（已修订）· `community-evolution`（已修订）· `community-aigc` · `community-four-roles`（已修订）

`zhihu-qa-vs-content` · `zhihu-salt-tradeoff` · `zhihu-salt`（已修订）· `zhihu-creator-ops`

`xhs-decision-engine` · `xhs-note-structure` · `xhs-vs-douyin-creator` · `xhs-creator-tier` · `xhs-search`（已修订）

`douyin-local-loop` · `douyin-vs-meituan` · `douyin-poi-ia` · `douyin-local-push`（已修订）

### 微信 / 商业 / AIGC（已修订或准确）

`moments-not-home`（已修订）· `ads-mission-triangle`（已修订）· `super-app-logic` · `cac-ltv` · `aigc-product`

`aigc-eval-dims` · `aigc-hallucination-guard` · `aigc-rag-debug-layers` · `query-tagging-framework` · `ai-agent-boundary`

### 舆情（已修订一项）

`crisis-time-window`（已修订）· `social-currency`（已修订）

---

## 使用注意（未改卡，答题时口头补一句）

| 卡片 | 注意 |
|------|------|
| `xhs-note-structure` | 「爆款结构」是归纳模板，非平台官方规则 |
| `xhs-vs-douyin-creator` | 对比表为面试归纳，数据因类目/时期变化 |
| `douyin-vs-meituan` | 竞争格局持续变化，避免写死「抖音一定赢/输」 |
| `ota-oligopoly` | 「一超多强」为行业描述，份额需查最新财报 |
| `community-ces` / B站卡 | 算法**会迭代**，勿背死权重 |
| `ecom-category-strategy` | 3C/美妆等为典型举例，非全行业真理 |
| `ota-train-profit` | 火车票佣金与政策强相关，会调整 |

---

## 重复主题（保留两张，已交叉引用）

- `zhihu-salt` ↔ `zhihu-salt-tradeoff`（社区补充 vs 知乎生态）
- `xhs-search` ↔ `xhs-decision-engine`（补充 vs 小红书主卡）

---

## 后续维护建议

1. 平台算法类卡片：每半年检索一次是否有大改版（CES、推荐权重）。
2. 新增卡片默认加前缀：`启发式` / `参考口径` / `面试常用框架`。
3. 禁止无出处写死：**百分比、权重排序、官方术语**。
4. 运行 `node scripts/patch-knowledge-audit.js` 可重复应用本轮修订（幂等：仅覆盖 PATCHES 内 id）。
