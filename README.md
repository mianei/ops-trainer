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
| `ACCESS_USERS` | **多人账号**，格式 `zhangsan:码1,lisi:码2` 或 JSON `{"zhangsan":"码1"}` |
| `ACCESS_CODE` | 未配置 `ACCESS_USERS` 时的单一访问码（账号可留空） |
| `UPSTASH_REDIS_REST_URL` | **答题记录**与限流（记录功能必需） |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Token |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（推荐） |
| `DEEPSEEK_MODEL` | 可选，默认 `deepseek-chat` |
| `ANTHROPIC_API_KEY` | Claude API Key（与 DeepSeek 二选一） |
| `ANTHROPIC_MODEL` | 可选 |
| `AI_PROVIDER` | 可选，`deepseek` 或 `anthropic` |
| `UPSTASH_REDIS_REST_URL` | 可选，限流 |
| `UPSTASH_REDIS_REST_TOKEN` | 可选 |
| `DAILY_LIMIT_PER_IP` | 可选 |
| `DAILY_TOTAL_LIMIT` | 可选 |

3. 修改环境变量后需重新部署（Redeploy）

### 一人一号与答题记录

- 在 Vercel 配置 `ACCESS_USERS`，为每位朋友分配独立账号与访问码
- 配置 [Upstash Redis](https://upstash.com) 并填入 `UPSTASH_REDIS_*`，系统会按「账号 + 模块 + 同一道题」保存作答
- 再次作答同一道题时，AI 点评会自动增加 **「与上次相比」** 小节（不打分，仅对比进步）

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
