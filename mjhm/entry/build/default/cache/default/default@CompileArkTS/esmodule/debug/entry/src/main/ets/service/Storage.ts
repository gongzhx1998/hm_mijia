import preferences from "@ohos:data.preferences";
import type common from "@ohos:app.ability.common";
import { Logger } from "@normalized:N&&&entry/src/main/ets/common/AppConfig&";
const TAG = 'Storage';
/**
 * 本地存储封装（替代原 Android 的 MMKV / SharedPreferences）
 * 使用模块级变量缓存 Preferences 实例，避免 ArkTS 禁止的 this 访问
 */
let userPref: preferences.Preferences | null = null;
let appPref: preferences.Preferences | null = null;
async function getContextInstance(): Promise<common.Context> {
    return getContext() as common.Context;
}
export async function getAppPref(): Promise<preferences.Preferences> {
    if (appPref === null) {
        const ctx = await getContextInstance();
        appPref = preferences.getPreferencesSync(ctx, { name: 'mijia_app' });
    }
    return appPref;
}
export async function getUserPref(): Promise<preferences.Preferences> {
    if (userPref === null) {
        const ctx = await getContextInstance();
        userPref = preferences.getPreferencesSync(ctx, { name: 'mijia_user' });
    }
    return userPref;
}
export async function saveString(key: string, value: string): Promise<void> {
    const pref = await getUserPref();
    await pref.put(key, value);
    await pref.flush();
}
export async function getString(key: string, def: string = ''): Promise<string> {
    const pref = await getUserPref();
    const v: preferences.ValueType = await pref.get(key, def);
    return v as string;
}
export async function saveObject(key: string, value: object): Promise<void> {
    await saveString(key, JSON.stringify(value));
}
export async function getObject<T>(key: string): Promise<T | null> {
    const s = await getString(key, '');
    if (s === '') {
        return null;
    }
    try {
        return JSON.parse(s) as T;
    }
    catch (e) {
        Logger.error(TAG, `parse object failed: ${key}`);
        return null;
    }
}
export async function clear(key: string): Promise<void> {
    const pref = await getUserPref();
    await pref.delete(key);
    await pref.flush();
}
