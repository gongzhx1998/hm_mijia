# 米家 RN 插件实验宿主（C2）

## 白屏修复说明（2026-10-21）
- 旧版用 about:blank + loadUrl(resource://...?query)，ArkWeb 上常导致一直白屏，且 onPageEnd 误报「加载完成」。
- 现改为：Web 初始 src=`$rawfile(rnhost/index.html)`（应立刻见橙色条+底部绿日志），同时把 rawfile 拷到 filesDir 后用 file:// 再加载以便 XHR 拉 13MB bundle。
- 已开启 `WebviewController.setWebDebuggingAccess(true)`，电脑 Chrome 可开 `chrome://inspect`。

## 真机请重新编译安装后再进「米家原版插件（实验）」
应先看到橙色横幅与底部黑色日志区；日志里有 loc=/script ok/fetchText/boot ok。

sdk/ 与 plugin/ 已 gitignore，勿公开发布。
