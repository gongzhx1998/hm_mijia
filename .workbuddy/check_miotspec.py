import base64, hashlib, os, struct, time, urllib.request, urllib.parse, json
from Crypto.Cipher import AES

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

# 测试 miot-spec prop/get，用通用电源 siid=2, piid=1
tests = [
    ("1046841160", "台灯 philips.light.lite"),
    ("671916909", "空气净化器4 xiaomi.airp.mp4"),
    ("460881909", "升降桌 xlang.desk.vlocv2"),
    ("2193622512", "洗衣机 mibx5.washer.f63"),
    ("977123816", "空调插座 lumi.acpartner.mcn02"),
]

print("=== miot-spec prop/get 测试（siid=2, piid=1 电源）===")
for did, name in tests:
    try:
        payload = json.dumps({"params": [{"did": did, "siid": 2, "piid": 1}]})
        r = request("/miotspec/prop/get", payload)
        print(f"  [{did}] {name}")
        print(f"     {r[:300]}")
    except Exception as e:
        print(f"  [{did}] {name} 异常: {type(e).__name__} {e}")
