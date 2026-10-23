import { http } from '@kit.NetworkKit';
import { rcp } from '@kit.RemoteCommunicationKit';
import * as MiCrypto from './MiCrypto';
import * as Storage from './Storage';
import { AppConfig, Logger } from '../common/AppConfig';

const TAG = 'MiCloud';
const KEY_DEVICE_ID = 'mijia_cloud_device_id';
const KEY_SESSION = 'mijia_cloud_session';

export interface CloudDevice {
  did: string;
  token: string;
  name: string;
  model: string;
  localip: string;
  isOnline: boolean;
  specType: string;   // miot spec 类型，形如 urn:miot-spec-v2:device:table:...，用于识别设备类型
}

export interface CloudRoom {
  id: string;
  name: string;
  dids: string[];
}

export interface CloudHome {
  id: string;
  name: string;
  rooms: CloudRoom[];
}

const ACCOUNT_BASE = 'https://account.xiaomi.com';
const UA = 'Android-7.1.1-1.0.0-ONEPLUS A3010-136-xxx APP/xiaomi.smarthome APPV/62830';

// 模块级登录态
let ssecurity: string = '';
let userId: string = '';
let cUserId: string = '';
let serviceToken: string = '';
let deviceId: string = '';
let notificationUrl: string = '';
// 会话 Cookie 罐：跨登录步骤和跨登录尝试保持（二次验证的信任状态绑定在 Cookie 上）
const cookieJar: Map<string, string> = new Map<string, string>();
// 二次验证重放所需的 step1 参数（_sign/qs/callback），验证通过后重放 serviceLoginAuth2
let pendingSign: string = '';
let pendingQs: string = '';
let pendingCallback: string = '';
let pendingUser: string = '';
let pendingHash: string = '';
// 登录 nonce（serviceLoginAuth2 响应返回的 nonce 字段，Long 数字），
// 用于生成 clientSign 签发 serviceToken：clientSign = base64(SHA1("nonce=<nonce>&<ssecurity>"))
let loginNonce: string = '';
// auth error 自动重放重试标志（防无限递归）
let authRetried: boolean = false;

export function getUserId(): string {
  return userId;
}

/** 导出当前会话 Cookie（供 WebView 加载验证页前同步会话） */
export function getSessionCookie(): string {
  return buildCookieHeader();
}

/** 把 WebView 里验证得到的 Cookie 合并进 http 模块的会话罐 */
export function mergeCookieFromWeb(cookieStr: string): void {
  if (cookieStr === '') {
    return;
  }
  const segs = cookieStr.split(';');
  for (let i = 0; i < segs.length; i++) {
    const pair = segs[i].trim();
    const eq = pair.indexOf('=');
    if (eq > 0) {
      const name = pair.substring(0, eq).trim();
      const value = pair.substring(eq + 1).trim();
      if (name !== '' && name !== 'Path' && name !== 'Domain' && name !== 'Expires' && name !== 'Max-Age') {
        cookieJar.set(name, value);
      }
    }
  }
}

/** 最近一次登录触发的二次验证链接（空表示无需验证） */
export function getNotificationUrl(): string {
  return notificationUrl;
}

export function isLogin(): boolean {
  return serviceToken !== '';
}

/** 持久化登录态（ssecurity/serviceToken/userId + 重放 auth2 所需参数），App 重启后恢复 */
async function persistSession(): Promise<void> {
  try {
    const session: Record<string, string> = {
      'ssecurity': ssecurity,
      'serviceToken': serviceToken,
      'userId': userId,
      'cUserId': cUserId,
      // 重放 serviceLoginAuth2 刷新 ssecurity 所需（跨重启保留，避免重启后无法自动修复无效 ssecurity）
      'pendingUser': pendingUser,
      'pendingHash': pendingHash,
      'pendingSign': pendingSign,
      'pendingQs': pendingQs,
      'pendingCallback': pendingCallback
    };
    await Storage.saveString(KEY_SESSION, JSON.stringify(session));
    Logger.error(TAG, `>>> persistSession ok, ssecurity_len=${ssecurity.length}`);
  } catch (e) {
    Logger.error(TAG, `persistSession failed: ${String(e)}`);
  }
}

/** 恢复登录态（App 启动时调用） */
export async function restoreSession(): Promise<boolean> {
  try {
    const raw = await Storage.getString(KEY_SESSION, '');
    if (raw === '') {
      return false;
    }
    const session = JSON.parse(raw) as Record<string, string>;
    // 恢复重放 auth2 所需参数（即使 ssecurity 无效，也能在 auth error 时自动刷新）
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
      await getOrCreateDeviceId();
      Logger.error(TAG, `>>> restoreSession ok, ssecurity_len=${ssecurity.length}, userId=${userId}, hasPending=${pendingUser !== ''}`);
      return true;
    }
  } catch (e) {
    Logger.error(TAG, `restoreSession failed: ${String(e)}`);
  }
  return false;
}

/** 清除登录态（退出登录） */
export async function clearSession(): Promise<void> {
  ssecurity = '';
  serviceToken = '';
  userId = '';
  cUserId = '';
  cookieJar.clear();
  try {
    await Storage.clear(KEY_SESSION);
  } catch (e) {
    Logger.error(TAG, `clearSession failed: ${String(e)}`);
  }
}

function randomDeviceId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let s = '';
  for (let i = 0; i < 16; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

/**
 * 获取（或首次生成并持久化）deviceId。
 * 关键：deviceId 必须跨登录尝试保持一致——小米的二次验证绑定在该 deviceId 上，
 * 若每次随机生成，用户在浏览器完成验证后重试仍会被要求重新验证。
 */
async function getOrCreateDeviceId(): Promise<string> {
  if (deviceId !== '') {
    return deviceId;
  }
  const saved = await Storage.getString(KEY_DEVICE_ID, '');
  if (saved !== '') {
    deviceId = saved;
  } else {
    deviceId = randomDeviceId();
    await Storage.saveString(KEY_DEVICE_ID, deviceId);
  }
  return deviceId;
}

/**
 * 真实小米账号登录（micloud 三步握手）：
 * step1 serviceLogin 拿 _sign → step2 serviceLoginAuth2 拿 ssecurity/location
 * → step3 GET location 从响应 Cookie 拿 serviceToken
 * 密码 hash = MD5(password) 十六进制大写
 */
export async function login(username: string, password: string): Promise<boolean> {
  try {
    notificationUrl = '';
    deviceId = await getOrCreateDeviceId();
    cookieJar.set('sdkVersion', '3.8.6');
    cookieJar.set('deviceId', deviceId);
    cookieJar.set('pass_ua', 'web');
    const cookie = buildCookieHeader();

    const step1 = await httpRaw(http.RequestMethod.GET,
      `${ACCOUNT_BASE}/pass/serviceLogin?sid=mijia&_json=true`, cookie, null, null);
    const step1Data = parseJsonBody(step1.text);

    const hash = (await MiCrypto.md5(MiCrypto.utf8Bytes(password))).toUpperCase();
    // 保存 step1 参数，供二次验证通过后重放 serviceLoginAuth2
    pendingSign = String(step1Data['_sign'] ?? '');
    pendingQs = String(step1Data['qs'] ?? '');
    pendingCallback = String(step1Data['callback'] ?? '');
    pendingUser = username;
    pendingHash = hash;

    const form: Record<string, string> = {
      'sid': String(step1Data['sid'] ?? 'mijia'),
      '_sign': pendingSign,
      'qs': pendingQs,
      'callback': pendingCallback,
      'user': username,
      'hash': hash,
      '_json': 'true'
    };
    const step2 = await httpRaw(http.RequestMethod.POST,
      `${ACCOUNT_BASE}/pass/serviceLoginAuth2?_json=true`, buildCookieHeader(), encodeForm(form), null);
    const step2Data = parseJsonBody(step2.text);
    const code = String(step2Data['code'] ?? '-1');
    const location = String(step2Data['location'] ?? '');
    const desc = String(step2Data['desc'] ?? '');
    // 保存登录 nonce（serviceLoginAuth2 响应的 nonce，用于签发 serviceToken 的 clientSign）
    // 必须从原始文本提取字符串，JSON.parse 会把 19 位 Long 转 double 丢精度
    const nonceStr1 = extractNonceString(step2.text);
    if (nonceStr1 !== '') {
      loginNonce = nonceStr1;
    } else if (step2Data['nonce'] !== undefined && step2Data['nonce'] !== null) {
      loginNonce = String(step2Data['nonce']);
    }
    // 二次验证时，小米仍可能返回 ssecurity/userId（用于后续签名）
    if (String(step2Data['ssecurity'] ?? '') !== '') {
      ssecurity = String(step2Data['ssecurity']);
    }
    if (String(step2Data['userId'] ?? '') !== '') {
      userId = String(step2Data['userId']);
    }
    if (code !== '0' || location === '') {
      const notifyUrl = step2Data['notificationUrl'];
      if (notifyUrl !== undefined) {
        notificationUrl = String(notifyUrl);
        Logger.info(TAG, `账号开启二次验证，等待在 App 内完成验证: ${notificationUrl}`);
      }
      Logger.error(TAG, `login needs verify, code=${code}, desc=${desc}, hasLocation=${location !== ''}`);
      return false;
    }
    ssecurity = String(step2Data['ssecurity'] ?? '');
    userId = String(step2Data['userId'] ?? '');

    // step3：直接 GET location（无 clientSign），serviceToken 通过重定向链 Set-Cookie 写入。
    // 参考 yaomaolei/mijia-api：session.get(location) → cookies['serviceToken']。
    const step3 = await fetchServiceToken(location);
    serviceToken = extractServiceToken(step3);
    if (serviceToken === '') {
      Logger.error(TAG, `获取 serviceToken 失败, location=${location}`);
      const ks = Array.from(cookieJar.keys());
      Logger.error(TAG, `cookieJar keys: ${ks.join(',')}`);
      Logger.error(TAG, `step3 body: ${step3.text.substring(0, 300)}`);
      return false;
    }
    // 关键：cUserId 是 sts 返回的独立字段（≠ userId），必须从 cookieJar 拿。
    // 之前用 cUserId=${userId} 是错的（userId 是纯数字账号 id，cUserId 是另一个会话 token），导致 401。
    const cu = cookieJar.get('cUserId');
    if (cu !== undefined && cu !== '') {
      cUserId = cu;
    }
    Logger.info(TAG, `login success, userId=${userId}, cUserId=${cUserId.substring(0, 8)}`);
    await persistSession();
    return true;
  } catch (e) {
    Logger.error(TAG, 'login error');
    return false;
  }
}

/**
 * 二次验证通过后补取 ssecurity（签名必需）。
 * ⚠️ 关键：真正的 ssecurity 只能来自 POST /pass/serviceLoginAuth2 的响应，
 * GET /pass/serviceLogin 返回的 ssecurity 字段是无效的（占位/空值），不能用于签名。
 * 因此这里优先「重放 serviceLoginAuth2」拿 ssecurity；只有重放不可用时才回退 GET。
 * 若 ssecurity 已存在则跳过。
 */
async function fetchSsecurityAfterVerify(): Promise<void> {
  if (ssecurity !== '') {
    return;
  }
  // 优先重放 serviceLoginAuth2（正确来源）
  const replayed = await replayAuth2ForSsecurity();
  if (replayed) {
    return;
  }
  // 回退：GET serviceLogin（值可能无效，仅作兜底）
  try {
    const resp = await httpRaw(http.RequestMethod.GET,
      `${ACCOUNT_BASE}/pass/serviceLogin?sid=mijia&_json=true`, buildCookieHeader(), null, null);
    const data = parseJsonBody(resp.text);
    Logger.error(TAG, `>>> fetchSsecurityAfterVerify serviceLogin body=${resp.text.substring(0, 400)}`);
    if (String(data['code'] ?? '-1') === '0') {
      if (String(data['ssecurity'] ?? '') !== '') {
        ssecurity = String(data['ssecurity']);
        Logger.error(TAG, `>>> fetchSsecurityAfterVerify(回退) 拿到 ssecurity len=${ssecurity.length} head=${ssecurity.substring(0, 24)}`);
      }
      if (String(data['userId'] ?? '') !== '') {
        userId = String(data['userId']);
      }
      if (String(data['passToken'] ?? '') !== '') {
        cookieJar.set('passToken', String(data['passToken']));
      }
    } else {
      Logger.error(TAG, `fetchSsecurityAfterVerify code=${String(data['code'] ?? '-1')}`);
    }
  } catch (e) {
    Logger.error(TAG, `fetchSsecurityAfterVerify error: ${String(e)}`);
  }
}

/**
 * 重放 serviceLoginAuth2 拿真正的 ssecurity（签名密钥唯一正确来源）。
 * 使用登录时保存的 pendingUser/pendingHash/pendingSign/pendingQs/pendingCallback。
 * 成功返回 true（已写入模块级 ssecurity/userId）。
 */
async function replayAuth2ForSsecurity(): Promise<boolean> {
  if (pendingUser === '' || pendingHash === '') {
    Logger.error(TAG, `>>> replayAuth2ForSsecurity 缺少 pendingUser/pendingHash，无法重放`);
    return false;
  }
  try {
    const form: Record<string, string> = {
      'sid': 'mijia',
      '_sign': pendingSign,
      'qs': pendingQs !== '' ? pendingQs : '%3Fsid%3Dmijia%26_json%3Dtrue',
      'callback': pendingCallback !== '' ? pendingCallback : 'https://sts.api.io.mi.com/sts',
      'user': pendingUser,
      'hash': pendingHash,
      '_json': 'true'
    };
    const step2 = await httpRaw(http.RequestMethod.POST,
      `${ACCOUNT_BASE}/pass/serviceLoginAuth2?_json=true`, buildCookieHeader(), encodeForm(form), null);
    const step2Data = parseJsonBody(step2.text);
    Logger.error(TAG, `>>> replayAuth2ForSsecurity body=${step2.text.substring(0, 500)}`);
    const code = String(step2Data['code'] ?? '-1');
    const location = String(step2Data['location'] ?? '');
    // 保存登录 nonce（用于 clientSign 签发 serviceToken）——从原始文本提取，避免 JSON.parse 精度丢失
    const nonceStr2 = extractNonceString(step2.text);
    if (nonceStr2 !== '') {
      loginNonce = nonceStr2;
    } else if (step2Data['nonce'] !== undefined && step2Data['nonce'] !== null) {
      loginNonce = String(step2Data['nonce']);
    }
    if (String(step2Data['ssecurity'] ?? '') !== '') {
      ssecurity = String(step2Data['ssecurity']);
      Logger.error(TAG, `>>> replayAuth2ForSsecurity 拿到正确 ssecurity len=${ssecurity.length} head=${ssecurity.substring(0, 24)}`);
    }
    if (String(step2Data['userId'] ?? '') !== '') {
      userId = String(step2Data['userId']);
    }
    // 若重放成功且有 location，顺带补 serviceToken（比 WebView 读的更可靠）
    if (code === '0' && location !== '' && serviceToken === '') {
      const step3 = await fetchServiceToken(location);
      const st = extractServiceToken(step3);
      if (st !== '') {
        serviceToken = st;
      }
    }
    return ssecurity !== '';
  } catch (e) {
    Logger.error(TAG, `replayAuth2ForSsecurity error: ${String(e)}`);
    return false;
  }
}

/**
 * 处理二次验证完成后的回调跳转。
 * 真实链路（对照 hass-xiaomi-miot / micloud）：
 * 验证通过后，会话 Cookie 已带信任状态。此时：
 * 1. 重新 GET /pass/serviceLogin（step1），code=0 且 body 带 ssecurity —— 这是 ssecurity 唯一来源
 * 2. 用该 ssecurity 重放 serviceLoginAuth2 拿 location
 * 3. GET location 拿 serviceToken
 */
export async function completeLoginAfterVerify(callbackUrl: string): Promise<boolean> {
  try {
    // 方式1：回调 URL 里可能直接带 location 参数（部分验证方式直接给登录回跳地址）
    let decoded = callbackUrl;
    try {
      decoded = decodeURIComponent(callbackUrl);
    } catch (e) {
      decoded = callbackUrl;
    }
    const locParam = extractQueryParam(decoded, 'location');
    if (locParam !== '') {
      const step3 = await fetchServiceToken(decodeURIComponent(locParam));
      serviceToken = extractServiceToken(step3);
      if (serviceToken !== '') {
        // 关键：ssecurity 是签名必需的，若尚未拿到则先补取，避免后续签名失败
        if (ssecurity === '') {
          await fetchSsecurityAfterVerify();
        }
        Logger.info(TAG, `completeLoginAfterVerify success via callback location, userId=${userId}, hasSsecurity=${ssecurity !== ''}`);
        await persistSession();
        return true;
      }
      Logger.error(TAG, `location returned but no serviceToken`);
    }

    // 方式1.5：identity/result/check 回调里带 callback 参数（编码后的 sts 签发地址），
    // result/check 页面的作用就是跳转到该 callback 完成 serviceToken 签发，直接 GET 它
    const cbParam = extractQueryParam(decoded, 'callback');
    if (cbParam !== '') {
      try {
        const cbUrl = decodeURIComponent(cbParam);
        if (cbUrl.indexOf('http') === 0) {
          Logger.info(TAG, `try GET result/check callback: ${cbUrl}`);
          const step3 = await httpGetFollowRedirect(cbUrl);
          serviceToken = extractServiceToken(step3);
          if (serviceToken !== '') {
            if (ssecurity === '') {
              await fetchSsecurityAfterVerify();
            }
            Logger.info(TAG, `completeLoginAfterVerify success via result/check callback, userId=${userId}, hasSsecurity=${ssecurity !== ''}`);
            await persistSession();
            return true;
          }
          Logger.error(TAG, `result/check callback no serviceToken`);
        }
      } catch (e) {
        Logger.error(TAG, 'result/check callback error');
      }
    }

    // 方式2：重新 GET serviceLogin（step1）。⚠️ 注意：GET serviceLogin 返回的 ssecurity 是无效值
    // （真正的 ssecurity 只能来自 serviceLoginAuth2 响应），所以这里只用于拿 location/passToken，
    // ssecurity 统一交给方式3（重放 serviceLoginAuth2）获取正确值。
    let gotSsecurity = false;
    try {
      const step1 = await httpRaw(http.RequestMethod.GET,
        `${ACCOUNT_BASE}/pass/serviceLogin?sid=mijia&_json=true`, buildCookieHeader(), null, null);
      const step1Data = parseJsonBody(step1.text);
      if (String(step1Data['code'] ?? '-1') === '0') {
        // 不从 GET serviceLogin 取 ssecurity（值无效），只取 userId/passToken（若返回）
        if (String(step1Data['userId'] ?? '') !== '') {
          userId = String(step1Data['userId']);
        }
        if (String(step1Data['passToken'] ?? '') !== '') {
          cookieJar.set('passToken', String(step1Data['passToken']));
        }
        // 若 step1 直接返回 location，先拿 serviceToken，但 ssecurity 仍需走方式3重放
        const loc1 = String(step1Data['location'] ?? '');
        if (loc1 !== '') {
          const step3 = await fetchServiceToken(loc1);
          serviceToken = extractServiceToken(step3);
          // 不在这里 return，继续走方式3重放 auth2 拿正确 ssecurity
        }
        Logger.info(TAG, `step1 after verify: code=0, userId=${userId}`);
      } else {
        Logger.error(TAG, `step1 after verify code=${String(step1Data['code'] ?? '-1')}`);
      }
    } catch (e) {
      Logger.error(TAG, 'step1 after verify error');
    }

    // 方式3：重放 serviceLoginAuth2（用固定 callback/qs，与 micloud 一致）
    if (pendingUser !== '' && pendingHash !== '') {
      const form: Record<string, string> = {
        'sid': 'mijia',
        '_sign': pendingSign,
        'qs': pendingQs !== '' ? pendingQs : '%3Fsid%3Dmijia%26_json%3Dtrue',
        'callback': pendingCallback !== '' ? pendingCallback : 'https://sts.api.io.mi.com/sts',
        'user': pendingUser,
        'hash': pendingHash,
        '_json': 'true'
      };
      const step2 = await httpRaw(http.RequestMethod.POST,
        `${ACCOUNT_BASE}/pass/serviceLoginAuth2?_json=true`, buildCookieHeader(), encodeForm(form), null);
      const step2Data = parseJsonBody(step2.text);
      Logger.error(TAG, `>>> replay serviceLoginAuth2 body=${step2.text.substring(0, 400)}`);
      const code = String(step2Data['code'] ?? '-1');
      const location = String(step2Data['location'] ?? '');
      const nonceStr3 = extractNonceString(step2.text);
      if (nonceStr3 !== '') {
        loginNonce = nonceStr3;
      } else if (step2Data['nonce'] !== undefined && step2Data['nonce'] !== null) {
        loginNonce = String(step2Data['nonce']);
      }
      if (String(step2Data['ssecurity'] ?? '') !== '') {
        ssecurity = String(step2Data['ssecurity']);
        gotSsecurity = true;
        Logger.error(TAG, `>>> replay 拿到 ssecurity len=${ssecurity.length} head=${ssecurity.substring(0, 24)}`);
      }
      if (String(step2Data['userId'] ?? '') !== '') {
        userId = String(step2Data['userId']);
      }
      if (code === '0' && location !== '') {
        const step3 = await fetchServiceToken(location);
        const st = extractServiceToken(step3);
        if (st !== '') {
          serviceToken = st;
        }
        if (serviceToken !== '') {
          Logger.info(TAG, `completeLoginAfterVerify success via replay, userId=${userId}`);
          await persistSession();
          return true;
        }
      }
      Logger.error(TAG, `replay serviceLoginAuth2 code=${code}, desc=${String(step2Data['desc'] ?? '')}`);
    }

    // 方式4：从当前会话 Cookie 罐里直接找 serviceToken / userId（兜底）
    const st = cookieJar.get('serviceToken');
    if (st !== undefined && st !== '' && gotSsecurity) {
      serviceToken = st;
      Logger.info(TAG, `completeLoginAfterVerify success via cookieJar`);
      await persistSession();
      return true;
    }
    Logger.error(TAG, `completeLoginAfterVerify failed, gotSsecurity=${gotSsecurity}, callbackUrl=${callbackUrl}`);
    return false;
  } catch (e) {
    Logger.error(TAG, 'completeLoginAfterVerify error');
    return false;
  }
}

/** 从 URL 里提取 query 参数 */
function extractQueryParam(url: string, name: string): string {
  const idx = url.indexOf('?');
  if (idx < 0) {
    return '';
  }
  const query = url.substring(idx + 1);
  const pairs = query.split('&');
  for (let i = 0; i < pairs.length; i++) {
    const eq = pairs[i].indexOf('=');
    if (eq > 0 && pairs[i].substring(0, eq) === name) {
      return pairs[i].substring(eq + 1);
    }
  }
  return '';
}

/**
 * 从 Cookie 字符串中按名提取值（供 Login 从 WebView Cookie 读 token）。
 * 兼容 "a=1; b=2" 和完整 Set-Cookie 串。
 */
export function extractCookieValue(cookieStr: string, name: string): string {
  if (cookieStr === '') {
    return '';
  }
  const segs = cookieStr.split(';');
  for (let i = 0; i < segs.length; i++) {
    const pair = segs[i].trim();
    const eq = pair.indexOf('=');
    if (eq > 0 && pair.substring(0, eq).trim() === name) {
      return pair.substring(eq + 1).trim();
    }
  }
  return '';
}

/**
 * 用二次验证完成后从 WebView 拿到的 serviceToken 完成登录。
 * userId 优先取 step2 已保存的值，否则从调用方传入的 Cookie 里读。
 */
export async function completeLoginWithToken(token: string, cookieStr: string = ''): Promise<boolean> {
  if (token === '') {
    return false;
  }
  serviceToken = token;
  if (userId === '') {
    userId = extractCookieValue(cookieStr, 'userId');
  }
  // 同步 cUserId（sts 独立字段，≠ userId）；优先从传入 Cookie 读，否则从 cookieJar 拿
  const cuFromCookie = extractCookieValue(cookieStr, 'cUserId');
  if (cuFromCookie !== '') {
    cUserId = cuFromCookie;
  } else {
    const cu = cookieJar.get('cUserId');
    if (cu !== undefined && cu !== '') {
      cUserId = cu;
    }
  }
  // 关键：WebView 路径只拿得到 serviceToken，ssecurity 仍是空的。
  // ssecurity 是 RC4 签名的密钥来源，缺了它 signedPost 会因 base64 解码空串而抛错。
  // 这里补取 ssecurity —— fetchSsecurityAfterVerify 现在会优先重放 serviceLoginAuth2
  // 拿正确 ssecurity（GET serviceLogin 返回的 ssecurity 是无效值，仅兜底）。
  if (ssecurity === '') {
    await fetchSsecurityAfterVerify();
  }
  if (ssecurity === '') {
    Logger.error(TAG, `completeLoginWithToken: 仍未拿到 ssecurity，后续云签名请求会失败`);
  }
  Logger.info(TAG, `completeLoginWithToken ok, userId=${userId}, hasSsecurity=${ssecurity !== ''}`);
  await persistSession();
  return true;
}

/**
 * 拉取米家云设备列表（含局域网控制所需的 token/localip）。
 * 逆向 aa.apk（DeviceApi.updateDeviceList）确认真实接口为 /v2/home/device_list_page：
 * 请求 data={"start_did":...}（空对象首次拉全量），响应顶层 list + has_more/next_start_did 分页。
 */
export async function getDevices(country: string = 'cn'): Promise<CloudDevice[]> {
  const devices: CloudDevice[] = [];
  let startDid = '';
  // 分页拉取：has_more=true 时用 next_start_did 继续翻页
  for (let page = 0; page < 20; page++) {
    const reqJson = startDid === '' ? '{}' : `{"start_did":"${startDid}"}`;
    const respData = await signedPost('/v2/home/device_list_page', reqJson, country);
    const gcode = Number(respData['code'] ?? -1);
    Logger.info(TAG, `getDevices device_list_page code=${gcode}`);
    if (gcode !== 0) {
      Logger.error(TAG, `device_list_page resp body: ${JSON.stringify(respData).substring(0, 500)}`);
      throw new Error(`米家云设备列表返回错误码: ${gcode}`);
    }
    // 逆向确认响应顶层即 list（DeviceApi.onSuccess 直接 optJSONArray("list")）；
    // 兜底兼容部分环境 result.list 包裹
    let rawList = respData['list'];
    if (!(rawList instanceof Array)) {
      const result = respData['result'];
      if (result !== undefined) {
        rawList = (result as Record<string, Object>)['list'];
      }
    }
    const list: Object[] = (rawList instanceof Array) ? rawList as Object[] : [];
    for (let i = 0; i < list.length; i++) {
      const d = list[i] as Record<string, Object>;
      const dev: CloudDevice = {
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
    // 无更多则结束；否则用 next_start_did 翻页
    const hasMore = Boolean(respData['has_more'] ?? false);
    if (!hasMore) {
      break;
    }
    const next = String(respData['next_start_did'] ?? '');
    if (next === '' || next === startDid) {
      break;
    }
    startDid = next;
  }
  Logger.info(TAG, `getDevices total=${devices.length}`);
  return devices;
}

/**
 * 云上远程控制设备（rpc，旧协议）。
 * 逆向 aa.apk（DeviceApi.rpcAsyncRemote）确认：POST /home/rpc/{did}，data={"method":..,"params":..}。
 * 注：旧 rpc 对现代 miot-spec 设备会返回 "undefined command"/"user ack timeout"，控制请优先用 miotSetProp。
 */
export async function rpcRemote(did: string, method: string,
  params: (string | number | boolean)[]): Promise<Record<string, Object>> {
  const payload: Record<string, Object> = { 'method': method, 'params': params };
  const respData = await signedPost(`/home/rpc/${did}`, JSON.stringify(payload), 'cn');
  Logger.info(TAG, `rpcRemote ${did} ${method} code=${Number(respData['code'] ?? -1)}`);
  return respData;
}

/** 透传米家云 API（插件 callSmartHomeAPI 用），data 为插件给的 JSON 字符串 */
export async function callCloudApi(path: string, data: string): Promise<Record<string, Object>> {
  const p: string = path.startsWith('/') ? path : '/' + path;
  return await signedPost(p, data.length > 0 ? data : '{}', 'cn');
}

/** fetch_plugin 返回的插件包信息 */
export interface PluginPackageInfo {
  model: string;
  pluginId: number;
  packageId: number;
  version: number;
  sdkVersion: number;
  downloadUrl: string;
  md5: string;
  size: number;
}

/**
 * 按型号查询米家 RN 插件包（与米家 App 相同的 /v2/plugin/fetch_plugin）。
 * 没有 RN 插件（download_url 为空）时返回 null。
 */
export async function fetchPluginInfo(model: string): Promise<PluginPackageInfo | null> {
  const m: Map<string, PluginPackageInfo | null> = await fetchPluginInfos([model]);
  return m.get(model) ?? null;
}

/**
 * 批量查询插件包（一次 /v2/plugin/fetch_plugin）。结果里每个请求的型号都有键：
 * 没有 download_url（无 RN 插件）或云端没返回的型号值为 null。
 */
export async function fetchPluginInfos(models: string[]): Promise<Map<string, PluginPackageInfo | null>> {
  const out: Map<string, PluginPackageInfo | null> = new Map<string, PluginPackageInfo | null>();
  const plugins: Object[] = [];
  for (let i = 0; i < models.length; i++) {
    out.set(models[i], null);
    const item: Record<string, Object> = { 'model': models[i], 'package_id': 0, 'type': '' };
    plugins.push(item);
  }
  if (plugins.length === 0) {
    return out;
  }
  const latest: Record<string, Object> = {
    'api_version': 10117, 'app_platform': 'android', 'region': 'cn', 'plugins': plugins, 'package_type': ''
  };
  const backup: Record<string, Object> = { 'plugins': plugins, 'api_level': 111, 'app_platform': 'phone' };
  const body: Record<string, Object> = { 'is_car_mihome': false, 'latest_req': latest, 'backup_req': backup };
  const resp = await signedPost('/v2/plugin/fetch_plugin', JSON.stringify(body), 'cn');
  const code: number = Number(resp['code'] ?? -1);
  if (code !== 0) {
    throw new Error(`fetch_plugin code=${code} ${String(resp['message'] ?? '')}`);
  }
  const result = resp['result'] as Record<string, Object> | undefined;
  const list = result !== undefined ? result['latest_info'] : undefined;
  if (list === undefined || !(list instanceof Array)) {
    return out;
  }
  const arr: Object[] = list as Object[];
  for (let i = 0; i < arr.length; i++) {
    const x = arr[i] as Record<string, Object>;
    const model: string = String(x['model'] ?? '');
    const url: string = String(x['download_url'] ?? '');
    if (!out.has(model) || url.length === 0) {
      continue;
    }
    const info: PluginPackageInfo = {
      model: model,
      pluginId: Number(x['plugin_id'] ?? 0),
      packageId: Number(x['plugin_package_id'] ?? 0),
      version: Number(x['version'] ?? 0),
      sdkVersion: Number(x['sdk_version'] ?? 0),
      downloadUrl: url,
      md5: String(x['md5sum'] ?? '').toLowerCase(),
      size: Number(x['size'] ?? 0)
    };
    out.set(model, info);
  }
  return out;
}

/**
 * miot-spec 读属性（云）：POST /miotspec/prop/get，data={"params":[{"did","siid","piid"}]}。
 * 逆向 11.8.705 SpecPropertyApi 确认。返回 result[].value 为属性值，result[].code<0 表示失败。
 */
export async function miotGetProp(did: string, siid: number, piid: number): Promise<Record<string, Object>> {
  const prop: Record<string, Object> = { 'did': did, 'siid': siid, 'piid': piid };
  const params: Object[] = [];
  params.push(prop);
  const payload: Record<string, Object> = { 'params': params };
  const respData = await signedPost('/miotspec/prop/get', JSON.stringify(payload), 'cn');
  Logger.info(TAG, `miotGetProp ${did} ${siid}.${piid} code=${Number(respData['code'] ?? -1)}`);
  return respData;
}

/**
 * miot-spec 写属性（云）：POST /miotspec/prop/set，data={"params":[{"did","siid","piid","value"}]}。
 * 电源属性通用 siid=2、piid=1，value 为 boolean。result[].code<0 表示失败（0/1 表示成功或无变化）。
 */
export async function miotSetProp(did: string, siid: number, piid: number,
  value: boolean | number | string): Promise<Record<string, Object>> {
  const prop: Record<string, Object> = { 'did': did, 'siid': siid, 'piid': piid, 'value': value };
  const params: Object[] = [];
  params.push(prop);
  const payload: Record<string, Object> = { 'params': params };
  const respData = await signedPost('/miotspec/prop/set', JSON.stringify(payload), 'cn');
  Logger.info(TAG, `miotSetProp ${did} ${siid}.${piid}=${value} code=${Number(respData['code'] ?? -1)}`);
  return respData;
}

/**
 * 批量读电源状态（云）：一次 /miotspec/prop/get 请求读多台设备的电源（siid=2, piid=1）。
 * 返回 did → boolean 映射（value 非 boolean 或读取失败时不写入）。
 */
export async function miotGetPowerStates(dids: string[]): Promise<Record<string, boolean>> {
  const params: Object[] = [];
  for (let i = 0; i < dids.length; i++) {
    const prop: Record<string, Object> = { 'did': dids[i], 'siid': 2, 'piid': 1 };
    params.push(prop);
  }
  const payload: Record<string, Object> = { 'params': params };
  const respData = await signedPost('/miotspec/prop/get', JSON.stringify(payload), 'cn');
  const result: Record<string, boolean> = {};
  const rawResult = respData['result'];
  if (rawResult instanceof Array) {
    const arr = rawResult as Object[];
    for (let i = 0; i < arr.length; i++) {
      const r = arr[i] as Record<string, Object>;
      const did = String(r['did'] ?? '');
      const val = r['value'];
      if (did === '') {
        continue;
      }
      if (val === true) {
        result[did] = true;
      } else if (val === false) {
        result[did] = false;
      }
    }
  }
  return result;
}

/** miot-spec 属性定义（从 spec 定义解析出的单个属性，含只读与可写） */
export interface SpecProperty {
  siid: number;
  piid: number;
  name: string;        // 属性名（从 type urn 提取）：on / brightness / temperature / relative-humidity ...
  description: string; // 英文描述（兜底用）
  format: string;      // bool / uint8 / uint16 / int / float / string ...
  readable: boolean;
  writable: boolean;
  unit: string;        // percentage / celsius / minutes ...
  min: number;
  max: number;
  step: number;
  hasRange: boolean;   // 是否有 value-range（决定能否渲染成滑块）
}

/** 设备 spec 定义（services 拍平成属性列表，含只读与可写） */
export interface DeviceSpec {
  did: string;
  deviceType: string;   // light / air-purifier / table / washer / temperature-humidity-sensor ...
  props: SpecProperty[];
}

/**
 * 批量拉取设备 miot-spec 定义（云）。
 * 逆向 11.8.705 SpecCacheSource.get_instances_by_dids 确认：
 *   POST /appgateway/gspec/Gspec/get_instances_by_dids
 *   data={"dids":[...],"urns":["",...],"isGetFullInstance":true}
 * 响应 instances[did].instance 是 spec JSON 字符串，含 services[i].iid(siid) +
 * properties[j]{iid(piid),type(urn),description,format,access,unit,value-range}。
 * 保留所有可读属性（access 含 read），跳过 device-information 服务的元数据（制造商/型号等）。
 */
export async function getDeviceSpecs(dids: string[]): Promise<Record<string, DeviceSpec>> {
  const result: Record<string, DeviceSpec> = {};
  if (dids.length === 0) {
    return result;
  }
  const urns: string[] = [];
  for (let i = 0; i < dids.length; i++) {
    urns.push('');
  }
  const payload: Record<string, Object> = {
    'dids': dids,
    'urns': urns,
    'isGetFullInstance': true
  };
  const respData = await signedPost('/appgateway/gspec/Gspec/get_instances_by_dids', JSON.stringify(payload), 'cn');
  const code = Number(respData['code'] ?? -1);
  if (code !== 0) {
    Logger.error(TAG, `getDeviceSpecs failed code=${code}`);
    return result;
  }
  const instances = respData['instances'];
  if (instances === undefined || instances === null) {
    return result;
  }
  const instMap = instances as Record<string, Object>;
  const keys = Object.keys(instMap);
  for (let i = 0; i < keys.length; i++) {
    const did = keys[i];
    const instVal = instMap[did] as Record<string, Object>;
    const instanceStr = String(instVal['instance'] ?? '');
    if (instanceStr === '') {
      continue;
    }
    const spec = parseJsonBody(instanceStr);
    const typeUrn = String(spec['type'] ?? '');
    const deviceType = urnDeviceType(typeUrn);
    const props: SpecProperty[] = [];
    const services = spec['services'];
    if (services instanceof Array) {
      const svcArr = services as Object[];
      for (let s = 0; s < svcArr.length; s++) {
        const svc = svcArr[s] as Record<string, Object>;
        const siid = Number(svc['iid'] ?? 0);
        const svcType = String(svc['type'] ?? '');
        // 跳过 device-information 服务（制造商/型号/序列号等元数据，对控制/显示无意义）
        if (svcType.indexOf('device-information') >= 0) {
          continue;
        }
        const propArr = svc['properties'];
        if (propArr instanceof Array) {
          const arr = propArr as Object[];
          for (let p = 0; p < arr.length; p++) {
            const prop = arr[p] as Record<string, Object>;
            // 判断可读/可写
            let readable = false;
            let writable = false;
            const access = prop['access'];
            if (access instanceof Array) {
              const acc = access as Object[];
              for (let a = 0; a < acc.length; a++) {
                const av = String(acc[a]);
                if (av === 'read') {
                  readable = true;
                } else if (av === 'write') {
                  writable = true;
                }
              }
            }
            if (!readable && !writable) {
              continue;
            }
            const piid = Number(prop['iid'] ?? 0);
            const propType = String(prop['type'] ?? '');
            const name = urnPropName(propType);
            const format = String(prop['format'] ?? '');
            const description = String(prop['description'] ?? '');
            const unit = String(prop['unit'] ?? '');
            let min = 0;
            let max = 0;
            let step = 1;
            let hasRange = false;
            const vr = prop['value-range'];
            if (vr instanceof Array) {
              const vrArr = vr as Object[];
              if (vrArr.length >= 2) {
                min = Number(vrArr[0]);
                max = Number(vrArr[1]);
                step = vrArr.length >= 3 ? Number(vrArr[2]) : 1;
                hasRange = true;
              }
            }
            const sp: SpecProperty = {
              siid: siid,
              piid: piid,
              name: name,
              description: description,
              format: format,
              readable: readable,
              writable: writable,
              unit: unit,
              min: min,
              max: max,
              step: step,
              hasRange: hasRange
            };
            props.push(sp);
          }
        }
      }
    }
    const ds: DeviceSpec = {
      did: did,
      deviceType: deviceType,
      props: props
    };
    result[did] = ds;
  }
  return result;
}

/** 从 spec type urn 提取设备类别：urn:miot-spec-v2:device:light:... → light */
function urnDeviceType(urn: string): string {
  const marker = 'device:';
  const idx = urn.indexOf(marker);
  if (idx < 0) {
    return '';
  }
  const rest = urn.substring(idx + marker.length);
  const colon = rest.indexOf(':');
  return colon < 0 ? rest : rest.substring(0, colon);
}

/** 从 property type urn 提取属性名：urn:miot-spec-v2:property:temperature:... → temperature */
function urnPropName(urn: string): string {
  const marker = 'property:';
  const idx = urn.indexOf(marker);
  if (idx < 0) {
    return '';
  }
  const rest = urn.substring(idx + marker.length);
  const colon = rest.indexOf(':');
  return colon < 0 ? rest : rest.substring(0, colon);
}

/**
 * 批量读单台设备的属性值（云）：一次 /miotspec/prop/get 读多个 siid/piid。
 * 返回 key=`${siid}.${piid}` → 值 的映射。
 */
export async function miotGetPropValues(did: string, siids: number[],
  piids: number[]): Promise<Record<string, string | number | boolean>> {
  const params: Object[] = [];
  for (let i = 0; i < siids.length; i++) {
    const prop: Record<string, Object> = { 'did': did, 'siid': siids[i], 'piid': piids[i] };
    params.push(prop);
  }
  const payload: Record<string, Object> = { 'params': params };
  const respData = await signedPost('/miotspec/prop/get', JSON.stringify(payload), 'cn');
  const result: Record<string, string | number | boolean> = {};
  const rawResult = respData['result'];
  if (rawResult instanceof Array) {
    const arr = rawResult as Object[];
    for (let i = 0; i < arr.length; i++) {
      const r = arr[i] as Record<string, Object>;
      const siid = Number(r['siid'] ?? 0);
      const piid = Number(r['piid'] ?? 0);
      const val = r['value'];
      const key = `${siid}.${piid}`;
      if (val === true) {
        result[key] = true;
      } else if (val === false) {
        result[key] = false;
      } else if (val !== undefined && val !== null) {
        // 区分 number / string：JSON.parse 后数值会转成 number（如温度 24.6、湿度 61）
        const s = String(val);
        const num = Number(s);
        if (!Number.isNaN(num) && s !== '' && String(num) === s) {
          result[key] = num;
        } else {
          result[key] = s;
        }
      }
    }
  }
  return result;
}

/** 拉取真实家庭+房间结构（/v2/homeroom/gethome_merged，与 hass-xiaomi-miot 一致） */
export async function getHomeList(country: string = 'cn'): Promise<CloudHome[]> {
  const respData = await signedPost('/v2/homeroom/gethome_merged',
    '{"fg":true,"fetch_share":true,"fetch_share_dev":true,"fetch_cariot":true,"limit":300,"app_ver":7,"plat_form":0}', country);
  const gcode = Number(respData['code'] ?? -1);
  Logger.info(TAG, `getHomeList gethome_merged code=${gcode}`);
  if (gcode !== 0) {
    Logger.error(TAG, `gethome_merged failed, body=${JSON.stringify(respData).substring(0, 500)}`);
    return [];
  }
  const result = respData['result'] as Record<string, Object>;
  const rawHomes = result['homelist'];
  const list: Object[] = (rawHomes instanceof Array) ? rawHomes as Object[] : [];
  const homes: CloudHome[] = [];
  for (let i = 0; i < list.length; i++) {
    const h = list[i] as Record<string, Object>;
    const rooms: CloudRoom[] = [];
    const rawRooms = h['roomlist'];
    const rl: Object[] = (rawRooms instanceof Array) ? rawRooms as Object[] : [];
    for (let j = 0; j < rl.length; j++) {
      const r = rl[j] as Record<string, Object>;
      const dids: string[] = [];
      const rawDids = r['dids'];
      const dl: Object[] = (rawDids instanceof Array) ? rawDids as Object[] : [];
      for (let k = 0; k < dl.length; k++) {
        dids.push(String(dl[k]));
      }
      const room: CloudRoom = {
        id: String(r['id'] ?? ''),
        name: String(r['name'] ?? '未命名房间'),
        dids: dids
      };
      rooms.push(room);
    }
    const home: CloudHome = {
      id: String(h['id'] ?? ''),
      name: String(h['name'] ?? '我的家'),
      rooms: rooms
    };
    homes.push(home);
  }
  Logger.info(TAG, `getHomeList returned ${homes.length} homes`);
  return homes;
}

/**
 * 米家云签名请求（AES-256-GCM 加密协议，ENCRYPT-AES，11.8.x 起）：
 * 逆向 11.8.705 vd.java(OooOO0/OooO0oo) + vr2.java + x4d.java + zba.java 确认：
 * 1. nonce = base64(8随机 + 4分钟时间戳)（同 RC4）
 * 2. signed_nonce = base64(sha256(base64decode(ssecurity) + base64decode(nonce)))（同 RC4）
 * 3. aes_key = base64decode(signed_nonce)（32字节）；aes_iv = 12字节随机
 * 4. 每个参数独立 AES-256-GCM 加密（同一个 key+iv）
 * 5. aes_hash__ = base64(iv)（就是 GCM 的 12 字节 IV，不是 hash！）
 * 6. signature = base64(sha1("POST&path&aes_hash__=xxx&data=xxx&signed_nonce"))，参数按字典序
 * 7. 请求体无 ssecurity；响应用同一个 key+iv AES-GCM 解密，MIOT-CONTENT-ENCODING=GZIP 时再解压
 */
async function signedPost(urlPath: string, data: string, country: string): Promise<Record<string, Object>> {
  if (serviceToken === '') {
    throw new Error('未登录米家云');
  }
  if (ssecurity === '') {
    // ssecurity 是 AES 签名的密钥来源，为空说明登录态不完整，签名必然失败。
    throw new Error('ssecurity 为空，登录态不完整，请重新登录（二次验证后未拿到 ssecurity）');
  }
  // 域名：逆向确认 CN 用 api.mijia.tech，海外用 {region}.api.io.mi.com
  const base = country === 'cn' ? AppConfig.IOT_API_BASE : `https://${country}.api.io.mi.com/app`;
  const url = base + urlPath;
  // 关键日志一律用 error 级别（鸿蒙 console.info 默认不落盘），确保请求地址/参数全程可见
  Logger.error(TAG, `>>> signedPost 请求 url=${url}`);
  Logger.error(TAG, `>>> signedPost 明文 data=${data}`);
  Logger.error(TAG, `>>> ssecurity_len=${ssecurity.length} ssecurity=${ssecurity} userId=${userId} serviceToken=${serviceToken}`);
  const nonce = genNonce();
  Logger.error(TAG, `>>> nonce=${nonce}`);
  const signedNonce = await genSignedNonce(ssecurity, nonce);

  // 签名路径：逆向确认用 Uri.parse(path).getEncodedPath()，即原始 path（不含 /app 前缀）
  const path = urlPath;

  // AES 密钥 = base64decode(signed_nonce) = 32 字节；IV = 12 字节随机
  const aesKey = MiCrypto.base64Decode(cleanBase64(signedNonce));
  const aesIv = MiCrypto.randomBytes(12);
  const ivB64 = MiCrypto.base64Encode(aesIv);

  // 加密 data（AES-256-GCM，输出 ciphertext‖tag）
  const encData = MiCrypto.base64Encode(await MiCrypto.aesGcmEncrypt(MiCrypto.utf8Bytes(data), aesKey, aesIv));

  // 构造加密后的参数（用于 signature），aes_hash__ = base64(iv)
  const encParams: Record<string, string> = {};
  encParams['data'] = encData;
  encParams['aes_hash__'] = ivB64;
  const signature = await genEncSignature('POST', path, signedNonce, encParams);

  // 最终请求体：无 ssecurity 字段
  const form: Record<string, string> = {};
  form['data'] = encData;
  form['aes_hash__'] = ivB64;
  form['signature'] = signature;
  form['_nonce'] = nonce;

  // Cookie 头：逆向 aa.apk + 对照 SDK 确认真实结构
  // Cookie：cUserId 必须用 sts 返回的 cUserId（≠ userId），否则 401 auth error。
  const cuserIdVal = cUserId !== '' ? cUserId : userId;
  const cookie = `cUserId=${cuserIdVal}; yetAnotherServiceToken=${serviceToken}; serviceToken=${serviceToken}; timezone_id=Asia/Shanghai; timezone=GMT+08:00; is_daylight=0; dst_offset=0; channel=MI_APP_STORE; countryCode=CN; PassportDeviceId=${deviceId}; locale=zh_CN`;
  Logger.error(TAG, `>>> Cookie=${cookie.substring(0, 160)}`);
  // 请求头：AES 协议用 ENCRYPT-AES。
  // 注意：不发送 miot-accept-encoding: GZIP，让服务器返回不压缩响应，避免处理 GZIP 解压
  //（鸿蒙 zlib 内存解压接口繁琐且仅 zlib 格式，米家是 gzip 格式，直接去头最稳）。
  const header: Record<string, string> = {
    'x-xiaomi-protocal-flag-cli': 'PROTOCAL-HTTP2',
    'miot-encrypt-algorithm': 'ENCRYPT-AES',
    'accept-encoding': 'identity'
  };
  try {
    const resp = await httpRaw(http.RequestMethod.POST, url, cookie, encodeForm(form), header);
    Logger.error(TAG, `>>> signedPost ${urlPath} 响应码=${resp.status} 响应体原文(前300)="${resp.text.substring(0, 300)}"`);
    // 响应是 AES-GCM 加密的，用同一个 key+iv 解密
    const decrypted = await aesGcmDecryptResponse(resp.text, aesKey, aesIv);
    const parsed = parseJsonBody(decrypted);
    const pcode = Number(parsed['code'] ?? -1);
    Logger.error(TAG, `>>> signedPost ${urlPath} 解密后 code=${pcode}`);
    // 解密后完整打印（分块，避免单行过长被截断）
    const fullBody = JSON.stringify(parsed);
    const chunk = 900;
    if (fullBody.length <= chunk) {
      Logger.error(TAG, `>>> signedPost ${urlPath} body=${fullBody}`);
    } else {
      const total = Math.ceil(fullBody.length / chunk);
      for (let ci = 0; ci < total; ci++) {
        Logger.error(TAG, `>>> signedPost ${urlPath} body[${ci + 1}/${total}] ${fullBody.substring(ci * chunk, (ci + 1) * chunk)}`);
      }
    }
    // auth error（code=2）：大概率是 ssecurity 无效。若同进程内保留登录参数，重放 auth2 刷新后重试一次。
    if (pcode === 2 && !authRetried) {
      authRetried = true;
      Logger.error(TAG, `>>> signedPost 检测到 auth error，尝试重放 auth2 刷新 ssecurity`);
      const refreshed = await replayAuth2ForSsecurity();
      if (refreshed) {
        await persistSession();
        Logger.error(TAG, `>>> signedPost 刷新 ssecurity 成功，重试请求`);
        return await signedPost(urlPath, data, country);
      }
      Logger.error(TAG, `>>> signedPost 无法刷新 ssecurity（缺少登录参数），需要重新登录`);
    }
    return parsed;
  } catch (e) {
    Logger.error(TAG, `>>> signedPost ${urlPath} http error: ${String(e)}`);
    Logger.error(TAG, `>>> signedPost ${urlPath} url=${url}`);
    throw new Error(`signedPost ${urlPath} http error`);
  }
}

/**
 * AES-GCM 响应解密：base64decode → AES-256-GCM 解密（同 key+iv）。
 * 非 base64（服务器返回明文错误/HTML）时直接返回原文。
 * 注：请求头已不发送 miot-accept-encoding: GZIP，故服务器返回不压缩响应，无需 GZIP 解压。
 */
async function aesGcmDecryptResponse(body: string, key: Uint8Array, iv: Uint8Array): Promise<string> {
  const cleaned = body.trim();
  if (!isValidBase64(cleaned)) {
    Logger.error(TAG, `aesGcmDecryptResponse: 响应体非 base64 密文，直接返回原文: ${cleaned.substring(0, 200)}`);
    return cleaned;
  }
  const plain = await MiCrypto.aesGcmDecrypt(MiCrypto.base64Decode(cleaned), key, iv);
  return MiCrypto.utf8String(plain);
}

/**
 * signature = base64(sha1("POST&" + path + "&k=v..." + "&signed_nonce"))
 * 参数按字典序排序（Java TreeMap 行为，AES 协议 vd.java/vr2.java 确认）。
 * RC4 用插入顺序，AES 用字典序——这里统一改成字典序（两者参数名 data/xxx_hash__ 排序后顺序一致）。
 */
async function genEncSignature(method: string, path: string, signedNonce: string,
  params: Record<string, string>): Promise<string> {
  const parts: string[] = [];
  parts.push(method.toUpperCase());
  parts.push(path);
  const keys = Object.keys(params).sort();
  for (let i = 0; i < keys.length; i++) {
    parts.push(`${keys[i]}=${params[keys[i]]}`);
  }
  parts.push(signedNonce);
  const signStr = parts.join('&');
  const digest = await MiCrypto.sha1Bytes(MiCrypto.utf8Bytes(signStr));
  return MiCrypto.base64Encode(digest);
}

/** rc4 加密字符串：base64(rc4(key=base64decode(signedNonce), 丢弃1024字节)加密(utf8(s))) */
function rc4EncryptStr(signedNonce: string, s: string): string {
  const key = MiCrypto.base64Decode(cleanBase64(signedNonce));
  const encrypted = MiCrypto.rc4Crypt(key, MiCrypto.utf8Bytes(s), 1024);
  return MiCrypto.base64Encode(encrypted);
}

/** rc4 解密字符串：utf8(rc4(key=base64decode(signedNonce), 丢弃1024字节)解密(base64decode(s))) */
function rc4DecryptStr(signedNonce: string, s: string): string {
  const key = MiCrypto.base64Decode(cleanBase64(signedNonce));
  const cleaned = s.trim();
  // 防御：若响应体不是合法 base64（服务器返回明文错误/HTML），直接返回原文，
  // 避免 base64Decode 抛 "unsupported characters" 而吞掉真实错误信息
  if (!isValidBase64(cleaned)) {
    Logger.error(TAG, `rc4DecryptStr: 响应体非 base64 密文，直接返回原文: ${cleaned.substring(0, 200)}`);
    return cleaned;
  }
  const decrypted = MiCrypto.rc4Crypt(key, MiCrypto.base64Decode(cleaned), 1024);
  return MiCrypto.utf8String(decrypted);
}

/** 校验字符串是否可解析为 base64（避免 decodeSync 抛 unsupported characters） */
function isValidBase64(s: string): boolean {
  if (s === '') {
    return false;
  }
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    const ok = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '+' || c === '/' || c === '=';
    if (!ok) {
      return false;
    }
  }
  return true;
}

/** nonce = base64(8 字节随机 + 4 字节分钟时间戳) */
function genNonce(): string {
  const bytes = new Uint8Array(12);
  bytes.set(MiCrypto.randomBytes(8), 0);
  const ts = Math.floor(Date.now() / 60000);
  bytes[8] = (ts >>> 24) & 0xff;
  bytes[9] = (ts >>> 16) & 0xff;
  bytes[10] = (ts >>> 8) & 0xff;
  bytes[11] = ts & 0xff;
  return MiCrypto.base64Encode(bytes);
}

/** signed_nonce = base64(sha256(base64decode(ssecurity) + base64decode(nonce))) */
async function genSignedNonce(sec: string, nonce: string): Promise<string> {
  const a = MiCrypto.base64Decode(cleanBase64(sec));
  const b = MiCrypto.base64Decode(cleanBase64(nonce));
  const combined = new Uint8Array(a.length + b.length);
  combined.set(a, 0);
  combined.set(b, a.length);
  const digest = await MiCrypto.sha256Bytes(combined);
  return MiCrypto.base64Encode(digest);
}

/** 清洗 base64：去掉空白/换行等非 base64 字符，避免 decodeSync 抛 unsupported characters */
function cleanBase64(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charAt(i);
    const isB64 = (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c === '+' || c === '/' || c === '=';
    if (isB64) {
      out += c;
    }
  }
  return out;
}

/** 从罐子构建请求 Cookie 头 */
function buildCookieHeader(): string {
  const parts: string[] = [];
  const keys = Array.from(cookieJar.keys());
  for (let i = 0; i < keys.length; i++) {
    const v = cookieJar.get(keys[i]);
    if (v !== undefined) {
      parts.push(`${keys[i]}=${v}`);
    }
  }
  return parts.join('; ');
}

/**
 * 把响应 Set-Cookie 并入罐子。
 * 鸿蒙 resp.cookies 实际返回 Netscape cookie 格式，每一行由制表符分隔 7 个字段：
 *   domain  includeSubdomain  path  isSecure  expiry  name  value
 * 例如：`.sts.api.io.mi.com\tTRUE\t/\tFALSE\t0\tuserId\t166904385`
 * 也兼容旧的 "a=1; b=2" 和 "name=value; path=/; domain=..." 两种形态。
 */
function storeCookies(rawCookies: string): void {
  if (rawCookies === '' || rawCookies === 'undefined') {
    return;
  }
  const lines = rawCookies.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li].trim();
    if (line === '') {
      continue;
    }
    // 形态1：Netscape 制表符格式（7 个字段），取第 7 个字段 name 和第 8 个字段 value
    const tabs = line.split('\t');
    if (tabs.length >= 7) {
      const name = tabs[5].trim();
      const value = tabs[6].trim();
      if (name !== '') {
        cookieJar.set(name, value);
      }
      continue;
    }
    // 形态2：传统 "a=1; b=2" / "name=value; path=/..." 格式
    const segs = line.split(/[;,]/);
    for (let i = 0; i < segs.length; i++) {
      const pair = segs[i].trim();
      const idx = pair.indexOf('=');
      if (idx > 0) {
        const name = pair.substring(0, idx).trim();
        const value = pair.substring(idx + 1).trim();
        if (name !== '' && name !== 'Path' && name !== 'Domain' && name !== 'Expires' && name !== 'Max-Age'
          && name !== 'HttpOnly' && name !== 'Secure' && name !== 'SameSite') {
          cookieJar.set(name, value);
        }
      }
    }
  }
}

/** 从响应 Cookie 中按名提取值（兼容 Netscape 制表符格式与 name=value 格式） */
function findCookieValue(cookies: string[], name: string): string {
  for (let i = 0; i < cookies.length; i++) {
    const line = cookies[i];
    // Netscape 制表符格式
    const tabs = line.split('\t');
    if (tabs.length >= 7 && tabs[5].trim() === name) {
      return tabs[6].trim();
    }
    // name=value 格式
    const pair = line.trim().split(';')[0];
    const idx = pair.indexOf('=');
    if (idx > 0 && pair.substring(0, idx) === name) {
      return pair.substring(idx + 1);
    }
  }
  return '';
}

function encodeForm(form: Record<string, string>): string {
  const keys = Object.keys(form);
  let s = '';
  for (let i = 0; i < keys.length; i++) {
    s += (i === 0 ? '' : '&') + `${keys[i]}=${encodeURIComponent(form[keys[i]])}`;
  }
  return s;
}

/** 解析小米账号接口的响应（去掉 &&&START&&& 前缀） */
function parseJsonBody(text: string): Record<string, Object> {
  const clean = text.replace(/^&&&START&&&/, '');
  const parsed: object = JSON.parse(clean) as object;
  return parsed as Record<string, Object>;
}

/**
 * 从原始 JSON 响应文本中提取 nonce 字符串，避免 JSON.parse 大整数精度丢失。
 *
 * ⚠️ 血泪教训：serviceLoginAuth2 响应的 nonce 是 Long 数字（如 8082866328074280000，19 位），
 * 远超 JS 安全整数上限 2^53 ≈ 9.007e15。JSON.parse 会把它转成 double（8082866328074279936，
 * 丢了 64），导致 clientSign 算错 → sts 校验失败静默返回 200 "ok" 不签发 serviceToken。
 *
 * 兼容两种写法：`"nonce":8082866328074280000`（数字）和 `"nonce":"8082866328074280000"`（字符串）。
 */
function extractNonceString(text: string): string {
  const re = new RegExp('"nonce"\\s*:\\s*"?([0-9]+)"?');
  const m = re.exec(text);
  if (m !== null && m[1] !== undefined) {
    return m[1];
  }
  return '';
}

interface HttpTextResult {
  text: string;
  cookies: string[];
  status: number;
  headers: Record<string, string>;
}

async function httpRaw(method: http.RequestMethod, url: string, cookie: string,
  body: string | null, extraHeader: Record<string, string> | null): Promise<HttpTextResult> {
  const header: Record<string, string> = {
    'User-Agent': UA,
    'Content-Type': 'application/x-www-form-urlencoded'
  };
  if (extraHeader !== null) {
    const ks = Object.keys(extraHeader);
    for (let i = 0; i < ks.length; i++) {
      header[ks[i]] = extraHeader[ks[i]];
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
    const httpReq = http.createHttp();
  try {
    const resp = await httpReq.request(url, options);
    let ck = String(resp.cookies);
    // 兜底：resp.cookies 为空时从 set-cookie header 提取
    if (ck === '' || ck === 'undefined') {
      ck = getHeaderValue((resp.header as Record<string, Object>), 'set-cookie');
    }
    // 关键：把响应 Set-Cookie 累积进 cookieJar（鸿蒙 resp.cookies 可能是 Netscape 格式 string）
    storeCookies(ck);
    const result: HttpTextResult = {
      text: String(resp.result),
      cookies: ck.split('\n'),
      status: resp.responseCode,
      headers: respHeaderToMap(resp.header as Record<string, Object>)
    };
    return result;
  } finally {
    httpReq.destroy();
  }
}

/**
 * 签发 serviceToken：直接 GET location，无需 clientSign。
 *
 * ⚠️ 关键（血泪教训）：大陆 sid=mijia（海外才是 xiaomiio）的流程是【直接 GET location，无 clientSign】，
 * serviceToken 通过 sts 重定向链的 Set-Cookie 写入，不是响应 header，也不是 location 的 auth 参数。
 * 参考 Do1e/mijia-api（可工作的第三方库）：`session.get(location)` → `cookies['serviceToken']`。
 * 之前加 clientSign + 从 header 拿 token 是【错误方向】（那是海外 sid 的 XMPassport 流程），
 * 导致 sts 校验 clientSign 失败静默返回 200 "ok" 却不签发 serviceToken。
 */
async function fetchServiceToken(location: string): Promise<HttpTextResult> {
  Logger.error(TAG, `>>> fetchServiceToken 直接 GET location（无 clientSign）, ssecurity_len=${ssecurity.length}`);
  return await httpGetFollowRedirect(location);
}

/**
 * 从 step3 响应中提取 serviceToken。
 * 大陆 sid=mijia：serviceToken 通过 sts 重定向链 Set-Cookie 写入，
 * 优先从 cookieJar（累积所有跳的 Set-Cookie）拿，其次最后一跳 cookies，最后 header 兜底。
 */
function extractServiceToken(step3: HttpTextResult): string {
  let st = cookieJar.get('serviceToken') ?? '';
  if (st === '') {
    st = findCookieValue(step3.cookies, 'serviceToken');
  }
  if (st === '') {
    st = findHeaderValue(step3.headers, 'xiaomiio_serviceToken');
  }
  if (st === '') {
    st = findHeaderValue(step3.headers, 'serviceToken');
  }
  if (st !== '') {
    // 同步 cUserId（sts 返回的独立字段，≠ userId；Cookie 必须用它对才不 401）
    const cu = cookieJar.get('cUserId');
    if (cu !== undefined && cu !== '') {
      cUserId = cu;
    }
  }
  return st;
}

/**
 * GET 请求并手动跟随 302 重定向（最多 10 跳），累积每一跳的 Set-Cookie。
 * 小米登录 step3 的 serviceToken 是通过 location 的重定向链 Set-Cookie 写入的。
 *
 * ⚠️ 关键（血泪教训）：鸿蒙 @ohos.net.http 会自动跟随重定向且无法禁用
 * （官方论坛明确「http 不支持禁止重定向」），导致 sts 重定向链中间的
 * Set-Cookie（serviceToken）被底层丢弃，最终只返回 200 "ok" + 空 Cookie。
 * 必须改用 rcp（RemoteCommunicationKit），设 transfer.autoRedirect=false，
 * 手动逐跳跟随并累积 Set-Cookie，才能拿到 serviceToken。
 */
async function httpGetFollowRedirect(startUrl: string): Promise<HttpTextResult> {
  let currentUrl = startUrl;
  let lastText = '';
  let lastCookies: string[] = [];
  let lastHeaders: Record<string, string> = {};
  const maxHop = 10;
  // rcp 会话：手动控制重定向，cookies 需在 header 里手动携带（rcp 不自动共享 Cookie）
  const session = rcp.createSession({
    requestConfiguration: {
      transfer: {
        autoRedirect: false,
        timeout: { connectMs: 15000, transferMs: 30000 }
      }
    }
  });
  for (let hop = 0; hop < maxHop; hop++) {
    // 每一跳都携带最新的 cookieJar（累积了前面跳转的 Set-Cookie）
    const currentCookie = buildCookieHeader();
    const headers: rcp.RequestHeaders = {
      'user-agent': UA,
      'content-type': 'application/x-www-form-urlencoded'
    };
    if (currentCookie !== '') {
      headers['cookie'] = currentCookie;
    }
    let respText = '';
    let respCookies = '';
    let respHeaderMap: Record<string, string> = {};
    let respCode = 0;
    let respLocation = '';
    try {
      const req = new rcp.Request(currentUrl, 'GET', headers);
      const resp = await session.fetch(req);
      respCode = resp.statusCode;
      const bodyStr = resp.toString();
      respText = bodyStr === null ? '' : bodyStr;
      // rcp 响应头里读 set-cookie 和 location（key 可能大小写不一，值可能是数组）
      const hdrKeys = Object.keys(resp.headers);
      for (let hi = 0; hi < hdrKeys.length; hi++) {
        const hk = hdrKeys[hi];
        const rawV = resp.headers[hk];
        const lk = hk.toLowerCase();
        // header 值可能是数组（多个同名 header，如多个 set-cookie）
        let hv = '';
        if (rawV instanceof Array) {
          const arr = rawV as Object[];
          const parts: string[] = [];
          for (let j = 0; j < arr.length; j++) {
            parts.push(String(arr[j]));
          }
          hv = parts.join('\n');
        } else if (rawV !== undefined) {
          hv = String(rawV);
        }
        respHeaderMap[lk] = hv;
        if (lk === 'set-cookie') {
          respCookies = respCookies === '' ? hv : respCookies + '\n' + hv;
        } else if (lk === 'location') {
          respLocation = hv;
        }
        if (lk.indexOf('cookie') >= 0 || lk === 'location'
          || lk.indexOf('servicetoken') >= 0 || lk.indexOf('service') >= 0) {
          Logger.error(TAG, `>>> step3 rcp header[${hk}]=${hv.substring(0, 300)}`);
        }
      }
      // 兜底：rcp 的 cookies 是 ResponseCookie[] 数组（{name, value}），比手解析 header 更可靠
      const rc = resp.cookies;
      if (rc !== undefined && rc !== null) {
        let rcStr = '';
        for (let ci = 0; ci < rc.length; ci++) {
          const c = rc[ci];
          const cName = c.name;
          const cVal = c.value === undefined ? '' : c.value;
          rcStr += (rcStr === '' ? '' : '\n') + `${cName}=${cVal}`;
        }
        if (rcStr !== '') {
          respCookies = rcStr;
        }
      }
    } catch (e) {
      Logger.error(TAG, `>>> step3 rcp hop=${hop} fetch error: ${String(e)}`);
      break;
    }
    storeCookies(respCookies);
    Logger.error(TAG, `>>> step3 hop=${hop} code=${respCode} body=${respText.substring(0, 120)} respCookies=${respCookies.substring(0, 200)}`);
    lastText = respText;
    lastCookies = respCookies.split('\n');
    lastHeaders = respHeaderMap;
    // 没有 Location 就结束
    if (respLocation === '') {
      break;
    }
    // 处理相对路径
    if (respLocation.indexOf('http') === 0) {
      currentUrl = respLocation;
    } else if (respLocation.indexOf('/') === 0) {
      const host = extractHost(startUrl);
      currentUrl = host + respLocation;
    } else {
      break;
    }
  }
  try {
    session.close();
  } catch (e) {
    Logger.error(TAG, `step3 rcp session.close error: ${String(e)}`);
  }
  const result: HttpTextResult = {
    text: lastText,
    cookies: lastCookies,
    status: 0,
    headers: lastHeaders
  };
  return result;
}

/** 从响应 header 对象里取某个 header 值（兼容大小写和数组） */
function getHeaderValue(h: Record<string, Object>, name: string): string {
  if (h === undefined || h === null) {
    return '';
  }
  const lower = name.toLowerCase();
  const keys = Object.keys(h);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) {
      const v = h[keys[i]];
      // header 值可能是数组（多个同名 header，如多个 Set-Cookie）
      if (v instanceof Array) {
        const arr = v as Object[];
        const parts: string[] = [];
        for (let j = 0; j < arr.length; j++) {
          parts.push(String(arr[j]));
        }
        return parts.join('\n');
      }
      return String(v);
    }
  }
  return '';
}

/** 把鸿蒙响应 header 对象转成 {小写key: value} 的 Map（value 数组时取第一个） */
function respHeaderToMap(h: Record<string, Object>): Record<string, string> {
  const out: Record<string, string> = {};
  if (h === undefined || h === null) {
    return out;
  }
  const keys = Object.keys(h);
  for (let i = 0; i < keys.length; i++) {
    const v = h[keys[i]];
    if (v instanceof Array) {
      const arr = v as Object[];
      if (arr.length > 0) {
        out[keys[i].toLowerCase()] = String(arr[0]);
      }
    } else {
      out[keys[i].toLowerCase()] = String(v);
    }
  }
  return out;
}

/** 从已转成 Map 的响应 header 里按名取第一个值（大小写不敏感） */
function findHeaderValue(headers: Record<string, string>, name: string): string {
  const lower = name.toLowerCase();
  const keys = Object.keys(headers);
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].toLowerCase() === lower) {
      return headers[keys[i]];
    }
  }
  return '';
}

/** 从完整 URL 提取 scheme://host */
function extractHost(url: string): string {
  const schemeIdx = url.indexOf('://');
  if (schemeIdx < 0) {
    return '';
  }
  const afterScheme = url.substring(schemeIdx + 3);
  const slashIdx = afterScheme.indexOf('/');
  if (slashIdx < 0) {
    return url;
  }
  return url.substring(0, schemeIdx + 3) + afterScheme.substring(0, slashIdx);
}
