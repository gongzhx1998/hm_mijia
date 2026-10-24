import { common } from '@kit.AbilityKit';
import { fileIo as fs } from '@kit.CoreFileKit';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { bundleManager } from '@kit.AbilityKit';

const DOMAIN: number = 0x0D01;
const TAG: string = 'RnHostWarm';
/** 缓存格式版本。rawfile 内容变化会被指纹自动检测，无需手动递增 */
export const RNHHOST_CACHE_REV: string = 'c3-20261024-warm5b';

/** 小文件：每次打开都对 rawfile 内容做指纹，变化即重拷 */
const SMALL_FILES: string[] = ['index.html', 'rnhost/host.js', 'rnhost/boot.js', 'plugin/res/files.js'];

function mark(msg: string, t0?: number): number {
  const now: number = Date.now();
  if (t0 !== undefined && t0 > 0) {
    hilog.info(DOMAIN, TAG, `%{public}s +%{public}dms`, msg, now - t0);
  } else {
    hilog.info(DOMAIN, TAG, `%{public}s`, msg);
  }
  return now;
}

function ensureDir(path: string): void {
  try {
    fs.mkdirSync(path, true);
  } catch (_e) {
  }
}

async function copyRaw(ctx: common.UIAbilityContext, rel: string, destPath: string): Promise<number> {
  const data: Uint8Array = await ctx.resourceManager.getRawFileContent(rel);
  const parent: string = destPath.substring(0, destPath.lastIndexOf('/'));
  ensureDir(parent);
  const file = fs.openSync(destPath, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
  const buf: ArrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  fs.writeSync(file.fd, buf);
  fs.closeSync(file);
  return data.byteLength;
}

function fileSize(path: string): number {
  try {
    return Number(fs.statSync(path).size);
  } catch (_e) {
    return -1;
  }
}

function readMarker(path: string): string {
  try {
    const f = fs.openSync(path, fs.OpenMode.READ_ONLY);
    const st = fs.statSync(path);
    const len: number = Number(st.size);
    const buf: ArrayBuffer = new ArrayBuffer(len);
    fs.readSync(f.fd, buf);
    fs.closeSync(f);
    const u8: Uint8Array = new Uint8Array(buf);
    let out: string = '';
    for (let i = 0; i < u8.length; i++) {
      out += String.fromCharCode(u8[i]);
    }
    return out;
  } catch (_e) {
    return '';
  }
}

function writeMarker(path: string, body: string): void {
  const file = fs.openSync(path, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
  const bytes: Uint8Array = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) {
    bytes[i] = body.charCodeAt(i) & 0xff;
  }
  fs.writeSync(file.fd, bytes.buffer);
  fs.closeSync(file);
}

function fnv1a(h: number, u8: Uint8Array): number {
  let x: number = h;
  for (let i = 0; i < u8.length; i++) {
    x ^= u8[i];
    x = Math.imul(x, 16777619) >>> 0;
  }
  return x;
}

async function rawSize(ctx: common.UIAbilityContext, rel: string): Promise<number> {
  try {
    const d = await ctx.resourceManager.getRawFd(rel);
    const len: number = Number(d.length);
    try {
      await ctx.resourceManager.closeRawFd(rel);
    } catch (_e) {
    }
    return len;
  } catch (_e2) {
    return -1;
  }
}

async function smallFingerprint(ctx: common.UIAbilityContext): Promise<string> {
  let h: number = 2166136261;
  for (let i = 0; i < SMALL_FILES.length; i++) {
    try {
      const data: Uint8Array = await ctx.resourceManager.getRawFileContent('rnhost/' + SMALL_FILES[i]);
      h = fnv1a(h, data);
      h = (h ^ data.byteLength) >>> 0;
    } catch (_e) {
      h = (h ^ 0x5a5a5a5a) >>> 0;
    }
  }
  return h.toString(16);
}

async function bigFingerprint(ctx: common.UIAbilityContext): Promise<string> {
  const sdk: number = await rawSize(ctx, 'rnhost/sdk/sdk.bundle');
  const plug: number = await rawSize(ctx, 'rnhost/plugin/main.bundle');
  let upd: string = '0';
  try {
    const info = bundleManager.getBundleInfoForSelfSync(bundleManager.BundleFlag.GET_BUNDLE_INFO_DEFAULT);
    upd = String(info.updateTime) + 'v' + String(info.versionCode);
  } catch (_e) {
  }
  return `${sdk}:${plug}:${upd}`;
}

async function copySmall(ctx: common.UIAbilityContext, root: string): Promise<void> {
  for (let i = 0; i < SMALL_FILES.length; i++) {
    await copyRaw(ctx, 'rnhost/' + SMALL_FILES[i], root + '/' + SMALL_FILES[i]);
  }
}

let warmPromise: Promise<string> | null = null;

/**
 * 将 rnhost rawfile 同步到 filesDir（带版本标记，命中则跳过）。
 * 可在 EntryAbility 后台预热，PluginHost 打开时几乎零拷贝。
 */
export function ensureRnHostCache(ctx: common.UIAbilityContext): Promise<string> {
  if (warmPromise !== null) {
    return warmPromise;
  }
  warmPromise = doEnsure(ctx).catch((e: Error): string => {
    warmPromise = null;
    throw new Error(e?.message ?? 'ensureRnHostCache failed');
  });
  return warmPromise;
}

async function doEnsure(ctx: common.UIAbilityContext): Promise<string> {
  const t0: number = mark('ensure start');
  const root: string = ctx.filesDir + '/rnhost_web';
  const markerPath: string = root + '/.cache_ok';
  ensureDir(root);
  ensureDir(root + '/rnhost');
  ensureDir(root + '/sdk');
  ensureDir(root + '/plugin');
  ensureDir(root + '/plugin/res');

  const sdkPath: string = root + '/sdk/sdk.bundle';
  const plugPath: string = root + '/plugin/main.bundle';
  const sdkSz: number = fileSize(sdkPath);
  const plugSz: number = fileSize(plugPath);
  const marker: string = readMarker(markerPath);
  const big: string = await bigFingerprint(ctx);
  const small: string = await smallFingerprint(ctx);
  const bigPrefix: string = `${RNHHOST_CACHE_REV}|${big}|`;
  const fullKey: string = `${bigPrefix}${small}|`;
  if (marker.indexOf(bigPrefix) === 0 && sdkSz > 1000000 && plugSz > 1000000 &&
    fileSize(root + '/plugin/res/files.js') > 100) {
    if (marker.indexOf(fullKey) === 0) {
      mark(`CACHE HIT rev=${RNHHOST_CACHE_REV} big=${big} small=${small}`, t0);
      return root;
    }
    // 只有 host/boot/index/files.js 变了：增量重拷小文件
    await copySmall(ctx, root);
    const tail: string = marker.substring(marker.indexOf('|', bigPrefix.length) + 1);
    writeMarker(markerPath, `${fullKey}${tail}`);
    mark(`CACHE SMALL-REFRESH small=${small} (was ${marker.substring(bigPrefix.length, bigPrefix.length + 8)})`, t0);
    return root;
  }
  mark(`CACHE MISS — full copy big=${big} small=${small} marker=${marker.substring(0, 80)}`, t0);

  const tCopy: number = Date.now();
  await copySmall(ctx, root);
  const sdkBytes: number = await copyRaw(ctx, 'rnhost/sdk/sdk.bundle', sdkPath);
  mark(`copied sdk ${sdkBytes}`, tCopy);
  const plugBytes: number = await copyRaw(ctx, 'rnhost/plugin/main.bundle', plugPath);
  mark(`copied plugin ${plugBytes}`, tCopy);

  let names: string[] = [];
  try {
    names = await ctx.resourceManager.getRawFileList('rnhost/plugin/res');
  } catch (e) {
    hilog.error(DOMAIN, TAG, 'getRawFileList %{public}s', String(e));
    names = ['files.js', 'manifest.json'];
  }
  const tRes: number = Date.now();
  let n: number = 0;
  for (let i = 0; i < names.length; i++) {
    const name: string = names[i];
    if (name.length === 0 || name === '.' || name === '..') {
      continue;
    }
    try {
      await copyRaw(ctx, 'rnhost/plugin/res/' + name, root + '/plugin/res/' + name);
      n++;
    } catch (e2) {
      hilog.error(DOMAIN, TAG, 'copy res %{public}s %{public}s', name, String(e2));
    }
  }
  mark(`copied res files=${n}`, tRes);

  const body: string = `${fullKey}${sdkBytes}|${plugBytes}|${n}`;
  writeMarker(markerPath, body);
  mark(`ensure done marker=${body}`, t0);
  return root;
}
