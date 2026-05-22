# 运营思维训练器

## 部署方式（推荐 Vercel + GitHub）

1. 把本项目推到 GitHub 仓库
2. 打开 [Vercel](https://vercel.com)，导入该仓库并部署
3. 在 Vercel 项目 **Settings → Environment Variables** 配置：

### 访问码怎么设置

1. 打开 [vercel.com](https://vercel.com) → 你的项目 **ops-trainer**
2. 顶部 **Settings** → 左侧 **Environment Variables**
3. 新增变量：
   - **Key（名称）**：`ACCESS_CODE`
   - **Value（值）**：你自己定的密码，例如 `my-secret-2025`（发给学员用的就是这一串）
   - **Environment**：勾选 Production、Preview、Development
4. 点击 **Save**
5. 回到 **Deployments** → 最新部署右侧 **⋯** → **Redeploy**（改环境变量后必须重新部署才生效）

用户在前端输入的访问码，必须与这里的 `ACCESS_CODE` **完全一致**（区分大小写）。

| 变量 | 说明 |
|------|------|
| `ACCESS_CODE` | 访问码（用户进门时输入的密码） |
| `DEEPSEEK_API_KEY` | **DeepSeek API Key（推荐）** |
| `DEEPSEEK_MODEL` | 可选，默认 `deepseek-chat` |
| `AI_PROVIDER` | 可选，`deepseek` 或 `anthropic`，不填则自动检测 |
| `ANTHROPIC_API_KEY` | Claude API Key（二选一） |
| `ANTHROPIC_MODEL` | 可选，默认 `claude-sonnet-4-6` |
| `UPSTASH_REDIS_REST_URL` | 可选，用于每日限流 |
| `UPSTASH_REDIS_REST_TOKEN` | 可选 |
| `DAILY_LIMIT_PER_IP` | 可选，默认 30 |
| `DAILY_TOTAL_LIMIT` | 可选，默认 500 |

4. 部署后访问 Vercel 给的域名，先输入访问码再进入

**说明：** 纯 GitHub Pages 只能托管静态页面，无法运行 `/api/verify` 和 `/api/chat`。AI 点评与访问码校验必须在 Vercel（或同类平台）上运行。

## 从 GitHub 实时更新场景

练习题目在 `topics.json` 里。改完并 `git push` 后，用户刷新网页即可拉取最新场景。

若使用 GitHub 仓库的 raw 地址，在 `index.html` 顶部配置：

```javascript
const GITHUB_TOPICS_URL = 'https://raw.githubusercontent.com/你的用户名/你的仓库/main/topics.json';
```

留空则使用同站点下的 `topics.json`。

## 本地预览

静态部分可用任意静态服务器；API 需 Vercel CLI：

```bash
npx vercel dev
```
