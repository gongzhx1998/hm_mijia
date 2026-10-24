/**
 * Load sdk.bundle + main.bundle then AppRegistry.runApplication.
 * ArkWeb blocks XHR on file:// — use classic <script src> instead.
 * Expects host.js already evaluated. Bundles should be pre-patched
 * (sdk MIOT_SDK_LOADER stripped; plugin trailing __r stripped; keyMirror hardened).
 *
 * IMPORTANT: InitializeCore replaces global setTimeout with RN JSTimers
 * (bridge-backed). Capture host timers BEFORE loading sdk for boot sequencing.
 */
(function (global) {
  'use strict';
  var HOST = global.__RNHost;
  var log = global.__RNHostLog || function () {};
  var mark = function (n) { return (HOST && HOST.mark) ? HOST.mark(n) : (log('PERF', n), 0); };

  // Capture before Metro / InitializeCore patches timers & Promise (warm reuse needs these)
  var HostPromise = global.Promise;
  var hostSetTimeout = global.setTimeout;
  var hostClearTimeout = global.clearTimeout;
  try {
    if (HOST && HOST.nativeTimers) {
      hostSetTimeout = HOST.nativeTimers.setTimeout;
      hostClearTimeout = HOST.nativeTimers.clearTimeout;
    }
  } catch (_nt) {}
  var nodeRequire = typeof global.require === 'function' ? global.require : null;
  try {
    if (!nodeRequire && typeof require === 'function') nodeRequire = require;
  } catch (_e) {}

  function startBridgePump() {
    // RN Promise/JSTimers 依赖 MessageQueue；暖机 skipSdk 后必须用原生 timer 泵队列
    try {
      if (HOST && HOST._pumpId != null) return;
      var nt = HOST && HOST.nativeTimers;
      var st = (nt && nt.setTimeout) || hostSetTimeout;
      var si = (nt && nt.setInterval) || global.setInterval;
      HOST._pumpId = si.call(global, function () {
        try { HOST.pollQueue(); } catch (_p) {}
      }, 8);
    } catch (_e2) {}
  }
  function stopBridgePump() {
    try {
      if (HOST && HOST._pumpId != null) {
        var nt = HOST.nativeTimers;
        var ci = (nt && nt.clearInterval) || global.clearInterval;
        ci.call(global, HOST._pumpId);
        HOST._pumpId = null;
      }
    } catch (_e3) {}
  }

  function ensureGlobals() {
    try {
      if (typeof global.global === 'undefined') global.global = global;
      if (typeof global.globalThis === 'undefined') global.globalThis = global;
      if (typeof global.window === 'undefined') global.window = global;
      if (typeof global.self === 'undefined') global.self = global;
      if (!global.process) global.process = { env: { NODE_ENV: 'production' } };
      if (!global.process.env) global.process.env = { NODE_ENV: 'production' };
      if (!global.process.env.NODE_ENV) global.process.env.NODE_ENV = 'production';
    } catch (e) {
      log('ensureGlobals err', String(e));
    }
  }

  function delay(ms) {
    return new HostPromise(function (resolve) {
      hostSetTimeout(resolve, ms);
    });
  }

  function absolutize(src) {
    if (!src) return src;
    if (/^(https?:|file:|data:)/i.test(src)) return src;
    try {
      if (typeof location !== 'undefined' && location.href && location.protocol !== 'about:') {
        return new URL(src, location.href).href;
      }
    } catch (_e) {}
    return src;
  }

  function loadClassicScript(src) {
    return new HostPromise(function (resolve, reject) {
      src = absolutize(src);
      var canDom = typeof document !== 'undefined' && document.createElement && !global.__RNHostForceVmEval;
      if (!canDom) {
        try {
          if (!nodeRequire) throw new Error('no require for vm-eval');
          var fs = nodeRequire('fs');
          var code = fs.readFileSync(src, 'utf8');
          log('vm-eval', src, 'bytes', code.length);
          // eslint-disable-next-line no-eval
          (0, eval)(code + '\n//# sourceURL=' + src);
          resolve();
        } catch (e) {
          reject(e);
        }
        return;
      }
      var done = false;
      var timer = hostSetTimeout(function () {
        if (done) return;
        done = true;
        log('script TIMEOUT', src);
        reject(new Error('script timeout ' + src));
      }, 8000);
      function fin(err) {
        if (done) return;
        done = true;
        try { hostClearTimeout(timer); } catch (_c) {}
        if (err) reject(err); else resolve();
      }
      log('script insert', src);
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () {
        log('script onload', src);
        fin(null);
      };
      s.onerror = function () {
        log('script onerror', src);
        fin(new Error('script onerror ' + src));
      };
      (document.head || document.documentElement || document.body).appendChild(s);
    });
  }

  function requireAppRegistry() {
    var mod = null;
    var run = null;
    try {
      mod = global.__r(10822);
      run = mod && (mod.runApplication || (mod.default && mod.default.runApplication));
    } catch (e) {
      log('AppRegistry require failed', String(e && e.message || e));
    }
    if (!run) throw new Error('AppRegistry.runApplication not found');
    try {
      if (mod.getAppKeys) log('appKeys', JSON.stringify(mod.getAppKeys()));
    } catch (e2) {}
    return { mod: mod, run: run };
  }

  function runApplication(packageName, rootTag) {
    var ar = requireAppRegistry();
    // 不同插件注册的 appKey 不一定等于 project.json 的 package_path：未注册时取第一个已注册的 key
    try {
      var keys = ar.mod.getAppKeys ? ar.mod.getAppKeys() : null;
      if (keys && keys.length && keys.indexOf(packageName) < 0) {
        var alt = keys.filter(function (k) { return k !== 'sdk'; });
        if (alt.length) {
          log('appKey', packageName, 'not registered, using', alt[0]);
          packageName = alt[0];
        }
      }
      var real = keys ? keys.filter(function (k) { return k !== 'sdk'; }) : [];
      if (keys && real.length === 0) {
        throw new Error('插件入口执行出错（未注册任何界面）：' + (HOST.firstFatal || ('no AppRegistry key for ' + packageName)));
      }
    } catch (_k) {
      if (_k && /插件入口执行出错/.test(String(_k.message))) throw _k;
    }
    log('runApplication', packageName, 'rootTag', rootTag);
    try {
      ar.run.call(ar.mod, packageName, { rootTag: rootTag, initialProps: {} });
    } catch (e3) {
      log('runApplication threw', String(e3 && e3.message || e3));
      throw e3;
    }
    HOST.pollQueue();
  }

  /** 入口校正：入口 id 不在插件定义的模块里时，按 "前缀-id" / 以 "-id" 结尾 / 插件最后一个 *10001 模块 依次匹配 */
  function resolveEntries(entries, ids, prefix) {
    if (!ids || !ids.length) return entries;
    var set = {};
    for (var i = 0; i < ids.length; i++) set[String(ids[i])] = ids[i];
    var out = [];
    for (var j = 0; j < entries.length; j++) {
      var e = entries[j];
      var k = String(e);
      var hit;
      if (Object.prototype.hasOwnProperty.call(set, k)) hit = set[k];
      else if (prefix && Object.prototype.hasOwnProperty.call(set, prefix + '-' + k)) hit = set[prefix + '-' + k];
      else {
        for (var n = ids.length - 1; n >= 0; n--) {
          if (typeof ids[n] === 'string' && ids[n].slice(-(k.length + 1)) === '-' + k) { hit = ids[n]; break; }
        }
      }
      if (hit === undefined) {
        log('entry', k, 'not defined by plugin bundle (' + ids.length + ' modules), first id', String(ids[0]));
        hit = e;
      } else if (String(hit) !== k) {
        log('entry', k, 'resolved to', String(hit));
      }
      out.push(hit);
    }
    return out;
  }

  HOST.loadAndRun = function (options) {
    options = options || {};
    var sdkUrl = options.sdkUrl || 'sdk/sdk.bundle';
    var pluginUrl = options.pluginUrl || 'plugin/main.bundle';
    var rootTag = options.rootTag || 11;
    var packageName = options.packageName || HOST.packageName || 'miot.plugin.prototype';
    // 插件入口模块（来自 bundle 尾部 __r(...)，已剔除 InitializeCore 10120）；数字或 "pkg-10001" 字符串
    var entries = (options.entries && options.entries.length) ? options.entries : [10001];
    var pluginIds = [];
    ensureGlobals();
    HOST.boot({ device: options.device, packageName: packageName, plugin: options.plugin });
    HOST._t0 = 0; // 每次真正启动插件重新计时（暖机阶段的 mark 不计入）
    mark('loadAndRunStart');
    log('loadAndRun via <script src>', sdkUrl, pluginUrl);

    function runSdkInit() {
      if (typeof global.__r !== 'function') {
        throw new Error('global.__r missing after sdk.bundle');
      }
      mark('sdkScriptLoaded');
      log('sdk loaded, calling InitializeCore __r(10120)');
      try {
        global.__r(10120);
        log('InitializeCore ok');
        mark('initializeCore');
        if (options.sdkLoader !== false) {
          try {
            global.__r(10290);
            mark('sdkLoader');
          } catch (eL) {
            log('sdk loader __r(10290) err', String(eL && eL.stack || eL));
          }
        }
        global.__sdkWarmed = true;
      } catch (e) {
        log('InitializeCore err', String(e && e.stack || e));
        throw e;
      }
    }

    function loadPlugin() {
      var origD = global.__d;
      if (typeof origD === 'function') {
        global.__d = function (factory, id) {
          if (id !== undefined) pluginIds.push(id);
          return origD.apply(this, arguments);
        };
      }
      return loadClassicScript(pluginUrl).then(function () {
        if (origD) global.__d = origD;
      }, function (eS) {
        if (origD) global.__d = origD;
        throw eS;
      });
    }

    function waitMicrotasks(ms) {
      // 原生 timer + 泵 RN MessageQueue，避免 HostPromise 抢先结束而 AppRegistry 尚未 register
      return new HostPromise(function (resolve) {
        var done = false;
        function fin() { if (!done) { done = true; resolve(); } }
        var n = 0;
        (function tick() {
          try { for (var i = 0; i < 16; i++) HOST.pollQueue(); } catch (_p) {}
          try {
            HostPromise.resolve().then(function () { HostPromise.resolve().then(function () {}); });
          } catch (_e) {}
          if (++n > ((ms || 16) / 4)) { fin(); return; }
          hostSetTimeout(tick, 4);
        })();
        hostSetTimeout(fin, ms || 16);
      });
    }

    function waitForAppRegistered(packageName, maxMs) {
      return new HostPromise(function (resolve) {
        var t0 = Date.now();
        (function tick() {
          try { for (var i = 0; i < 24; i++) HOST.pollQueue(); } catch (_p) {}
          try {
            var ar = requireAppRegistry();
            var keys = ar.mod.getAppKeys ? ar.mod.getAppKeys() : [];
            var real = (keys || []).filter(function (k) { return k !== 'sdk'; });
            if (real.length > 0) {
              log('appKeys ready', JSON.stringify(real));
              resolve(real);
              return;
            }
          } catch (_e) {}
          if (Date.now() - t0 >= (maxMs || 250)) {
            log('appKeys timeout', packageName);
            resolve([]);
            return;
          }
          hostSetTimeout(tick, 8);
        })();
      });
    }

    function waitForFirstPaint() {
      return new HostPromise(function (resolve) {
        var root = typeof document !== 'undefined' ? document.getElementById('rn-root') : null;
        var done = false;
        function finish(why) {
          if (done) return;
          done = true;
          log('firstPaint detect', why);
          resolve();
        }
        function hasRn() {
          try {
            if (!root) return false;
            if (root.querySelector('[data-rn]')) return true;
            if (root.querySelector('[data-tag]')) return true;
            // 任意非占位子节点
            for (var i = 0; i < root.children.length; i++) {
              if (root.children[i].id !== 'rn-placeholder') return true;
            }
          } catch (_e) {}
          return false;
        }
        if (hasRn()) { finish('sync'); return; }
        var obs = null;
        try {
          if (root && typeof MutationObserver === 'function') {
            obs = new MutationObserver(function () {
              if (hasRn()) {
                if (obs) obs.disconnect();
                // 双 rAF：等布局/绘制一帧
                var raf = HOST.nativeRaf || (typeof requestAnimationFrame === 'function' ? requestAnimationFrame : null);
                if (raf) {
                  raf.call(global, function () { raf.call(global, function () { finish('mutation'); }); });
                } else {
                  hostSetTimeout(function () { finish('mutation'); }, 16);
                }
              }
            });
            obs.observe(root, { childList: true, subtree: true });
          }
        } catch (_e2) {}
        // 已有视图时立刻结束；否则最多等 280ms（不再固定 400ms）
        var n = 0;
        (function tick() {
          for (var i = 0; i < 8; i++) HOST.pollQueue();
          if (hasRn()) { if (obs) try { obs.disconnect(); } catch (_e3) {} finish('poll'); return; }
          if (++n > 35) { if (obs) try { obs.disconnect(); } catch (_e4) {} finish('timeout'); return; }
          hostSetTimeout(tick, 8);
        })();
      });
    }

    var chain;
    if (options.skipSdk || global.__sdkWarmed) {
      mark('sdkSkipped');
      log('skipSdk, __sdkWarmed=', !!global.__sdkWarmed);
      startBridgePump();
      chain = HostPromise.resolve();
    } else {
      chain = loadClassicScript(sdkUrl).then(function () {
        runSdkInit();
        startBridgePump();
      });
    }

    return chain
      .then(function () { return loadPlugin(); })
      .then(function () {
        mark('pluginScriptLoaded');
        entries = resolveEntries(entries, pluginIds, options.plugin && options.plugin.packagePrefix);
        HOST.firstFatal = null;
        log('plugin loaded, calling entries', JSON.stringify(entries));
        try {
          for (var ei = 0; ei < entries.length; ei++) global.__r(entries[ei]);
          if (HOST.firstFatal) log('plugin entry reported error', HOST.firstFatal);
          else log('plugin entries ok');
          mark('pluginEntry');
        } catch (e) {
          log('plugin entry err', String(e && e.stack || e));
          throw e;
        }
        return waitMicrotasks(32).then(function () {
          return waitForAppRegistered(packageName, 280);
        });
      })
      .then(function () {
        mark('beforeRunApplication');
        log('before runApplication');
        runApplication(packageName, rootTag);
        log('after runApplication, waiting paint');
        mark('runApplication');
        for (var i = 0; i < 24; i++) HOST.pollQueue();
        return waitForFirstPaint();
      })
      .then(function () {
        for (var i = 0; i < 12; i++) HOST.pollQueue();
        var snap = HOST.snapshotViews();
        log('view count', snap.length);
        mark('firstPaint');
        mark('bootOk');
        stopBridgePump();
        if (typeof HOST.onViewTree === 'function') HOST.onViewTree(snap);
        return snap;
      });
  };

  /** 暖机：只加载并初始化 SDK，供离线 Web 预热 */
  HOST.warmSdk = function (sdkUrl) {
    ensureGlobals();
    mark('warmSdkStart');
    return loadClassicScript(sdkUrl || 'sdk/sdk.bundle').then(function () {
      if (typeof global.__r !== 'function') throw new Error('no __r after sdk');
      mark('sdkScriptLoaded');
      global.__r(10120);
      mark('initializeCore');
      try { global.__r(10290); mark('sdkLoader'); } catch (eL) { log('warm sdkLoader', String(eL)); }
      global.__sdkWarmed = true;
      mark('sdkWarmReady');
      log('warmSdk done');
      return true;
    });
  };
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : this);
