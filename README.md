# hm_mijia
鸿蒙版本米家

## 为什么无法复用米家 RN 设备详情页

米家的设备详情页是 **React Native 插件**：每个设备型号一个独立的插件包（`/v2/plugin/fetch_plugin` 下发下载地址），而非 App 内置的固定页面。

实测下载台灯插件包确认，无法复用的根本原因是**两套 RN 运行时内核不兼容**：

| | 米家插件 bundle | 鸿蒙 RN 方案（RNOH）|
|---|---|---|
| React | 16.8.6 | 18.x |
| 架构 | 老架构（Paper + BatchedBridge）| 新架构（Fabric + TurboModule）|
| 通信桥 | BatchedBridge（异步 JSON 桥）| JSI 直连（**无桥**）|

- 米家插件是**自带 RN 0.60 老架构运行时的二进制包**，入口是 `init(config)`（插件初始化），启动时要初始化 `BatchedBridge`。
- RNOH 是新架构，**没有 BatchedBridge**，插件一加载就在运行时内核层崩溃，这不是补几个接口能解决的。
- RNOH 官方的 `61-interop` 兼容包是**源码级**兼容（需 `index.js` 源码重新打包），而米家只有编译后的二进制 bundle，**没有源码**。
- 反编译 bundle 理论可行（明文 JS），但重打包到新架构 + 重写米家私有 MIOT native 模块，等于重写米家插件宿主，投入产出不划算。

因此设备详情页采用**替代方案**：通过 miot-spec 协议（`/miotspec/prop/get`、`/miotspec/prop/set`）拿真实数据，用 ArkTS 手写卡片式 UI（控制能力完全真实，UI 观感靠定制逼近米家）。
