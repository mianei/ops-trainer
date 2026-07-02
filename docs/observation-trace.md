# Observation Trace（观测追踪）

> Golden Set / Badcase 工作流的面试级可观测性：每轮对话自动留痕，Badcase 系统打标，Token 可聚合。

## 设计目标

- **Per-turn 快照**：用户作答、完整上下文（prompt 片段、scenario、rubric）、评分/点评结果
- **Badcase 自动打标**：无需人工翻 log，`|diff|≥2`、均分偏差、parse 失败、timeout 等自动写入 `badcase` 字段
- **Token 聚合**：按日/周/月汇总成本

## Trace 记录格式（JSONL 每行一条）

```json
{
  "traceId": "uuid",
  "runId": "eval-2026-06-23T12-00-00",
  "turn": 1,
  "at": "2026-06-23T12:00:00.000Z",
  "source": "eval-scoring | chat-review | chat-followup | coach",
  "sampleId": "eval-001",
  "userAnswer": "学员作答…",
  "context": {
    "scenario": "题目…",
    "rubric": { "逻辑性": "…" },
    "topicId": "iv-pm"
  },
  "result": {
    "parseOk": true,
    "scores": { "逻辑性": 5 },
    "rubricAvg": 4.8
  },
  "golden": { "humanScores": { "逻辑性": 5 } },
  "badcase": {
    "tagged": true,
    "reasons": ["dimension_mismatch"],
    "details": [{ "type": "dimension_mismatch", "items": [{ "dimension": "专业性", "human": 5, "ai": 2, "delta": 3 }] }]
  },
  "tokens": { "prompt": 800, "completion": 400, "total": 1200 }
}
```

## Badcase 规则（与 Golden Set 对齐）

| 规则 | 默认阈值 | `reasons` 值 |
|------|----------|--------------|
| 单维度 AI vs 人工 | \|Δ\| ≥ 2 | `dimension_mismatch` |
| 五维均分偏差 | ≥ 1.5 | `overall_score_delta` |
| JSON 点评解析失败 | — | `parse_failure` |
| 上游 timeout | — | `timeout` |

配置见 `lib/observation-trace.js` 中 `DEFAULT_BADCASE_RULES`。

## Golden Set 评测（本地 JSONL）

```bash
# 跑 30 条评测并写入 eval/traces/run-*.jsonl
DEEPSEEK_API_KEY=sk-xxx node scripts/eval-scoring.js

# 关闭 trace 写入
EVAL_TRACE=0 node scripts/eval-scoring.js
```

输出示例：

```
评分 eval-001… ok excellent Δmax 0.0
…
=== Badcases (3) ===
  eval-017  reasons=dimension_mismatch  Δmax=2
Trace 已写入: eval/traces/eval-2026-06-23T12-00-00.jsonl
```

## Token 聚合 CLI

```bash
# 按日（默认）
node scripts/aggregate-tokens.js

# 按周 / 月，并列出 badcase
node scripts/aggregate-tokens.js --period week --badcases
node scripts/aggregate-tokens.js --period month --dir eval/traces
```

若配置了 `UPSTASH_REDIS_REST_URL`，脚本会额外打印 API 侧 Upstash 聚合。

## API 侧 Trace（需 Upstash）

`/api/records` POST，`recordType`:

| recordType | 说明 |
|------------|------|
| `traces` | 最近 trace 列表；`badcasesOnly: true` 仅 badcase |
| `token-aggregate` | `period`: `day`/`week`/`month`，`days`: 回溯天数 |

`/api/chat`、`/api/coach` 响应含 `traceId`；配置了 Upstash 时 trace 写入 Redis。

## Context Guard（对话轮次护栏）

长会话超过 **40 轮**（`CONTEXT_TURN_THRESHOLD`）时：

- **保留**：用户档案（intake）、最近 **10 轮**（`CONTEXT_KEEP_RECENT`）
- **压缩**：更早轮次 → 结构化规则摘要（可选 `CONTEXT_LLM_SUMMARY=1` 走 LLM）

集成点：`api/chat.js`（followup）、`api/coach.js`（多轮 coach）。

## 存储与限制

| 场景 | 存储 | 限制 |
|------|------|------|
| Golden Set 本地跑分 | `eval/traces/*.jsonl` | 仅 Node 脚本，适合 CI/本地 |
| Vercel Edge API | Upstash Redis | Hobby 无持久磁盘；trace 索引最多 ~200 条/用户 |
| Token 日汇总 | Upstash Hash `ops:token:day:YYYY-MM-DD` | TTL ~400 天 |

未配置 Upstash 时，API trace 为 best-effort no-op，响应仍返回 `traceId`；Golden Set 本地 JSONL 不受影响。

## 相关文件

- `lib/observation-trace.js` — trace 构建、badcase、token、Upstash
- `lib/context-guard.js` — 轮次阈值与选择性压缩
- `scripts/eval-scoring.js` — Golden Set + trace 输出
- `scripts/aggregate-tokens.js` — token / badcase 聚合 CLI
