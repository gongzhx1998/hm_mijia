import socket, struct, hashlib, json, time
from Crypto.Cipher import AES

def miio_send(ip, token_hex, method, params, timeout=4):
    token = bytes.fromhex(token_hex)
    payload = json.dumps({"id": 1, "method": method, "params": params}).encode()
    key = hashlib.md5(token).digest()
    iv = hashlib.md5(key + token).digest()
    # PKCS7 pad
    pad = 16 - (len(payload) % 16)
    payload = payload + bytes([pad]) * pad
    cipher = AES.new(key, AES.MODE_CBC, iv)
    encrypted = cipher.encrypt(payload)

    # header
    now = int(time.time())
    header = struct.pack('>HHIII', 0x2131, 32 + len(encrypted), 0, 0, now)
    checksum = hashlib.md5(header + token + encrypted).digest()
    packet = header + checksum + encrypted

    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    s.settimeout(timeout)
    s.sendto(packet, (ip, 54321))
    try:
        data, _ = s.recvfrom(4096)
    finally:
        s.close()

    if len(data) <= 32:
        return {"_raw_len": len(data)}
    resp_enc = data[32:]
    # 响应用同一 key/iv 解密（miIO 响应也是 AES-CBC，key/iv 同请求）
    dec = AES.new(key, AES.MODE_CBC, iv)
    plain = dec.decrypt(resp_enc)
    # 去 padding
    plain = plain[:-plain[-1]]
    return json.loads(plain.decode("utf-8", "replace"))

# 测试几台内网设备
tests = [
    ("192.168.1.161", "e6abd863b028d3e03273e551f00a7fc0", "NOC升降桌"),
    ("192.168.1.36",  "55e59b9e52a859e2b26c4ab928803bb3", "空气净化器4"),
    ("192.168.1.15",  "a1556a5a4513f6985ebaf05e866cecf5", "空调插座"),
]
for ip, tok, name in tests:
    print(f"=== {name} ({ip}) get_prop power ===")
    try:
        r = miio_send(ip, tok, "get_prop", ["power"])
        print("  响应:", json.dumps(r, ensure_ascii=False))
    except Exception as e:
        print("  失败:", type(e).__name__, e)
