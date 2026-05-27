# MindTraining

产运思维训练 Web 应用：在真实业务场景中练习产品与运营判断，支持独立作答、AI 结构化点评与多轮追问。

## 链接

| | |
|---|---|
| 在线训练 | https://ops-trainer.vercel.app |
| 下载与说明 | https://ops-trainer.vercel.app/download |
| 源码仓库 | https://github.com/mianei/ops-trainer |
| 版本发布 | https://github.com/mianei/ops-trainer/releases |

## 功能

- 按产品 / 运营 / 面试等模块组织的场景题库
- 先作答、后点评的训练流程
- 基于大模型的结构化反馈与追问
- 访问码门禁（由部署方配置）
- 响应式布局，支持桌面与移动端浏览器

## 使用方式

### 学员

在浏览器打开 [在线训练地址](https://ops-trainer.vercel.app)，输入部署方提供的访问码即可开始。

### 开发者

1. 克隆或 [下载源码 ZIP](https://github.com/mianei/ops-trainer/archive/refs/heads/main.zip)
2. 按下方「部署」章节配置环境变量并部署到 Vercel（或兼容平台）
3. 本地调试可执行 `npx vercel dev`

题目数据位于 `topics.json` 及配套的 `scenarios-*.json`、`topics-*.json` 文件。

**框架与定义** 在 `knowledge.json`，App 内 **知识库** Tab 阅读，不当作练习题。内容规范见 [docs/content-audit.md](./docs/content-audit.md)。

## Windows 桌面版

`desktop/` 目录提供基于 Electron 的 Windows 便携版（`.exe`），窗口内加载已部署的线上站点，需保持网络连接。

- **下载**：在 [Releases](https://github.com/mianei/ops-trainer/releases) 获取 `MindTraining-*-Windows-portable.exe`
- **构建说明**：见 [desktop/README.md](./desktop/README.md)

## 部署

本项目为静态前端 + Serverless API（`/api/verify`、`/api/chat`），推荐使用 [Vercel](https://vercel.com) 部署。纯 GitHub Pages 无法运行 API 路由。

1. 将仓库导入 Vercel
2. 在 **Settings → Environment Variables** 配置：

| 变量 | 说明 |
|------|------|
| `REGISTER_INVITE_CODE` | **注册邀请码**（全员共用，发给朋友即可；用户自选用户名/密码） |
| `UPSTASH_REDIS_REST_URL` | **注册账号 + 答题记录**与限流（注册与记录必需） |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Token |
| `ACCESS_USERS` | 可选，站长预分配账号 `zhangsan:码1,lisi:码2` |
| `ACCESS_CODE` | 可选，未开注册时的单一访问码（用户名可留空）；也可兼作邀请码 fallback |
| `AUTH_PEPPER` | 可选，密码哈希盐（默认用邀请码） |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（推荐） |
| `DEEPSEEK_MODEL` | 可选，默认 `deepseek-chat` |
| `ANTHROPIC_API_KEY` | Claude API Key（与 DeepSeek 二选一） |
| `ANTHROPIC_MODEL` | 可选 |
| `AI_PROVIDER` | 可选，`deepseek` 或 `anthropic` |
| `DAILY_LIMIT_PER_IP` | 可选 |
| `DAILY_TOTAL_LIMIT` | 可选 |

3. 修改环境变量后需重新部署（Redeploy）

### 自助注册（推荐）

你**不用**逐个填账号，只需：

1. 在 [Upstash](https://upstash.com) 建一个 Redis，把 URL/Token 填进 Vercel
2. 设置 **`REGISTER_INVITE_CODE`**，例如 `mind2025`（这一串发给朋友，大家共用）
3. Redeploy

朋友打开站点 → **注册** → 自己取用户名、设密码、填邀请码 → 即可练题，作答按用户名保存。

### 站长预分配（可选）

- 配置 `ACCESS_USERS` 仍可手动指定账号密码（与注册用户并存）
- 仅 `ACCESS_CODE` 时：登录页用户名可留空，只填密码（单人模式）

### 答题记录

- 配置 Upstash 后，系统按「用户名 + 模块」保存近期作答
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

评测脚本：`node scripts/eval-golden.js` · 扩充知识：`node scripts/expand-knowledge.js`

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
