# 米家 App 原生鸿蒙（HarmonyOS NEXT）重写技术方案

> 创建：2026-10-16 ｜ 当前版本：v1.2 ｜ 状态：🔨开发中
> 页面/模块：整体技术方案（逆向分析 → 架构选型 → 分阶段实施）
> 状态说明：P0/P1 已开发完成（ArkTS 工程 + 登录 + 设备/家庭/场景，mock 联调），待接入真实小米云

---

## 0. 结论速览（TL;DR）

逆向目标为 **小米米家（Mijia）App**（包名 `com.xiaomi.smarthome`，APK 234MB，12642 个文件、15 个 dex、137 个 native `.so`），是小米官方的全屋智能家居控制中心。做「原生鸿蒙版本」本质上是**在一个全新操作系统上重建一个大型 IoT 平台级客户端**，工程量极大。本方案的核心判断：

- **不可能整体照搬**，必须**分期、分模块、以「鸿蒙原生 ArkTS + ArkUI」重建**，并复用小米云端能力（设备控制、账号、推送均走小米云 API）。
- 逆向产出的价值在于**梳理功能全景 + 明确技术栈 + 识别可复用的协议/数据结构**，而非直接翻译代码（IL2CPP/RN 无法直接移植）。
- 建议**先做 MVP（设备列表 + 控制 + 场景），再逐步补齐摄像头、3D 家庭、语音、支付等重模块**。

详见 [§2 逆向结论](#sec-2)、[§3 鸿蒙架构设计](#sec-3)、[§5 分期实施](#sec-5)。

---

## 1. 逆向分析范围与手段

### 1.1 分析目标

| 项 | 值 |
|---|---|
| 文件 | `C:\Users\ZhixinGong\Downloads\aa.apk` |
| 大小 | 234 MB |
| 文件数 | 12642 |
| 包名 | `com.xiaomi.smarthome`（小米米家） |

### 1.2 使用工具

- **REA（rea-agents 6.5.0 CLI）**：`analyze` / `decode-android-resources` 命令（原生反汇编需 Ghidra/Hopper/IDA 引擎，本机未配置，故未走深度反汇编；APK 资源解码需 apktool，本机未装）。
- **Python 脚本**（自写）：解包 APK → 解析 `AndroidManifest.xml`（UTF-16 字符串池）、`global-metadata.dat`（IL2CPP 元数据）、`ScriptingAssemblies.json`、`boot.config`、目录结构。

> 说明：REA 在本机**未完成深度反汇编**（缺 Ghidra/Hopper/IDA/apktool）。本文结论基于「清单/元数据/资源/字符串」层面的静态取证，已足以支撑技术方案；如需**函数级**逆向（协议细节、加密算法、鉴权流程），需补充安装 Ghidra 或 Hopper 后再用 REA 深挖，见 [§7 待补充逆向](#sec-7)。

---

## 2. 逆向结论

<a id="sec-2"></a>

### 2.1 应用定位

小米米家（Mijia）—— 小米生态链的**全屋智能家居统一控制入口**。核心能力：

- 设备接入与管理（WiFi / 蓝牙 / Zigbee / UWB / NFC）
- 家庭与房间管理、成员共享
- 场景自动化（specscene）、NFC 场景
- 摄像头监控（`listcamera`、`camera.*`，含 P2P 直连）
- 3D 家庭建模（`House3dActivity`，Unity 渲染）
- 语音助手（米音 `mico`）、支付（`mibi`）、商城
- 多厂商推送、崩溃上报、性能监控

### 2.2 技术栈全景（逆向取证）

| 层 | 技术 | 证据 |
|---|---|---|
| 主体框架 | 原生 Android（Java/Kotlin） | 15 个 `classes*.dex` + `assets/A3AEECD8.dex`（加固/壳） |
| 混合容器 | React Native（Hermes） | `assets/plugin_rn_sdk/sdk.bundle`、`libhermes.so`、`libreactnativejni.so`、`libyoga.so` |
| 3D/游戏引擎 | Unity + IL2CPP | `libil2cpp.so`、`libunity.so`、`global-metadata.dat`、`Mi.Main.dll`、`HybridCLR.Runtime.dll` |
| 热更新 | HybridCLR（IL2CPP 侧） | `HybridCLR.Runtime.dll` |
| 视频 | FFmpeg / ijkplayer / B站 | `libffmpegkit.so`、`libijkplayer.so`、`libijkffmpeg.so`、`libavcodec.so` |
| 摄像头 P2P | TUTK / PPCS | `libTUTKGlobalAPIs.so`、`libIOTCAPIs.so`、`libPPCS_API.so`、`libRDTAPIs.so`、`libAVAPIs.so` |
| AI 推理 | ONNX Runtime | `libonnxruntime.so` |
| 人脸识别 | 旷视 Megvii | `libtoyger.so`、`libMegviiIDCardQuality_1.2.2.so`、`liblivenessdetection_v2.4.7.so`、`com.alipay.zoloz.toyger.*` |
| 数据库 | Realm / MMKV | `librealm-jni.so`、`libmmkv.so` |
| 崩溃/APM | Bugly / Sentry / XCrash | `libBugly.so`、`libsentry*.so`、`libxcrash.so` |
| 推送 | 小米 + 华为 + vivo + OPPO + 魅族 + 极光 + getui | 多个 `*Push*`、`PushReceiver`、`getui.permission` |
| 支付 | 小米米币 mibi / 支付宝 / 微信 | `com.mibi.sdk.*`、`AlipayChannelActivity`、`WXPayEntryActivity` |
| 登录 | 小米账号（OpenAuth） | `com.xiaomi.account.openauth.AuthorizeActivity`、`AccountLoginActivity` |
| 微博分享 | 新浪微博 SDK | `libweibosdkcore.so`、`WbShareTransActivity` |
| 音频 | G.711 / Opus / WebRTC | `libG711.so`、`libopusJni.so`、`libwebrtc_apm.so` |
| 蓝牙 | inuker Bluetooth | `BluetoothService`、`ScanBleDeviceActivity` |

### 2.3 加固与逆向障碍

- 存在 `assets/A3AEECD8.dex` + `libA3AEECD8.so`，表明**主 dex 做了加固/加壳**（疑似自研或第三方壳），反编译困难。
- IL2CPP 代码编译为原生机器码（`libil2cpp.so`），无 C# IL，需 `Il2CppDumper` + Ghidra/IDA 配合 `global-metadata.dat` 才能还原函数逻辑。
- 云端交互走小米私有协议（`libmiio.so` / `libsmarthome_security.so` / `libEncryptorP.so`），协议细节在原生层。

> 综上：**功能全景可循，但「代码级照搬」不可行**，鸿蒙版只能按功能契约重建。

### 2.4 关键业务模块（Activity 级清单）

| 模块 | 代表组件 | 鸿蒙重建难度 |
|---|---|---|
| 家庭/房间 | `CreateHouseActivity`、`HomeEditorActivity`、`ShareHomeActivity`、`House3dActivity` | 中（3D 家庭难） |
| 设备管理 | `CommonDeviceEditActivity`、`DeviceLauncher2`、`ETHStationActivity` | 中 |
| 配网 | `WifiSettingNormal`、`KuailianLauncher`、`ScanBleDeviceActivity`、`NFCWifiListActivity` | 高（蓝牙/WiFi/NFC 底层） |
| 摄像头 | `JumperActivity`、`CameraSortActivity`、`ChooseSubCameraActivity`、`CameraNetChooseActivity` | 高（P2P 拉流） |
| 场景 | `SpecSceneEditPageV2`、`SpecSceneActionList`、`ScenePhoneGuide`、`NFCSceneRunActivity` | 中 |
| UWB | `UwbTestActivity`、`UwbMicoActivity`、`BindUwbTagDeviceActivity` | 高 |
| 语音 | `MicoWHIActivity`、`UwbMicoActivity` | 高 |
| 支付/商城 | `QrPayActivity`、`SignDeductEntryActivity`、`openshop` | 中 |
| 登录/账号 | `AccountLoginActivity`、`LoginQRActivity`、`AuthorizeActivity` | 中 |

---

## 3. 鸿蒙原生架构设计

<a id="sec-3"></a>

### 3.1 总体技术选型

| 维度 | 选型 | 理由 |
|---|---|---|
| 开发语言 | ArkTS | 鸿蒙 NEXT 主推，类型安全，承接原 Kotlin/TS 逻辑 |
| UI 框架 | ArkUI（声明式） | 官方，替代原 XML/RN 双栈 |
| 目标系统 | HarmonyOS NEXT（API 12+） | 「原生鸿蒙」即不含 AOSP 的纯血鸿蒙 |
| 网络 | `@ohos.net.http` / WebSocket | 与小米云交互 |
| 本地存储 | 关系型（`@ohos.data.relationalStore`）替代 Realm；键值用 Preferences 替代 MMKV | 鸿蒙原生能力 |
| 音视频 | `@ohos.multimedia.avplayer` / AVCodec 替代 ijkplayer/FFmpeg | 原生解码 |
| 摄像头 P2P | **关键难点**，见 [§3.4](#sec-3-4) | — |
| 推送 | 鸿蒙推送服务（HarmonyOS Push Kit）替代小米/多厂商推送 | 系统级 |
| 登录 | 小米账号 OpenAuth（Web/HTTP 流程） | 复用云端，SDK 需自研适配 |
| 崩溃监控 | HiLog + 自建上报 / `@ohos.hiviewdfx.hiAppEvent` | 替代 Bugly |

### 3.2 应用分层

```
┌─────────────────────────────────────────────┐
│  UI 层（ArkUI 页面/组件）                     │
│  首页 · 设备 · 家庭 · 场景 · 摄像头 · 我的    │
├─────────────────────────────────────────────┤
│  业务层（ArkTS service / 状态管理）          │
│  设备控制 · 场景引擎 · 家庭模型 · 配网流程    │
├─────────────────────────────────────────────┤
│  基础能力层（SDK 适配）                      │
│  网络 · 存储 · 推送 · 登录 · 支付 · 音视频   │
├─────────────────────────────────────────────┤
│  平台 API（HarmonyOS NEXT 系统能力）         │
│  蓝牙/WiFi/NFC/UWB/摄像头/定位/多模态         │
└─────────────────────────────────────────────┘
```

### 3.3 与小米云端的对接策略

逆向确认应用强依赖小米云服务。鸿蒙版应**复用同一云端**，而非自建后端：

- **设备控制**：小米 IoT 云（`api.io.mi.com` 域，经 `libmiio` 交互），需还原/复用其鉴权（登录态 token）与控制协议（通常是 HTTPS + JSON，部分私有加密）。**这是能否控制设备的核心**，需补充逆向（[§7](#sec-7)）。
- **账号体系**：小米账号 OAuth（`account.xiaomi.com`），鸿蒙侧自实现登录跳转与 token 换取。
- **推送**：设备事件经小米云推送 → 鸿蒙侧对接 Push Kit 自建通道（或小米云提供长连接）。

### 3.4 关键难点与可行性

<a id="sec-3-4"></a>

| 难点 | 说明 | 可行性 |
|---|---|---|
| 小米云私有协议 | `libmiio`/`libsmarthome_security` 加密鉴权在原生层，未开源 | ⚠️ 需逆向还原或走官方开放 API |
| 摄像头 P2P 拉流 | TUTK/PPCS 私有 P2P + 私有码流，鸿蒙无对应 SDK | ❌ 极高，建议一期排除或走云转码 |
| UWB / NFC 场景 | 依赖鸿蒙 UWB/NFC Kit 能力与硬件 | ⚠️ 视鸿蒙 API 成熟度 |
| 3D 家庭建模 | Unity 渲染，鸿蒙需 ArcUI 3D / 自绘 | ⚠️ 重，后置 |
| 语音助手 mico | 米音服务 + 音频链路 | ⚠️ 后置 |

---

## 3.5 设备控制协议设计（局域网 + 云端）

<a id="sec-3-5"></a>

经补充调研（[D5](#scheme-d5) 改走逆向、[D7](#scheme-d7) 两者都要），确定两条控制通道：

### 3.5.1 miIO 局域网协议（第一阶段实现）

基于开源 `python-miio` 已验证的协议（MIT/GPL 参考，鸿蒙侧自研重写）：

| 项 | 规格 |
|---|---|
| 传输 | UDP，端口 **54321** |
| 头部 | 32 字节：魔数 `0x2131`(2B) + 长度(2B) + 未知(4B=0) + 设备 ID(4B) + 时间戳(4B) + **token 校验和 MD5(16B)** |
| 加密 | AES-128-CBC，`key = MD5(token)`，`IV = MD5(key + token)`，PKCS7 填充 |
| 载荷 | JSON：`{"id":<seq>,"method":"set_power","params":[...]}` |
| 校验 | checksum = MD5(header + token + 密文) |

**token 获取（关键）**：
1. 局域网 hello 握手（向 54321 发固定 32 字节 `21310020ff...`，响应 checksum 即 token）—— 仅部分老设备支持。
2. 米家云 API 提取（`micloud` 方案）：登录小米账号 → 云上设备列表含 `token`/`did`/`localip` 字段 —— **自用场景主推此路径**。

### 3.5.2 米家云远程控制（第二阶段）

- 通过小米账号登录换取云凭证（`micloud` 已实现 challenge-response 登录握手），拿设备列表 + token。
- 远程控制走米家云 `api.io.mi.com` 私有接口（需进一步逆向 `libmiio`/`libsmarthome_security`）。
- token 提取与云端登录是同一套「账号登录 → 云 API」链路，可一次打通。

### 3.5.3 鸿蒙侧实现要点

- UDP：`@kit.NetworkKit` `socket.constructUDPSocketInstance()`。
- AES-CBC：`@ohos.security.cryptoFramework`（`cipher.createCipher`，含 PKCS7）。
- MD5：`@ohos.security.cryptoFramework` `md.createMd('MD5')`。
- 设备发现/控制封装在 `service/MiioClient.ets`（新增）。

---

## 4. 待确认决策点

<a id="sec-4"></a>
<a id="scheme-d1"></a>
<a id="scheme-d2"></a>
<a id="scheme-d3"></a>
<a id="scheme-d4"></a>
<a id="scheme-d5"></a>
<a id="scheme-d6"></a>
<a id="scheme-d7"></a>

| 编号 | 决策点 | 备选项 | 建议 |
|---|---|---|---|
| [D1](#scheme-d1) | 目标系统范围 | A. 纯 HarmonyOS NEXT；B. 兼容 Android（跨端框架） | ✅已确认：A（2026-10-16） |
| [D2](#scheme-d2) | 是否复用小米云 | A. 复用官方云；B. 自建中转后端 | ✅已确认：A（2026-10-16） |
| [D3](#scheme-d3) | 一期 MVP 范围 | A. 设备列表+控制+场景；B. 加摄像头；C. 全量 | ✅已确认：A（2026-10-16） |
| [D4](#scheme-d4) | 摄像头 P2P 策略 | A. 云转码（HLS/FLV）；B. 自研 P2P；C. 一期不做 | ✅已确认：C（一期不做，后续走云转码） |
| [D5](#scheme-d5) | 小米云协议获取 | A. 官方开放 API/SDK；B. 逆向还原私有协议 | ❌已废弃 A → ✅改走 B（逆向）：官方控制端 Open API 仅限「控制自家产品」，不开放「控制用户已有设备」；本 App 定位自用/内部工具，改逆向 miIO 局域网协议 + 米家云 token 提取 |
| [D6](#scheme-d6) | 是否需要官方授权 | A. 已获小米授权/合作；B. 自用/内部演示 | ✅已确认：B（自用/内部工具，非商用发布） |
| [D7](#scheme-d7) | 控制范围 | A. 局域网；B. 云端远程；C. 两者都要 | ✅已确认：C（两者都要，先局域网后云端） |

---

## 5. 分期实施计划

<a id="sec-5"></a>

| 阶段 | 目标 | 关键工作 | 状态 |
|---|---|---|---|
| P0 | 可运行骨架 | ArkTS 工程、路由、主题、网络/存储基础 | ✅ |
| P1 | MVP | 登录、设备列表、设备控制、家庭/房间、场景 | ✅（mock 联调，待接真实云） |
| P2 | 增强 | 摄像头（云转码）、推送、配网 | ⏳ |
| P3 | 高阶 | 3D 家庭、语音、UWB/NFC、支付商城 | ⏳ |
| P4 | 稳定化 | 性能、崩溃治理、灰度发布 | ⏳ |

---

## 6. 实施清单

<a id="sec-6"></a>

| 序号 | 任务 | 依赖 | 状态 |
|---|---|---|---|
| 1 | 搭 ArkTS 工程 + 目录规范 | — | ✅（mjhm/ 工程已建） |
| 2 | 小米账号 OAuth 登录 | D2/D5 | ✅（占位 + mock，待真实 OAuth） |
| 3 | 小米云设备列表/控制协议对接 | D2/D5 | 🔨（mock 联调完成，待官方 API 参数） |
| 4 | 设备控制 UI（开关/参数面板） | 3 | ✅ |
| 5 | 家庭/房间模型 + UI | 3 | ✅ |
| 6 | 场景引擎（条件-动作） | 3 | ✅ |
| 7 | 推送通道接入 | 2 | ⏳ |
| 8 | 摄像头云转码接入 | D4 | ⏳ |
| 9 | 配网（WiFi/蓝牙） | — | ⏳ |
| 10 | 3D 家庭 / 语音 / UWB / 支付 | D3 | ⏳ |

---

## 7. 待补充逆向

<a id="sec-7"></a>

当前未做**函数级**逆向，以下内容需进一步取证（安装 Ghidra 后经 REA 完成）：

1. 小米云设备控制协议与加密算法（`libmiio`、`libsmarthome_security`、`libEncryptorP`）。
2. 登录鉴权与 token 换取流程（`AccountLoginActivity` 及账号 SDK）。
3. IL2CPP 业务逻辑（`Mi.Main.dll`）—— 用 `Il2CppDumper` 配合 `global-metadata.dat` 还原类型/方法。
4. RN 插件（`sdk.bundle`）中可复用的协议/数据结构。
5. 摄像头 P2P 信令（TUTK/PPCS）——若 D4 选自研。

---

## 8. 实施记录（P0/P1）

<a id="sec-8"></a>

### 8.1 实际改动文件清单

工程位于 `mjhm/`，采用 HarmonyOS NEXT Stage 模型：

| 文件 | 说明 |
|---|---|
| `AppScope/app.json5` | bundleName `com.mijia.hm`、应用名「米家」 |
| `build-profile.json5` / `hvigor-config.json5` / `oh-package.json5` | 构建配置（compileSdk 5.0.0(12)） |
| `entry/src/main/module.json5` | 模块配置 + 权限声明（网络/蓝牙/定位/后台） |
| `entry/src/main/resources/base/profile/main_pages.json` | 页面路由注册（8 个页面） |
| `entry/src/main/ets/entryability/EntryAbility.ets` | 应用入口 |
| `entry/src/main/ets/common/AppConfig.ets` | 全局配置（小米云/OAuth 端点、mock 开关） |
| `entry/src/main/ets/service/HttpClient.ets` | HTTP 封装（token 注入、超时、错误归一化） |
| `entry/src/main/ets/service/Storage.ets` | 本地存储（Preferences，替代 MMKV） |
| `entry/src/main/ets/service/ApiService.ets` | 小米云 API 层（家庭/设备/场景 + mock 兜底） |
| `entry/src/main/ets/model/Models.ets` | 数据模型（Device/Room/Home/Scene/UserInfo） |
| `entry/src/main/ets/pages/*.ets` | 8 个页面（Index/Login/Home/DeviceList/DeviceControl/RoomList/SceneList/SceneEdit） |

### 8.2 与原方案的偏差

1. **图标为占位纯色 PNG**：真实图标资源待设计稿提供后替换。
2. **登录走 mock**：真实小米 OAuth 需 `OAUTH_CLIENT_ID` 及回调配置，当前 `ApiService.loginWithOAuth` 用 mock code 换取用户态（见 `AppConfig.ENABLE_MOCK`）。
3. **设备协议为 mock**：`ApiService` 已按官方开放 API 预留 endpoint（`api.io.mi.com`），响应解析待官方接口文档对齐。

### 8.3 验证结果

- 工程结构、资源引用、页面路由均已就绪，**未经 DevEco Studio 编译验证**（本机无 HarmonyOS SDK/DevEco 环境）。
- mock 数据链路（家庭→房间→设备→控制→场景）逻辑完整。

### 8.4 遗留待办

1. 装 DevEco Studio + HarmonyOS SDK 做首次编译与真机联调。
2. 接入真实小米 OAuth 与设备控制协议（依赖 [D5](#scheme-d5) 的官方 API 文档）。
3. P2~P4 功能（摄像头/推送/配网/3D/语音/支付）待后续迭代。

### 8.5 控制协议层实现（v1.3 追加）

| 文件 | 说明 |
|---|---|
| `service/MiCrypto.ets` | miIO 加密工具：MD5 派生 key/IV、AES-128-CBC（`@ohos.security.cryptoFramework`） |
| `service/MiioClient.ets` | miIO 局域网客户端：UDP 54321、32 字节头、token 校验和、`discoverToken` hello 握手 |
| `service/MiCloud.ets` | 米家云 token 提取：小米账号登录（challenge-response 骨架）+ 设备列表（token/did/localip） |
| `service/ApiService.ets` | `controlDevice` 优先走 miIO 局域网协议；新增 `syncCloudDevices` 拉取真实设备 |
| `model/Models.ets` | `Device` 增加 `token`/`ip` 字段 |

**偏差说明**：`MiCloud.login` 的 challenge-response 签名逻辑为骨架占位，需按 `micloud` 完整流程补全（ssecurity/nonce + 密码多次 MD5）。

---

## 迭代记录

| 版本 | 时间 | 变更内容 |
|---|---|---|
| v1.4 | 2026-10-16 12:20 | **用 jadx 完成 APK 函数级逆向**，修正全部协议错误：域名 api.io.mi.com→**api.mijia.tech**；设备列表 /home/device_list→**/v2/home/device_list_page**（顶层 list + 分页）；Cookie userId→**cUserId**+channel+countryCode；新增云端远程控制 /home/rpc/{did}；重写除登录页外全部页面（首页网格布局/设备列表分组/控制面板/房间/场景） |
| v1.3 | 2026-10-16 10:20 | 明确目标为自用/内部工具（D6=B）；D5 从「官方 API」改为「逆向协议」；新增 D7 控制范围=两者都要；新增 §3.5 控制协议设计（miIO 局域网 + 米家云） |
| v1.2 | 2026-10-16 10:10 | 开发完成：P0/P1 实施记录回写（§8），ArkTS 工程 + 登录/设备/家庭/场景已实现（mock 联调） |
| v1.1 | 2026-10-16 10:02 | 决策点 D1~D6 全部确认（D1=A/D2=A/D3=A/D4=C/D5=先A后B/D6=A），进入 P1 MVP 开发 |
| v1.0 | 2026-10-16 09:55 | 初版：逆向分析结论 + 鸿蒙原生重写技术方案（架构选型、决策点、分期实施） |
