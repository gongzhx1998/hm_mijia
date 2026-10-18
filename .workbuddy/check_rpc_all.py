import base64, hashlib, os, struct, time, urllib.request, urllib.parse, json
from Crypto.Cipher import AES

# 15:11 最新登录态
SSECURITY = "t+7haHtUDV8DdYjno4nEXg=="
SERVICE_TOKEN = "l9HbKB4aFDNcbf/Xu9vY5PSAwbABnMUtGMIK4HO8DjGAeec4XIbJXoyOoHkxN8saR+h/rgI8JxG6qkJPxe3FPvITAVXK+bnQwnucMvw4JcTNWUDwpVBlo2gldONpF9MfGxpcfieDr23q7VC3QpqkLpPKyZ9UtEQ2u2TKgyRk3hjVhObbg0XfCCq8tAyscrpa"
CUSERID = "1tFjBdSkRYX8VnpB6hPDJdRVwsY"

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

# 拉设备列表
r = request("/v2/home/device_list_page", "{}")
obj = json.loads(r)
lst = (obj.get("result") or {}).get("list") or obj.get("list") or []
print("设备数:", len(lst))
devs = [(d["did"], d["name"], d.get("model"), d.get("isOnline"), d.get("localip")) for d in lst]

# 对每台设备做云端 rpc get_prop
print("\n=== 云端 rpc get_prop 测试（逐台）===")
for did, name, model, online, lip in devs:
    try:
        r2 = request(f"/home/rpc/{did}", json.dumps({"method": "get_prop", "params": ["power"]}))
        o2 = json.loads(r2)
        err = o2.get("error")
        ecode = o2.get("code")
        err_str = f"error={json.dumps(err, ensure_ascii=False)}" if err else ""
        print(f"  [{did}] {name} ({model}) online={online} localip={lip}")
        print(f"     code={ecode} {err_str[:120]}")
    except Exception as e:
        print(f"  [{did}] {name} 请求异常: {type(e).__name__} {e}")
