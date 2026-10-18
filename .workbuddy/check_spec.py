import base64, hashlib, os, struct, time, urllib.request, urllib.parse, json
from Crypto.Cipher import AES

SSECURITY = "t+7haHtUDV8DdYjno4nEXg=="
SERVICE_TOKEN = "l9HbKB4aFDNcbf/Xu9vY5PSAwbABnMUtGMIK4HO8DjGAeec4XIbJXoyOoHkxN8saR+h/rgI8JxG6qkJPxe3FPvITAVXK+bnQwnucMvw4JcTNWUDwpVBlo2gldONpF9MfGxpcfieDr23q7VC3QpqkLpPKyZ9UtEQ2u2TKgyRk3hjVhObbg0XfCCq8tAyscrpa"
CUSERID = "1tFjBdSkRYX8VnpB6hPDJdRVwsY"

def gn(): return base64.b64encode(os.urandom(8) + struct.pack('>i', int(time.time()*1000//60000))).decode()
def sn(s, n):
    m = hashlib.sha256(); m.update(base64.b64decode(s)); m.update(base64.b64decode(n)); return base64.b64encode(m.digest()).decode()
def sign(path, params, snv):
    parts = ['POST', path] + [f'{k}={params[k]}' for k in sorted(params)] + [snv]
    return base64.b64encode(hashlib.sha1('&'.join(parts).encode()).digest()).decode()
def req(path, dj):
    n = gn(); sv = sn(SSECURITY, n); key = base64.b64decode(sv); iv = os.urandom(12)
    c = AES.new(key, AES.MODE_GCM, nonce=iv); ct, tag = c.encrypt_and_digest(dj.encode())
    ed = base64.b64encode(ct+tag).decode(); ivb = base64.b64encode(iv).decode()
    sig = sign(path, {'data': ed, 'aes_hash__': ivb}, sv)
    body = {'data': ed, 'aes_hash__': ivb, 'signature': sig, '_nonce': n}
    cookie = f'cUserId={CUSERID}; yetAnotherServiceToken={SERVICE_TOKEN}; serviceToken={SERVICE_TOKEN}; PassportDeviceId=DEEB589BCB3D1545; countryCode=CN; locale=zh_CN'
    hdrs = {'User-Agent': 'iOS-27.0.1-11.8.204-iPhone14,3--03CC589B4617E5C354AEACA704CE71B758643751-166904385-DEEB589BCB3D1545-iPhone', 'Content-Type': 'application/x-www-form-urlencoded', 'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2', 'miot-encrypt-algorithm': 'ENCRYPT-AES', 'accept-encoding': 'identity', 'Cookie': cookie}
    r = urllib.request.urlopen(urllib.request.Request('https://api.mijia.tech/app'+path, data=urllib.parse.urlencode(body).encode(), headers=hdrs, method='POST'), timeout=30)
    raw = r.read().decode(); rb = base64.b64decode(raw.strip())
    return AES.new(key, AES.MODE_GCM, nonce=iv).decrypt_and_verify(rb[:-16], rb[-16:]).decode()

def get_spec(dids):
    dj = json.dumps({'dids': dids, 'urns': ['']*len(dids), 'isGetFullInstance': True})
    r = req('/appgateway/gspec/Gspec/get_instances_by_dids', dj)
    o = json.loads(r)
    return o.get('instances', {})

dids = ['1046841160', '671916909', '2193622512', '460881909', '977123816']
insts = get_spec(dids)
print("获取到的设备 spec 数:", len(insts))

for did in dids:
    inst = insts.get(did)
    if not inst:
        print(f"\n[{did}] 无 spec")
        continue
    spec = json.loads(inst['instance'])
    print(f"\n===== [{did}] {inst.get('urn','')} =====")
    print("type:", spec.get('type'), "| desc:", spec.get('description'))
    for svc in spec.get('services', []):
        siid = svc.get('iid')
        svc_desc = svc.get('description', '')
        for prop in svc.get('properties', []):
            piid = prop.get('iid')
            access = prop.get('access', [])
            fmt = prop.get('format', '')
            desc = prop.get('description', '')
            vr = prop.get('value-range', '')
            # 只看可写属性
            if 'w' in access:
                print(f"  [可写] siid={siid} piid={piid} | {desc} | access={access} | format={fmt} | value-range={vr}")
