import cryptoFramework from "@ohos:security.cryptoFramework";
import util from "@ohos:util";
export interface KeyIv {
    key: Uint8Array;
    iv: Uint8Array;
}
/**
 * miIO 协议加密工具（模块级函数，避免 ArkTS 禁止的 this）
 * key = MD5(token)；IV = MD5(key + token)；AES-128-CBC + PKCS7
 */
export async function md5(data: Uint8Array): Promise<string> {
    const md = cryptoFramework.createMd('MD5');
    const blob: cryptoFramework.DataBlob = { data: data };
    await md.update(blob);
    const digest = await md.digest();
    return toHex(digest.data);
}
export async function deriveKeyIv(tokenBytes: Uint8Array): Promise<KeyIv> {
    const keyHex = await md5(tokenBytes);
    const key = fromHex(keyHex);
    const combined = new Uint8Array(key.length + tokenBytes.length);
    combined.set(key, 0);
    combined.set(tokenBytes, key.length);
    const ivHex = await md5(combined);
    const iv = fromHex(ivHex);
    const result: KeyIv = { key: key, iv: iv };
    return result;
}
export async function aesCbcEncrypt(plain: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const cipher = cryptoFramework.createCipher('AES128|CBC|PKCS7');
    const symKey: cryptoFramework.SymKey = await makeSymKey(key);
    const ivSpec: cryptoFramework.IvParamsSpec = { algName: 'IvParamsSpec', iv: { data: iv } };
    await cipher.init(cryptoFramework.CryptoMode.ENCRYPT_MODE, symKey, ivSpec);
    const result = await cipher.doFinal({ data: plain });
    return new Uint8Array(result.data);
}
export async function aesCbcDecrypt(cipherText: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const cipher = cryptoFramework.createCipher('AES128|CBC|PKCS7');
    const symKey: cryptoFramework.SymKey = await makeSymKey(key);
    const ivSpec: cryptoFramework.IvParamsSpec = { algName: 'IvParamsSpec', iv: { data: iv } };
    await cipher.init(cryptoFramework.CryptoMode.DECRYPT_MODE, symKey, ivSpec);
    const result = await cipher.doFinal({ data: cipherText });
    return new Uint8Array(result.data);
}
async function makeSymKey(key: Uint8Array): Promise<cryptoFramework.SymKey> {
    const symKeyGenerator = cryptoFramework.createSymKeyGenerator('AES128');
    const keyBlob: cryptoFramework.DataBlob = { data: key };
    return await symKeyGenerator.convertKey(keyBlob);
}
export async function hmacSha256Bytes(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
    const mac = cryptoFramework.createMac('SHA256');
    const keyGen = cryptoFramework.createSymKeyGenerator('SHA256');
    const keyBlob: cryptoFramework.DataBlob = { data: key };
    const symKey: cryptoFramework.SymKey = await keyGen.convertKey(keyBlob);
    await mac.init(symKey);
    await mac.update({ data: msg });
    const out = await mac.doFinal();
    return new Uint8Array(out.data);
}
export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
    const md = cryptoFramework.createMd('SHA256');
    await md.update({ data: data });
    const digest = await md.digest();
    return new Uint8Array(digest.data);
}
export function base64Encode(data: Uint8Array): string {
    const helper = new util.Base64Helper();
    return helper.encodeToStringSync(data);
}
export function base64Decode(s: string): Uint8Array {
    const helper = new util.Base64Helper();
    // 防御：去掉所有非 base64 字符（空白/换行/引号等），并补足 padding，
    // 否则 decodeSync 会抛 "The input string contains unsupported characters"
    let cleaned = '';
    for (let i = 0; i < s.length; i++) {
        const c = s.charAt(i);
        const ok = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
            || c === '+' || c === '/' || c === '=';
        if (ok) {
            cleaned += c;
        }
    }
    // 空串/全非法字符：返回空字节，避免 decodeSync 抛 unsupported characters
    const noPad = cleaned.replace(/=+$/, '');
    if (noPad === '') {
        return new Uint8Array(0);
    }
    // 去掉末尾 padding 后按 4 对齐补 '='，否则 decodeSync 对非 4 倍数长度也会报错
    const rem = noPad.length % 4;
    let aligned = noPad;
    if (rem !== 0) {
        for (let i = 0; i < 4 - rem; i++) {
            aligned += '=';
        }
    }
    return new Uint8Array(helper.decodeSync(aligned));
}
export function randomBytes(n: number): Uint8Array {
    const b = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
        b[i] = Math.floor(Math.random() * 256);
    }
    return b;
}
export function toHex(data: Uint8Array): string {
    let s = '';
    for (let i = 0; i < data.length; i++) {
        s += data[i].toString(16).padStart(2, '0');
    }
    return s;
}
export function fromHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}
export function utf8Bytes(str: string): Uint8Array {
    const textEncoder = new util.TextEncoder();
    const result = new Uint8Array(textEncoder.encodeInto(str));
    return result;
}
export function utf8String(data: Uint8Array): string {
    const textDecoder = util.TextDecoder.create('utf-8');
    return textDecoder.decodeToString(data);
}
/**
 * RC4 流加密（纯 ArkTS 实现，密钥为字节数组）。
 * 米家云 RC4 协议需要先丢弃前 1024 字节密钥流（KSA + 1024 次 PRGA）。
 */
export function rc4Crypt(key: Uint8Array, data: Uint8Array, drop: number = 0): Uint8Array {
    const s: number[] = new Array<number>(256);
    for (let i = 0; i < 256; i++) {
        s[i] = i;
    }
    let j = 0;
    for (let i = 0; i < 256; i++) {
        j = (j + s[i] + key[i % key.length]) & 0xff;
        const tmp = s[i];
        s[i] = s[j];
        s[j] = tmp;
    }
    // 丢弃前 drop 字节密钥流（KSA 后先跑 drop 轮 PRGA）
    let a = 0;
    let b = 0;
    for (let k = 0; k < drop; k++) {
        a = (a + 1) & 0xff;
        b = (b + s[a]) & 0xff;
        const t = s[a];
        s[a] = s[b];
        s[b] = t;
    }
    // 继续用更新后的 a/b/s 状态加密数据
    const out = new Uint8Array(data.length);
    for (let k = 0; k < data.length; k++) {
        a = (a + 1) & 0xff;
        b = (b + s[a]) & 0xff;
        const t = s[a];
        s[a] = s[b];
        s[b] = t;
        const keystream = s[(s[a] + s[b]) & 0xff];
        out[k] = data[k] ^ keystream;
    }
    return out;
}
/** SHA1 摘要，返回字节数组 */
export async function sha1Bytes(data: Uint8Array): Promise<Uint8Array> {
    const md = cryptoFramework.createMd('SHA1');
    await md.update({ data: data });
    const digest = await md.digest();
    return new Uint8Array(digest.data);
}
/**
 * AES-256-GCM 加密（米家云 11.8.x ENCRYPT-AES 协议）。
 * key = 32 字节，iv = 12 字节，tag = 16 字节（GCM 标准 128 位）。
 * 返回 ciphertext ‖ tag（16 字节 tag 拼接在末尾，与 Java AES/GCM/NoPadding 的 doFinal 输出一致）。
 * 鸿蒙 API：update(明文) 返回密文，doFinal(null) 返回 authTag，需手动拼接。
 */
export async function aesGcmEncrypt(plain: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const cipher = cryptoFramework.createCipher('AES256|GCM|NoPadding');
    const symKey: cryptoFramework.SymKey = await makeSymKey256(key);
    const gcmParams: cryptoFramework.GcmParamsSpec = {
        algName: 'GcmParamsSpec',
        iv: { data: iv },
        aad: { data: new Uint8Array(0) },
        authTag: { data: new Uint8Array(0) }
    };
    await cipher.init(cryptoFramework.CryptoMode.ENCRYPT_MODE, symKey, gcmParams);
    const cipherText = await cipher.update({ data: plain });
    const tag = await cipher.doFinal(null);
    const ct = new Uint8Array(cipherText.data);
    const tg = tag === null ? new Uint8Array(0) : new Uint8Array(tag.data);
    const out = new Uint8Array(ct.length + tg.length);
    out.set(ct, 0);
    out.set(tg, ct.length);
    return out;
}
/** AES-256-GCM 解密：输入 ciphertext ‖ tag（末尾 16 字节为 tag），返回明文。 */
export async function aesGcmDecrypt(cipherWithTag: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const tagLen = 16;
    const cipherText = cipherWithTag.subarray(0, cipherWithTag.length - tagLen);
    const tag = cipherWithTag.subarray(cipherWithTag.length - tagLen);
    const cipher = cryptoFramework.createCipher('AES256|GCM|NoPadding');
    const symKey: cryptoFramework.SymKey = await makeSymKey256(key);
    const gcmParams: cryptoFramework.GcmParamsSpec = {
        algName: 'GcmParamsSpec',
        iv: { data: iv },
        aad: { data: new Uint8Array(0) },
        authTag: { data: tag }
    };
    await cipher.init(cryptoFramework.CryptoMode.DECRYPT_MODE, symKey, gcmParams);
    const plain = await cipher.update({ data: cipherText });
    await cipher.doFinal(null);
    return new Uint8Array(plain.data);
}
async function makeSymKey256(key: Uint8Array): Promise<cryptoFramework.SymKey> {
    const symKeyGenerator = cryptoFramework.createSymKeyGenerator('AES256');
    const keyBlob: cryptoFramework.DataBlob = { data: key };
    return await symKeyGenerator.convertKey(keyBlob);
}
