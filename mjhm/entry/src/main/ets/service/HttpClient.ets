import { http } from '@kit.NetworkKit';
import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { AppConfig, Logger } from '../common/AppConfig';

const TAG = 'HttpClient';

/**
 * 通用 HTTP 客户端（模块级 token，避免 ArkTS 禁止的 this）
 */
let token: string = '';

export async function initToken(): Promise<void> {
  const ctx = getContext() as common.Context;
  const pref = preferences.getPreferencesSync(ctx, { name: AppConfig.KEY_TOKEN });
  token = pref.getSync('access_token', '') as string;
}

export function setToken(t: string): void {
  token = t;
}

export async function get(url: string, params?: Record<string, string | number | boolean>): Promise<object> {
  let full = url;
  if (params !== undefined) {
    const keys: string[] = Object.keys(params);
    let qs = '';
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const v = String(params[k]);
      qs += (i === 0 ? '' : '&') + `${k}=${encodeURIComponent(v)}`;
    }
    full = url.includes('?') ? `${url}&${qs}` : `${url}?${qs}`;
  }
  return request(http.RequestMethod.GET, full, null);
}

export async function post(url: string, body?: Record<string, Object>): Promise<object> {
  let b: Record<string, Object> = {};
  if (body !== undefined) {
    b = body;
  }
  return request(http.RequestMethod.POST, url, b);
}

async function request(method: http.RequestMethod, url: string, body: object | null): Promise<object> {
  const httpReq = http.createHttp();
  const header: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': token !== '' ? `Bearer ${token}` : ''
  };
  const options: http.HttpRequestOptions = {
    method: method,
    header: header,
    connectTimeout: 15000,
    readTimeout: 30000
  };
  if (body !== null) {
    options.extraData = JSON.stringify(body);
  }
  try {
    const resp = await httpReq.request(url, options);
    if (resp.responseCode !== http.ResponseCode.OK) {
      throw new Error(`HTTP ${resp.responseCode}`);
    }
    const text = String(resp.result);
    return JSON.parse(text) as object;
  } catch (e) {
    Logger.error(TAG, `request failed: ${String(e)}`);
    throw new Error('http request failed');
  } finally {
    httpReq.destroy();
  }
}
