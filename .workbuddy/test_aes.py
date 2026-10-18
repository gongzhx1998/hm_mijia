import urllib.request
import json

url = "https://api.mijia.tech/app/user/get_user_config"
payload = {
    '_nonce': "/////7uk7HIBx8f0",
    'aes_hash__': "i0bjvR7+82t9HNW/",
    'data': "XcKlROWrMt5iiaYukeoiU2UrEoJm8NRoktfEN/ZqB4sN4lTHfO7RVXjWxNoz5XuhzoWZZ8Ocbx0mTj7lTitCTziaKxUf84yEtGh0k6KUBg==",
    'signature': "mKtGz8nx2w7so/o+VHY5BAiGqOA="
}
headers = {
    'User-Agent': "iOS-27.0.1-11.8.204-iPhone14,3--03CC589B4617E5C354AEACA704CE71B758643751-166904385-DEEB589BCB3D1545-iPhone",
    'miot-encrypt-algorithm': "ENCRYPT-AES",
    'miot-origin-request-version': "ios;phone;11.8.204.311",
    'miot-accept-encoding': "GZIP",
    'content-encoding': "identity",
    'priority': "u=3, i",
    'accept-language': "zh-Hans;q=1",
    'x-xiaomi-protocal-flag-cli': "PROTOCAL-HTTP2",
    'domain-refer': "api.mijia.tech",
    'origin-from': "MiHome",
    'operate-common': "_region=CN&_language=ZH_CN&_deviceId=03CC589B4617E5C354AEACA704CE71B758643751&_appVersion=11.8.204&_platform=1&_platformVersion=27.0.1",
    'Cookie': "serviceToken=aKashp8Trao2eYuk0p0IO4M58+YOfl1UTn9BWFnJklXuiN4XoLbOLvtLozMfXY5FQeTj30A/tFPRO7zryupr6LvJzfBDn/DNEd7nE207hMTROS2xApdRUSJA6Y+q4XP7hwPrrHyxwxk4SzoLjUXsId16gUyWcbajBg3jbhEIJYOIqPAF3zj16RVtW2IEXibe; yetAnotherServiceToken=aKashp8Trao2eYuk0p0IO4M58+YOfl1UTn9BWFnJklXuiN4XoLbOLvtLozMfXY5FQeTj30A/tFPRO7zryupr6LvJzfBDn/DNEd7nE207hMTROS2xApdRUSJA6Y+q4XP7hwPrrHyxwxk4SzoLjUXsId16gUyWcbajBg3jbhEIJYOIqPAF3zj16RVtW2IEXibe; PassportDeviceId=DEEB589BCB3D1545; countryCode=CN; locale=zh_cn; userId=166904385"
}

data = urllib.parse.urlencode(payload).encode('utf-8')
req = urllib.request.Request(url, data=data, headers=headers, method='POST')
try:
    resp = urllib.request.urlopen(req, timeout=30)
    print("STATUS:", resp.status)
    print("BODY:", resp.read().decode('utf-8', 'replace'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR STATUS:", e.code)
    print("BODY:", e.read().decode('utf-8', 'replace'))
    print("HEADERS:", dict(e.headers))
except Exception as e:
    print("ERROR:", type(e).__name__, e)
