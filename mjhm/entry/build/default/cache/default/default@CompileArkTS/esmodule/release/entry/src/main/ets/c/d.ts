import type { Device, m3, j3, Scene, l3 } from "../f/g";
import { i, j } from "@normalized:N&&&entry/src/main/ets/a/b&";
import * as f1 from "@normalized:N&&&entry/src/main/ets/c/e&";
import * as Storage from "@normalized:N&&&entry/src/main/ets/c/h&";
const g1 = 'ApiService';
export async function f4(): Promise<m3[]> {
    const p9 = await f1.t9('cn');
    const q9: m3[] = [];
    for (let r9 = 0; r9 < p9.length; r9++) {
        let count = 0;
        for (let s9 = 0; s9 < p9[r9].rooms.length; s9++) {
            count += p9[r9].rooms[s9].dids.length;
        }
        const h: m3 = {
            homeId: p9[r9].id,
            name: p9[r9].name,
            u5: p9[r9].rooms.length,
            m4: count
        };
        q9.push(h);
    }
    return q9;
}
export async function g4(j9: string): Promise<j3[]> {
    const k9 = await f1.t9('cn');
    const l9: j3[] = [];
    for (let m9 = 0; m9 < k9.length; m9++) {
        if (k9[m9].id === j9) {
            for (let n9 = 0; n9 < k9[m9].rooms.length; n9++) {
                const r = k9[m9].rooms[n9];
                const o9: j3 = {
                    h3: r.id,
                    name: r.name,
                    homeId: j9,
                    m4: r.dids.length
                };
                l9.push(o9);
            }
            break;
        }
    }
    return l9;
}
interface g7 {
    u9: Record<string, string>;
    v9: Record<string, string>;
}
async function v6(): Promise<g7> {
    const b9: Record<string, string> = {};
    const c9: Record<string, string> = {};
    const d9 = await f1.t9('cn');
    for (let f9 = 0; f9 < d9.length; f9++) {
        const g9 = d9[f9].rooms;
        for (let h9 = 0; h9 < g9.length; h9++) {
            const i9 = g9[h9].dids;
            for (let k = 0; k < i9.length; k++) {
                b9[i9[k]] = d9[f9].id;
                c9[i9[k]] = g9[h9].id;
            }
        }
    }
    const e9: g7 = { u9: b9, v9: c9 };
    return e9;
}
export async function getDevices(t8: string, u8?: string): Promise<Device[]> {
    let v8: f1.l5[] | null = await Storage.t5<f1.l5[]>(i.u);
    if (v8 === null || v8.length === 0) {
        const a9 = await f1.getDevices('cn');
        await Storage.j5(i.u, a9);
        v8 = a9;
    }
    const w8 = await v6();
    const devices: Device[] = [];
    for (let x8 = 0; x8 < v8.length; x8++) {
        const y8 = v8[x8];
        const hid = w8.u9[y8.did] ?? '';
        const z8 = w8.v9[y8.did] ?? '';
        if (t8 !== '' && hid !== t8) {
            continue;
        }
        if (u8 !== undefined && z8 !== u8) {
            continue;
        }
        devices.push(c7(y8, z8));
    }
    return devices;
}
export async function i4(r8: string): Promise<Device[]> {
    const s8 = await f1.getDevices('cn');
    await Storage.j5(i.u, s8);
    return getDevices(r8);
}
function w6(type: string): boolean {
    return type === 'switch' || type === 'light' || type === 'air_conditioner'
        || type === 'air_purifier' || type === 'humidifier' || type === 'fan'
        || type === 'heater' || type === 'desk';
}
export async function h4(devices: Device[]): Promise<void> {
    const n8: string[] = [];
    for (let q8 = 0; q8 < devices.length; q8++) {
        if (w6(devices[q8].type)) {
            n8.push(devices[q8].did);
        }
    }
    if (n8.length === 0) {
        return;
    }
    try {
        const o8 = await f1.w9(n8);
        for (let p8 = 0; p8 < devices.length; p8++) {
            const v = o8[devices[p8].did];
            if (v !== undefined) {
                devices[p8].props['power'] = v;
            }
        }
        j.info(g1, `readPowerStates done: ${n8.length} 台设备电源状态已读取`);
    }
    catch (e) {
        j.error(g1, `readPowerStates failed: ${e}`);
    }
}
export async function j4(cmd: l3): Promise<boolean> {
    if (cmd.method === 'set_power') {
        await y6(cmd.did, x6(cmd.params));
        return true;
    }
    const m8 = await f1.x9(cmd.did, cmd.method, cmd.params);
    z6(cmd.did, m8);
    return true;
}
function x6(params: (string | number | boolean)[]): boolean {
    if (params.length === 0) {
        return false;
    }
    const p = params[0];
    if (typeof p === 'boolean') {
        return p;
    }
    if (typeof p === 'number') {
        return p !== 0;
    }
    return p === 'on' || p === 'true' || p === '1';
}
async function y6(i8: string, on: boolean): Promise<void> {
    const j8 = await f1.t2(i8, 2, 1, on);
    const code = Number(j8['code'] ?? -1);
    if (code !== 0) {
        throw new Error(`云端控制返回错误码: ${code}`);
    }
    const result = j8['result'];
    if (result instanceof Array) {
        const arr = result as Object[];
        for (let k8 = 0; k8 < arr.length; k8++) {
            const l8 = Number((arr[k8] as Record<string, Object>)['code'] ?? 0);
            if (l8 < 0) {
                throw new Error(`设备属性设置失败 code=${l8}（可能离线或该属性不支持）`);
            }
        }
    }
    j.info(g1, `cloud miot-spec power ok: ${i8} -> ${on ? 'on' : 'off'}`);
}
function z6(g8: string, h8: Record<string, Object>): void {
    const code = Number(h8['code'] ?? -1);
    if (code !== 0) {
        throw new Error(`云端控制返回错误码: ${code}`);
    }
    const err = h8['error'];
    if (err !== undefined && err !== null) {
        const errCode = Number((err as Record<string, Object>)['code'] ?? 0);
        const errMsg = String((err as Record<string, Object>)['message'] ?? '');
        if (errCode !== 0) {
            throw new Error(`设备未响应（云端 error ${errCode}: ${errMsg}）`);
        }
    }
    j.info(g1, `cloud rpc ok: ${g8}`);
}
export async function a7(username: string, password: string): Promise<Device[]> {
    const c8 = await f1.h5(username, password);
    if (!c8) {
        throw new Error('米家云登录失败（账号/密码错误，或需先完成二次验证）');
    }
    const d8 = await f1.getDevices('cn');
    await Storage.j5(i.u, d8);
    j.info(g1, `synced ${d8.length} cloud devices`);
    const devices: Device[] = [];
    const e8 = await v6();
    for (let f8 = 0; f8 < d8.length; f8++) {
        devices.push(c7(d8[f8], e8.v9[d8[f8].did] ?? ''));
    }
    return devices;
}
export async function m6(a8: string): Promise<Scene[]> {
    const b8: Scene[] | null = await Storage.t5<Scene[]>(i.a1);
    if (b8 === null) {
        return [];
    }
    return b8;
}
export async function n6(scene: Scene): Promise<boolean> {
    const x7 = await m6('');
    let y7 = false;
    for (let z7 = 0; z7 < x7.length; z7++) {
        if (x7[z7].sceneId === scene.sceneId) {
            x7[z7] = scene;
            y7 = true;
            break;
        }
    }
    if (!y7) {
        x7.push(scene);
    }
    await Storage.j5(i.a1, x7);
    return true;
}
export async function b7(sceneId: string): Promise<boolean> {
    const u7 = await m6('');
    const v7: Scene[] = [];
    for (let w7 = 0; w7 < u7.length; w7++) {
        if (u7[w7].sceneId !== sceneId) {
            v7.push(u7[w7]);
        }
    }
    await Storage.j5(i.a1, v7);
    return true;
}
export async function runScene(sceneId: string): Promise<number> {
    const q7 = await m6('');
    let target: Scene | null = null;
    for (let t7 = 0; t7 < q7.length; t7++) {
        if (q7[t7].sceneId === sceneId) {
            target = q7[t7];
            break;
        }
    }
    if (target === null) {
        throw new Error('场景不存在');
    }
    let r7 = 0;
    for (let s7 = 0; s7 < target.actions.length; s7++) {
        const a = target.actions[s7];
        const cmd: l3 = { did: a.did, method: a.method, params: a.params };
        try {
            await j4(cmd);
            r7++;
        }
        catch (e) {
            j.error(g1, `scene action failed: ${a.did}`);
        }
    }
    return r7;
}
function c7(o7: f1.l5, p7: string): Device {
    const dev: Device = {
        did: o7.did,
        model: o7.model,
        name: o7.name,
        type: f7(o7.model, o7.specType ?? ''),
        h3: p7,
        online: o7.isOnline,
        icon: 'icon_device',
        token: o7.token,
        ip: o7.localip,
        props: {}
    };
    return dev;
}
function d7(specType: string): string {
    const marker = 'device:';
    const l7 = specType.indexOf(marker);
    if (l7 < 0) {
        return '';
    }
    const m7 = specType.substring(l7 + marker.length);
    const n7 = m7.indexOf(':');
    return n7 < 0 ? m7.toLowerCase() : m7.substring(0, n7).toLowerCase();
}
function e7(model: string): string {
    const dot = model.indexOf('.');
    if (dot < 0) {
        return model.toLowerCase();
    }
    const j7 = model.substring(dot + 1);
    const k7 = j7.indexOf('.');
    return k7 < 0 ? j7.toLowerCase() : j7.substring(0, k7).toLowerCase();
}
function f7(model: string, specType: string): string {
    const h7 = d7(specType);
    const i7 = e7(model);
    const key = h7 !== '' ? h7 : i7;
    if (key === 'air-conditioner' || key.indexOf('air-condition') >= 0 || key.indexOf('aircondition') >= 0) {
        return 'air_conditioner';
    }
    if (key === 'water-purifier' || key.indexOf('water-purif') >= 0 || key.indexOf('waterpur') >= 0) {
        return 'water_purifier';
    }
    if (key === 'air-purifier' || key.indexOf('air-purif') >= 0 || key.indexOf('airpur') >= 0) {
        return 'air_purifier';
    }
    if (key === 'induction-cooker' || key.indexOf('cooker') >= 0 || key.indexOf('ihcooker') >= 0) {
        return 'cooker';
    }
    if (key === 'temperature-humidity-sensor' || key === 'humidity-sensor') {
        return 'sensor';
    }
    if (key === 'juicer' || key.indexOf('juicer') >= 0) {
        return 'juicer';
    }
    if (key === 'speaker' || key.indexOf('speaker') >= 0 || key.indexOf('wifispeaker') >= 0) {
        return 'speaker';
    }
    if (key.indexOf('plug') >= 0 || key.indexOf('switch') >= 0 || key.indexOf('outlet') >= 0
        || key.indexOf('acpartner') >= 0 || key.indexOf('socket') >= 0) {
        return 'switch';
    }
    if (key.indexOf('purifier') >= 0) {
        return 'air_purifier';
    }
    if (key.indexOf('humid') >= 0 || key.indexOf('dehumid') >= 0) {
        return 'humidifier';
    }
    if (key.indexOf('light') >= 0 || key.indexOf('bulb') >= 0 || key.indexOf('lamp') >= 0) {
        return 'light';
    }
    if (key.indexOf('sensor') >= 0) {
        return 'sensor';
    }
    if (key.indexOf('camera') >= 0 || key.indexOf('ipc') >= 0) {
        return 'camera';
    }
    if (key.indexOf('desk') >= 0 || key.indexOf('table') >= 0) {
        return 'desk';
    }
    if (key.indexOf('fan') >= 0) {
        return 'fan';
    }
    if (key.indexOf('heater') >= 0) {
        return 'heater';
    }
    if (key.indexOf('curtain') >= 0) {
        return 'curtain';
    }
    if (key.indexOf('lock') >= 0) {
        return 'lock';
    }
    if (key.indexOf('washer') >= 0 || key.indexOf('washing') >= 0) {
        return 'washer';
    }
    if (key.indexOf('fridge') >= 0) {
        return 'fridge';
    }
    if (key.indexOf('router') >= 0) {
        return 'router';
    }
    return 'device';
}
