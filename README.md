# CVassistant

AI 产品经理简历优化与面试训练：简历评分与一键优化、基于简历准备面试、业务场景判断练习。

## 链接

| | |
|---|---|
| 在线训练 | https://ops-trainer.vercel.app |
| 下载与说明 | https://ops-trainer.vercel.app/download |
| 源码仓库 | https://github.com/mianei/ops-trainer |
| 版本发布 | https://github.com/mianei/ops-trainer/releases |

## 功能

- **简历优化**：上传简历/JD、一键评分、一键优化
- **面试训练**：基于简历准备、业务场景作答
- 免注册，打开即用（单人使用，无需访问码）

## 使用方式

在浏览器打开 [在线训练地址](https://ops-trainer.vercel.app) 即可使用，无需注册或登录。

1. 克隆或 [下载源码 ZIP](https://github.com/mianei/ops-trainer/archive/refs/heads/main.zip)
2. 在项目根目录复制 `.env.example` → `.env.local`，填入 `DEEPSEEK_API_KEY`，保持 `AUTH_DISABLED=1`
3. **本地启动（必做，不能双击 `index.html`）**：

```bash
npx vercel dev
```

浏览器打开终端里显示的地址（通常是 `http://localhost:3000`）。

> **为什么不能直接打开 HTML？**  
> 页面会请求 `/api/chat`、`/api/coach`、`/api/plan` 等接口。用 `file://` 或普通静态服务器打开时，这些 API 不存在，AI 点评、项目教练、智能体规划都会失败。必须用 `vercel dev` 同时跑前端 + Serverless API。

4. 部署到 Vercel 时按下方「部署」章节配置环境变量

题目数据位于 `topics.json` 及配套的 `scenarios-*.json`、`topics-*.json` 文件。

**框架与定义** 在 `knowledge.json`，App 内 **知识库** Tab 阅读，不当作练习题。内容规范见 [docs/content-audit.md](./docs/content-audit.md)。

## Windows 桌面版

`desktop/` 目录提供基于 Electron 的 Windows 便携版（`.exe`），窗口内加载已部署的线上站点，需保持网络连接。

- **下载**：在 [Releases](https://github.com/mianei/ops-trainer/releases) 获取 Windows 便携版
- **构建说明**：见 [desktop/README.md](./desktop/README.md)

## 部署

本项目为静态前端 + Serverless API（`/api/verify`、`/api/chat`），推荐使用 [Vercel](https://vercel.com) 部署。纯 GitHub Pages 无法运行 API 路由。

1. 将仓库导入 Vercel
2. 在 **Settings → Environment Variables** 配置：

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | **必填**，DeepSeek API Key（简历评分/教练/点评） |
| `AUTH_DISABLED` | **推荐 `1`**，单人免注册访客模式 |
| `DEEPSEEK_MODEL` | 可选，默认 `deepseek-chat` |
| `ANTHROPIC_API_KEY` | Claude API Key（与 DeepSeek 二选一） |
| `ANTHROPIC_MODEL` | 可选 |
| `AI_PROVIDER` | 可选，`deepseek` 或 `anthropic` |
| `UPSTASH_REDIS_REST_URL` | 可选，答题历史（不配也能练题） |
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

### 答题记录（可选）

- 配置 Upstash 后，系统按「用户 ID + 模块」保存近期作答（访客默认为 `guest`）
- 再次在本模块作答时，AI 点评会自动增加 **「思维成长」** 小节：对照你最近几次作答（不必同一道题），看是否想到更多、想得更深

### 知识库 RAG

提交分析时，后端从 `knowledge.json` **检索**与题目/作答相关的框架（默认 Top 3），注入 DeepSeek 点评 prompt。

| 变量 | 说明 |
|------|------|
| `RAG_ENABLED` | 默认开启；设为 `0` 关闭 |
| `RAG_TOP_K` | 检索条数，默认 `3`，最大 `5` |

扩充知识：只改 `knowledge.json` 并部署即可。DeepSeek 暂无 embedding API，当前为 BM25 关键词检索。

### v4.42 产品能力

- **知识库 61+ 卡**：含 OTA / 电商 / 社区等行业框架
- **作答前推荐阅读**：按模块与场景标签提示 1–3 张知识卡
- **结构化点评**：五维 rubric（1–5）+ 亮点 / 待加强 / 行动建议
- **思维成长时间线**：右上角「我的成长」查看历史作答
- **流式生成**：DeepSeek 点评 NDJSON 流式返回
- **场景 prompt 路由**：`【OTA·决策】` 类题自动匹配对应模块 systemPrompt

扩充知识：`node scripts/expand-knowledge-web.js` · `node scripts/expand-knowledge-web-batch2.js`

**v4.45** 面经第二批 +12 知识卡：`scenarios-web-curated-batch2.json`（+37 题，面经合计 **85** 题）· 知识库 **108** 张卡。

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
