# MindTraining · 产运思维训练

开源的产运思维训练 Web 应用：场景题练习 + AI 结构化点评 + 多轮追问。

| | 链接 |
|---|---|
| **在线使用** | https://ops-trainer.vercel.app |
| **下载 / 开源说明** | https://ops-trainer.vercel.app/download |
| **GitHub 仓库** | https://github.com/mianei/ops-trainer |
| **下载源码 ZIP** | https://github.com/mianei/ops-trainer/archive/refs/heads/main.zip |

---

## 一句话说清楚

**MindTraining 是网页，不是安装包。**  
学员打开网址就能用；开发者从 GitHub 下载源码，可以自己部署一份。

Voicebox 那种 Windows `.msi` / macOS `.dmg` 是**桌面软件**才需要的。本项目不需要打包安装程序。

---

## 我已经在 GitHub 上了吗？

**是的。** 仓库地址：https://github.com/mianei/ops-trainer  

你平时 `git push` 就是在更新 GitHub 上的代码。别人打开这个链接就能看到项目。

### 确认仓库是「公开」的

1. 打开 https://github.com/mianei/ops-trainer/settings  
2. 拉到最下面 **Danger Zone**  
3. 如果是 Private，点 **Change visibility → Make public**

公开后，全世界都能看代码、下载 ZIP、Fork 你的项目。

---

## 别人怎么「下载」？

### 学员（只想练习）

把在线链接发过去就行：

```
https://ops-trainer.vercel.app
```

### 开发者（想要源码）

**方式 A：下载 ZIP（最简单）**

1. 打开 https://github.com/mianei/ops-trainer  
2. 点绿色 **Code** 按钮  
3. 选 **Download ZIP**  
4. 解压后按下方「本地预览」操作  

**方式 B：发正式版本（可选）**

1. 打开 https://github.com/mianei/ops-trainer/releases/new  
2. 版本号填 `v4.35`（和页脚 buildTag 一致即可）  
3. 点 **Publish release**  
4. GitHub 会自动附上 Source code 压缩包  

---

## 和 Voicebox 下载页的区别

| | Voicebox | MindTraining |
|---|---|---|
| 形态 | 桌面软件，要安装 | **浏览器网页** |
| GitHub 上放什么 | `.msi` / `.dmg` 安装包 + 源码 | **源码**（HTML + JSON 题库 + API） |
| 用户怎么用 | 下载 → 安装 → 打开 App | 打开网址 → 输入访问码 |
| 你需要做什么 | 打包各平台安装程序 | 代码 push 到 GitHub，Vercel 自动更新线上 |

---

## 部署（Vercel + GitHub）

1. 代码在 GitHub 仓库  
2. [Vercel](https://vercel.com) 导入该仓库并部署  
3. 在 Vercel **Settings → Environment Variables** 配置：

| 变量 | 说明 |
|------|------|
| `ACCESS_CODE` | 访问码（用户进门时输入） |
| `DEEPSEEK_API_KEY` | DeepSeek API Key（推荐） |
| `ANTHROPIC_API_KEY` | Claude API Key（二选一） |

**注意：** 密钥只放 Vercel 环境变量，不要写进代码、不要 commit。`.env` 已在 `.gitignore` 里。

改完环境变量后，在 Deployments 里 **Redeploy** 一次才生效。

**说明：** 纯 GitHub Pages 只能托管静态页面，无法运行 `/api/verify` 和 `/api/chat`。AI 点评必须在 Vercel（或同类平台）上运行。

---

## 本地预览

```bash
npx vercel dev
```

---

## 许可证

[MIT License](./LICENSE) — 可自由使用、修改、再分发。
