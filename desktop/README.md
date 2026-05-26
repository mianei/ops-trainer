# MindTraining 桌面版（个人用）

用 Electron 包一层窗口，打开线上训练站。  
**仍需联网**，访问码与 AI 点评走 Vercel 上的接口（与浏览器版相同）。

## 本机试用（不打包）

```bash
cd desktop
npm install
npm start
```

## 打包 Windows 便携版（单个 .exe，免安装）

```bash
cd desktop
npm install
npm run build:win
```

生成文件在 `desktop/dist/`，例如：

`MindTraining-1.0.0-Windows-portable.exe`

双击即可运行。Windows 可能提示「未知发布者」——个人自用可点「仍要运行」，**无需花钱买签名证书**。

## 从 GitHub 下载

1. 打开 https://github.com/mianei/ops-trainer/releases  
2. 找带 **Desktop** 或 **Windows-portable** 的版本  
3. 下载 `.exe` 即可  

若还没有 Release，可在本机按上面步骤打包，或让仓库维护者打标签触发自动构建（见下）。

## 自动构建（可选）

推送标签 `desktop-v1.0.0` 后，GitHub Actions 会自动打包并附到 Release：

```bash
git tag desktop-v1.0.0
git push origin desktop-v1.0.0
```

然后在 Releases 页下载附件。

## 改线上地址

默认打开 `https://ops-trainer.vercel.app`。本地调试可：

```bash
set MINDTRAINING_URL=https://你的域名
npm start
```
