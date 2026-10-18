import base64, hashlib, os, struct, time, urllib.request
from Crypto.Cipher import AES

# 14:31 登录的完整登录态
SSECURITY = "/Oyek37pwEAm4Hdjo0B73Q=="
SERVICE_TOKEN = "Eo3MP+f8UU7qAJU0EolflPJLkKrBbD45ZCTRR3uL8s//+glrP0Bp6meSoKzjm7df8/6Pq1T0zUkuBWj89rSIRneOldMi2VpJLP+S/16QTl8cJ4lI4Siv/bsxDZrUWexhsOV/VUS5v1jeQf3hZBJeRgWp4mduKGxIu4kooaX7xTWYrLCLUCZSSMP4Wv65+gg6"
CUSERID = "1tFjBdSkRYX8VnpB6hPDJdRVwsY"
USER_ID = "166904385"

def gen_nonce():
    b = os.urandom(8) + struct.pack('>i', int(time.time() * 1000 // 60000))
    return base64.b64encode(b).decode()

def signed_nonce(ssecurity, nonce):
    m = hashlib.sha256()
    m.update(base64.b64decode(ssecurity))
    m.update(base64.b64decode(nonce))
    return base64.b64encode(m.digest()).decode()

def sign(method, path, params, sn):
    parts = [method.upper(), path]
    for k in sorted(params.keys()):
        parts.append(f"{k}={params[k]}")
    parts.append(sn)
    return base64.b64encode(hashlib.sha1("&".join(parts).encode()).digest()).decode()

def request(url_path, data_json, cookie_variant):
    nonce = gen_nonce()
    sn = signed_nonce(SSECURITY, nonce)
    key = base64.b64decode(sn)
    iv = os.urandom(12)
    cipher = AES.new(key, AES.MODE_GCM, nonce=iv)
    ct, tag = cipher.encrypt_and_digest(data_json.encode())
    enc_data = base64.b64encode(ct + tag).decode()
    iv_b64 = base64.b64encode(iv).decode()
    signature = sign("POST", url_path, {"data": enc_data, "aes_hash__": iv_b64}, sn)
    body = {"data": enc_data, "aes_hash__": iv_b64, "signature": signature, "_nonce": nonce}

    # 三种 Cookie 变体
    if cookie_variant == "cuserid_correct":
        cookie = f"cUserId={CUSERID}; yetAnotherServiceToken={SERVICE_TOKEN}; serviceToken={SERVICE_TOKEN}; PassportDeviceId=DEEB589BCB3D1545; countryCode=CN; locale=zh_CN"
    elif cookie_variant == "userid_only":
        cookie = f"yetAnotherServiceToken={SERVICE_TOKEN}; serviceToken={SERVICE_TOKEN}; PassportDeviceId=DEEB589BCB3D1545; countryCode=CN; locale=zh_CN; userId={USER_ID}"
    else:  # cuserid_wrong (=userId)
        cookie = f"cUserId={USER_ID}; yetAnotherServiceToken={SERVICE_TOKEN}; serviceToken={SERVICE_TOKEN}; PassportDeviceId=DEEB589BCB3D1545; countryCode=CN; locale=zh_CN"

    headers = {
        "User-Agent": "iOS-27.0.1-11.8.204-iPhone14,3--03CC589B4617E5C354AEACA704CE71B758643751-166904385-DEEB589BCB3D1545-iPhone",
        "Content-Type": "application/x-www-form-urlencoded",
        "x-xiaomi-protocal-flag-cli": "PROTOCAL-HTTP2",
        "miot-encrypt-algorithm": "ENCRYPT-AES",
        "accept-encoding": "identity",
        "miot-origin-request-version": "ios;phone;11.8.204.311",
        "operate-common": "_region=CN&_language=ZH_CN&_deviceId=03CC589B4617E5C354AEACA704CE71B758643751&_appVersion=11.8.204&_platform=1&_platformVersion=27.0.1",
        "Cookie": cookie,
    }
    data = urllib.parse.urlencode(body).encode()
    req = urllib.request.Request("https://api.mijia.tech/app" + url_path, data=data, headers=headers, method="POST")
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        raw = resp.read().decode("utf-8", "replace")
        print(f"  [{cookie_variant}] STATUS:", resp.status)
        try:
            rb = base64.b64decode(raw.strip())
            dec = AES.new(key, AES.MODE_GCM, nonce=iv)
            plain = dec.decrypt_and_verify(rb[:-16], rb[-16:])
            print("    解密成功:", plain.decode("utf-8", "replace")[:200])
        except Exception as e:
            print("    原始body:", raw[:200])
    except urllib.error.HTTPError as e:
        print(f"  [{cookie_variant}] HTTP ERROR:", e.code, e.read().decode()[:100])
    except Exception as e:
        print(f"  [{cookie_variant}] ERROR:", type(e).__name__, e)

for v in ["cuserid_correct", "userid_only", "cuserid_wrong"]:
    print(f"=== Cookie 变体: {v} ===")
    request("/v2/homeroom/gethome_merged", '{"fg":true,"fetch_share":true,"fetch_share_dev":true,"fetch_cariot":true,"limit":300,"app_ver":7,"plat_form":0}', v)
