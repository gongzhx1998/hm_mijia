import { router, window } from '@kit.ArkUI';
import { webview } from '@kit.ArkWeb';
import { common } from '@kit.AbilityKit';
import * as MiCloud from '../service/MiCloud';
import { Logger } from '../common/AppConfig';
import { ensureRnHostCache, RNHHOST_CACHE_REV } from '../service/RnHostWarm';
import { resolvePlugin, PluginMeta, PluginUnavailableError } from '../service/PluginStore';
import {
  ensureWarmWeb, getWarmController, getWarmNode, isWarmSdkReady, WarmNodeController,
  attachWarmBridge, detachWarmBridge, abandonWarm, activateWarm
} from '../service/RnWebPool';

const TAG = 'PluginHost';

class RnHostBridge {
  page: PluginHost;

  constructor(page: PluginHost) {
    this.page = page;
  }

  invoke(requestJson: string): string {
    let action: string = '';
    let payload: Record<string, Object> = {};
    let reqId: number = 0;
    try {
      const obj: Record<string, Object> = JSON.parse(requestJson) as Record<string, Object>;
      action = String(obj['action'] ?? '');
      const rawPayload: Object | undefined = obj['payload'] as Object | undefined;
      if (rawPayload !== undefined && rawPayload !== null && typeof rawPayload === 'object') {
        payload = rawPayload as Record<string, Object>;
      }
      reqId = Number(obj['id'] ?? 0);
    } catch (e) {
      Logger.error(TAG, `bridge parse failed: ${e}`);
      return JSON.stringify({ 'ok': false, 'error': 'bad json' } as Record<string, Object>);
    }
    // 性能：允许 JS 上报 timing
    if (action === 'perfMark') {
      const name: string = String(payload['name'] ?? '');
      const ms: number = Number(payload['ms'] ?? 0);
      Logger.info(TAG, `PERF js ${name}=${ms}ms`);
      this.page.onJsPerf(name, ms);
      return JSON.stringify({ 'ok': true, 'id': reqId } as Record<string, Object>);
    }
    if (action === 'exitPlugin') {
      this.page.exitPlugin();
      return JSON.stringify({ 'ok': true, 'id': reqId } as Record<string, Object>);
    }
    if (action === 'statusBarStyle') {
      this.page.setStatusBarStyle(String(payload['style'] ?? ''));
      return JSON.stringify({ 'ok': true, 'id': reqId } as Record<string, Object>);
    }
    if (action === 'bootFailed') {
      this.page.onBootFailed(String(payload['msg'] ?? ''));
      return JSON.stringify({ 'ok': true, 'id': reqId } as Record<string, Object>);
    }
    if (action === 'warmReady') {
      Logger.info(TAG, 'PERF warmReady from JS');
      return JSON.stringify({ 'ok': true, 'id': reqId } as Record<string, Object>);
    }
    if (action === 'hostDevice') {
      this.page.onHostDevice(String(payload['name'] ?? ''), String(payload['model'] ?? ''), String(payload['did'] ?? ''));
      return JSON.stringify({ 'ok': true, 'id': reqId } as Record<string, Object>);
    }
    this.page.handleBridge(reqId, action, payload);
    const pending: Record<string, Object> = { 'pending': true, 'id': reqId };
    return JSON.stringify(pending);
  }
}

/**
 * 米家原版 RN 插件实验页（性能版：缓存命中跳过拷贝、安静日志、原生头即时显示）。
 */
@Entry
@Component
struct PluginHost {
  @State statusText: string = '准备加载…';
  @State deviceTitle: string = '';
  @State deviceSub: string = '';
  @State bootMsText: string = '';
  @State webReady: boolean = false;
  @State failed: boolean = false;
  @State unavailable: boolean = false;
  @State progressPct: number = -1;
  private pluginMeta: PluginMeta | null = null;
  private hostPageLoaded: boolean = false;
  private pid: number = 0;
  private online: boolean = true;
  private fallbackTimer: number = -1;
  private controller: webview.WebviewController = new webview.WebviewController();
  private bridge: RnHostBridge = new RnHostBridge(this);
  private did: string = '';
  private model: string = '';
  private name: string = '';
  private reqSeq: number = 1;
  private hostDir: string = '';
  private pageReady: boolean = false;
  private blankDone: boolean = false;
  private hostLoaded: boolean = false;
  private cacheFailed: boolean = false;
  private statusBarVp: number = 0;
  private win: window.Window | null = null;
  private kicked: boolean = false;
  private tPage: number = 0;
  private firstPropMs: number = -1;
  @State useWarm: boolean = false;
  /** 0=尚未决定 1=暖机 NodeContainer 2=冷 Web */
  @State webSurface: number = 0;
  private warmNodeRef: WarmNodeController | null = null;
  private usingWarmController: boolean = false;
  private warmFallbackTimer: number = -1;
  private claimPollTimer: number = -1;

  aboutToAppear(): void {
    this.tPage = Date.now();
    Logger.info(TAG, `PERF pageAppear rev=${RNHHOST_CACHE_REV}`);
    try {
      webview.WebviewController.setWebDebuggingAccess(true);
    } catch (_e) {
    }
    const params = router.getParams() as Record<string, string>;
    this.did = params['did'] ?? '';
    this.model = params['model'] ?? '';
    this.name = params['name'] ?? '设备';
    this.pid = Number(params['pid'] ?? '0');
    this.online = (params['online'] ?? '1') !== '0';
    this.deviceTitle = this.name;
    this.deviceSub = `${this.model} · ${this.did}`;
    this.statusText = '';
    this.prepareAndLoad();
    this.preparePlugin();
  }

  /** 按型号取插件：缓存命中立即返回；否则后台下载（进度显示在原生头里） */
  private async preparePlugin(): Promise<void> {
    const t0: number = Date.now();
    try {
      const ctx = getContext(this) as common.UIAbilityContext;
      const meta: PluginMeta = await resolvePlugin(ctx, this.model, (text: string, pct: number) => {
        this.statusText = text;
        this.progressPct = pct;
      });
      this.pluginMeta = meta;
      this.progressPct = -1;
      Logger.info(TAG, `PERF pluginReady ${meta.key} pkg=${meta.packageName} +${Date.now() - t0}ms page+${Date.now() - this.tPage}ms`);
      this.statusText = '';
      this.kickBoot();
    } catch (e) {
      const err: Error = e as Error;
      const msg: string = err?.message ?? String(e);
      Logger.error(TAG, `preparePlugin ${this.model}: ${msg}`);
      this.progressPct = -1;
      if (e instanceof PluginUnavailableError) {
        this.unavailable = true;
        this.fail(`${msg}，即将打开原生控制页`, true);
      } else {
        this.fail(`插件加载失败：${msg}`, false);
      }
    }
  }

  private fail(msg: string, autoNative: boolean): void {
    this.failed = true;
    this.webReady = false;
    this.statusText = msg;
    if (autoNative && this.fallbackTimer < 0) {
      this.fallbackTimer = setTimeout(() => {
        this.openNative();
      }, 1800);
    }
  }

  onBootFailed(msg: string): void {
    Logger.error(TAG, `bootFailed ${this.model}: ${msg}`);
    this.fail(`插件运行失败：${msg}`, false);
  }

  openNative(): void {
    if (this.fallbackTimer >= 0) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = -1;
    }
    this.restoreStatusBar();
    router.replaceUrl({ url: 'pages/DeviceControl', params: { 'did': this.did, 'native': '1' } as Record<string, string> });
  }

  private retry(): void {
    this.failed = false;
    this.statusText = '重试中…';
    if (this.pluginMeta === null) {
      this.preparePlugin();
    } else {
      this.kicked = false;
      this.hostPageLoaded = false;
      this.hostLoaded = false;
      this.loadHostPage();
    }
  }

  exitPlugin(): void {
    Logger.info(TAG, 'exitPlugin from RN');
    this.restoreStatusBar();
    router.back();
  }

  setStatusBarStyle(style: string): void {
    if (this.win === null) {
      return;
    }
    const light: boolean = style === 'light-content';
    try {
      const prop: window.SystemBarProperties = { statusBarContentColor: light ? '#FFFFFF' : '#000000' };
      this.win.setWindowSystemBarProperties(prop);
    } catch (e) {
      Logger.error(TAG, `setStatusBarStyle: ${e}`);
    }
  }

  private restoreStatusBar(): void {
    this.setStatusBarStyle('dark-content');
  }

  aboutToDisappear(): void {
    if (this.fallbackTimer >= 0) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = -1;
    }
    this.clearWarmTimers();
    if (this.usingWarmController) {
      try {
        detachWarmBridge();
      } catch (_e) {
      }
      // NodeContainer disappear 会 scheduleRewarm；此处不 abandon
    }
    this.restoreStatusBar();
  }

  onBackPress(): boolean {
    if (!this.webReady) {
      return false;
    }
    try {
      // RN BackHandler 决定：插件内二级页先退；根页由 JS 调 exitPlugin
      this.controller.runJavaScript('void (window.__RNHost && window.__RNHost.hardwareBack && window.__RNHost.hardwareBack());');
      return true;
    } catch (_e) {
      return false;
    }
  }

  onHostDevice(name: string, model: string, did: string): void {
    if (did.length > 0 && did !== this.did) {
      Logger.info(TAG, `host device ${model} ${did} (entry ${this.model} ${this.did})`);
      this.deviceTitle = name.length > 0 ? name : this.deviceTitle;
      this.deviceSub = `${model} · ${did}（入口设备 ${this.model} 与插件不符，已切到插件设备）`;
    }
  }

  onJsPerf(name: string, ms: number): void {
    if (name === 'firstPaint' || name === 'bootOk') {
      this.bootMsText = `RN ${name} ${Math.round(ms)}ms · 页打开 ${Date.now() - this.tPage}ms`;
      this.webReady = true;
      this.clearWarmTimers();
      Logger.info(TAG, `PERF ${name}=${Math.round(ms)}ms page+${Date.now() - this.tPage}ms warm=${this.usingWarmController}`);
    }
    if (name === 'firstProp' && this.firstPropMs < 0) {
      this.firstPropMs = ms;
      Logger.info(TAG, `PERF firstProp=${ms}ms page=${Date.now() - this.tPage}ms`);
    }
  }

  private clearWarmTimers(): void {
    if (this.warmFallbackTimer >= 0) {
      clearTimeout(this.warmFallbackTimer);
      this.warmFallbackTimer = -1;
    }
    if (this.claimPollTimer >= 0) {
      clearTimeout(this.claimPollTimer);
      this.claimPollTimer = -1;
    }
  }

  /** 认领预热 Web：warm5 关闭（skipSdk 后 __r(10001) 失败），直走冷路径 */
  private claimWarmPath(): boolean {
    return false;
  }

  private fallbackColdFromWarm(): void {
    this.clearWarmTimers();
    try {
      abandonWarm();
    } catch (_e) {
    }
    try {
      detachWarmBridge();
    } catch (_e2) {
    }
    this.usingWarmController = false;
    this.warmNodeRef = null;
    this.useWarm = false;
    this.webSurface = 2;
    this.controller = new webview.WebviewController();
    this.hostLoaded = false;
    this.hostPageLoaded = false;
    this.kicked = false;
    this.blankDone = false;
    this.pageReady = false;
    this.webReady = false;
    Logger.info(TAG, 'PERF coldFallback after warm fail');
    // 冷 Web 会在 build 里挂载；onControllerAttached 触发 loadHostPage
  }

  private pollClaimOrCold(n: number): void {
    if (this.useWarm || this.hostLoaded) {
      return;
    }
    if (this.claimWarmPath()) {
      return;
    }
    // 最多等 ~400ms 暖机就绪，否则立刻冷启动（不让用户干等）
    if (n >= 10) {
      Logger.info(TAG, `PERF warmMiss -> cold page+${Date.now() - this.tPage}ms`);
      this.webSurface = 2;
      // blankDone 等冷 Web onControllerAttached
      return;
    }
    this.claimPollTimer = setTimeout(() => {
      this.claimPollTimer = -1;
      this.pollClaimOrCold(n + 1);
    }, 40);
  }

  private async prepareAndLoad(): Promise<void> {
    const t0: number = Date.now();
    try {
      const ctx = getContext(this) as common.UIAbilityContext;
      try {
        this.win = await window.getLastWindow(ctx);
        const area: window.AvoidArea = this.win.getWindowAvoidArea(window.AvoidAreaType.TYPE_SYSTEM);
        this.statusBarVp = Math.round(px2vp(area.topRect.height) * 100) / 100;
      } catch (eW) {
        Logger.error(TAG, `avoidArea: ${eW}`);
      }
      this.hostDir = await ensureRnHostCache(ctx);
      Logger.info(TAG, `PERF cacheReady +${Date.now() - t0}ms page+${Date.now() - this.tPage}ms dir=${this.hostDir}`);
      try {
        const ui = this.getUIContext();
        ensureWarmWeb(ui, this.hostDir, this.statusBarVp);
      } catch (eW2) {
        Logger.error(TAG, `ensureWarm late: ${eW2}`);
      }
      // warm5: 不 claim，直接冷启动（避免 2.5s fallback / 8s bootFailed）
      if (this.claimWarmPath()) {
        return;
      }
      this.webSurface = 2;
    } catch (e) {
      this.statusText = `准备失败，回退 rawfile: ${e}`;
      Logger.error(TAG, `prepareAndLoad: ${e}`);
      this.hostDir = '';
      this.cacheFailed = true;
      this.webSurface = 2;
    }
  }

  private loadHostPage(): void {
    if (this.hostLoaded) {
      return;
    }
    this.hostLoaded = true;
    const tLoad: number = Date.now();
    try {
      this.controller.registerJavaScriptProxy(this.bridge, 'RNHostBridge', ['invoke']);
    } catch (e) {
      Logger.error(TAG, `registerJavaScriptProxy: ${e}`);
    }
    // 优先 filesDir 缓存（file://）；缓存失败才回退 rawfile
    const base: string = this.hostDir.length > 0 ? ('file://' + this.hostDir + '/index.html') :
      'resource://rawfile/rnhost/index.html';
    // sb = Web 顶部所在的状态栏高度（vp），供 StatusBarManager.HEIGHT / 安全区使用
    const url: string = `${base}?sb=${this.statusBarVp}`;
    try {
      this.kicked = false;
      this.controller.loadUrl(url);
      Logger.info(TAG, `PERF loadUrl +${Date.now() - tLoad}ms page+${Date.now() - this.tPage}ms`);
      // 加载态只显示 spinner，不刷状态文案
    } catch (e2) {
      Logger.error(TAG, `loadUrl: ${e2}`);
      this.statusText = `loadUrl 失败: ${e2}`;
    }
  }

  private kickBoot(): void {
    if (this.kicked || !this.hostPageLoaded || this.pluginMeta === null || this.failed) {
      return;
    }
    this.kicked = true;
    const meta: PluginMeta = this.pluginMeta;
    const pl: Record<string, Object> = {
      'base': meta.base,
      'resFilesJs': meta.resFilesJs,
      'packageName': meta.packageName,
      'entries': meta.entries,
      'pluginId': meta.pluginId,
      'packageId': meta.packageId,
      'packagePrefix': meta.packagePrefix ?? '',
      'versionName': meta.versionName,
      'apiLevel': meta.apiLevel,
      'model': meta.model,
      'skipSdk': this.usingWarmController
    };
    const dev: Record<string, Object> = {
      'did': this.did,
      'model': this.model,
      'name': this.name,
      'pid': this.pid,
      'isOnline': this.online
    };
    // JSON 直接作为 JS 字面量；转义 U+2028/2029 与 </script>
    const plJs: string = JSON.stringify(pl).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const devJs: string = JSON.stringify(dev).replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
    const pageT0: number = this.tPage;
    const js: string =
      'void (function(){' +
      'try{' +
      'window.__RNHostQuiet=true;' +
      'window.__kickFromArk=true;' +
      'window.__arkPageT0=' + String(pageT0) + ';' +
      'window.__deviceFromArk=' + devJs + ';' +
      'window.__pluginFromArk=' + plJs + ';' +
      'if(window.RNHostBridge&&window.__RNHost){window.__RNHost.installBridgeProxy(window.RNHostBridge);}' +
      "if(typeof window.startPluginHost==='function'){window.startPluginHost();}" +
      "}catch(e){console&&console.log&&console.log('kickBoot err',e);}" +
      '})();';
    try {
      this.controller.runJavaScript(js);
      Logger.info(TAG, `PERF kickBoot page+${Date.now() - this.tPage}ms warm=${this.usingWarmController}`);
    } catch (e) {
      Logger.error(TAG, `kickBoot: ${e}`);
      this.statusText = `kickBoot 失败: ${e}`;
    }
  }

  handleBridge(reqId: number, action: string, payload: Record<string, Object>): void {
    const id: number = reqId > 0 ? reqId : this.reqSeq++;
    const t0: number = Date.now();
    this.dispatchBridge(action, payload).then((result: string) => {
      if (action === 'callSmartHomeAPI' && this.firstPropMs < 0) {
        const path: string = String(payload['path'] ?? '');
        if (path.indexOf('/miotspec/prop') >= 0) {
          this.firstPropMs = Date.now() - this.tPage;
          Logger.info(TAG, `PERF firstPropResponse page+${this.firstPropMs}ms bridge+${Date.now() - t0}ms`);
        }
      }
      this.deliverResult(id, true, result);
    }).catch((e: Object) => {
      this.deliverResult(id, false, String(e));
    });
  }

  private deliverResult(id: number, ok: boolean, body: string): void {
    try {
      let escaped: string = body;
      escaped = escaped.replace(/\\/g, '\\\\');
      escaped = escaped.replace(/'/g, "\\'");
      escaped = escaped.replace(/\n/g, '\\n');
      escaped = escaped.replace(/\r/g, '');
      const flag: string = ok ? 'true' : 'false';
      const js: string =
        'void (window.__RNHost && window.__RNHost.onBridgeResult && window.__RNHost.onBridgeResult(' +
        String(id) + ', ' + flag + ", '" + escaped + "'));";
      this.controller.runJavaScript(js);
    } catch (e) {
      Logger.error(TAG, `deliverResult failed: ${e}`);
    }
  }

  /** 插件实际绑定的设备（JS 侧 HOST.device.did），入口页 did 只作兜底 */
  private targetDid(payload: Record<string, Object>): string {
    const a: Object | undefined = payload['__did'] as Object | undefined;
    if (a !== undefined && a !== null && String(a).length > 0) {
      return String(a);
    }
    const b: Object | undefined = payload['did'] as Object | undefined;
    if (b !== undefined && b !== null && String(b).length > 0) {
      return String(b);
    }
    return this.did;
  }

  private async dispatchBridge(action: string, payload: Record<string, Object>): Promise<string> {
    if (action === 'callMethod') {
      const method: string = String(payload['method'] ?? '');
      const rawParams: Object | undefined = payload['params'] as Object | undefined;
      const params: (string | number | boolean)[] = [];
      if (rawParams !== undefined && Array.isArray(rawParams)) {
        const arr: Object[] = rawParams as Object[];
        for (let i = 0; i < arr.length; i++) {
          const v: Object = arr[i];
          if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
            params.push(v as string | number | boolean);
          } else {
            params.push(JSON.stringify(v));
          }
        }
      } else if (typeof rawParams === 'string') {
        try {
          const parsed: Object = JSON.parse(rawParams) as Object;
          if (Array.isArray(parsed)) {
            const arr2: Object[] = parsed as Object[];
            for (let j = 0; j < arr2.length; j++) {
              const v2: Object = arr2[j];
              if (typeof v2 === 'string' || typeof v2 === 'number' || typeof v2 === 'boolean') {
                params.push(v2 as string | number | boolean);
              } else {
                params.push(JSON.stringify(v2));
              }
            }
          }
        } catch (_e) {
        }
      }
      const did: string = this.targetDid(payload);
      Logger.info(TAG, `bridge callMethod did=${did} ${method} params=${JSON.stringify(params)}`);
      const resp: Record<string, Object> = await MiCloud.rpcRemote(did, method, params);
      Logger.info(TAG, `bridge callMethod done code=${Number(resp['code'] ?? -1)}`);
      return JSON.stringify(resp);
    }
    if (action === 'callSmartHomeAPI') {
      const path: string = String(payload['path'] ?? '');
      Logger.info(TAG, `bridge callSmartHomeAPI ${path}`);
      if (path.indexOf('/miotspec/prop/get') >= 0) {
        return await this.handleSpecGet(payload);
      }
      if (path.indexOf('/miotspec/prop/set') >= 0) {
        return await this.handleSpecSet(payload);
      }
      // 其他米家云接口：透传（与米家 App 一致，由插件决定调用哪些接口）
      const raw: Object | undefined = payload['params'] as Object | undefined;
      const data: string = typeof raw === 'string' ? raw : JSON.stringify(raw ?? {});
      try {
        const resp: Record<string, Object> = await MiCloud.callCloudApi(path, data);
        Logger.info(TAG, `bridge callSmartHomeAPI ${path} code=${Number(resp['code'] ?? -1)}`);
        return JSON.stringify(resp);
      } catch (eApi) {
        Logger.error(TAG, `callSmartHomeAPI ${path} failed: ${eApi}`);
        const bad: Record<string, Object> = { 'code': -1, 'message': String(eApi) };
        return JSON.stringify(bad);
      }
    }
    if (action === 'getSpecProps') {
      return JSON.stringify({} as Record<string, Object>);
    }
    return JSON.stringify(null);
  }

  private async handleSpecGet(payload: Record<string, Object>): Promise<string> {
    const siids: number[] = [];
    const piids: number[] = [];
    this.parseSpecParams(payload, siids, piids, null);
    if (siids.length === 0) {
      const empty: Record<string, Object> = { 'code': 0, 'result': [] as Object };
      return JSON.stringify(empty);
    }
    // 返回米家 SDK 期望的 result 数组：[{did,siid,piid,value,code}, ...]
    const did: string = this.targetDid(payload);
    const values: Record<string, string | number | boolean> =
      await MiCloud.miotGetPropValues(did, siids, piids);
    const resultArr: Object[] = [];
    for (let i = 0; i < siids.length; i++) {
      const key: string = `${siids[i]}.${piids[i]}`;
      const item: Record<string, Object> = {
        'did': did,
        'siid': siids[i],
        'piid': piids[i],
        'code': 0
      };
      if (values[key] !== undefined) {
        item['value'] = values[key] as Object;
      } else {
        item['code'] = -1;
      }
      resultArr.push(item);
    }
    Logger.info(TAG, `handleSpecGet did=${did} n=${siids.length} keys=${Object.keys(values).join(',')}`);
    const out: Record<string, Object> = { 'code': 0, 'result': resultArr };
    return JSON.stringify(out);
  }

  private async handleSpecSet(payload: Record<string, Object>): Promise<string> {
    const siids: number[] = [];
    const piids: number[] = [];
    const values: Array<string | number | boolean> = [];
    this.parseSpecParams(payload, siids, piids, values);
    if (siids.length === 0) {
      const bad: Record<string, Object> = { 'code': -1, 'message': 'no params' };
      return JSON.stringify(bad);
    }
    const did: string = this.targetDid(payload);
    const resultArr: Object[] = [];
    for (let i = 0; i < siids.length; i++) {
      const v: string | number | boolean = i < values.length ? values[i] : 0;
      try {
        await MiCloud.miotSetProp(did, siids[i], piids[i], v);
        const okItem: Record<string, Object> = {
          'did': did,
          'siid': siids[i],
          'piid': piids[i],
          'code': 0
        };
        resultArr.push(okItem);
        Logger.info(TAG, `handleSpecSet did=${did} ${siids[i]}.${piids[i]}=${v} ok`);
      } catch (e) {
        const badItem: Record<string, Object> = {
          'did': did,
          'siid': siids[i],
          'piid': piids[i],
          'code': -1,
          'message': String(e)
        };
        resultArr.push(badItem);
        Logger.error(TAG, `handleSpecSet ${siids[i]}.${piids[i]}=${v} fail: ${e}`);
      }
    }
    const out: Record<string, Object> = { 'code': 0, 'result': resultArr };
    return JSON.stringify(out);
  }

  private parseSpecParams(
    payload: Record<string, Object>,
    siids: number[],
    piids: number[],
    values: Array<string | number | boolean> | null
  ): void {
    let dataStr: string = '';
    const raw = payload['params'];
    if (typeof raw === 'string') {
      dataStr = raw;
    } else {
      dataStr = JSON.stringify(raw ?? {});
    }
    try {
      const parsed: Record<string, Object> = JSON.parse(dataStr) as Record<string, Object>;
      const p: Object | undefined = parsed['params'] as Object | undefined;
      if (p !== undefined && Array.isArray(p)) {
        const arr: Object[] = p as Object[];
        for (let i = 0; i < arr.length; i++) {
          const item: Record<string, Object> = arr[i] as Record<string, Object>;
          siids.push(Number(item['siid'] ?? 0));
          piids.push(Number(item['piid'] ?? 0));
          if (values !== null) {
            const v: Object | undefined = item['value'] as Object | undefined;
            if (typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') {
              values.push(v as string | number | boolean);
            } else {
              values.push(0);
            }
          }
        }
        return;
      }
      const maybeArr: Object = JSON.parse(dataStr) as Object;
      if (Array.isArray(maybeArr)) {
        const arr2: Object[] = maybeArr as Object[];
        for (let j = 0; j < arr2.length; j++) {
          const item2: Record<string, Object> = arr2[j] as Record<string, Object>;
          siids.push(Number(item2['siid'] ?? 0));
          piids.push(Number(item2['piid'] ?? 0));
          if (values !== null) {
            const v2: Object | undefined = item2['value'] as Object | undefined;
            if (typeof v2 === 'boolean' || typeof v2 === 'number' || typeof v2 === 'string') {
              values.push(v2 as string | number | boolean);
            } else {
              values.push(0);
            }
          }
        }
      }
    } catch (e) {
      Logger.error(TAG, `parseSpecParams: ${e}`);
    }
  }

  build() {
    Stack({ alignContent: Alignment.Top }) {
      if (this.webSurface === 1 && this.warmNodeRef !== null) {
        NodeContainer(this.warmNodeRef)
          .width('100%')
          .height('100%')
          .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
      } else if (this.webSurface === 2) {
        // 冷启动：先 about:blank，再 loadUrl(file://…)
        Web({ src: 'about:blank', controller: this.controller })
          .width('100%')
          .height('100%')
          .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
          .javaScriptAccess(true)
          .domStorageAccess(true)
          .fileAccess(true)
          .onControllerAttached(() => {
            this.pageReady = true;
            Logger.info(TAG, `PERF onControllerAttached page+${Date.now() - this.tPage}ms`);
            setTimeout(() => {
              if (!this.blankDone) {
                this.blankDone = true;
                if (this.hostDir.length > 0 || this.cacheFailed) {
                  this.loadHostPage();
                }
              }
            }, 60);
            try {
              webview.WebviewController.setWebDebuggingAccess(true);
            } catch (_e) {
            }
          })
          .onPageBegin((event) => {
            const url: string = event && event.url ? event.url : '';
            Logger.info(TAG, `PERF onPageBegin page+${Date.now() - this.tPage}ms ${url}`);
          })
          .onPageEnd((event) => {
            const url: string = event && event.url ? event.url : '';
            Logger.info(TAG, `PERF onPageEnd page+${Date.now() - this.tPage}ms ${url}`);
            if (!this.blankDone && (url.length === 0 || url.indexOf('about:blank') === 0)) {
              this.blankDone = true;
              if (this.hostDir.length > 0 || this.cacheFailed) {
                this.loadHostPage();
              }
              return;
            }
            const isFileHost: boolean = url.indexOf('rnhost_web') >= 0 || url.indexOf('file://') >= 0 ||
              url.indexOf('rnhost/index.html') >= 0 || url.indexOf('rnhost.local') >= 0;
            if (isFileHost) {
              this.hostPageLoaded = true;
              setTimeout(() => {
                this.kickBoot();
              }, 0);
            }
          })
          .onErrorReceive((event) => {
            let url: string = '';
            let main: boolean = false;
            let info: string = '';
            try {
              if (event && event.request) {
                url = event.request.getRequestUrl();
                main = event.request.isMainFrame();
              }
              if (event && event.error) {
                info = String(event.error.getErrorCode()) + ' ' + String(event.error.getErrorInfo());
              }
            } catch (e) {
              info = String(e);
            }
            Logger.error(TAG, `onErrorReceive main=${main} url=${url} err=${info}`);
            if (main) {
              this.statusText = `Web主框错误: ${url.length > 0 ? url : info}`;
              this.failed = true;
            }
          })
          .onHttpErrorReceive((event) => {
            let url: string = '';
            let main: boolean = false;
            try {
              if (event && event.request) {
                url = event.request.getRequestUrl();
                main = event.request.isMainFrame();
              }
            } catch (_e) {
            }
            Logger.error(TAG, `onHttpErrorReceive main=${main} url=${url}`);
            if (main) {
              this.statusText = `Web HTTP错误: ${url}`;
              this.failed = true;
            }
          })
          .onConsole((event) => {
            try {
              const msg = event.message.getMessage();
              if (msg.indexOf('PERF') >= 0 || msg.indexOf('boot') >= 0 || msg.indexOf('FAIL') >= 0 ||
                msg.indexOf('FAILED') >= 0 || msg.indexOf('MIOTRPC') >= 0 || msg.indexOf('callMethod') >= 0 ||
                msg.indexOf('callSmartHome') >= 0 || msg.indexOf('bridge') >= 0 || msg.indexOf('cloud') >= 0 ||
                msg.indexOf('WARM') >= 0 || msg.indexOf('skipSdk') >= 0) {
                Logger.info(TAG, 'console ' + msg);
              }
            } catch (_e) {
            }
            return false;
          })
      }

      // 加载遮罩：米家风格居中 Loading，保留原生头设备名；首帧后隐藏
      if (!this.webReady) {
        Column() {
          Row() {
            Text('←')
              .fontSize(22)
              .fontColor('#222222')
              .padding({ left: 4, right: 12, top: 4, bottom: 4 })
              .onClick(() => {
                router.back();
              })
            Text(this.deviceTitle.length > 0 ? this.deviceTitle : '米家插件')
              .fontSize(17)
              .fontWeight(FontWeight.Medium)
              .fontColor('#222222')
              .layoutWeight(1)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
          .width('100%')
          .padding({ left: 12, right: 16, top: 10, bottom: 10 })

          Column() {
            if (this.failed) {
              Text(this.statusText)
                .fontSize(14)
                .fontColor('#D32F2F')
                .textAlign(TextAlign.Center)
                .padding({ left: 24, right: 24 })
              Row() {
                if (!this.unavailable) {
                  Button('重试')
                    .fontSize(14)
                    .height(36)
                    .margin({ right: 12 })
                    .onClick(() => {
                      this.retry();
                    })
                }
                Button('使用原生控制页')
                  .fontSize(14)
                  .height(36)
                  .backgroundColor('#33A0FF')
                  .fontColor('#FFFFFF')
                  .onClick(() => {
                    this.openNative();
                  })
              }
              .margin({ top: 20 })
            } else {
              Stack({ alignContent: Alignment.Center }) {
                if (this.progressPct >= 0) {
                  Progress({ value: this.progressPct, total: 100, type: ProgressType.Ring })
                    .width(56)
                    .height(56)
                    .color('#33A0FF')
                }
                LoadingProgress()
                  .width(36)
                  .height(36)
                  .color('#33A0FF')
              }
              .width(56)
              .height(56)
            }
          }
          .layoutWeight(1)
          .width('100%')
          .justifyContent(FlexAlign.Center)
          .alignItems(HorizontalAlign.Center)
        }
        .width('100%')
        .height('100%')
        .backgroundColor(this.failed ? '#F7F7F7' : '#F5F5F5')
        .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#F5F5F5')
  }
}
