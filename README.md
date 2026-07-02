# CVassistant 3.0

AI 产品经理简历优化与面试训练：Agent 工作台（三栏布局）、简历评分与一键优化、基于简历准备面试、业务场景判断练习。

## 链接

| | |
|---|---|
| 在线训练 | https://cvassistant-ai.vercel.app |
| 下载与说明 | https://cvassistant-ai.vercel.app/download |
| 源码仓库 | https://github.com/mianei/ops-trainer |
| 版本发布 | https://github.com/mianei/ops-trainer/releases |

> 仓库名仍为 `ops-trainer`（历史别名）；Vercel 项目名为 `cvassistant`。旧域名 `ops-trainer.vercel.app` 仍可访问。

## 功能（3.0）

- **Agent 工作台**：左 Nav · 中 Canvas（Artifact）· 右 Chat；一键评分/准备面试结果直接进画布，Chat 作 steering
- **简历优化**：上传简历/JD、一键评分、一键优化、局部改写指令
- **面试训练**：基于简历准备报告、218+ 面经题、业务场景五维点评
- **项目教练**：`/api/coach` 六种辅导模式（简历诊断、面试防御、项目迭代等）
- **训练计划**：`/api/plan` 生成阶段性训练步骤
- **成长与观测**：配置 Upstash 后支持答题历史、进步曲线、Observation Trace（badcase 打标、Token 聚合）
- **免注册访客模式**：打开即用（`AUTH_DISABLED=1`，无登录 UI）

## 使用方式

在浏览器打开 [在线训练地址](https://cvassistant-ai.vercel.app) 即可使用，无需注册或登录。

1. 克隆或 [下载源码 ZIP](https://github.com/mianei/ops-trainer/archive/refs/heads/main.zip)
2. 在项目根目录复制 `.env.example` → `.env.local`，填入 `DEEPSEEK_API_KEY`，保持 `AUTH_DISABLED=1`
3. **本地启动（必做，不能双击 `index.html`）**：

```bash
npx vercel dev
```

浏览器打开终端里显示的地址（通常是 `http://localhost:3000`）。

> **为什么不能直接打开 HTML？**  
> 页面会请求 `/api/chat`、`/api/coach`、`/api/plan`、`/api/records` 等接口。用 `file://` 或普通静态服务器打开时，这些 API 不存在，AI 点评、项目教练、智能体规划都会失败。必须用 `vercel dev` 同时跑前端 + Serverless API。

4. 部署到 Vercel 时按下方「部署」章节配置环境变量

题目数据位于 `topics.json` 及配套的 `scenarios-*.json`、`topics-*.json` 文件。

**框架与定义** 在 `knowledge.json`，App 内 **知识库** Tab 阅读，不当作练习题。内容规范见 [docs/content-audit.md](./docs/content-audit.md)。

3.0 布局与 Agent 方案见 [docs/v3.0-agent-workspace.md](./docs/v3.0-agent-workspace.md)；观测追踪见 [docs/observation-trace.md](./docs/observation-trace.md)。

## API（4 个 Serverless 端点）

| 端点 | 用途 |
|------|------|
| `POST /api/chat` | 五维点评、追问、框架/标准解析（`tool: analyze`）、语音转写（`tool: transcribe`） |
| `POST /api/coach` | 项目教练：简历评分/优化、面试准备等 `action` |
| `POST /api/plan` | 训练计划生成 |
| `POST /api/records` | 统一记录接口，通过 `recordType` 路由 |

### `/api/records` 的 `recordType`

| recordType | 说明 |
|------------|------|
| `history`（默认） | 各模块近期作答列表 |
| `analytics` | 进步曲线、薄弱题型 |
| `traces` | Observation Trace 列表（`badcasesOnly: true` 仅 badcase） |
| `token-aggregate` / `tokens` | Token 按日/周/月聚合 |

共享业务逻辑在根目录 `lib/`（由 Edge 函数 import）。

## Windows 桌面版

`desktop/` 目录提供基于 Electron 的 Windows 便携版（`.exe`），窗口内加载已部署的线上站点，需保持网络连接。

- **下载**：在 [Releases](https://github.com/mianei/ops-trainer/releases) 获取 Windows 便携版
- **构建说明**：见 [desktop/README.md](./desktop/README.md)

## 部署

本项目为静态前端 + Serverless API（4 个 `/api/*` 端点），推荐使用 [Vercel](https://vercel.com) 部署。纯 GitHub Pages 无法运行 API 路由。

1. 将仓库导入 Vercel（项目名建议 `cvassistant`）
2. 在 **Settings → Environment Variables** 配置：

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | **必填**，DeepSeek API Key（简历评分/教练/点评） |
| `AUTH_DISABLED` | **推荐 `1`**，单人免注册访客模式 |
| `DEEPSEEK_MODEL` | 可选，默认 `deepseek-chat` |
| `ANTHROPIC_API_KEY` | Claude API Key（与 DeepSeek 二选一） |
| `ANTHROPIC_MODEL` | 可选 |
| `AI_PROVIDER` | 可选，`deepseek` 或 `anthropic` |
| `OPENAI_API_KEY` | 可选，语音转写（Whisper） |
| `UPSTASH_REDIS_REST_URL` | 可选，答题历史 / Trace（不配也能练题） |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Token |
| `ACCESS_CODE` | 可选，仅当 `AUTH_DISABLED=0` 时启用密码保护 |
| `ACCESS_USERS` | 可选，多用户 `user:pass` 预分配 |
| `DAILY_LIMIT_PER_IP` | 可选 |
| `DAILY_TOTAL_LIMIT` | 可选 |

3. 修改环境变量后需重新部署（Redeploy）

### 单人免注册模式（默认）

本版本面向**单人自用**，推荐配置：

1. `DEEPSEEK_API_KEY`（必填）
2. `AUTH_DISABLED=1`（默认）
3. **不配置** `ACCESS_CODE` / `REGISTER_INVITE_CODE`

打开页面即以访客身份使用，无登录门禁。若需密码保护，设置 `ACCESS_CODE` 并将 `AUTH_DISABLED=0`。

### 答题记录与 Trace（可选）

- 配置 Upstash 后，系统按「用户 ID + 模块」保存近期作答（访客默认为 `guest`）
- 再次在本模块作答时，AI 点评会自动增加 **「思维成长」** 小节：对照你最近几次作答（不必同一道题），看是否想到更多、想得更深
- `/api/chat`、`/api/coach` 响应含 `traceId`；Trace 与 Token 聚合经 `/api/records` 查询。详见 [docs/observation-trace.md](./docs/observation-trace.md)

### 知识库 RAG

提交分析时，后端从 `knowledge.json` **检索**与题目/作答相关的框架（默认 Top 3），注入 DeepSeek 点评 prompt。

| 变量 | 说明 |
|------|------|
| `RAG_ENABLED` | 默认开启；设为 `0` 关闭 |
| `RAG_TOP_K` | 检索条数，默认 `3`，最大 `5` |

扩充知识：只改 `knowledge.json` 并部署即可。DeepSeek 暂无 embedding API，当前为 BM25 关键词检索。

### 评测集（Golden Set）

```bash
# 跑 30 条评测并写入 eval/traces/run-*.jsonl
DEEPSEEK_API_KEY=sk-xxx node scripts/eval-scoring.js

# Token 聚合
node scripts/aggregate-tokens.js --period week --badcases
```

说明见 [eval/评测集说明.md](./eval/评测集说明.md)。

请勿将密钥写入代码或提交至仓库；`.env` 已列入 `.gitignore`。

### 从 GitHub 拉取题库（可选）

在 `index.html` 中配置：

```javascript
const GITHUB_TOPICS_URL = 'https://raw.githubusercontent.com/<user>/<repo>/main/topics.json';
```

留空则使用站点同目录下的 `topics.json`。

## 发布版本

在 GitHub **Releases** 创建标签可附带源码压缩包。桌面版由标签 `desktop-v*` 触发 Actions 自动构建 Windows 便携包。

## 许可证

[MIT License](./LICENSE)
