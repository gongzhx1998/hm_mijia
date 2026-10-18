# 米家鸿蒙原生重写（Mijia HarmonyOS NEXT）

基于逆向分析（目标：小米米家 `com.xiaomi.smarthome`）重建的原生鸿蒙客户端。

## 技术栈

- ArkTS + ArkUI（声明式）
- HarmonyOS NEXT（Stage 模型，API 12 / compileSdk 5.0.0(12)）
- 网络：`@kit.NetworkKit`；存储：`@kit.ArkData` Preferences

## 目录结构

```
mjhm/
├── AppScope/                    # 应用级配置（bundleName、图标、名称）
├── entry/
│   ├── src/main/
│   │   ├── module.json5        # 模块配置 + 权限声明
│   │   ├── ets/
│   │   │   ├── entryability/   # EntryAbility
│   │   │   ├── pages/          # 页面（Index/Login/Home/DeviceList/DeviceControl/RoomList/SceneList/SceneEdit）
│   │   │   ├── common/         # AppConfig、Logger
│   │   │   ├── service/        # HttpClient、Storage、ApiService、MiioClient、MiCrypto、MiCloud
│   │   │   └── model/          # 数据模型
│   │   └── resources/
│   └── build-profile.json5
├── build-profile.json5
└── oh-package.json5
```

## 已实现（P1 MVP）

- [x] 启动路由（登录态判断）
- [x] 登录页（小米账号 OAuth 占位 + mock）
- [x] 首页（房间 Tab + 设备卡片 + 快捷开关 + 底部导航）
- [x] 设备列表 / 设备控制（开关、亮度滑杆）
- [x] 房间列表
- [x] 场景列表 / 场景编辑（条件-动作引擎）
- [x] miIO 局域网控制协议（`service/MiioClient.ets` + `service/MiCrypto.ets`）
- [x] 米家云 token 提取（`service/MiCloud.ets`，登录拉取设备 token/ip）

## 控制协议说明

本 App 定位**自用/内部工具**，控制用户已有米家设备，走逆向协议（非官方 Open API，官方仅限控制自家产品）：

1. **局域网**：miIO 协议（UDP 54321 + AES-128-CBC），`key=MD5(token)`、`IV=MD5(key+token)`。
2. **云端**：小米账号登录 → 米家云设备列表提取 token/did/localip（第二阶段远程控制需进一步逆向）。

token 获取：局域网 hello 握手（部分老设备）+ 米家云 API 提取（`micloud` 方案，自用主推）。

## 关键接入点（TODO）

当前 `AppConfig.ENABLE_MOCK = true`，UI 走 mock 数据。接入真实控制时：

1. 在 `common/AppConfig.ets` 设置 `ENABLE_MOCK = false`。
2. 用 `ApiService.syncCloudDevices(账号, 密码)` 拉取真实设备（含 token），即可局域网控制。
3. 米家云登录签名逻辑（`MiCloud.login` 的 challenge-response）需按 micloud 流程补全。

## 构建

用 DevEco Studio 打开本目录，或通过 `hvigorw` 命令行构建：

```bash
# 需要 HarmonyOS SDK + hvigor 环境
hvigorw assembleHap
```

## 相关文档

- 技术方案：`docs/2026年10月份/16日/米家App原生鸿蒙重写技术方案.md`
