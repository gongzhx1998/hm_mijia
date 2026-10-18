# 米家云 API 协议逆向文档

> 反编译来源：米家 Android App `11.8.705`（`classes10.dex` → `_m_j/vd.java`、`_m_j/vr2.java`，`classes9.dex` → `_m_j/x4d.java` 等）
> 反编译工具：jadx 1.5.6（需 JDK 17，系统默认 Java 8 会报 `UnsupportedClassVersionError`）
> 本文档记录登录、请求加密、Cookie、接口的完整逆向结论，供后续修改对照。

---

## 1. 服务器与域名映射

由 `ir7.java`（`OooOoo0()` / `OooOoOO()`）、`kpa.java`、`d98.java` 三方确认，**sid 与域名强绑定**：

| 地区 | sid | API 域名 | Cookie 域 |
|------|-----|----------|-----------|
| **中国大陆** | `mijia` | `https://api.mijia.tech/app` | `.mijia.tech` |
| **海外** | `xiaomiio` | `https://{region}.api.io.mi.com/app` | `.io.mi.com` |

判定逻辑 `d98.OoooO(serverBean)`：`serverBean==null/CN/st → false(→mijia)`，海外 → true(→xiaomiio)。

> ⚠️ 曾经错配 `sid=xiaomiio` + `api.mijia.tech`，签发的 serviceToken 是海外 scope，请求大陆 API 被拒 → 401。

---

## 2. 登录流程（micloud 三步握手）

```
① GET  https://account.xiaomi.com/pass/serviceLogin?sid=mijia&_json=true
   响应：_sign、qs、callback

② POST https://account.xiaomi.com/pass/serviceLoginAuth2?_json=true
   form：sid=mijia  _sign  qs  callback  user=<账号>  hash=<MD5(密码)大写>  _json=true
   响应：code=0, ssecurity, location, userId, nonce

③ GET  <location>   （location 是 sts 重定向链，直接 GET，无 clientSign、无 _userIdNeedEncrypt）
   响应：302 → ... → 200 "ok"，每跳 Set-Cookie 累积：serviceToken / cUserId / userId / passToken
```

**关键点**：
- `hash = MD5(密码)` 的十六进制**大写**。
- `ssecurity` 只能来自 **step2 serviceLoginAuth2 的响应**；GET serviceLogin 返回的 ssecurity 是**无效占位值**，不能用于签名。
- `serviceToken` 从 **step3 的 Set-Cookie** 拿（不是响应 header，也不是 location 的 auth 参数）。
- **cUserId 与 userId 是两个不同的值**（见 §4）。

### 二次验证（2FA）

- step2 返回 `code!=0` 且带 `notificationUrl` → 账号开了二次验证，需在 WebView 内完成验证。
- 验证必须在 WebView 内完成（http 模块与 WebView 是两套隔离 Cookie），完成后用 `webview.WebCookieManager` 读 Cookie 拿 serviceToken。
- 验证完成后**重放 serviceLoginAuth2** 拿正确 ssecurity（`replayAuth2ForSsecurity`），不要走 GET serviceLogin 兜底（占位值）。

---

## 3. 请求加密协议

`miot-encrypt-algorithm` 请求头决定加密方式。**当前（11.8.x）是 AES，RC4 已被弃用**（服务器对 RC4 返回 401 auth error）。

### 3.1 共同部分：nonce 与 signed_nonce（RC4/AES 一致）

```
nonce        = base64( 8字节随机 + 4字节分钟时间戳大端 )   // vr2.OooO00o: writeLong(随机) + writeInt((now+timeDiff)/60000)
signed_nonce = base64( SHA256( base64decode(ssecurity) ‖ base64decode(nonce) ) )
               // x4d.OooO0oO=concat 字节数组，zba.Oooooo0=SHA256
```

`ssecurity` 是 16 字节 base64（24 字符），`nonce` 是 12 字节 base64（16 字符），`signed_nonce` 是 32 字节 base64（44 字符）。

### 3.2 AES-256-GCM（当前协议，ENCRYPT-AES）

```
aes_key = base64decode(signed_nonce)      // 32 字节（AES-256）
aes_iv  = 12 字节随机（SecureRandom）

每个参数（data 等）独立加密（同一个 key + 同一个 iv）：
    encrypted = base64( AES-256-GCM( plaintext, key=aes_key, iv=aes_iv, tag=128bit ) )
    // Java: Cipher.getInstance("AES/GCM/NoPadding") + GCMParameterSpec(128, iv)
    // 输出 = ciphertext ‖ tag（16 字节 tag 拼接在末尾）

aes_hash__ = base64(aes_iv)               // ★ 就是 GCM 的 12 字节 IV，不是 hash！

signature = base64( SHA1( "POST" + "&" + path + "&" + 参数字典序拼接 + "&" + signed_nonce ) )
    // 参数按 TreeMap 字典序排序：aes_hash__ 排在 data 前面
    // 即 SHA1("POST&/v2/home/device_list_page&aes_hash__=xxx&data=xxx&" + signed_nonce)
    // path 不含 /app 前缀

请求体（form urlencoded）：
    data=<加密后的data>  aes_hash__=<base64(iv)>  signature=<签名>  _nonce=<nonce>
    ★ 无 ssecurity 字段
```

**响应解密**（vd.OooO0oo）：
```
plaintext = AES-256-GCM 解密( base64decode(response), key=aes_key, iv=aes_iv )
若响应头 MIOT-CONTENT-ENCODING=GZIP → 先 GZIP 解压
```

> 注意：`data` 的密文长度 = 明文长度 + 16（tag）。之前抓包里 data=79 字节 = 63 明文 + 16 tag，即由此而来。

### 3.3 RC4（旧协议，ENCRYPT-RC4，已弃用）

```
rc4_hash__ = base64(SHA1("POST&path&data=<明文>&signed_nonce"))
每个参数用 RC4 加密：key = base64decode(signed_nonce)，先丢弃前 1024 字节密钥流
signature  = base64(SHA1("POST&path&data=<密文>&rc4_hash__=<密文>&signed_nonce"))  // 加密后计算
请求体：{data, rc4_hash__, signature, ssecurity, _nonce}   // 带 ssecurity
```

---

## 4. Cookie 结构（关键！）

请求头 Cookie（AES 请求）：

```
cUserId=<cUserId>; yetAnotherServiceToken=<serviceToken>; serviceToken=<serviceToken>;
timezone_id=Asia/Shanghai; timezone=GMT+08:00; is_daylight=0; dst_offset=0;
channel=MI_APP_STORE; countryCode=CN; PassportDeviceId=<deviceId>; locale=zh_CN
```

**★ 最重要的坑：`cUserId` 不是 `userId`！**

- `userId` = 纯数字账号 id（如 `166904385`），来自 step2 响应。
- `cUserId` = sts 返回的**另一个独立会话串**（如 `1tFjBdSkRYX8VnpB6hPDJdRVwsY`，30 字符），来自 step3 的 Set-Cookie。

实测：`cUserId=<userId>` 会返回 **401 auth error**；`cUserId=<真正的cUserId>` 返回 200。这是之前一直 401 的最终根因之一。

其余请求头：

```
x-xiaomi-protocal-flag-cli: PROTOCAL-HTTP2
miot-encrypt-algorithm: ENCRYPT-AES
accept-encoding: identity          # 不发送 miot-accept-encoding:GZIP，让服务器返回不压缩响应
User-Agent: <Android/iOS UA>
```

---

## 5. HTTP 接口

| 接口 | 路径 | 明文 data（示例） |
|------|------|-------------------|
| 家庭列表 | `/v2/homeroom/gethome_merged` | `{"fg":true,"fetch_share":true,"fetch_share_dev":true,"fetch_cariot":true,"limit":300,"app_ver":7,"plat_form":0}` |
| 设备列表 | `/v2/home/device_list_page` | `{}` |
| 用户配置 | `/user/get_user_config` | `{"component_id":0,"keys":[...]}` |

- 签名里的 `path` 不含 `/app` 前缀（即 `/v2/home/device_list_page`）。
- 完整 URL = API 域名 + path = `https://api.mijia.tech/app/v2/home/device_list_page`。

---

## 6. 关键教训（血泪史，别重蹈覆辙）

1. **sid 与域名强绑定**：大陆 = `mijia` + `api.mijia.tech`；海外 = `xiaomiio` + `api.io.mi.com`。错配 → 401。
2. **cUserId ≠ userId**：Cookie 里的 cUserId 必须用 sts 返回的 cUserId 串，用 userId 会 401。
3. **serviceToken 从 Set-Cookie 拿**：不是 header、不是 location 的 auth 参数。
4. **ssecurity 只认 serviceLoginAuth2 响应**：GET serviceLogin 的是占位值。
5. **鸿蒙 http 组件会自动跟随 302 且无法禁用**：登录的 sts 重定向链必须用 `rcp` + `autoRedirect:false` 手动逐跳累积 Set-Cookie。
6. **RC4 已弃用**：11.8.x 起用 AES-256-GCM（`ENCRYPT-AES` + `aes_hash__`），`aes_hash__` = base64(IV)。
7. **nonce 的 19 位 Long 会丢精度**：JS `JSON.parse` 把 nonce 转 double 丢精度，需从原始文本正则提取字符串。

---

## 7. 代码位置

| 文件 | 内容 |
|------|------|
| `mjhm/entry/src/main/ets/service/MiCloud.ets` | 登录、signedPost（AES 加密）、Cookie 构造、rcp 重定向 |
| `mjhm/entry/src/main/ets/service/MiCrypto.ets` | aesGcmEncrypt/aesGcmDecrypt、sha1/sha256/md5、rc4、base64 |
| `mjhm/entry/src/main/ets/common/AppConfig.ets` | `IOT_API_BASE = https://api.mijia.tech/app` |
