import http from "@ohos:net.http";
import rcp from "@hms:collaboration.rcp";
import * as g11 from "@normalized:N&&&entry/src/main/ets/c/j&";
import * as Storage from "@normalized:N&&&entry/src/main/ets/c/h&";
import { i, j } from "@normalized:N&&&entry/src/main/ets/a/b&";
const g1 = 'MiCloud';
const h11 = 'mijia_cloud_device_id';
const i11 = 'mijia_cloud_session';
export interface l5 {
    did: string;
    token: string;
    name: string;
    model: string;
    localip: string;
    isOnline: boolean;
    specType: string;
}
export interface j11 {
    id: string;
    name: string;
    dids: string[];
}
export interface k11 {
    id: string;
    name: string;
    rooms: j11[];
}
const l11 = 'https://account.xiaomi.com';
const n11 = 'Android-7.1.1-1.0.0-ONEPLUS A3010-136-xxx APP/xiaomi.smarthome APPV/62830';
let ssecurity: string = '';
let userId: string = '';
let cUserId: string = '';
let serviceToken: string = '';
let deviceId: string = '';
let notificationUrl: string = '';
const o11: Map<string, string> = new Map<string, string>();
let pendingSign: string = '';
let pendingQs: string = '';
let pendingCallback: string = '';
let pendingUser: string = '';
let pendingHash: string = '';
let p11: string = '';
let q11: boolean = false;
export function getUserId(): string {
    return userId;
}
export function q5(): string {
    return s10();
}
export function m5(l20: string): void {
    if (l20 === '') {
        return;
    }
    const m20 = l20.split(';');
    for (let n20 = 0; n20 < m20.length; n20++) {
        const o20 = m20[n20].trim();
        const p20 = o20.indexOf('=');
        if (p20 > 0) {
            const name = o20.substring(0, p20).trim();
            const value = o20.substring(p20 + 1).trim();
            if (name !== '' && name !== 'Path' && name !== 'Domain' && name !== 'Expires' && name !== 'Max-Age') {
                o11.set(name, value);
            }
        }
    }
}
export function i5(): string {
    return notificationUrl;
}
export function y9(): boolean {
    return serviceToken !== '';
}
async function z9(): Promise<void> {
    try {
        const session: Record<string, string> = {
            'ssecurity': ssecurity,
            'serviceToken': serviceToken,
            'userId': userId,
            'cUserId': cUserId,
            'pendingUser': pendingUser,
            'pendingHash': pendingHash,
            'pendingSign': pendingSign,
            'pendingQs': pendingQs,
            'pendingCallback': pendingCallback
        };
        await Storage.k5(i11, JSON.stringify(session));
        j.error(g1, `>>> persistSession ok, ssecurity_len=${ssecurity.length}`);
    }
    catch (e) {
        j.error(g1, `persistSession failed: ${String(e)}`);
    }
}
export async function e4(): Promise<boolean> {
    try {
        const k20 = await Storage.getString(i11, '');
        if (k20 === '') {
            return false;
        }
        const session = JSON.parse(k20) as Record<string, string>;
        if (String(session['pendingUser'] ?? '') !== '') {
            pendingUser = String(session['pendingUser']);
        }
        if (String(session['pendingHash'] ?? '') !== '') {
            pendingHash = String(session['pendingHash']);
        }
        if (String(session['pendingSign'] ?? '') !== '') {
            pendingSign = String(session['pendingSign']);
        }
        if (String(session['pendingQs'] ?? '') !== '') {
            pendingQs = String(session['pendingQs']);
        }
        if (String(session['pendingCallback'] ?? '') !== '') {
            pendingCallback = String(session['pendingCallback']);
        }
        if (String(session['ssecurity'] ?? '') !== '' && String(session['serviceToken'] ?? '') !== '') {
            ssecurity = String(session['ssecurity']);
            serviceToken = String(session['serviceToken']);
            userId = String(session['userId'] ?? '');
            cUserId = String(session['cUserId'] ?? '');
            await c10();
            j.error(g1, `>>> restoreSession ok, ssecurity_len=${ssecurity.length}, userId=${userId}, hasPending=${pendingUser !== ''}`);
            return true;
        }
    }
    catch (e) {
        j.error(g1, `restoreSession failed: ${String(e)}`);
    }
    return false;
}
export async function a10(): Promise<void> {
    ssecurity = '';
    serviceToken = '';
    userId = '';
    cUserId = '';
    o11.clear();
    try {
        await Storage.clear(i11);
    }
    catch (e) {
        j.error(g1, `clearSession failed: ${String(e)}`);
    }
}
function b10(): string {
    const i20 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let s = '';
    for (let j20 = 0; j20 < 16; j20++) {
        s += i20.charAt(Math.floor(Math.random() * i20.length));
    }
    return s;
}
async function c10(): Promise<string> {
    if (deviceId !== '') {
        return deviceId;
    }
    const h20 = await Storage.getString(h11, '');
    if (h20 !== '') {
        deviceId = h20;
    }
    else {
        deviceId = b10();
        await Storage.k5(h11, deviceId);
    }
    return deviceId;
}
export async function h5(username: string, password: string): Promise<boolean> {
    try {
        notificationUrl = '';
        deviceId = await c10();
        o11.set('sdkVersion', '3.8.6');
        o11.set('deviceId', deviceId);
        o11.set('pass_ua', 'web');
        const cookie = s10();
        const x19 = await y10(http.RequestMethod.GET, `${l11}/pass/serviceLogin?sid=mijia&_json=true`, cookie, null, null);
        const y19 = w10(x19.text);
        const hash = (await g11.q20(g11.r20(password))).toUpperCase();
        pendingSign = String(y19['_sign'] ?? '');
        pendingQs = String(y19['qs'] ?? '');
        pendingCallback = String(y19['callback'] ?? '');
        pendingUser = username;
        pendingHash = hash;
        const z19: Record<string, string> = {
            'sid': String(y19['sid'] ?? 'mijia'),
            '_sign': pendingSign,
            'qs': pendingQs,
            'callback': pendingCallback,
            'user': username,
            'hash': hash,
            '_json': 'true'
        };
        const a20 = await y10(http.RequestMethod.POST, `${l11}/pass/serviceLoginAuth2?_json=true`, s10(), v10(z19), null);
        const b20 = w10(a20.text);
        const code = String(b20['code'] ?? '-1');
        const location = String(b20['location'] ?? '');
        const desc = String(b20['desc'] ?? '');
        const c20 = x10(a20.text);
        if (c20 !== '') {
            p11 = c20;
        }
        else if (b20['nonce'] !== undefined && b20['nonce'] !== null) {
            p11 = String(b20['nonce']);
        }
        if (String(b20['ssecurity'] ?? '') !== '') {
            ssecurity = String(b20['ssecurity']);
        }
        if (String(b20['userId'] ?? '') !== '') {
            userId = String(b20['userId']);
        }
        if (code !== '0' || location === '') {
            const g20 = b20['notificationUrl'];
            if (g20 !== undefined) {
                notificationUrl = String(g20);
                j.info(g1, `账号开启二次验证，等待在 App 内完成验证: ${notificationUrl}`);
            }
            j.error(g1, `login needs verify, code=${code}, desc=${desc}, hasLocation=${location !== ''}`);
            return false;
        }
        ssecurity = String(b20['ssecurity'] ?? '');
        userId = String(b20['userId'] ?? '');
        const d20 = await z10(location);
        serviceToken = a11(d20);
        if (serviceToken === '') {
            j.error(g1, `获取 serviceToken 失败, location=${location}`);
            const f20 = Array.from(o11.keys());
            j.error(g1, `cookieJar keys: ${f20.join(',')}`);
            j.error(g1, `step3 body: ${d20.text.substring(0, 300)}`);
            return false;
        }
        const e20 = o11.get('cUserId');
        if (e20 !== undefined && e20 !== '') {
            cUserId = e20;
        }
        j.info(g1, `login success, userId=${userId}, cUserId=${cUserId.substring(0, 8)}`);
        await z9();
        return true;
    }
    catch (e) {
        j.error(g1, 'login error');
        return false;
    }
}
async function d10(): Promise<void> {
    if (ssecurity !== '') {
        return;
    }
    const v19 = await e10();
    if (v19) {
        return;
    }
    try {
        const w19 = await y10(http.RequestMethod.GET, `${l11}/pass/serviceLogin?sid=mijia&_json=true`, s10(), null, null);
        const data = w10(w19.text);
        j.error(g1, `>>> fetchSsecurityAfterVerify serviceLogin body=${w19.text.substring(0, 400)}`);
        if (String(data['code'] ?? '-1') === '0') {
            if (String(data['ssecurity'] ?? '') !== '') {
                ssecurity = String(data['ssecurity']);
                j.error(g1, `>>> fetchSsecurityAfterVerify(回退) 拿到 ssecurity len=${ssecurity.length} head=${ssecurity.substring(0, 24)}`);
            }
            if (String(data['userId'] ?? '') !== '') {
                userId = String(data['userId']);
            }
            if (String(data['passToken'] ?? '') !== '') {
                o11.set('passToken', String(data['passToken']));
            }
        }
        else {
            j.error(g1, `fetchSsecurityAfterVerify code=${String(data['code'] ?? '-1')}`);
        }
    }
    catch (e) {
        j.error(g1, `fetchSsecurityAfterVerify error: ${String(e)}`);
    }
}
async function e10(): Promise<boolean> {
    if (pendingUser === '' || pendingHash === '') {
        j.error(g1, `>>> replayAuth2ForSsecurity 缺少 pendingUser/pendingHash，无法重放`);
        return false;
    }
    try {
        const p19: Record<string, string> = {
            'sid': 'mijia',
            '_sign': pendingSign,
            'qs': pendingQs !== '' ? pendingQs : '%3Fsid%3Dmijia%26_json%3Dtrue',
            'callback': pendingCallback !== '' ? pendingCallback : 'https://sts.api.io.mi.com/sts',
            'user': pendingUser,
            'hash': pendingHash,
            '_json': 'true'
        };
        const q19 = await y10(http.RequestMethod.POST, `${l11}/pass/serviceLoginAuth2?_json=true`, s10(), v10(p19), null);
        const r19 = w10(q19.text);
        j.error(g1, `>>> replayAuth2ForSsecurity body=${q19.text.substring(0, 500)}`);
        const code = String(r19['code'] ?? '-1');
        const location = String(r19['location'] ?? '');
        const s19 = x10(q19.text);
        if (s19 !== '') {
            p11 = s19;
        }
        else if (r19['nonce'] !== undefined && r19['nonce'] !== null) {
            p11 = String(r19['nonce']);
        }
        if (String(r19['ssecurity'] ?? '') !== '') {
            ssecurity = String(r19['ssecurity']);
            j.error(g1, `>>> replayAuth2ForSsecurity 拿到正确 ssecurity len=${ssecurity.length} head=${ssecurity.substring(0, 24)}`);
        }
        if (String(r19['userId'] ?? '') !== '') {
            userId = String(r19['userId']);
        }
        if (code === '0' && location !== '' && serviceToken === '') {
            const t19 = await z10(location);
            const u19 = a11(t19);
            if (u19 !== '') {
                serviceToken = u19;
            }
        }
        return ssecurity !== '';
    }
    catch (e) {
        j.error(g1, `replayAuth2ForSsecurity error: ${String(e)}`);
        return false;
    }
}
export async function n5(w18: string): Promise<boolean> {
    try {
        let x18 = w18;
        try {
            x18 = decodeURIComponent(w18);
        }
        catch (e) {
            x18 = w18;
        }
        const y18 = f10(x18, 'location');
        if (y18 !== '') {
            const o19 = await z10(decodeURIComponent(y18));
            serviceToken = a11(o19);
            if (serviceToken !== '') {
                if (ssecurity === '') {
                    await d10();
                }
                j.info(g1, `completeLoginAfterVerify success via callback location, userId=${userId}, hasSsecurity=${ssecurity !== ''}`);
                await z9();
                return true;
            }
            j.error(g1, `location returned but no serviceToken`);
        }
        const z18 = f10(x18, 'callback');
        if (z18 !== '') {
            try {
                const m19 = decodeURIComponent(z18);
                if (m19.indexOf('http') === 0) {
                    j.info(g1, `try GET result/check callback: ${m19}`);
                    const n19 = await b11(m19);
                    serviceToken = a11(n19);
                    if (serviceToken !== '') {
                        if (ssecurity === '') {
                            await d10();
                        }
                        j.info(g1, `completeLoginAfterVerify success via result/check callback, userId=${userId}, hasSsecurity=${ssecurity !== ''}`);
                        await z9();
                        return true;
                    }
                    j.error(g1, `result/check callback no serviceToken`);
                }
            }
            catch (e) {
                j.error(g1, 'result/check callback error');
            }
        }
        let a19 = false;
        try {
            const i19 = await y10(http.RequestMethod.GET, `${l11}/pass/serviceLogin?sid=mijia&_json=true`, s10(), null, null);
            const j19 = w10(i19.text);
            if (String(j19['code'] ?? '-1') === '0') {
                if (String(j19['userId'] ?? '') !== '') {
                    userId = String(j19['userId']);
                }
                if (String(j19['passToken'] ?? '') !== '') {
                    o11.set('passToken', String(j19['passToken']));
                }
                const k19 = String(j19['location'] ?? '');
                if (k19 !== '') {
                    const l19 = await z10(k19);
                    serviceToken = a11(l19);
                }
                j.info(g1, `step1 after verify: code=0, userId=${userId}`);
            }
            else {
                j.error(g1, `step1 after verify code=${String(j19['code'] ?? '-1')}`);
            }
        }
        catch (e) {
            j.error(g1, 'step1 after verify error');
        }
        if (pendingUser !== '' && pendingHash !== '') {
            const c19: Record<string, string> = {
                'sid': 'mijia',
                '_sign': pendingSign,
                'qs': pendingQs !== '' ? pendingQs : '%3Fsid%3Dmijia%26_json%3Dtrue',
                'callback': pendingCallback !== '' ? pendingCallback : 'https://sts.api.io.mi.com/sts',
                'user': pendingUser,
                'hash': pendingHash,
                '_json': 'true'
            };
            const d19 = await y10(http.RequestMethod.POST, `${l11}/pass/serviceLoginAuth2?_json=true`, s10(), v10(c19), null);
            const e19 = w10(d19.text);
            j.error(g1, `>>> replay serviceLoginAuth2 body=${d19.text.substring(0, 400)}`);
            const code = String(e19['code'] ?? '-1');
            const location = String(e19['location'] ?? '');
            const f19 = x10(d19.text);
            if (f19 !== '') {
                p11 = f19;
            }
            else if (e19['nonce'] !== undefined && e19['nonce'] !== null) {
                p11 = String(e19['nonce']);
            }
            if (String(e19['ssecurity'] ?? '') !== '') {
                ssecurity = String(e19['ssecurity']);
                a19 = true;
                j.error(g1, `>>> replay 拿到 ssecurity len=${ssecurity.length} head=${ssecurity.substring(0, 24)}`);
            }
            if (String(e19['userId'] ?? '') !== '') {
                userId = String(e19['userId']);
            }
            if (code === '0' && location !== '') {
                const g19 = await z10(location);
                const h19 = a11(g19);
                if (h19 !== '') {
                    serviceToken = h19;
                }
                if (serviceToken !== '') {
                    j.info(g1, `completeLoginAfterVerify success via replay, userId=${userId}`);
                    await z9();
                    return true;
                }
            }
            j.error(g1, `replay serviceLoginAuth2 code=${code}, desc=${String(e19['desc'] ?? '')}`);
        }
        const b19 = o11.get('serviceToken');
        if (b19 !== undefined && b19 !== '' && a19) {
            serviceToken = b19;
            j.info(g1, `completeLoginAfterVerify success via cookieJar`);
            await z9();
            return true;
        }
        j.error(g1, `completeLoginAfterVerify failed, gotSsecurity=${a19}, callbackUrl=${w18}`);
        return false;
    }
    catch (e) {
        j.error(g1, 'completeLoginAfterVerify error');
        return false;
    }
}
function f10(url: string, name: string): string {
    const s18 = url.indexOf('?');
    if (s18 < 0) {
        return '';
    }
    const query = url.substring(s18 + 1);
    const t18 = query.split('&');
    for (let u18 = 0; u18 < t18.length; u18++) {
        const v18 = t18[u18].indexOf('=');
        if (v18 > 0 && t18[u18].substring(0, v18) === name) {
            return t18[u18].substring(v18 + 1);
        }
    }
    return '';
}
export function o5(n18: string, name: string): string {
    if (n18 === '') {
        return '';
    }
    const o18 = n18.split(';');
    for (let p18 = 0; p18 < o18.length; p18++) {
        const q18 = o18[p18].trim();
        const r18 = q18.indexOf('=');
        if (r18 > 0 && q18.substring(0, r18).trim() === name) {
            return q18.substring(r18 + 1).trim();
        }
    }
    return '';
}
export async function p5(token: string, k18: string = ''): Promise<boolean> {
    if (token === '') {
        return false;
    }
    serviceToken = token;
    if (userId === '') {
        userId = o5(k18, 'userId');
    }
    const l18 = o5(k18, 'cUserId');
    if (l18 !== '') {
        cUserId = l18;
    }
    else {
        const m18 = o11.get('cUserId');
        if (m18 !== undefined && m18 !== '') {
            cUserId = m18;
        }
    }
    if (ssecurity === '') {
        await d10();
    }
    if (ssecurity === '') {
        j.error(g1, `completeLoginWithToken: 仍未拿到 ssecurity，后续云签名请求会失败`);
    }
    j.info(g1, `completeLoginWithToken ok, userId=${userId}, hasSsecurity=${ssecurity !== ''}`);
    await z9();
    return true;
}
export async function getDevices(country: string = 'cn'): Promise<l5[]> {
    const devices: l5[] = [];
    let e18 = '';
    for (let page = 0; page < 20; page++) {
        const f18 = e18 === '' ? '{}' : `{"start_did":"${e18}"}`;
        const respData = await j10('/v2/home/device_list_page', f18, country);
        const g18 = Number(respData['code'] ?? -1);
        j.info(g1, `getDevices device_list_page code=${g18}`);
        if (g18 !== 0) {
            j.error(g1, `device_list_page resp body: ${JSON.stringify(respData).substring(0, 500)}`);
            throw new Error(`米家云设备列表返回错误码: ${g18}`);
        }
        let h18 = respData['list'];
        if (!(h18 instanceof Array)) {
            const result = respData['result'];
            if (result !== undefined) {
                h18 = (result as Record<string, Object>)['list'];
            }
        }
        const list: Object[] = (h18 instanceof Array) ? h18 as Object[] : [];
        for (let j18 = 0; j18 < list.length; j18++) {
            const d = list[j18] as Record<string, Object>;
            const dev: l5 = {
                did: String(d['did'] ?? ''),
                token: String(d['token'] ?? ''),
                name: String(d['name'] ?? ''),
                model: String(d['model'] ?? ''),
                localip: String(d['localip'] ?? ''),
                isOnline: Boolean(d['isOnline'] ?? false),
                specType: String(d['spec_type'] ?? '')
            };
            devices.push(dev);
        }
        const i18 = Boolean(respData['has_more'] ?? false);
        if (!i18) {
            break;
        }
        const next = String(respData['next_start_did'] ?? '');
        if (next === '' || next === e18) {
            break;
        }
        e18 = next;
    }
    j.info(g1, `getDevices total=${devices.length}`);
    return devices;
}
export async function x9(d18: string, method: string, params: (string | number | boolean)[]): Promise<Record<string, Object>> {
    const payload: Record<string, Object> = { 'method': method, 'params': params };
    const respData = await j10(`/home/rpc/${d18}`, JSON.stringify(payload), 'cn');
    j.info(g1, `rpcRemote ${d18} ${method} code=${Number(respData['code'] ?? -1)}`);
    return respData;
}
export async function g10(a18: string, b18: number, c18: number): Promise<Record<string, Object>> {
    const prop: Record<string, Object> = { 'did': a18, 'siid': b18, 'piid': c18 };
    const params: Object[] = [];
    params.push(prop);
    const payload: Record<string, Object> = { 'params': params };
    const respData = await j10('/miotspec/prop/get', JSON.stringify(payload), 'cn');
    j.info(g1, `miotGetProp ${a18} ${b18}.${c18} code=${Number(respData['code'] ?? -1)}`);
    return respData;
}
export async function t2(x17: string, y17: number, z17: number, value: boolean | number | string): Promise<Record<string, Object>> {
    const prop: Record<string, Object> = { 'did': x17, 'siid': y17, 'piid': z17, 'value': value };
    const params: Object[] = [];
    params.push(prop);
    const payload: Record<string, Object> = { 'params': params };
    const respData = await j10('/miotspec/prop/set', JSON.stringify(payload), 'cn');
    j.info(g1, `miotSetProp ${x17} ${y17}.${z17}=${value} code=${Number(respData['code'] ?? -1)}`);
    return respData;
}
export async function w9(s17: string[]): Promise<Record<string, boolean>> {
    const params: Object[] = [];
    for (let w17 = 0; w17 < s17.length; w17++) {
        const prop: Record<string, Object> = { 'did': s17[w17], 'siid': 2, 'piid': 1 };
        params.push(prop);
    }
    const payload: Record<string, Object> = { 'params': params };
    const respData = await j10('/miotspec/prop/get', JSON.stringify(payload), 'cn');
    const result: Record<string, boolean> = {};
    const t17 = respData['result'];
    if (t17 instanceof Array) {
        const arr = t17 as Object[];
        for (let u17 = 0; u17 < arr.length; u17++) {
            const r = arr[u17] as Record<string, Object>;
            const v17 = String(r['did'] ?? '');
            const val = r['value'];
            if (v17 === '') {
                continue;
            }
            if (val === true) {
                result[v17] = true;
            }
            else if (val === false) {
                result[v17] = false;
            }
        }
    }
    return result;
}
export interface o2 {
    siid: number;
    piid: number;
    name: string;
    description: string;
    format: string;
    readable: boolean;
    writable: boolean;
    unit: string;
    min: number;
    max: number;
    step: number;
    u2: boolean;
}
export interface r11 {
    did: string;
    deviceType: string;
    props: o2[];
}
export async function q2(t16: string[]): Promise<Record<string, r11>> {
    const result: Record<string, r11> = {};
    if (t16.length === 0) {
        return result;
    }
    const u16: string[] = [];
    for (let r17 = 0; r17 < t16.length; r17++) {
        u16.push('');
    }
    const payload: Record<string, Object> = {
        'dids': t16,
        'urns': u16,
        'isGetFullInstance': true
    };
    const respData = await j10('/appgateway/gspec/Gspec/get_instances_by_dids', JSON.stringify(payload), 'cn');
    const code = Number(respData['code'] ?? -1);
    if (code !== 0) {
        j.error(g1, `getDeviceSpecs failed code=${code}`);
        return result;
    }
    const v16 = respData['instances'];
    if (v16 === undefined || v16 === null) {
        return result;
    }
    const w16 = v16 as Record<string, Object>;
    const keys = Object.keys(w16);
    for (let x16 = 0; x16 < keys.length; x16++) {
        const y16 = keys[x16];
        const z16 = w16[y16] as Record<string, Object>;
        const a17 = String(z16['instance'] ?? '');
        if (a17 === '') {
            continue;
        }
        const spec = w10(a17);
        const b17 = String(spec['type'] ?? '');
        const deviceType = h10(b17);
        const props: o2[] = [];
        const c17 = spec['services'];
        if (c17 instanceof Array) {
            const e17 = c17 as Object[];
            for (let s = 0; s < e17.length; s++) {
                const f17 = e17[s] as Record<string, Object>;
                const g17 = Number(f17['iid'] ?? 0);
                const h17 = String(f17['type'] ?? '');
                if (h17.indexOf('device-information') >= 0) {
                    continue;
                }
                const i17 = f17['properties'];
                if (i17 instanceof Array) {
                    const arr = i17 as Object[];
                    for (let p = 0; p < arr.length; p++) {
                        const prop = arr[p] as Record<string, Object>;
                        let readable = false;
                        let writable = false;
                        const access = prop['access'];
                        if (access instanceof Array) {
                            const p17 = access as Object[];
                            for (let a = 0; a < p17.length; a++) {
                                const q17 = String(p17[a]);
                                if (q17 === 'read') {
                                    readable = true;
                                }
                                else if (q17 === 'write') {
                                    writable = true;
                                }
                            }
                        }
                        if (!readable && !writable) {
                            continue;
                        }
                        const j17 = Number(prop['iid'] ?? 0);
                        const k17 = String(prop['type'] ?? '');
                        const name = i10(k17);
                        const format = String(prop['format'] ?? '');
                        const description = String(prop['description'] ?? '');
                        const unit = String(prop['unit'] ?? '');
                        let min = 0;
                        let max = 0;
                        let step = 1;
                        let l17 = false;
                        const m17 = prop['value-range'];
                        if (m17 instanceof Array) {
                            const o17 = m17 as Object[];
                            if (o17.length >= 2) {
                                min = Number(o17[0]);
                                max = Number(o17[1]);
                                step = o17.length >= 3 ? Number(o17[2]) : 1;
                                l17 = true;
                            }
                        }
                        const n17: o2 = {
                            siid: g17,
                            piid: j17,
                            name: name,
                            description: description,
                            format: format,
                            readable: readable,
                            writable: writable,
                            unit: unit,
                            min: min,
                            max: max,
                            step: step,
                            u2: l17
                        };
                        props.push(n17);
                    }
                }
            }
        }
        const d17: r11 = {
            did: y16,
            deviceType: deviceType,
            props: props
        };
        result[y16] = d17;
    }
    return result;
}
function h10(p16: string): string {
    const marker = 'device:';
    const q16 = p16.indexOf(marker);
    if (q16 < 0) {
        return '';
    }
    const r16 = p16.substring(q16 + marker.length);
    const s16 = r16.indexOf(':');
    return s16 < 0 ? r16 : r16.substring(0, s16);
}
function i10(l16: string): string {
    const marker = 'property:';
    const m16 = l16.indexOf(marker);
    if (m16 < 0) {
        return '';
    }
    const n16 = l16.substring(m16 + marker.length);
    const o16 = n16.indexOf(':');
    return o16 < 0 ? n16 : n16.substring(0, o16);
}
export async function s2(d16: string, e16: number[], f16: number[]): Promise<Record<string, string | number | boolean>> {
    const params: Object[] = [];
    for (let k16 = 0; k16 < e16.length; k16++) {
        const prop: Record<string, Object> = { 'did': d16, 'siid': e16[k16], 'piid': f16[k16] };
        params.push(prop);
    }
    const payload: Record<string, Object> = { 'params': params };
    const respData = await j10('/miotspec/prop/get', JSON.stringify(payload), 'cn');
    const result: Record<string, string | number | boolean> = {};
    const g16 = respData['result'];
    if (g16 instanceof Array) {
        const arr = g16 as Object[];
        for (let h16 = 0; h16 < arr.length; h16++) {
            const r = arr[h16] as Record<string, Object>;
            const i16 = Number(r['siid'] ?? 0);
            const j16 = Number(r['piid'] ?? 0);
            const val = r['value'];
            const key = `${i16}.${j16}`;
            if (val === true) {
                result[key] = true;
            }
            else if (val === false) {
                result[key] = false;
            }
            else if (val !== undefined && val !== null) {
                const s = String(val);
                const num = Number(s);
                if (!Number.isNaN(num) && s !== '' && String(num) === s) {
                    result[key] = num;
                }
                else {
                    result[key] = s;
                }
            }
        }
    }
    return result;
}
export async function t9(country: string = 'cn'): Promise<k11[]> {
    const respData = await j10('/v2/homeroom/gethome_merged', '{"fg":true,"fetch_share":true,"fetch_share_dev":true,"fetch_cariot":true,"limit":300,"app_ver":7,"plat_form":0}', country);
    const q15 = Number(respData['code'] ?? -1);
    j.info(g1, `getHomeList gethome_merged code=${q15}`);
    if (q15 !== 0) {
        j.error(g1, `gethome_merged failed, body=${JSON.stringify(respData).substring(0, 500)}`);
        return [];
    }
    const result = respData['result'] as Record<string, Object>;
    const r15 = result['homelist'];
    const list: Object[] = (r15 instanceof Array) ? r15 as Object[] : [];
    const s15: k11[] = [];
    for (let t15 = 0; t15 < list.length; t15++) {
        const h = list[t15] as Record<string, Object>;
        const u15: j11[] = [];
        const v15 = h['roomlist'];
        const w15: Object[] = (v15 instanceof Array) ? v15 as Object[] : [];
        for (let y15 = 0; y15 < w15.length; y15++) {
            const r = w15[y15] as Record<string, Object>;
            const z15: string[] = [];
            const a16 = r['dids'];
            const b16: Object[] = (a16 instanceof Array) ? a16 as Object[] : [];
            for (let k = 0; k < b16.length; k++) {
                z15.push(String(b16[k]));
            }
            const c16: j11 = {
                id: String(r['id'] ?? ''),
                name: String(r['name'] ?? '未命名房间'),
                dids: z15
            };
            u15.push(c16);
        }
        const x15: k11 = {
            id: String(h['id'] ?? ''),
            name: String(h['name'] ?? '我的家'),
            rooms: u15
        };
        s15.push(x15);
    }
    j.info(g1, `getHomeList returned ${s15.length} homes`);
    return s15;
}
async function j10(a15: string, data: string, country: string): Promise<Record<string, Object>> {
    if (serviceToken === '') {
        throw new Error('未登录米家云');
    }
    if (ssecurity === '') {
        throw new Error('ssecurity 为空，登录态不完整，请重新登录（二次验证后未拿到 ssecurity）');
    }
    const base = country === 'cn' ? i.m : `https://${country}.api.io.mi.com/app`;
    const url = base + a15;
    j.error(g1, `>>> signedPost 请求 url=${url}`);
    j.error(g1, `>>> signedPost 明文 data=${data}`);
    j.error(g1, `>>> ssecurity_len=${ssecurity.length} ssecurity=${ssecurity} userId=${userId} serviceToken=${serviceToken}`);
    const nonce = p10();
    j.error(g1, `>>> nonce=${nonce}`);
    const b15 = await q10(ssecurity, nonce);
    const path = a15;
    const c15 = g11.s20(r10(b15));
    const d15 = g11.t20(12);
    const e15 = g11.u20(d15);
    const f15 = g11.u20(await g11.v20(g11.r20(data), c15, d15));
    const g15: Record<string, string> = {};
    g15['data'] = f15;
    g15['aes_hash__'] = e15;
    const signature = await l10('POST', path, b15, g15);
    const h15: Record<string, string> = {};
    h15['data'] = f15;
    h15['aes_hash__'] = e15;
    h15['signature'] = signature;
    h15['_nonce'] = nonce;
    const i15 = cUserId !== '' ? cUserId : userId;
    const cookie = `cUserId=${i15}; yetAnotherServiceToken=${serviceToken}; serviceToken=${serviceToken}; timezone_id=Asia/Shanghai; timezone=GMT+08:00; is_daylight=0; dst_offset=0; channel=MI_APP_STORE; countryCode=CN; PassportDeviceId=${deviceId}; locale=zh_CN`;
    j.error(g1, `>>> Cookie=${cookie.substring(0, 160)}`);
    const header: Record<string, string> = {
        'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
        'miot-encrypt-algorithm': 'ENCRYPT-AES',
        'accept-encoding': 'identity'
    };
    try {
        const j15 = await y10(http.RequestMethod.POST, url, cookie, v10(h15), header);
        j.error(g1, `>>> signedPost ${a15} 响应码=${j15.status} 响应体原文(前300)="${j15.text.substring(0, 300)}"`);
        const k15 = await k10(j15.text, c15, d15);
        const l15 = w10(k15);
        const m15 = Number(l15['code'] ?? -1);
        j.error(g1, `>>> signedPost ${a15} 解密后 code=${m15}`);
        const n15 = JSON.stringify(l15);
        const chunk = 900;
        if (n15.length <= chunk) {
            j.error(g1, `>>> signedPost ${a15} body=${n15}`);
        }
        else {
            const total = Math.ceil(n15.length / chunk);
            for (let p15 = 0; p15 < total; p15++) {
                j.error(g1, `>>> signedPost ${a15} body[${p15 + 1}/${total}] ${n15.substring(p15 * chunk, (p15 + 1) * chunk)}`);
            }
        }
        if (m15 === 2 && !q11) {
            q11 = true;
            j.error(g1, `>>> signedPost 检测到 auth error，尝试重放 auth2 刷新 ssecurity`);
            const o15 = await e10();
            if (o15) {
                await z9();
                j.error(g1, `>>> signedPost 刷新 ssecurity 成功，重试请求`);
                return await j10(a15, data, country);
            }
            j.error(g1, `>>> signedPost 无法刷新 ssecurity（缺少登录参数），需要重新登录`);
        }
        return l15;
    }
    catch (e) {
        j.error(g1, `>>> signedPost ${a15} http error: ${String(e)}`);
        j.error(g1, `>>> signedPost ${a15} url=${url}`);
        throw new Error(`signedPost ${a15} http error`);
    }
}
async function k10(body: string, key: Uint8Array, iv: Uint8Array): Promise<string> {
    const z14 = body.trim();
    if (!o10(z14)) {
        j.error(g1, `aesGcmDecryptResponse: 响应体非 base64 密文，直接返回原文: ${z14.substring(0, 200)}`);
        return z14;
    }
    const plain = await g11.w20(g11.s20(z14), key, iv);
    return g11.x20(plain);
}
async function l10(method: string, path: string, v14: string, params: Record<string, string>): Promise<string> {
    const w14: string[] = [];
    w14.push(method.toUpperCase());
    w14.push(path);
    const keys = Object.keys(params).sort();
    for (let y14 = 0; y14 < keys.length; y14++) {
        w14.push(`${keys[y14]}=${params[keys[y14]]}`);
    }
    w14.push(v14);
    const x14 = w14.join('&');
    const digest = await g11.y20(g11.r20(x14));
    return g11.u20(digest);
}
function m10(t14: string, s: string): string {
    const key = g11.s20(r10(t14));
    const u14 = g11.z20(key, g11.r20(s), 1024);
    return g11.u20(u14);
}
function n10(q14: string, s: string): string {
    const key = g11.s20(r10(q14));
    const r14 = s.trim();
    if (!o10(r14)) {
        j.error(g1, `rc4DecryptStr: 响应体非 base64 密文，直接返回原文: ${r14.substring(0, 200)}`);
        return r14;
    }
    const s14 = g11.z20(key, g11.s20(r14), 1024);
    return g11.x20(s14);
}
function o10(s: string): boolean {
    if (s === '') {
        return false;
    }
    for (let o14 = 0; o14 < s.length; o14++) {
        const c = s.charAt(o14);
        const p14 = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '+' || c === '/' || c === '=';
        if (!p14) {
            return false;
        }
    }
    return true;
}
function p10(): string {
    const bytes = new Uint8Array(12);
    bytes.set(g11.t20(8), 0);
    const n14 = Math.floor(Date.now() / 60000);
    bytes[8] = (n14 >>> 24) & 0xff;
    bytes[9] = (n14 >>> 16) & 0xff;
    bytes[10] = (n14 >>> 8) & 0xff;
    bytes[11] = n14 & 0xff;
    return g11.u20(bytes);
}
async function q10(l14: string, nonce: string): Promise<string> {
    const a = g11.s20(r10(l14));
    const b = g11.s20(r10(nonce));
    const m14 = new Uint8Array(a.length + b.length);
    m14.set(a, 0);
    m14.set(b, a.length);
    const digest = await g11.a21(m14);
    return g11.u20(digest);
}
function r10(s: string): string {
    let i14 = '';
    for (let j14 = 0; j14 < s.length; j14++) {
        const c = s.charAt(j14);
        const k14 = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '+' || c === '/' || c === '=';
        if (k14) {
            i14 += c;
        }
    }
    return i14;
}
function s10(): string {
    const g14: string[] = [];
    const keys = Array.from(o11.keys());
    for (let h14 = 0; h14 < keys.length; h14++) {
        const v = o11.get(keys[h14]);
        if (v !== undefined) {
            g14.push(`${keys[h14]}=${v}`);
        }
    }
    return g14.join('; ');
}
function t10(z13: string): void {
    if (z13 === '' || z13 === 'undefined') {
        return;
    }
    const lines = z13.split('\n');
    for (let a14 = 0; a14 < lines.length; a14++) {
        const line = lines[a14].trim();
        if (line === '') {
            continue;
        }
        const b14 = line.split('\t');
        if (b14.length >= 7) {
            const name = b14[5].trim();
            const value = b14[6].trim();
            if (name !== '') {
                o11.set(name, value);
            }
            continue;
        }
        const c14 = line.split(/[;,]/);
        for (let d14 = 0; d14 < c14.length; d14++) {
            const e14 = c14[d14].trim();
            const f14 = e14.indexOf('=');
            if (f14 > 0) {
                const name = e14.substring(0, f14).trim();
                const value = e14.substring(f14 + 1).trim();
                if (name !== '' && name !== 'Path' && name !== 'Domain' && name !== 'Expires' && name !== 'Max-Age'
                    && name !== 'HttpOnly' && name !== 'Secure' && name !== 'SameSite') {
                    o11.set(name, value);
                }
            }
        }
    }
}
function u10(cookies: string[], name: string): string {
    for (let v13 = 0; v13 < cookies.length; v13++) {
        const line = cookies[v13];
        const w13 = line.split('\t');
        if (w13.length >= 7 && w13[5].trim() === name) {
            return w13[6].trim();
        }
        const x13 = line.trim().split(';')[0];
        const y13 = x13.indexOf('=');
        if (y13 > 0 && x13.substring(0, y13) === name) {
            return x13.substring(y13 + 1);
        }
    }
    return '';
}
function v10(t13: Record<string, string>): string {
    const keys = Object.keys(t13);
    let s = '';
    for (let u13 = 0; u13 < keys.length; u13++) {
        s += (u13 === 0 ? '' : '&') + `${keys[u13]}=${encodeURIComponent(t13[keys[u13]])}`;
    }
    return s;
}
function w10(text: string): Record<string, Object> {
    const r13 = text.replace(/^&&&START&&&/, '');
    const s13: object = JSON.parse(r13) as object;
    return s13 as Record<string, Object>;
}
function x10(text: string): string {
    const p13 = new RegExp('"nonce"\\s*:\\s*"?([0-9]+)"?');
    const q13 = p13.exec(text);
    if (q13 !== null && q13[1] !== undefined) {
        return q13[1];
    }
    return '';
}
interface s11 {
    text: string;
    cookies: string[];
    status: number;
    headers: Record<string, string>;
}
async function y10(method: http.RequestMethod, url: string, cookie: string, body: string | null, j13: Record<string, string> | null): Promise<s11> {
    const header: Record<string, string> = {
        'User-Agent': n11,
        'Content-Type': 'application/x-www-form-urlencoded'
    };
    if (j13 !== null) {
        const n13 = Object.keys(j13);
        for (let o13 = 0; o13 < n13.length; o13++) {
            header[n13[o13]] = j13[n13[o13]];
        }
    }
    if (cookie !== '') {
        header['Cookie'] = cookie;
    }
    const options: http.HttpRequestOptions = {
        method: method,
        header: header,
        connectTimeout: 15000,
        readTimeout: 30000
    };
    if (body !== null) {
        options.extraData = body;
    }
    const k13 = http.createHttp();
    try {
        const l13 = await k13.request(url, options);
        let m13 = String(l13.cookies);
        if (m13 === '' || m13 === 'undefined') {
            m13 = c11((l13.header as Record<string, Object>), 'set-cookie');
        }
        t10(m13);
        const result: s11 = {
            text: String(l13.result),
            cookies: m13.split('\n'),
            status: l13.responseCode,
            headers: d11(l13.header as Record<string, Object>)
        };
        return result;
    }
    finally {
        k13.destroy();
    }
}
async function z10(location: string): Promise<s11> {
    j.error(g1, `>>> fetchServiceToken 直接 GET location（无 clientSign）, ssecurity_len=${ssecurity.length}`);
    return await b11(location);
}
function a11(g13: s11): string {
    let h13 = o11.get('serviceToken') ?? '';
    if (h13 === '') {
        h13 = u10(g13.cookies, 'serviceToken');
    }
    if (h13 === '') {
        h13 = e11(g13.headers, 'xiaomiio_serviceToken');
    }
    if (h13 === '') {
        h13 = e11(g13.headers, 'serviceToken');
    }
    if (h13 !== '') {
        const i13 = o11.get('cUserId');
        if (i13 !== undefined && i13 !== '') {
            cUserId = i13;
        }
    }
    return h13;
}
async function b11(e12: string): Promise<s11> {
    let f12 = e12;
    let g12 = '';
    let h12: string[] = [];
    let i12: Record<string, string> = {};
    const j12 = 10;
    const session = rcp.createSession({
        requestConfiguration: {
            transfer: {
                autoRedirect: false,
                timeout: { connectMs: 15000, transferMs: 30000 }
            }
        }
    });
    for (let k12 = 0; k12 < j12; k12++) {
        const l12 = s10();
        const headers: rcp.RequestHeaders = {
            'user-agent': n11,
            'content-type': 'application/x-www-form-urlencoded'
        };
        if (l12 !== '') {
            headers['cookie'] = l12;
        }
        let m12 = '';
        let n12 = '';
        let o12: Record<string, string> = {};
        let p12 = 0;
        let q12 = '';
        try {
            const req = new rcp.Request(f12, 'GET', headers);
            const r12 = await session.fetch(req);
            p12 = r12.statusCode;
            const s12 = r12.toString();
            m12 = s12 === null ? '' : s12;
            const t12 = Object.keys(r12.headers);
            for (let z12 = 0; z12 < t12.length; z12++) {
                const a13 = t12[z12];
                const b13 = r12.headers[a13];
                const c13 = a13.toLowerCase();
                let d13 = '';
                if (b13 instanceof Array) {
                    const arr = b13 as Object[];
                    const e13: string[] = [];
                    for (let f13 = 0; f13 < arr.length; f13++) {
                        e13.push(String(arr[f13]));
                    }
                    d13 = e13.join('\n');
                }
                else if (b13 !== undefined) {
                    d13 = String(b13);
                }
                o12[c13] = d13;
                if (c13 === 'set-cookie') {
                    n12 = n12 === '' ? d13 : n12 + '\n' + d13;
                }
                else if (c13 === 'location') {
                    q12 = d13;
                }
                if (c13.indexOf('cookie') >= 0 || c13 === 'location'
                    || c13.indexOf('servicetoken') >= 0 || c13.indexOf('service') >= 0) {
                    j.error(g1, `>>> step3 rcp header[${a13}]=${d13.substring(0, 300)}`);
                }
            }
            const u12 = r12.cookies;
            if (u12 !== undefined && u12 !== null) {
                let v12 = '';
                for (let w12 = 0; w12 < u12.length; w12++) {
                    const c = u12[w12];
                    const x12 = c.name;
                    const y12 = c.value === undefined ? '' : c.value;
                    v12 += (v12 === '' ? '' : '\n') + `${x12}=${y12}`;
                }
                if (v12 !== '') {
                    n12 = v12;
                }
            }
        }
        catch (e) {
            j.error(g1, `>>> step3 rcp hop=${k12} fetch error: ${String(e)}`);
            break;
        }
        t10(n12);
        j.error(g1, `>>> step3 hop=${k12} code=${p12} body=${m12.substring(0, 120)} respCookies=${n12.substring(0, 200)}`);
        g12 = m12;
        h12 = n12.split('\n');
        i12 = o12;
        if (q12 === '') {
            break;
        }
        if (q12.indexOf('http') === 0) {
            f12 = q12;
        }
        else if (q12.indexOf('/') === 0) {
            const host = f11(e12);
            f12 = host + q12;
        }
        else {
            break;
        }
    }
    try {
        session.close();
    }
    catch (e) {
        j.error(g1, `step3 rcp session.close error: ${String(e)}`);
    }
    const result: s11 = {
        text: g12,
        cookies: h12,
        status: 0,
        headers: i12
    };
    return result;
}
function c11(h: Record<string, Object>, name: string): string {
    if (h === undefined || h === null) {
        return '';
    }
    const a12 = name.toLowerCase();
    const keys = Object.keys(h);
    for (let b12 = 0; b12 < keys.length; b12++) {
        if (keys[b12].toLowerCase() === a12) {
            const v = h[keys[b12]];
            if (v instanceof Array) {
                const arr = v as Object[];
                const c12: string[] = [];
                for (let d12 = 0; d12 < arr.length; d12++) {
                    c12.push(String(arr[d12]));
                }
                return c12.join('\n');
            }
            return String(v);
        }
    }
    return '';
}
function d11(h: Record<string, Object>): Record<string, string> {
    const y11: Record<string, string> = {};
    if (h === undefined || h === null) {
        return y11;
    }
    const keys = Object.keys(h);
    for (let z11 = 0; z11 < keys.length; z11++) {
        const v = h[keys[z11]];
        if (v instanceof Array) {
            const arr = v as Object[];
            if (arr.length > 0) {
                y11[keys[z11].toLowerCase()] = String(arr[0]);
            }
        }
        else {
            y11[keys[z11].toLowerCase()] = String(v);
        }
    }
    return y11;
}
function e11(headers: Record<string, string>, name: string): string {
    const w11 = name.toLowerCase();
    const keys = Object.keys(headers);
    for (let x11 = 0; x11 < keys.length; x11++) {
        if (keys[x11].toLowerCase() === w11) {
            return headers[keys[x11]];
        }
    }
    return '';
}
function f11(url: string): string {
    const t11 = url.indexOf('://');
    if (t11 < 0) {
        return '';
    }
    const u11 = url.substring(t11 + 3);
    const v11 = u11.indexOf('/');
    if (v11 < 0) {
        return url;
    }
    return url.substring(0, t11 + 3) + u11.substring(0, v11);
}
