import { UIContext, NodeController, BuilderNode, FrameNode, Size } from '@kit.ArkUI';
import { webview } from '@kit.ArkWeb';
import { hilog } from '@kit.PerformanceAnalysisKit';
import { fileIo as fs } from '@kit.CoreFileKit';

const DOMAIN: number = 0x0D02;
const TAG: string = 'RnWebPool';
export const RNHOST_ORIGIN: string = 'https://rnhost.local';

/** 暖机 JSBridge 中枢：创建时即 register，PluginHost claim 时挂 handler */
class WarmBridgeHub {
  handler: ((json: string) => string) | null = null;

  invoke(requestJson: string): string {
    if (this.handler !== null) {
      return this.handler(requestJson);
    }
    try {
      const obj: Record<string, Object> = JSON.parse(requestJson) as Record<string, Object>;
      const action: string = String(obj['action'] ?? '');
      if (action === 'warmReady') {
        markSdkReady('bridge');
      }
      if (action === 'perfMark') {
        const payload: Record<string, Object> = obj['payload'] as Record<string, Object>;
        const name: string = String(payload['name'] ?? '');
        const ms: number = Number(payload['ms'] ?? 0);
        hilog.info(DOMAIN, TAG, 'PERF warm js %{public}s=%{public}dms', name, ms);
      }
    } catch (_e) {
    }
    return JSON.stringify({ 'ok': true, 'pending': false } as Record<string, Object>);
  }
}

const warmHub: WarmBridgeHub = new WarmBridgeHub();

class WarmData {
  controller: webview.WebviewController = new webview.WebviewController();
}

function mimeFor(path: string): string {
  if (path.endsWith('.html')) {
    return 'text/html';
  }
  if (path.endsWith('.js') || path.endsWith('.bundle')) {
    return 'application/javascript';
  }
  if (path.endsWith('.json')) {
    return 'application/json';
  }
  if (path.endsWith('.css')) {
    return 'text/css';
  }
  if (path.endsWith('.png')) {
    return 'image/png';
  }
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (path.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  return 'application/octet-stream';
}

function readFileBytes(path: string): Uint8Array {
  try {
    const f = fs.openSync(path, fs.OpenMode.READ_ONLY);
    const st = fs.statSync(path);
    const len: number = Number(st.size);
    const buf: ArrayBuffer = new ArrayBuffer(len);
    fs.readSync(f.fd, buf);
    fs.closeSync(f);
    return new Uint8Array(buf);
  } catch (_e) {
    return new Uint8Array(0);
  }
}

/** path relative to hostDir, no leading slash; may include plugins/... */
function interceptLocal(url: string): WebResourceResponse | null {
  const prefix: string = RNHOST_ORIGIN + '/';
  if (url.indexOf(prefix) !== 0) {
    return null;
  }
  let rel: string = url.substring(prefix.length);
  const q: number = rel.indexOf('?');
  if (q >= 0) {
    rel = rel.substring(0, q);
  }
  if (rel.length === 0 || rel.indexOf('..') >= 0) {
    return null;
  }
  if (warmHostDir.length === 0) {
    return null;
  }
  const path: string = warmHostDir + '/' + rel;
  const bytes: Uint8Array = readFileBytes(path);
  const resp: WebResourceResponse = new WebResourceResponse();
  if (bytes.byteLength === 0) {
    hilog.error(DOMAIN, TAG, 'intercept 404 %{public}s', rel);
    resp.setResponseData('');
    resp.setResponseMimeType('text/plain');
    resp.setResponseCode(404);
    resp.setReasonMessage('Not Found');
    resp.setResponseIsReady(true);
    return resp;
  }
  const ab: ArrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  resp.setResponseData(ab);
  resp.setResponseEncoding('utf-8');
  resp.setResponseMimeType(mimeFor(rel));
  resp.setResponseCode(200);
  resp.setReasonMessage('OK');
  resp.setResponseHeader([
    { headerKey: 'Cache-Control', headerValue: 'max-age=86400' },
    { headerKey: 'Access-Control-Allow-Origin', headerValue: '*' }
  ]);
  resp.setResponseIsReady(true);
  return resp;
}

@Builder
function warmWebBuilder(data: WarmData) {
  Web({ src: 'about:blank', controller: data.controller })
    .width('100%')
    .height('100%')
    .javaScriptAccess(true)
    .domStorageAccess(true)
    .fileAccess(true)
    .onlineImageAccess(true)
    .expandSafeArea([SafeAreaType.SYSTEM], [SafeAreaEdge.TOP])
    .onControllerAttached(() => {
      try {
        webview.WebviewController.setWebDebuggingAccess(true);
      } catch (_e) {
      }
      try {
        data.controller.registerJavaScriptProxy(warmHub, 'RNHostBridge', ['invoke']);
      } catch (e) {
        hilog.error(DOMAIN, TAG, 'warm registerProxy %{public}s', String(e));
      }
      hilog.info(DOMAIN, TAG, 'warm onControllerAttached');
      // 先 Active，再延迟加载暖机页（避免 about:blank 冲掉导航）
      try {
        data.controller.onActive();
      } catch (_eA) {
      }
      setTimeout(() => {
        if (warmUrl.length > 0) {
          try {
            hilog.info(DOMAIN, TAG, 'warm loadUrl %{public}s', warmUrl);
            data.controller.loadUrl(warmUrl);
          } catch (e2) {
            hilog.error(DOMAIN, TAG, 'warm loadUrl %{public}s', String(e2));
          }
        }
      }, 40);
    })
    .onInterceptRequest((event) => {
      try {
        const reqUrl: string = event.request.getRequestUrl();
        return interceptLocal(reqUrl);
      } catch (e) {
        hilog.error(DOMAIN, TAG, 'intercept err %{public}s', String(e));
        return null;
      }
    })
    .onPageEnd((event) => {
      const url: string = event && event.url ? event.url : '';
      hilog.info(DOMAIN, TAG, 'warm onPageEnd %{public}s', url);
      if (url.indexOf('warm=1') >= 0 || url.indexOf('rnhost.local/index.html') >= 0) {
        try {
          data.controller.onActive();
        } catch (_e2) {
        }
        pollWarmReady(data.controller, 0);
      }
    })
    .onErrorReceive((event) => {
      let info: string = '';
      try {
        if (event && event.error) {
          info = String(event.error.getErrorCode()) + ' ' + String(event.error.getErrorInfo());
        }
        if (event && event.request) {
          info = info + ' url=' + event.request.getRequestUrl();
        }
      } catch (_e3) {
      }
      hilog.error(DOMAIN, TAG, 'warm onError %{public}s', info);
    })
    .onConsole((event) => {
      try {
        const msg: string = event.message.getMessage();
        if (msg.indexOf('PERF') >= 0 || msg.indexOf('WARM') >= 0 || msg.indexOf('boot') >= 0 ||
          msg.indexOf('FAIL') >= 0 || msg.indexOf('script') >= 0 || msg.indexOf('skipSdk') >= 0) {
          hilog.info(DOMAIN, TAG, 'console %{public}s', msg.slice(0, 300));
        }
      } catch (_e) {
      }
      return false;
    })
}

const warmWrap = wrapBuilder<WarmData[]>(warmWebBuilder);

export class WarmNodeController extends NodeController {
  rootNode: BuilderNode<WarmData[]> | null = null;
  private bound: boolean = false;

  makeNode(_uiContext: UIContext): FrameNode | null {
    if (this.rootNode !== null) {
      return this.rootNode.getFrameNode();
    }
    return null;
  }

  aboutToAppear(): void {
    this.bound = true;
    claimed = true;
    hilog.info(DOMAIN, TAG, 'warm NodeContainer appear (claimed)');
    try {
      if (warmController !== null) {
        warmController.onActive();
      }
    } catch (_e) {
    }
  }

  aboutToDisappear(): void {
    this.bound = false;
    claimed = false;
    hilog.info(DOMAIN, TAG, 'warm NodeContainer disappear');
    warmHub.handler = null;
    // 仅在未被 abandon 时重暖（abandon 会自己 schedule）
    if (!abandoned) {
      scheduleRewarm();
    }
  }

  aboutToResize(size: Size): void {
    hilog.info(DOMAIN, TAG, 'warm resize %{public}s x %{public}s', String(size.width), String(size.height));
  }

  isBound(): boolean {
    return this.bound;
  }

  initWeb(uiContext: UIContext, control: webview.WebviewController): void {
    if (this.rootNode !== null) {
      return;
    }
    this.rootNode = new BuilderNode(uiContext);
    const data: WarmData = new WarmData();
    data.controller = control;
    this.rootNode.build(warmWrap, data);
  }
}

let warmNode: WarmNodeController | null = null;
let warmController: webview.WebviewController | null = null;
let warmUrl: string = '';
let warmHostDir: string = '';
let sdkReady: boolean = false;
let warmUiContext: UIContext | null = null;
let rewarmTimer: number = -1;
let creating: boolean = false;
let claimed: boolean = false;
let abandoned: boolean = false;
let statusBarVpCached: number = 0;

function markSdkReady(via: string): void {
  if (sdkReady) {
    return;
  }
  sdkReady = true;
  hilog.info(DOMAIN, TAG, 'PERF warmSdkReady via=%{public}s', via);
  // 保持 Active：offscreen Inactive 会导致 setTimeout/script.onload 挂死，claim 后注入 main.bundle 永远不 onload
  try {
    if (warmController !== null) {
      warmController.onActive();
    }
  } catch (_e) {
  }
}

function pollWarmReady(ctrl: webview.WebviewController, n: number): void {
  if (n > 120) {
    hilog.error(DOMAIN, TAG, 'warm sdk ready timeout');
    return;
  }
  if (sdkReady) {
    return;
  }
  ctrl.runJavaScript('window.__sdkWarmed===true?"1":"0"').then((result: string) => {
    if (result === '"1"' || result === '1') {
      markSdkReady('poll');
      return;
    }
    setTimeout(() => {
      pollWarmReady(ctrl, n + 1);
    }, 40);
  }).catch((_e2: Object) => {
    setTimeout(() => {
      pollWarmReady(ctrl, n + 1);
    }, 80);
  });
}

function scheduleRewarm(): void {
  sdkReady = false;
  warmHub.handler = null;
  if (rewarmTimer >= 0) {
    clearTimeout(rewarmTimer);
  }
  rewarmTimer = setTimeout(() => {
    rewarmTimer = -1;
    reloadWarm();
  }, 120);
}

function reloadWarm(): void {
  if (warmController === null || warmUrl.length === 0) {
    return;
  }
  if (warmNode !== null && warmNode.isBound()) {
    hilog.info(DOMAIN, TAG, 'skip rewarm: still bound');
    return;
  }
  abandoned = false;
  claimed = false;
  sdkReady = false;
  try {
    warmController.onActive();
  } catch (_e) {
  }
  try {
    // 重新 register proxy（部分机型 reattach 后 proxy 丢失）
    try {
      warmController.registerJavaScriptProxy(warmHub, 'RNHostBridge', ['invoke']);
    } catch (_eP) {
    }
    warmController.loadUrl(warmUrl);
    hilog.info(DOMAIN, TAG, 'PERF rewarm loadUrl');
  } catch (e) {
    hilog.error(DOMAIN, TAG, 'rewarm %{public}s', String(e));
  }
}

async function precompileBundles(ctrl: webview.WebviewController, hostDir: string): Promise<void> {
  const pairs: string[][] = [
    [hostDir + '/sdk/sdk.bundle', RNHOST_ORIGIN + '/sdk/sdk.bundle'],
    [hostDir + '/rnhost/host.js', RNHOST_ORIGIN + '/rnhost/host.js'],
    [hostDir + '/rnhost/boot.js', RNHOST_ORIGIN + '/rnhost/boot.js']
  ];
  for (let i = 0; i < pairs.length; i++) {
    const path: string = pairs[i][0];
    const url: string = pairs[i][1];
    const bytes: Uint8Array = readFileBytes(path);
    if (bytes.byteLength < 32) {
      continue;
    }
    const opts: webview.CacheOptions = {
      responseHeaders: [
        { headerKey: 'E-Tag', headerValue: 'rnhost-' + String(bytes.byteLength) },
        { headerKey: 'Last-Modified', headerValue: 'Sat, 24 Oct 2026 00:00:00 GMT' }
      ]
    };
    try {
      const code: number = await ctrl.precompileJavaScript(url, bytes, opts);
      hilog.info(DOMAIN, TAG, 'PERF precompile %{public}s code=%{public}d bytes=%{public}d', url, code,
        bytes.byteLength);
    } catch (e) {
      hilog.error(DOMAIN, TAG, 'precompile %{public}s %{public}s', url, String(e));
    }
  }
}

/**
 * 创建离线暖机 Web：https://rnhost.local/index.html?warm=1，拦截本地文件并执行 sdk。
 */
export function ensureWarmWeb(uiContext: UIContext, hostDir: string, statusBarVp: number): void {
  warmUiContext = uiContext;
  warmHostDir = hostDir;
  statusBarVpCached = statusBarVp;
  const url: string = RNHOST_ORIGIN + '/index.html?warm=1&sb=' + String(statusBarVp);
  if (warmNode !== null && warmController !== null && warmUrl === url) {
    hilog.info(DOMAIN, TAG, 'warm exists ready=%{public}s', String(sdkReady));
    return;
  }
  if (creating) {
    return;
  }
  creating = true;
  warmUrl = url;
  sdkReady = false;
  abandoned = false;
  const ctrl: webview.WebviewController = new webview.WebviewController();
  const node: WarmNodeController = new WarmNodeController();
  try {
    node.initWeb(uiContext, ctrl);
    warmNode = node;
    warmController = ctrl;
    hilog.info(DOMAIN, TAG, 'PERF warmCreated %{public}s', url);
    setTimeout(() => {
      precompileBundles(ctrl, hostDir).catch((e: Object) => {
        hilog.error(DOMAIN, TAG, 'precompileBundles %{public}s', String(e));
      });
    }, 400);
  } catch (e) {
    hilog.error(DOMAIN, TAG, 'ensureWarmWeb %{public}s', String(e));
    warmNode = null;
    warmController = null;
  } finally {
    creating = false;
  }
}

export function isWarmSdkReady(): boolean {
  return sdkReady && warmNode !== null && warmController !== null && !claimed;
}

export function getWarmNode(): WarmNodeController | null {
  return warmNode;
}

export function getWarmController(): webview.WebviewController | null {
  return warmController;
}

export function getWarmHostDir(): string {
  return warmHostDir;
}

export function attachWarmBridge(handler: (json: string) => string): void {
  warmHub.handler = handler;
  abandoned = false;
  try {
    if (warmController !== null) {
      warmController.onActive();
    }
  } catch (_e) {
  }
}

export function detachWarmBridge(): void {
  warmHub.handler = null;
}

/** PluginHost 超时/失败时放弃暖机，后台重暖；页面改走冷路径 */
export function abandonWarm(): void {
  hilog.info(DOMAIN, TAG, 'PERF abandonWarm');
  abandoned = true;
  claimed = false;
  sdkReady = false;
  warmHub.handler = null;
  scheduleRewarm();
}

export function releaseWarmForReuse(): void {
  scheduleRewarm();
}

export function activateWarm(): void {
  try {
    if (warmController !== null) {
      warmController.onActive();
    }
  } catch (_e) {
  }
}
