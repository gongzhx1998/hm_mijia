import preferences from "@ohos:data.preferences";
import type common from "@ohos:app.ability.common";
import { j } from "@normalized:N&&&entry/src/main/ets/a/b&";
const g1 = 'Storage';
let p23: preferences.Preferences | null = null;
let q23: preferences.Preferences | null = null;
async function l23(): Promise<common.Context> {
    return getContext() as common.Context;
}
export async function n23(): Promise<preferences.Preferences> {
    if (q23 === null) {
        const ctx = await l23();
        q23 = preferences.getPreferencesSync(ctx, { name: 'mijia_app' });
    }
    return q23;
}
export async function o23(): Promise<preferences.Preferences> {
    if (p23 === null) {
        const ctx = await l23();
        p23 = preferences.getPreferencesSync(ctx, { name: 'mijia_user' });
    }
    return p23;
}
export async function k5(key: string, value: string): Promise<void> {
    const u23 = await o23();
    await u23.put(key, value);
    await u23.flush();
}
export async function getString(key: string, s23: string = ''): Promise<string> {
    const t23 = await o23();
    const v: preferences.ValueType = await t23.get(key, s23);
    return v as string;
}
export async function j5(key: string, value: object): Promise<void> {
    await k5(key, JSON.stringify(value));
}
export async function t5<T>(key: string): Promise<T | null> {
    const s = await getString(key, '');
    if (s === '') {
        return null;
    }
    try {
        return JSON.parse(s) as T;
    }
    catch (e) {
        j.error(g1, `parse object failed: ${key}`);
        return null;
    }
}
export async function clear(key: string): Promise<void> {
    const r23 = await o23();
    await r23.delete(key);
    await r23.flush();
}
