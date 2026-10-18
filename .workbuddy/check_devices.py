import base64, hashlib, os, struct, time, urllib.request, urllib.parse, json
from Crypto.Cipher import AES

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

def request(url_path, data_json):
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

    cookie = f"cUserId={CUSERID}; yetAnotherServiceToken={SERVICE_TOKEN}; serviceToken={SERVICE_TOKEN}; PassportDeviceId=DEEB589BCB3D1545; countryCode=CN; locale=zh_CN"
    headers = {
        "User-Agent": "iOS-27.0.1-11.8.204-iPhone14,3--03CC589B4617E5C354AEACA704CE71B758643751-166904385-DEEB589BCB3D1545-iPhone",
        "Content-Type": "application/x-www-form-urlencoded",
        "x-xiaomi-protocal-flag-cli": "PROTOCAL-HTTP2",
        "miot-encrypt-algorithm": "ENCRYPT-AES",
        "accept-encoding": "identity",
        "Cookie": cookie,
    }
    data = urllib.parse.urlencode(body).encode()
    req = urllib.request.Request("https://api.mijia.tech/app" + url_path, data=data, headers=headers, method="POST")
    resp = urllib.request.urlopen(req, timeout=30)
    raw = resp.read().decode("utf-8", "replace")
    rb = base64.b64decode(raw.strip())
    dec = AES.new(key, AES.MODE_GCM, nonce=iv)
    plain = dec.decrypt_and_verify(rb[:-16], rb[-16:])
    return plain.decode("utf-8", "replace")

# 1. device_list_page 看设备字段
print("=== device_list_page ===")
r = request("/v2/home/device_list_page", "{}")
obj = json.loads(r)
lst = obj.get("list") or (obj.get("result") or {}).get("list") or []
print("设备数:", len(lst))
for d in lst[:5]:
    print(json.dumps({k: d.get(k) for k in ["did","name","model","isOnline","token","localip","mac","rssi","ssid","bssid","parent_id","is_share"]}, ensure_ascii=False))
print("顶层 keys:", list(obj.keys()))
if lst:
    print("首台设备全字段:", json.dumps(lst[0], ensure_ascii=False)[:800])

# 2. rpc 控制测试（先不真控制，用 get_prop 读属性，最安全）
print("\n=== rpc get_prop 测试 ===")
if lst:
    did = lst[0]["did"]
    r2 = request(f"/home/rpc/{did}", json.dumps({"method": "get_prop", "params": ["power"]}))
    print("rpc 响应:", r2[:300])
