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

  // Capture before Metro / InitializeCore patches timers & require
  var hostSetTimeout = global.setTimeout;
  var hostClearTimeout = global.clearTimeout;
  var nodeRequire = typeof global.require === 'function' ? global.require : null;
  try {
    if (!nodeRequire && typeof require === 'function') nodeRequire = require;
  } catch (_e) {}

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
    return new Promise(function (resolve) {
      hostSetTimeout(resolve, ms);
    });
  }

  function loadClassicScript(src) {
    return new Promise(function (resolve, reject) {
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
      log('script insert', src);
      var s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.onload = function () {
        log('script onload', src);
        resolve();
      };
      s.onerror = function () {
        log('script onerror', src);
        reject(new Error('script onerror ' + src));
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
      if (keys && real.length === 0 && HOST.firstFatal) {
        throw new Error('插件入口执行出错（未注册任何界面）：' + HOST.firstFatal);
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
    mark('loadAndRunStart');
    log('loadAndRun via <script src>', sdkUrl, pluginUrl);

    return loadClassicScript(sdkUrl)
      .then(function () {
        if (typeof global.__r !== 'function') {
          throw new Error('global.__r missing after sdk.bundle');
        }
        mark('sdkScriptLoaded');
        log('sdk loaded, calling InitializeCore __r(10120)');
        try {
          global.__r(10120);
          log('InitializeCore ok');
          mark('initializeCore');
          // 与米家一致：sdk.bundle 尾部的 /**MIOT_SDK_LOADER**/ 还会执行 __r(10290)（miot-sdk/native/plugin），
          // 按正确顺序预加载 SDK 模块；缺了它，部分插件会因循环依赖拿到未初始化的装饰器（decorator is not a function）
          if (options.sdkLoader !== false) {
            try {
              global.__r(10290);
              mark('sdkLoader');
            } catch (eL) {
              log('sdk loader __r(10290) err', String(eL && eL.stack || eL));
            }
          }
        } catch (e) {
          log('InitializeCore err', String(e && e.stack || e));
          throw e;
        }
        // 记录插件 bundle 定义的模块 id，用于校正入口（数字 10001 / "前缀-10001" 等不同布局）
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
      })
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
        // Let Promise.resolve().then(init) register AppRegistry component
        return delay(120);
      })
      .then(function () {
        mark('beforeRunApplication');
        log('before runApplication');
        runApplication(packageName, rootTag);
        log('after runApplication, waiting paint');
        mark('runApplication');
        return delay(400);
      })
      .then(function () {
        for (var i = 0; i < 20; i++) HOST.pollQueue();
        var snap = HOST.snapshotViews();
        log('view count', snap.length);
        mark('firstPaint');
        mark('bootOk');
        if (typeof HOST.onViewTree === 'function') HOST.onViewTree(snap);
        return snap;
      });
  };
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : this);
