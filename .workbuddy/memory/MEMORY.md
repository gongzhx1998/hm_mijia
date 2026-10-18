# 项目长期记忆 — 米家 App 鸿蒙重写

## ArkTS 编译规则（血泪教训，必须遵守）

写 ArkTS 代码时，以下规则务必先确认再写，避免反复编译报错：

1. **Web 组件必须传 controller**：`Web({ src, controller })`，不能只传 `src`。controller 用 `new webview.WebviewController()`，import 用 `import { webview } from '@kit.ArkWeb'`。报错 `Property 'controller' is missing`。
2. **动态 JSON 一律用 `Record<string, Object>`**：ArkTS 禁止自定义索引签名 `[key: string]`，禁止对非 Record 类型做 `obj['key']` 索引访问。
3. **禁止 any/unknown**：显式声明 interface 类型。
4. **禁止对象字面量当类型**：传参/返回的对象字面量必须有明确 interface 或 Record 标注。
5. **禁止解构** `const { a, b } = obj`：用 `.a`/`.b`。
6. **禁止 `.find/.filter/.map`**：用 for 循环手写。
7. **this 不能用于独立函数/静态方法**：service 层用模块级函数 + 模块级变量；页面 @Component/@Builder 里的 this 合法。
8. **加密 API 参数必须带 `algName`**：如 `IvParamsSpec` 要 `{ algName: 'IvParamsSpec', iv: { data } }`。
9. **http 方法用枚举**：`http.RequestMethod.GET/POST`，不用字符串。
10. **throw 只能抛 Error 子类**。
11. **UDP bind 参数是 `socket.NetAddress`**，不是 UDPBindOptions。
12. **resp.cookies 是 string**，需 `String(resp.cookies).split(';')` 转数组。

## 关键技术决策

- 目标：米家 App（com.xiaomi.smarthome）鸿蒙原生重写，自用工具。
- 控制协议：miIO 局域网（UDP 54321 + AES-128-CBC，key=MD5(token)/IV=MD5(key+token)）+ 米家云（micloud 三步握手登录 + 签名请求）。
- 小米官方控制端 API 不开放给第三方控制用户设备，故走逆向协议路线。
- 全真实数据，无 mock。
- deviceId 必须持久化（跨登录保持一致），否则二次验证死循环。
- **小米二次验证必须带会话 Cookie**：验证信任状态绑定在 Cookie 会话上，登录步骤间（step1/step2/step3/重试）必须用模块级 Cookie 罐保持并回传 Set-Cookie，否则验证完成后重试仍被要求验证。
- **二次验证的正确做法**：http 模块与 WebView 是两套隔离 Cookie，验证必须在 WebView 内完成并自动跳转 sts 回调，用 `webview.WebCookieManager.fetchCookieSync`（静态方法）读 Cookie 拿 serviceToken，再 `configCookieSync` 同步 http 模块会话 Cookie 到 WebView。验证页是 account.xiaomi.com 域，serviceToken 写在 sts.api.io.mi.com/api.io.mi.com 域，两个域都要读。
- 参考 go-micloud（wangbjun/go-micloud）：短信验证走 `/auth/sendPhoneTicket` + `/auth/verifyPhone`（sid=passport 网页流程），二次验证走 notificationUrl 安全验证页。
- **sid 与域名强绑定（决定性，别再搞反）**：aa.apk 反编译 ir7.java `OooOoo0()`/`OooOoOO()` + kpa.java 域名映射 + Do1e/mijia-api 三方一致确认：
  - **中国大陆 → sid=`mijia`，API=`api.mijia.tech`，Cookie 域=`.mijia.tech`**
  - **海外 → sid=`xiaomiio`，API=`api.io.mi.com`，Cookie 域=`.io.mi.com`**
  - 判定逻辑 `d98.OoooO(serverBean)`：serverBean==null/CN/st → false(→mijia)，海外 → true(→xiaomiio)。
  - 之前错配 `sid=xiaomiio` + `api.mijia.tech`，签发的 serviceToken 是海外 scope，请求大陆 api.mijia.tech 被拒 → 401 auth error（这是之前一直 401 的最终根因）。
- **serviceToken 签发（关键，别再走弯路）**：大陆 sid=mijia 的登录三步 = GET serviceLogin → POST serviceLoginAuth2 → **直接 GET location（无 clientSign、无 _userIdNeedEncrypt）**，serviceToken 从 **sts 重定向链的 Set-Cookie** 拿（不是 header，不是 location 的 auth 参数）。参考可工作的第三方库 Do1e/mijia-api、yaomaolei/mijia-api。之前"clientSign + header 拿 token"是海外 XMPassport 流程，大陆不适用。
- **鸿蒙 http 组件会自动跟随 302 重定向且无法禁用**（官方论坛确认），会导致 sts 中间 Set-Cookie 丢失；需手动控制重定向的流程一律用 `rcp`（RemoteCommunicationKit）+ `transfer.autoRedirect:false` 手动逐跳跟随累积 Set-Cookie。
- **⚠️ 协议已升级 RC4 → AES（2026）——已从 11.8.705 反编译出完整算法**：api.mijia.tech 对 RC4 返回 401，iOS/Android 11.8.x 用 AES（`ENCRYPT-AES` + `aes_hash__`）。旧 aa.apk=11.7.709 只有 `Crypto.RC4`（无 AES）。AES 算法（反编译 vd.java `OooOO0` + vr2.java + x4d.java + zba.java）：
  - **nonce**：base64(8字节随机 + 4字节分钟时间戳大端)，与 RC4 完全一致（vr2.OooO00o：writeLong+writeInt）。
  - **signed_nonce**：base64(SHA256(base64decode(ssecurity) ‖ base64decode(nonce)))，与 RC4 一致（x4d.OooO0oO=concat，zba.Oooooo0=SHA256）。
  - **AES key** = base64decode(signed_nonce)（32字节）；**AES IV** = 12字节随机（SecureRandom）。
  - **加密**：每个参数独立 `AES-256-GCM`（`Cipher.getInstance("AES/GCM/NoPadding")`，`GCMParameterSpec(128, iv)`），key=32字节、iv=12字节、tag=128位。每个参数都用同一个 key+iv 单独 doFinal。
  - **aes_hash__ = base64(iv)**（就是 GCM 的 12 字节 IV，**不是 hash**！之前困惑的"12字节"就是它）。
  - **signature**：base64(SHA1("POST&{path}&aes_hash__={b64(iv)}&data={enc_data}&{signed_nonce}"))，参数按 **TreeMap 字典序**排序（aes_hash__ 在 data 前），path 同 RC4 不含 /app。
  - **请求体**：{data, aes_hash__, signature, _nonce}，**无 ssecurity 字段**。
  - **响应解密**：AES-256-GCM 解密（同 key+iv），若响应头 MIOT-CONTENT-ENCODING=GZIP 再 GZIP 解压（vd.OooO0oo）。
  - 抓包验证吻合：data 79字节=63明文+16tag；aes_hash__ 12字节=IV。
