# MindTraining Desktop（Windows）

基于 Electron 的 Windows 便携版。启动后加载已部署的 MindTraining 线上站点，功能与浏览器版一致，需保持网络连接。

## 下载

预编译包见仓库 [Releases](https://github.com/mianei/ops-trainer/releases)，文件名形如：

`MindTraining-<version>-Windows-portable.exe`

首次运行若出现 Windows SmartScreen 提示，属未签名便携应用的正常情况，请根据系统指引选择继续运行。

## 本地运行（开发）

```bash
cd desktop
npm install
npm start
```

## 本地构建

```bash
cd desktop
npm install
npm run build:win
```

产物目录：`desktop/dist/`。

## 自定义线上地址

默认：`https://ops-trainer.vercel.app`

```bash
set MINDTRAINING_URL=https://your-domain.example
npm start
```

## CI 构建

推送标签 `desktop-v*`（例如 `desktop-v1.0.0`）将触发 GitHub Actions，在 Releases 中附带 Windows 便携包。

## 许可证

与主项目相同，见仓库根目录 [LICENSE](../LICENSE)。
