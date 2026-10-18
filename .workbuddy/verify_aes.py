import base64, hashlib, os, struct, time, urllib.request
from Crypto.Cipher import AES

# 日志里的真实登录态（13:24 登录）
SSECURITY = "pf158rBPpQcJYcxbWiDFOQ=="
SERVICE_TOKEN = "DfwPZDvBuvL64du4vb9LQpddgvwxl1A7EA7M07tQzu+ua/57X/N1KWmyMiah8uN+mSN4R48TkwzQUaGmvL3WCsJYAj1kbZS04//CR/tkGOTpLF/FEpSBbSc8LKL7dqYqkPyJn1D9BOc714lNnFlE3MfcuK+VRXDwxLJw/+SbbgS0AOxfm8C+49onpVlJASqT"
USER_ID = "166904385"

def gen_nonce():
    b = os.urandom(8) + struct.pack('>i', int(time.time() * 1000 // 60000))
    return base64.b64encode(b).decode()

def signed_nonce(ssecurity, nonce):
    m = hashlib.sha256()
    m.update(base64.b64decode(ssecurity))
    m.update(base64.b64decode(nonce))
    return base64.b64encode(m.digest()).decode()

def sign(method, path, params, signed_nonce_str):
    parts = [method.upper(), path]
    for k in sorted(params.keys()):  # TreeMap 字典序
        parts.append(f"{k}={params[k]}")
    parts.append(signed_nonce_str)
    s = "&".join(parts)
    return base64.b64encode(hashlib.sha1(s.encode()).digest()).decode()

def request(url_path, data_json):
    nonce = gen_nonce()
    sn = signed_nonce(SSECURITY, nonce)
    key = base64.b64decode(sn)  # 32 字节
    iv = os.urandom(12)  # 12 字节随机

    # AES-256-GCM 加密 data
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ct, tag = cipher.encrypt_and_digest(data_json.encode())
    enc_data = base64.b64encode(ct + tag).decode()  # ciphertext ‖ tag

    iv_b64 = base64.b64encode(iv).decode()  # aes_hash__ = base64(iv)

    # signature（参数字典序）
    enc_params = {"data": enc_data, "aes_hash__": iv_b64}
    signature = sign("POST", url_path, enc_params, sn)

    body = {
        "data": enc_data,
        "aes_hash__": iv_b64,
        "signature": signature,
        "_nonce": nonce,
    }

    cookie = (f"cUserId={USER_ID}; yetAnotherServiceToken={SERVICE_TOKEN}; "
              f"serviceToken={SERVICE_TOKEN}; timezone_id=Asia/Shanghai; timezone=GMT+08:00; "
              f"is_daylight=0; dst_offset=0; channel=MI_APP_STORE; countryCode=CN; "
              f"PassportDeviceId=DEEB589BCB3D1545; locale=zh_CN")
    # 新版 Android UA（版本 11.8.705，避免旧 APPV/62830 被拒）
    ua = ("Android-15-11.8.705-Xiaomi-23046RP50C-OS2.0.212.0.VMYCNXM-"
          "0123456789ABCDEF0123456789ABCDEF0123456789AB-CN-"
          "0123456789ABCDEF0123456789ABCDEF-0123456789ABCDEF0123456789ABCDEF-"
          "SmartHome-MI_APP_STORE-0123456789ABCDEF0123456789ABCDEF0123456789AB|"
          "0123456789ABCDEF0123456789ABCDEF|0-64")
    headers = {
        "User-Agent": ua,
        "Content-Type": "application/x-www-form-urlencoded",
        "x-xiaomi-protocal-flag-cli": "PROTOCAL-HTTP2",
        "miot-encrypt-algorithm": "ENCRYPT-AES",
        "accept-encoding": "identity",
        "miot-origin-request-version": "android;phone;11.8.705.311",
        "operate-common": "_region=CN&_language=ZH_CN&_deviceId=03CC589B4617E5C354AEACA704CE71B758643751&_appVersion=11.8.705&_platform=0&_platformVersion=15",
        "domain-refer": "api.mijia.tech",
        "origin-from": "MiHome",
        "Cookie": cookie,
    }
    data = urllib.parse.urlencode(body).encode()
    req = urllib.request.Request("https://api.mijia.tech/app" + url_path, data=data, headers=headers, method="POST")
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        print("STATUS:", resp.status)
        raw = resp.read().decode("utf-8", "replace")
        print("BODY(前300):", raw[:300])
        # 尝试 AES-GCM 解密响应（用同一个 key+iv）
        try:
            raw_bytes = base64.b64decode(raw.strip())
            dec = AES.new(key, AES.MODE_GCM, nonce=iv)
            plain = dec.decrypt_and_verify(raw_bytes[:-16], raw_bytes[-16:])
            print("解密成功:", plain.decode("utf-8", "replace")[:500])
        except Exception as e:
            print("响应解密失败(可能是明文错误):", e)
    except urllib.error.HTTPError as e:
        print("HTTP ERROR:", e.code)
        print("BODY:", e.read().decode("utf-8", "replace")[:300])
    except Exception as e:
        print("ERROR:", type(e).__name__, e)

if __name__ == "__main__":
    request("/v2/homeroom/gethome_merged",
            '{"fg":true,"fetch_share":true,"fetch_share_dev":true,"fetch_cariot":true,"limit":300,"app_ver":7,"plat_form":0}')
