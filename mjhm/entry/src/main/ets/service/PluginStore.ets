import { common } from '@kit.AbilityKit';
import { fileIo as fs } from '@kit.CoreFileKit';
import { http } from '@kit.NetworkKit';
import { zlib } from '@kit.BasicServicesKit';
import { cryptoFramework } from '@kit.CryptoArchitectureKit';
import { util } from '@kit.ArkTS';
import { hilog } from '@kit.PerformanceAnalysisKit';
import * as MiCloud from './MiCloud';

const DOMAIN: number = 0x0D01;
const TAG: string = 'PluginStore';
/** 插件缓存格式版本：处理逻辑变化时递增，旧缓存自动作废 */
// 2：修复 >4MB bundle 读取错位（旧缓存里的大插件是坏的，需要重装）
const STORE_REV: number = 2;
/** 后台检查更新的最小间隔 */
const CHECK_INTERVAL_MS: number = 6 * 3600 * 1000;
/** App 内置的插件（rawfile/rnhost/plugin，随 RnHostWarm 拷贝），可秒开 */
const BUNDLED_MODEL: string = 'philips.light.lite';
const BUNDLED_PACKAGE_ID: number = 1018292;
const BUNDLED_VERSION: number = 16;

/** 已就绪插件的描述（传给 Web 侧 window.__pluginFromArk） */
export interface PluginMeta {
  rev: number;
  model: string;
  key: string;
  base: string;          // 相对 rnhost_web/index.html 的目录，以 / 结尾
  resFilesJs: string;    // 插件资源清单脚本（内置插件为空，用共享清单）
  packageName: string;
  packagePrefix?: string; // project.json package_prefix（字符串模块 id 前缀）
  entries: Object[];     // 入口模块 id（number 或 string）
  pluginId: number;
  packageId: number;
  version: number;
  versionName: string;
  apiLevel: number;
  resCount: number;
  bundleBytes: number;
  bundled: boolean;
  checkedAt: number;
}

export type ProgressFn = (text: string, pct: number) => void;

/** 无 RN 插件 / 不支持的包 */
export class PluginUnavailableError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = 'PluginUnavailableError';
  }
}

function log(msg: string): void {
  hilog.info(DOMAIN, TAG, '%{public}s', msg);
}

function logErr(msg: string): void {
  hilog.error(DOMAIN, TAG, '%{public}s', msg);
}

function ensureDir(path: string): void {
  try {
    fs.mkdirSync(path, true);
  } catch (_e) {
  }
}

function exists(path: string): boolean {
  try {
    return fs.accessSync(path);
  } catch (_e) {
    return false;
  }
}

function fileSize(path: string): number {
  try {
    return Number(fs.statSync(path).size);
  } catch (_e) {
    return -1;
  }
}

function rmrf(path: string): void {
  try {
    if (!exists(path)) {
      return;
    }
    const st = fs.statSync(path);
    if (st.isDirectory()) {
      fs.rmdirSync(path);
    } else {
      fs.unlinkSync(path);
    }
  } catch (e) {
    logErr(`rmrf ${path}: ${e}`);
  }
}

function readBytes(path: string): Uint8Array {
  const len: number = fileSize(path);
  const buf: ArrayBuffer = new ArrayBuffer(len > 0 ? len : 0);
  if (len > 0) {
    // 注意：readSync 的 options.offset 是“文件”偏移，数据总是写到 buffer 开头；
    // 大于一个分块（4MB）的文件必须先读进临时块再拷到目标位置，否则后半段会错位/全 0
    const f = fs.openSync(path, fs.OpenMode.READ_ONLY);
    const out: Uint8Array = new Uint8Array(buf);
    const CHUNK: number = 4 * 1024 * 1024;
    const chunk: ArrayBuffer = new ArrayBuffer(Math.min(CHUNK, len));
    let off: number = 0;
    try {
      while (off < len) {
        const want: number = Math.min(CHUNK, len - off);
        const n: number = fs.readSync(f.fd, chunk, { offset: off, length: want });
        if (n <= 0) {
          break;
        }
        out.set(new Uint8Array(chunk, 0, n), off);
        off += n;
      }
    } finally {
      fs.closeSync(f);
    }
    if (off !== len) {
      throw new Error(`readBytes short read ${off}/${len} ${path}`);
    }
  }
  return new Uint8Array(buf);
}

function writeBytes(path: string, data: Uint8Array): void {
  const f = fs.openSync(path, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
  const ab: ArrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  fs.writeSync(f.fd, ab);
  fs.closeSync(f);
}

function utf8(s: string): Uint8Array {
  return new util.TextEncoder().encodeInto(s);
}

function readText(path: string): string {
  try {
    const u8: Uint8Array = readBytes(path);
    return util.TextDecoder.create('utf-8').decodeToString(u8);
  } catch (_e) {
    return '';
  }
}

function writeText(path: string, s: string): void {
  writeBytes(path, utf8(s));
}

function asciiOf(u8: Uint8Array, start: number, end: number): string {
  let out: string = '';
  for (let i = start; i < end; i++) {
    out += String.fromCharCode(u8[i]);
  }
  return out;
}

function indexOfBytes(hay: Uint8Array, needle: Uint8Array, from: number): number {
  const n: number = needle.length;
  if (n === 0) {
    return -1;
  }
  const first: number = needle[0];
  const last: number = hay.length - n;
  let i: number = from;
  while (i <= last) {
    i = hay.indexOf(first, i);
    if (i < 0 || i > last) {
      return -1;
    }
    let j: number = 1;
    while (j < n && hay[i + j] === needle[j]) {
      j++;
    }
    if (j === n) {
      return i;
    }
    i++;
  }
  return -1;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let total: number = 0;
  for (let i = 0; i < parts.length; i++) {
    total += parts[i].length;
  }
  const out: Uint8Array = new Uint8Array(total);
  let off: number = 0;
  for (let i = 0; i < parts.length; i++) {
    out.set(parts[i], off);
    off += parts[i].length;
  }
  return out;
}

function safeName(s: string): string {
  return s.replace(/[^A-Za-z0-9._-]/g, '_');
}

// ---------------------------------------------------------------- bundle 预处理

interface ProcessedBundle {
  code: Uint8Array;
  entries: Object[];
}

const KEYMIRROR_OLD: string = '!(obj instanceof Object && !Array.isArray(obj)) ? invariant(false) : undefined;';
const KEYMIRROR_NEW: string =
  'if (!(obj && typeof obj === "object" && !Array.isArray(obj))) { throw new Error("keyMirror: expected object"); }';
/** 解析一个 __r(...) 的参数：数字或带引号的字符串；无法识别返回 null */
function entryToken(inner: string): Object | null {
  const t: string = inner.trim();
  if (t.length >= 2 && (t.charAt(0) === '"' || t.charAt(0) === '\'') && t.charAt(t.length - 1) === t.charAt(0)) {
    return t.substring(1, t.length - 1);
  }
  if (t.length === 0) {
    return null;
  }
  for (let i = 0; i < t.length; i++) {
    const c: number = t.charCodeAt(i);
    if (c < 48 || c > 57) {
      return null;
    }
  }
  return Number(t);
}

/** 一行是否只由 __r(...); 语句组成（可带 MIOT_SDK_LOADER 注释前缀）；是则把入口追加到 out */
function entryLine(line: string, out: Object[] | null): boolean {
  let s: string = line.trim();
  const loader: string = '/**MIOT_SDK_LOADER**/';
  if (s.startsWith(loader)) {
    s = s.substring(loader.length).trim();
  }
  if (s.length === 0) {
    return false;
  }
  const found: Object[] = [];
  while (s.length > 0) {
    if (!s.startsWith('__r(')) {
      return false;
    }
    const close: number = s.indexOf(')');
    if (close < 0) {
      return false;
    }
    const tok: Object | null = entryToken(s.substring(4, close));
    if (tok === null) {
      return false;
    }
    found.push(tok);
    s = s.substring(close + 1).trim();
    if (s.startsWith(';')) {
      s = s.substring(1).trim();
    }
  }
  if (out !== null) {
    for (let i = 0; i < found.length; i++) {
      // InitializeCore(10120) 由宿主先执行
      if (!(typeof found[i] === 'number' && (found[i] as number) === 10120)) {
        out.push(found[i]);
      }
    }
  }
  return true;
}

/** 从启动代码 / bundle 尾部解析 __r(...) 入口 */
function parseEntries(tail: string, out: Object[]): void {
  const lines: string[] = tail.split('\n');
  for (let i = 0; i < lines.length; i++) {
    entryLine(lines[i], out);
  }
}

/** 替换所有 keyMirror 旧写法（与之前 PC 预处理一致） */
function hardenKeyMirror(code: Uint8Array): Uint8Array {
  const oldB: Uint8Array = utf8(KEYMIRROR_OLD);
  const newB: Uint8Array = utf8(KEYMIRROR_NEW);
  const parts: Uint8Array[] = [];
  let pos: number = 0;
  let hit: number = indexOfBytes(code, oldB, 0);
  if (hit < 0) {
    return code;
  }
  while (hit >= 0) {
    parts.push(code.subarray(pos, hit));
    parts.push(newB);
    pos = hit + oldB.length;
    hit = indexOfBytes(code, oldB, pos);
  }
  parts.push(code.subarray(pos));
  return concat(parts);
}

function processBundle(src: Uint8Array): ProcessedBundle {
  if (src.length < 16) {
    throw new PluginUnavailableError('插件包缺少 main.bundle');
  }
  // Hermes 字节码（.hbc）：网页宿主无法执行
  if (src[0] === 0xc6 && src[1] === 0x1f && src[2] === 0xbc && src[3] === 0x03) {
    throw new PluginUnavailableError('该设备插件是 Hermes 字节码（.hbc），网页宿主暂不支持');
  }
  const entries: Object[] = [];
  // RN Indexed RAM bundle：magic 0xFB0BD1E5（小端）
  if (src[0] === 0xe5 && src[1] === 0xd1 && src[2] === 0x0b && src[3] === 0xfb) {
    const dv: DataView = new DataView(src.buffer, src.byteOffset, src.byteLength);
    const count: number = dv.getUint32(4, true);
    const startupLen: number = dv.getUint32(8, true);
    const base: number = 12 + count * 8;
    const parts: Uint8Array[] = [];
    const nl: Uint8Array = utf8('\n');
    for (let i = 0; i < count; i++) {
      const off: number = dv.getUint32(12 + i * 8, true);
      let len: number = dv.getUint32(16 + i * 8, true);
      if (len === 0) {
        continue;
      }
      const s: number = base + off;
      while (len > 0 && src[s + len - 1] === 0) {
        len--;
      }
      parts.push(src.subarray(s, s + len));
      parts.push(nl);
    }
    let sl: number = startupLen;
    while (sl > 0 && src[base + sl - 1] === 0) {
      sl--;
    }
    const startup: string = asciiOf(src, base, base + sl);
    parseEntries(startup, entries);
    // 启动代码里除 __r / sourceMappingURL 之外的语句保留（极少见）
    const lines: string[] = startup.split('\n');
    const keep: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const t: string = lines[i].trim();
      if (t.length === 0 || t.startsWith('//#') || entryLine(t, null)) {
        continue;
      }
      keep.push(lines[i]);
    }
    if (keep.length > 0) {
      parts.push(utf8(keep.join('\n') + '\n'));
    }
    parts.push(utf8('/**PLUGIN_ENTRY**/ /* RAM bundle unpacked; host runs entries */\n'));
    return { code: hardenKeyMirror(concat(parts)), entries: entries };
  }
  // 普通 JS bundle：去掉尾部 __r(10120);__r(10001); 等自动启动语句
  let cut: number = src.length;
  const tailStart: number = Math.max(0, src.length - 4096);
  const tail: string = asciiOf(src, tailStart, src.length);
  const lines: string[] = tail.split('\n');
  let consumed: number = 0;
  for (let i = lines.length - 1; i > 0; i--) {
    const t: string = lines[i].trim();
    const lineEntries: Object[] = [];
    const isEntry: boolean = entryLine(t, lineEntries);
    if (t.length === 0 || t.startsWith('//#') || isEntry) {
      // 倒序扫描：本行入口插到前面，保持出现顺序
      for (let k = lineEntries.length - 1; k >= 0; k--) {
        entries.unshift(lineEntries[k]);
      }
      consumed += lines[i].length + 1;
      continue;
    }
    break;
  }
  cut = Math.max(0, src.length - consumed);
  const body: Uint8Array = src.subarray(0, cut);
  const code: Uint8Array = concat([body, utf8('\n/**PLUGIN_ENTRY**/ /* stripped; host runs entries */\n')]);
  return { code: hardenKeyMirror(code), entries: entries };
}

// ---------------------------------------------------------------- 资源

const DENSITY_ORDER: string[] = ['drawable-xxhdpi', 'drawable-xhdpi', 'drawable-xxxhdpi', 'drawable-hdpi',
  'drawable-mdpi', 'drawable', 'drawable-nodpi', 'raw'];

function densityRank(dir: string): number {
  const i: number = DENSITY_ORDER.indexOf(dir);
  return i >= 0 ? i : DENSITY_ORDER.length;
}

/** android/drawable-* 与 raw 下同名资源取最合适密度，移到 res/；返回文件名列表 */
function collectRes(androidDir: string, resDir: string): string[] {
  ensureDir(resDir);
  const best: Record<string, string> = {};
  const rank: Record<string, number> = {};
  let dirs: string[] = [];
  try {
    dirs = fs.listFileSync(androidDir);
  } catch (_e) {
    dirs = [];
  }
  for (let i = 0; i < dirs.length; i++) {
    const d: string = dirs[i];
    if (!(d.startsWith('drawable') || d === 'raw')) {
      continue;
    }
    const full: string = androidDir + '/' + d;
    let files: string[] = [];
    try {
      files = fs.listFileSync(full);
    } catch (_e2) {
      continue;
    }
    const r: number = densityRank(d);
    for (let j = 0; j < files.length; j++) {
      const f: string = files[j];
      const prev: number | undefined = rank[f];
      if (prev === undefined || r < prev) {
        rank[f] = r;
        best[f] = full + '/' + f;
      }
    }
  }
  const names: string[] = Object.keys(best);
  for (let i = 0; i < names.length; i++) {
    try {
      fs.renameSync(best[names[i]], resDir + '/' + names[i]);
    } catch (_e) {
      try {
        fs.copyFileSync(best[names[i]], resDir + '/' + names[i]);
      } catch (e2) {
        logErr(`move res ${names[i]}: ${e2}`);
      }
    }
  }
  return names;
}

// ---------------------------------------------------------------- 索引

function rootDir(ctx: common.Context): string {
  return ctx.filesDir + '/rnhost_web/plugins';
}

function indexPath(ctx: common.Context): string {
  return rootDir(ctx) + '/index.json';
}

function loadIndex(ctx: common.Context): Record<string, PluginMeta> {
  const t: string = readText(indexPath(ctx));
  if (t.length === 0) {
    return {};
  }
  try {
    return JSON.parse(t) as Record<string, PluginMeta>;
  } catch (_e) {
    return {};
  }
}

function saveIndexEntry(ctx: common.Context, meta: PluginMeta): void {
  ensureDir(rootDir(ctx));
  const idx: Record<string, PluginMeta> = loadIndex(ctx);
  idx[meta.model] = meta;
  writeText(indexPath(ctx), JSON.stringify(idx));
}

function isValid(ctx: common.Context, m: PluginMeta | undefined): boolean {
  if (m === undefined || m === null || m.rev !== STORE_REV) {
    return false;
  }
  if (m.bundled) {
    return true;
  }
  const dir: string = ctx.filesDir + '/rnhost_web/' + m.base;
  return fileSize(dir + 'main.bundle') === m.bundleBytes && m.bundleBytes > 0;
}

function bundledMeta(): PluginMeta {
  const m: PluginMeta = {
    rev: STORE_REV,
    model: BUNDLED_MODEL,
    key: 'bundled',
    base: 'plugin/',
    resFilesJs: '',
    packageName: 'miot.plugin.prototype',
    entries: [10001],
    pluginId: 1005732,
    packageId: BUNDLED_PACKAGE_ID,
    version: BUNDLED_VERSION,
    versionName: '1.0.55',
    apiLevel: 10055,
    resCount: 0,
    bundleBytes: 0,
    bundled: true,
    checkedAt: 0
  };
  return m;
}

// ---------------------------------------------------------------- 下载

function hex(u8: Uint8Array): string {
  let s: string = '';
  for (let i = 0; i < u8.length; i++) {
    const h: string = u8[i].toString(16);
    s += h.length === 1 ? '0' + h : h;
  }
  return s;
}

async function download(url: string, dest: string, expectSize: number, onProgress: ProgressFn | null): Promise<string> {
  const f = fs.openSync(dest, fs.OpenMode.READ_WRITE | fs.OpenMode.CREATE | fs.OpenMode.TRUNC);
  const md = cryptoFramework.createMd('MD5');
  const req = http.createHttp();
  let received: number = 0;
  let lastPct: number = -1;
  let writeErr: string = '';
  req.on('dataReceive', (data: ArrayBuffer) => {
    try {
      fs.writeSync(f.fd, data);
      md.updateSync({ data: new Uint8Array(data) });
      received += data.byteLength;
    } catch (e) {
      writeErr = String(e);
    }
  });
  req.on('dataReceiveProgress', (info: http.DataReceiveProgressInfo) => {
    const total: number = info.totalSize > 0 ? info.totalSize : expectSize;
    if (total > 0 && onProgress !== null) {
      const pct: number = Math.min(99, Math.floor(info.receiveSize * 100 / total));
      if (pct !== lastPct) {
        lastPct = pct;
        onProgress(`下载插件 ${pct}%（${(info.receiveSize / 1048576).toFixed(1)}/${(total / 1048576).toFixed(1)}MB）`, pct);
      }
    }
  });
  try {
    const code: number = await req.requestInStream(url, {
      method: http.RequestMethod.GET,
      connectTimeout: 15000,
      readTimeout: 180000,
      expectDataType: http.HttpDataType.ARRAY_BUFFER
    });
    if (code !== 200) {
      throw new Error(`下载失败 HTTP ${code}`);
    }
  } finally {
    req.off('dataReceive');
    req.off('dataReceiveProgress');
    req.destroy();
    fs.closeSync(f);
  }
  if (writeErr.length > 0) {
    throw new Error(`写入失败 ${writeErr}`);
  }
  const digest = md.digestSync();
  log(`downloaded ${received} bytes`);
  return hex(digest.data);
}

// ---------------------------------------------------------------- 安装

async function install(ctx: common.Context, info: MiCloud.PluginPackageInfo, onProgress: ProgressFn | null): Promise<PluginMeta> {
  const t0: number = Date.now();
  const root: string = rootDir(ctx);
  ensureDir(root);
  const key: string = `${safeName(info.model)}_${info.packageId}_${info.version}`;
  const work: string = ctx.cacheDir + '/plugin_dl_' + key;
  rmrf(work);
  ensureDir(work);
  const zipPath: string = work + '/pkg.zip';
  if (onProgress !== null) {
    onProgress('下载插件 0%', 0);
  }
  const md5: string = await download(info.downloadUrl, zipPath, info.size, onProgress);
  if (info.md5.length > 0 && md5 !== info.md5) {
    rmrf(work);
    throw new Error(`插件包 MD5 校验失败（${md5} ≠ ${info.md5}）`);
  }
  log(`md5 ok ${md5} +${Date.now() - t0}ms`);
  if (onProgress !== null) {
    onProgress('解压插件…', 99);
  }
  const unz: string = work + '/unz';
  ensureDir(unz);
  const opts: zlib.Options = { level: zlib.CompressLevel.COMPRESS_LEVEL_DEFAULT_COMPRESSION };
  await zlib.decompressFile(zipPath, unz, opts);
  const android: string = unz + '/android';
  const srcBundle: string = android + '/main.bundle';
  if (!exists(srcBundle)) {
    let hbc: boolean = false;
    try {
      const top: string[] = fs.listFileSync(android);
      for (let i = 0; i < top.length; i++) {
        if (top[i].endsWith('.hbc')) {
          hbc = true;
        }
      }
    } catch (_e) {
    }
    rmrf(work);
    throw new PluginUnavailableError(hbc ? '该设备插件是 Hermes 小程序包（.hbc），网页宿主暂不支持' : '插件包里没有 main.bundle');
  }
  let pj: Record<string, Object> = {};
  try {
    pj = JSON.parse(readText(android + '/project.json')) as Record<string, Object>;
  } catch (_e) {
  }
  if (onProgress !== null) {
    onProgress('处理插件…', 99);
  }
  // 多个后台下载并行时，CPU 密集的预处理串行执行，减少对首页渲染/滚动的影响
  const release: () => void = await lockProc();
  let processed: ProcessedBundle = { code: new Uint8Array(0), entries: [] };
  let resNames: string[] = [];
  const dest: string = root + '/' + key;
  try {
    await sleep(0);
    processed = processBundle(readBytes(srcBundle));
    const tmpDest0: string = dest + '.tmp';
    rmrf(tmpDest0);
    ensureDir(tmpDest0);
    writeBytes(tmpDest0 + '/main.bundle', processed.code);
    await sleep(0);
    resNames = collectRes(android, tmpDest0 + '/res');
    writeText(tmpDest0 + '/res/files.js', 'window.__RNHostPluginResFiles = ' + JSON.stringify(resNames) + ';\n');
    rmrf(dest);
    fs.renameSync(tmpDest0, dest);
  } finally {
    release();
  }
  rmrf(work);
  const meta: PluginMeta = {
    rev: STORE_REV,
    model: info.model,
    key: key,
    base: 'plugins/' + key + '/',
    resFilesJs: 'plugins/' + key + '/res/files.js',
    packageName: String(pj['package_path'] ?? 'miot.plugin.prototype'),
    packagePrefix: String(pj['package_prefix'] ?? ''),
    entries: processed.entries.length > 0 ? processed.entries : [10001],
    pluginId: info.pluginId,
    packageId: info.packageId,
    version: info.version,
    versionName: String(pj['version'] ?? String(info.version)),
    apiLevel: Number(pj['sdk_api_level'] ?? info.sdkVersion),
    resCount: resNames.length,
    bundleBytes: processed.code.length,
    bundled: false,
    checkedAt: Date.now()
  };
  saveIndexEntry(ctx, meta);
  log(`installed ${key} pkg=${meta.packageName} entries=${JSON.stringify(meta.entries)} res=${resNames.length} ` +
    `bytes=${meta.bundleBytes} +${Date.now() - t0}ms`);
  return meta;
}

/** 删除同型号的旧版本目录 */
function pruneOld(ctx: common.Context, keep: PluginMeta): void {
  const prefix: string = safeName(keep.model) + '_';
  try {
    const all: string[] = fs.listFileSync(rootDir(ctx));
    for (let i = 0; i < all.length; i++) {
      if (all[i].startsWith(prefix) && all[i] !== keep.key) {
        rmrf(rootDir(ctx) + '/' + all[i]);
      }
    }
  } catch (_e) {
  }
}

const inflight: Map<string, Promise<PluginMeta>> = new Map<string, Promise<PluginMeta>>();

// ---------------------------------------------------------------- 进度广播（点开设备时可加入正在进行的后台下载）

class ProgressState {
  text: string = '';
  pct: number = 0;
}

const listeners: Map<string, ProgressFn[]> = new Map<string, ProgressFn[]>();
const lastProgress: Map<string, ProgressState> = new Map<string, ProgressState>();

function progressFor(model: string): ProgressFn {
  return (text: string, pct: number): void => {
    const st: ProgressState = new ProgressState();
    st.text = text;
    st.pct = pct;
    lastProgress.set(model, st);
    const ls: ProgressFn[] | undefined = listeners.get(model);
    if (ls !== undefined) {
      for (let i = 0; i < ls.length; i++) {
        try {
          ls[i](text, pct);
        } catch (_e) {
        }
      }
    }
  };
}

function addListener(model: string, fn: ProgressFn): void {
  const ls: ProgressFn[] = listeners.get(model) ?? [];
  ls.push(fn);
  listeners.set(model, ls);
  const st: ProgressState | undefined = lastProgress.get(model);
  if (st !== undefined) {
    fn(st.text, st.pct);
  }
}

function removeListener(model: string, fn: ProgressFn): void {
  const ls: ProgressFn[] | undefined = listeners.get(model);
  if (ls === undefined) {
    return;
  }
  const i: number = ls.indexOf(fn);
  if (i >= 0) {
    ls.splice(i, 1);
  }
  if (ls.length === 0) {
    listeners.delete(model);
  }
}

// ---------------------------------------------------------------- 预处理串行锁 / 工具

let procTail: Promise<void> = Promise.resolve();

function lockProc(): Promise<() => void> {
  let release: () => void = () => {
  };
  const next: Promise<void> = new Promise<void>((resolve: () => void) => {
    release = resolve;
  });
  const prev: Promise<void> = procTail;
  procTail = next;
  return prev.then((): () => void => release);
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve: () => void) => {
    setTimeout(resolve, ms);
  });
}

// ---------------------------------------------------------------- 无插件型号记录

const NONE_TTL_MS: number = 24 * 3600 * 1000;

function nonePath(ctx: common.Context): string {
  return rootDir(ctx) + '/none.json';
}

function loadNone(ctx: common.Context): Record<string, number> {
  const t: string = readText(nonePath(ctx));
  if (t.length === 0) {
    return {};
  }
  try {
    return JSON.parse(t) as Record<string, number>;
  } catch (_e) {
    return {};
  }
}

function markNone(ctx: common.Context, model: string): void {
  ensureDir(rootDir(ctx));
  const n: Record<string, number> = loadNone(ctx);
  n[model] = Date.now();
  writeText(nonePath(ctx), JSON.stringify(n));
}

function isNoneFresh(n: Record<string, number>, model: string): boolean {
  const t: number | undefined = n[model];
  return t !== undefined && Date.now() - t < NONE_TTL_MS;
}

// ---------------------------------------------------------------- 下载安装（同一型号只跑一份）

function startInstall(ctx: common.Context, model: string, known: MiCloud.PluginPackageInfo | null): Promise<PluginMeta> {
  const running: Promise<PluginMeta> | undefined = inflight.get(model);
  if (running !== undefined) {
    return running;
  }
  const onProgress: ProgressFn = progressFor(model);
  const p: Promise<PluginMeta> = (async (): Promise<PluginMeta> => {
    try {
      onProgress('查询插件版本…', 0);
      const info: MiCloud.PluginPackageInfo | null = known !== null ? known : await MiCloud.fetchPluginInfo(model);
      if (info === null) {
        throw new PluginUnavailableError(`型号 ${model} 没有米家 RN 插件`);
      }
      log(`fetch_plugin ${model} plugin=${info.pluginId} package=${info.packageId} v${info.version} size=${info.size}`);
      if (model === BUNDLED_MODEL && info.packageId === BUNDLED_PACKAGE_ID) {
        const b: PluginMeta = bundledMeta();
        b.checkedAt = Date.now();
        saveIndexEntry(ctx, b);
        return b;
      }
      const meta: PluginMeta = await install(ctx, info, onProgress);
      pruneOld(ctx, meta);
      return meta;
    } catch (e) {
      if (e instanceof PluginUnavailableError) {
        markNone(ctx, model);
      }
      throw e as Error;
    } finally {
      inflight.delete(model);
      lastProgress.delete(model);
    }
  })();
  inflight.set(model, p);
  return p;
}

/** 后台检查更新：有新包就下载安装，下次打开生效；不阻塞当前页面 */
function backgroundCheck(ctx: common.Context, cur: PluginMeta): void {
  if (Date.now() - cur.checkedAt < CHECK_INTERVAL_MS || inflight.has(cur.model)) {
    return;
  }
  const p: Promise<PluginMeta> = (async (): Promise<PluginMeta> => {
    const info: MiCloud.PluginPackageInfo | null = await MiCloud.fetchPluginInfo(cur.model);
    if (info === null || (info.packageId === cur.packageId && info.version === cur.version)) {
      const m: PluginMeta = cur;
      m.checkedAt = Date.now();
      saveIndexEntry(ctx, m);
      log(`update check ${cur.model}: up to date (${cur.packageId} v${cur.version})`);
      return m;
    }
    log(`update check ${cur.model}: new package ${info.packageId} v${info.version}, installing in background`);
    if (cur.model === BUNDLED_MODEL && info.packageId === BUNDLED_PACKAGE_ID) {
      return cur;
    }
    const meta: PluginMeta = await install(ctx, info, null);
    pruneOld(ctx, meta);
    return meta;
  })();
  inflight.set(cur.model, p);
  p.catch((e: Error) => {
    logErr(`update check ${cur.model} failed: ${e?.message ?? e}`);
  }).finally(() => {
    inflight.delete(cur.model);
  });
}

/**
 * 取得某型号可运行的插件：缓存命中立即返回（并后台检查更新）；后台预取正在下载时加入它；否则下载安装。
 */
export async function resolvePlugin(ctx: common.Context, model: string, onProgress: ProgressFn | null): Promise<PluginMeta> {
  const idx: Record<string, PluginMeta> = loadIndex(ctx);
  const cached: PluginMeta | undefined = idx[model];
  if (cached !== undefined && isValid(ctx, cached)) {
    log(`cache hit ${model} -> ${cached.key}`);
    backgroundCheck(ctx, cached);
    return cached;
  }
  if (model === BUNDLED_MODEL) {
    // 内置插件秒开，首次也后台查一次版本
    const b: PluginMeta = bundledMeta();
    backgroundCheck(ctx, b);
    return b;
  }
  if (!inflight.has(model) && isNoneFresh(loadNone(ctx), model)) {
    throw new PluginUnavailableError(`型号 ${model} 没有米家 RN 插件`);
  }
  const joined: boolean = inflight.has(model);
  if (joined) {
    log(`join in-flight download ${model}`);
  }
  if (onProgress !== null) {
    addListener(model, onProgress);
  }
  try {
    return await startInstall(ctx, model, null);
  } finally {
    if (onProgress !== null) {
      removeListener(model, onProgress);
    }
  }
}

// ---------------------------------------------------------------- 首页后台预取

const PREFETCH_DELAY_MS: number = 2000;
const PREFETCH_CONCURRENCY: number = 2;
let prefetchBusy: boolean = false;
let prefetchPending: string[] | null = null;

/**
 * 首页拿到设备列表后调用：去重型号，一次批量查询，后台下载并预处理所有未缓存/已过期的插件。
 * 并发 2，预处理串行；无插件型号记入 none.json；中断后下次启动会重新计算剩余项继续。
 */
export function prefetchAll(ctx: common.Context, models: string[]): void {
  if (prefetchBusy) {
    prefetchPending = models;
    return;
  }
  prefetchBusy = true;
  runPrefetch(ctx, models).catch((e: Error) => {
    logErr(`prefetch failed: ${e?.message ?? e}`);
  }).finally(() => {
    prefetchBusy = false;
    if (prefetchPending !== null) {
      const next: string[] = prefetchPending;
      prefetchPending = null;
      prefetchAll(ctx, next);
    }
  });
}

async function runPrefetch(ctx: common.Context, models: string[]): Promise<void> {
  await sleep(PREFETCH_DELAY_MS);
  const t0: number = Date.now();
  const uniq: string[] = [];
  for (let i = 0; i < models.length; i++) {
    const m: string = models[i];
    if (m.length > 0 && uniq.indexOf(m) < 0) {
      uniq.push(m);
    }
  }
  const idx: Record<string, PluginMeta> = loadIndex(ctx);
  const none: Record<string, number> = loadNone(ctx);
  const need: string[] = [];
  let cachedFresh: number = 0;
  let noneCount: number = 0;
  for (let i = 0; i < uniq.length; i++) {
    const m: string = uniq[i];
    if (isNoneFresh(none, m)) {
      noneCount++;
      continue;
    }
    const c: PluginMeta | undefined = idx[m];
    if (c !== undefined && isValid(ctx, c) && Date.now() - c.checkedAt < CHECK_INTERVAL_MS) {
      cachedFresh++;
      continue;
    }
    need.push(m);
  }
  log(`prefetch: models=${uniq.length} cached=${cachedFresh} noPlugin=${noneCount} toCheck=${need.length}`);
  if (need.length === 0) {
    return;
  }
  const infos: Map<string, MiCloud.PluginPackageInfo | null> = await MiCloud.fetchPluginInfos(need);
  const jobs: MiCloud.PluginPackageInfo[] = [];
  for (let i = 0; i < need.length; i++) {
    const m: string = need[i];
    const info: MiCloud.PluginPackageInfo | null = infos.get(m) ?? null;
    if (info === null) {
      markNone(ctx, m);
      log(`prefetch: ${m} has no RN plugin`);
      continue;
    }
    const c: PluginMeta | undefined = idx[m];
    if (c !== undefined && isValid(ctx, c) && c.packageId === info.packageId && c.version === info.version) {
      c.checkedAt = Date.now();
      saveIndexEntry(ctx, c);
      continue;
    }
    if (m === BUNDLED_MODEL && info.packageId === BUNDLED_PACKAGE_ID) {
      const b: PluginMeta = bundledMeta();
      b.checkedAt = Date.now();
      saveIndexEntry(ctx, b);
      continue;
    }
    jobs.push(info);
  }
  let totalBytes: number = 0;
  for (let i = 0; i < jobs.length; i++) {
    totalBytes += jobs[i].size;
  }
  log(`prefetch: downloading ${jobs.length} plugins (${(totalBytes / 1048576).toFixed(1)}MB)`);
  let next: number = 0;
  let ok: number = 0;
  const worker = async (): Promise<void> => {
    while (next < jobs.length) {
      const info: MiCloud.PluginPackageInfo = jobs[next];
      next++;
      const cur: PluginMeta | undefined = loadIndex(ctx)[info.model];
      if (cur !== undefined && isValid(ctx, cur) && cur.packageId === info.packageId && cur.version === info.version) {
        continue;
      }
      const t1: number = Date.now();
      try {
        await startInstall(ctx, info.model, info);
        ok++;
        log(`prefetch: ${info.model} ready +${Date.now() - t1}ms`);
      } catch (e) {
        logErr(`prefetch: ${info.model} failed: ${(e as Error)?.message ?? e}`);
      }
      await sleep(200);
    }
  };
  const ws: Promise<void>[] = [];
  for (let i = 0; i < PREFETCH_CONCURRENCY; i++) {
    ws.push(worker());
  }
  await Promise.all(ws);
  log(`prefetch done: ${ok}/${jobs.length} installed in ${Date.now() - t0}ms`);
}
