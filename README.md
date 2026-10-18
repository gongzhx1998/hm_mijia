# hm_mijia

鸿蒙（HarmonyOS NEXT）版米家 App，自用工具。逆向米家私有协议实现，全真实数据、无 mock。

## 已实现功能

- **登录鉴权**：米家云私有协议（micloud 三步握手 + AES-256-GCM 加密签名），大陆域 `sid=mijia`
- **家庭 / 房间 / 设备列表**：真实拉取（`gethome_merged` + `device_list_page`）
- **家庭切换、房间筛选**：多家庭、多房间按归属过滤
- **设备控制**：miot-spec 协议云端控制（电源、亮度、升降、记忆位、模式、灵敏度等）
- **设备详情页**：spec 定义动态渲染 + 升降桌 / 台灯定制卡片
- **首页**：家庭名切换弹层、房间列表弹层、设备卡快捷开关（对齐米家原版样式）

## 维护状态

> 本库不再更新，仅作存档。

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
