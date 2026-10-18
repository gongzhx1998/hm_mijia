import cryptoFramework from "@ohos:security.cryptoFramework";
import util from "@ohos:util";
export interface j21 {
    key: Uint8Array;
    iv: Uint8Array;
}
export async function q20(data: Uint8Array): Promise<string> {
    const md = cryptoFramework.createMd('MD5');
    const blob: cryptoFramework.DataBlob = { data: data };
    await md.update(blob);
    const digest = await md.digest();
    return g21(digest.data);
}
export async function b21(h23: Uint8Array): Promise<j21> {
    const i23 = await q20(h23);
    const key = h21(i23);
    const j23 = new Uint8Array(key.length + h23.length);
    j23.set(key, 0);
    j23.set(h23, key.length);
    const k23 = await q20(j23);
    const iv = h21(k23);
    const result: j21 = { key: key, iv: iv };
    return result;
}
export async function c21(plain: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const e23 = cryptoFramework.createCipher('AES128|CBC|PKCS7');
    const f23: cryptoFramework.SymKey = await e21(key);
    const g23: cryptoFramework.IvParamsSpec = { algName: 'IvParamsSpec', iv: { data: iv } };
    await e23.init(cryptoFramework.CryptoMode.ENCRYPT_MODE, f23, g23);
    const result = await e23.doFinal({ data: plain });
    return new Uint8Array(result.data);
}
export async function d21(cipherText: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const b23 = cryptoFramework.createCipher('AES128|CBC|PKCS7');
    const c23: cryptoFramework.SymKey = await e21(key);
    const d23: cryptoFramework.IvParamsSpec = { algName: 'IvParamsSpec', iv: { data: iv } };
    await b23.init(cryptoFramework.CryptoMode.DECRYPT_MODE, c23, d23);
    const result = await b23.doFinal({ data: cipherText });
    return new Uint8Array(result.data);
}
async function e21(key: Uint8Array): Promise<cryptoFramework.SymKey> {
    const z22 = cryptoFramework.createSymKeyGenerator('AES128');
    const a23: cryptoFramework.DataBlob = { data: key };
    return await z22.convertKey(a23);
}
export async function f21(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
    const mac = cryptoFramework.createMac('SHA256');
    const v22 = cryptoFramework.createSymKeyGenerator('SHA256');
    const w22: cryptoFramework.DataBlob = { data: key };
    const x22: cryptoFramework.SymKey = await v22.convertKey(w22);
    await mac.init(x22);
    await mac.update({ data: msg });
    const y22 = await mac.doFinal();
    return new Uint8Array(y22.data);
}
export async function a21(data: Uint8Array): Promise<Uint8Array> {
    const md = cryptoFramework.createMd('SHA256');
    await md.update({ data: data });
    const digest = await md.digest();
    return new Uint8Array(digest.data);
}
export function u20(data: Uint8Array): string {
    const u22 = new util.Base64Helper();
    return u22.encodeToStringSync(data);
}
export function s20(s: string): Uint8Array {
    const m22 = new util.Base64Helper();
    let n22 = '';
    for (let s22 = 0; s22 < s.length; s22++) {
        const c = s.charAt(s22);
        const t22 = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9')
            || c === '+' || c === '/' || c === '=';
        if (t22) {
            n22 += c;
        }
    }
    const o22 = n22.replace(/=+$/, '');
    if (o22 === '') {
        return new Uint8Array(0);
    }
    const p22 = o22.length % 4;
    let q22 = o22;
    if (p22 !== 0) {
        for (let r22 = 0; r22 < 4 - p22; r22++) {
            q22 += '=';
        }
    }
    return new Uint8Array(m22.decodeSync(q22));
}
export function t20(n: number): Uint8Array {
    const b = new Uint8Array(n);
    for (let l22 = 0; l22 < n; l22++) {
        b[l22] = Math.floor(Math.random() * 256);
    }
    return b;
}
export function g21(data: Uint8Array): string {
    let s = '';
    for (let k22 = 0; k22 < data.length; k22++) {
        s += data[k22].toString(16).padStart(2, '0');
    }
    return s;
}
export function h21(i22: string): Uint8Array {
    const bytes = new Uint8Array(i22.length / 2);
    for (let j22 = 0; j22 < i22.length; j22 += 2) {
        bytes[j22 / 2] = parseInt(i22.substring(j22, j22 + 2), 16);
    }
    return bytes;
}
export function r20(str: string): Uint8Array {
    const h22 = new util.TextEncoder();
    const result = new Uint8Array(h22.encodeInto(str));
    return result;
}
export function x20(data: Uint8Array): string {
    const g22 = util.TextDecoder.create('utf-8');
    return g22.decodeToString(data);
}
export function z20(key: Uint8Array, data: Uint8Array, x21: number = 0): Uint8Array {
    const s: number[] = new Array<number>(256);
    for (let f22 = 0; f22 < 256; f22++) {
        s[f22] = f22;
    }
    let y21 = 0;
    for (let d22 = 0; d22 < 256; d22++) {
        y21 = (y21 + s[d22] + key[d22 % key.length]) & 0xff;
        const e22 = s[d22];
        s[d22] = s[y21];
        s[y21] = e22;
    }
    let a = 0;
    let b = 0;
    for (let k = 0; k < x21; k++) {
        a = (a + 1) & 0xff;
        b = (b + s[a]) & 0xff;
        const c22 = s[a];
        s[a] = s[b];
        s[b] = c22;
    }
    const z21 = new Uint8Array(data.length);
    for (let k = 0; k < data.length; k++) {
        a = (a + 1) & 0xff;
        b = (b + s[a]) & 0xff;
        const a22 = s[a];
        s[a] = s[b];
        s[b] = a22;
        const b22 = s[(s[a] + s[b]) & 0xff];
        z21[k] = data[k] ^ b22;
    }
    return z21;
}
export async function y20(data: Uint8Array): Promise<Uint8Array> {
    const md = cryptoFramework.createMd('SHA1');
    await md.update({ data: data });
    const digest = await md.digest();
    return new Uint8Array(digest.data);
}
export async function v20(plain: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const r21 = cryptoFramework.createCipher('AES256|GCM|NoPadding');
    const s21: cryptoFramework.SymKey = await i21(key);
    const t21: cryptoFramework.GcmParamsSpec = {
        algName: 'GcmParamsSpec',
        iv: { data: iv },
        aad: { data: new Uint8Array(0) },
        authTag: { data: new Uint8Array(0) }
    };
    await r21.init(cryptoFramework.CryptoMode.ENCRYPT_MODE, s21, t21);
    const cipherText = await r21.update({ data: plain });
    const tag = await r21.doFinal(null);
    const u21 = new Uint8Array(cipherText.data);
    const v21 = tag === null ? new Uint8Array(0) : new Uint8Array(tag.data);
    const w21 = new Uint8Array(u21.length + v21.length);
    w21.set(u21, 0);
    w21.set(v21, u21.length);
    return w21;
}
export async function w20(m21: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
    const n21 = 16;
    const cipherText = m21.subarray(0, m21.length - n21);
    const tag = m21.subarray(m21.length - n21);
    const o21 = cryptoFramework.createCipher('AES256|GCM|NoPadding');
    const p21: cryptoFramework.SymKey = await i21(key);
    const q21: cryptoFramework.GcmParamsSpec = {
        algName: 'GcmParamsSpec',
        iv: { data: iv },
        aad: { data: new Uint8Array(0) },
        authTag: { data: tag }
    };
    await o21.init(cryptoFramework.CryptoMode.DECRYPT_MODE, p21, q21);
    const plain = await o21.update({ data: cipherText });
    await o21.doFinal(null);
    return new Uint8Array(plain.data);
}
async function i21(key: Uint8Array): Promise<cryptoFramework.SymKey> {
    const k21 = cryptoFramework.createSymKeyGenerator('AES256');
    const l21: cryptoFramework.DataBlob = { data: key };
    return await k21.convertKey(l21);
}
