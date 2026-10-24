/**
 * Minimal React Native 0.61 Paper host for Mi Home plugin bundles.
 * Runs in browser / ArkWeb / jsdom.
 */
(function (global) {
  'use strict';

  var HOST = {
    log: [],
    views: Object.create(null),
    roots: Object.create(null),
    nextRootTag: 11,
    device: {
      did: '1046841160',
      model: 'philips.light.lite',
      name: '台灯',
      isOnline: true,
      mac: '00:00:00:00:00:00',
      ip: '192.168.1.100',
      token: '',
      deviceID: '1046841160',
      userId: '0',
      iconURL: '',
      lastOnline: Date.now() / 1000,
      version: '1.0.0',
      permitLevel: 16,
      isSetPinCode: false,
      pinCode: '',
      parent_id: '',
      parentId: '',
      parentModel: '',
      roomId: '',
      homeId: '',
      extraData: '',
      // Android 上 SDK 用 JSON.parse 读取这两个字段（Device.deviceConfigInfo / extraObj），必须是 JSON 字符串
      deviceConfigInfo: '{}',
      extrainfo: '{}',
      propInfo: {},
      owner: { id: '0', nickname: '', icon: '', type: 0 },
      isShared: false,
      isFamily: false,
      isOwner: true,
      isReadonly: false,
      pid: 0,
      pd_id: 0,
      isNew: false,
      event: '',
      freqFlag: false,
      freqCameraFlag: false,
      orderTime: 0,
      orderTimeTs: 0,
      showMode: 0,
      permitLevel: 16,
      comFlag: 0,
      ssid: '',
      bssid: '',
      latitude: 0,
      longitude: 0,
      type: 0
    },
    packageName: 'miot.plugin.prototype',
    pluginId: '0',
    sdkBase: 'sdk/',
    plugBase: 'plugin/',
    // 共享 SDK 资源（miotsdk_* 等，随 App 打包一次拷贝）；插件自身资源在 plugBase + 'res/'
    sharedResBase: 'plugin/res/',
    pluginResFiles: null,
    localBase: 'plugin/',
    assetMap: Object.create(null),
    bridgeProxy: null, // optional ArkTS bridge
    onViewTree: null,
    _reqId: 0,
    _pending: Object.create(null)
  };

  function isQuiet() {
    try {
      if (HOST.quiet) return true;
      if (typeof global !== 'undefined' && global.__RNHostQuiet) return true;
      if (typeof window !== 'undefined' && window.__RNHostQuiet) return true;
    } catch (_e) {}
    return false;
  }

  function log() {
    var args = Array.prototype.slice.call(arguments);
    var line = args.map(function (a) {
      try { return typeof a === 'string' ? a : JSON.stringify(a); } catch (e) { return String(a); }
    }).join(' ');
    var important = /PERF|FAIL|error|Error|unresolved|boot ok|host ready|view count|InitializeCore|runApplication/i.test(line);
    if (!isQuiet() || important) {
      HOST.log.push(line);
      if (HOST.log.length > 200) HOST.log.shift();
      if (typeof console !== 'undefined' && console.log) console.log('[RNHost]', line);
      if (!isQuiet()) {
        var el = typeof document !== 'undefined' ? document.getElementById('rn-log') : null;
        if (el) {
          el.textContent = HOST.log.slice(-40).join('\n');
          el.scrollTop = el.scrollHeight;
        }
      }
    } else {
      // still keep a tiny ring for diagnostics
      HOST.log.push(line);
      if (HOST.log.length > 80) HOST.log.shift();
    }
  }

  function mark(name) {
    var t = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    if (!HOST._t0) HOST._t0 = t;
    var ms = Math.round(t - HOST._t0);
    HOST.marks = HOST.marks || {};
    HOST.marks[name] = ms;
    log('PERF', name, ms + 'ms');
    try {
      if (HOST.bridgeProxy && typeof HOST.bridgeProxy.invoke === 'function') {
        HOST.bridgeProxy.invoke(JSON.stringify({ id: 0, action: 'perfMark', payload: { name: name, ms: ms } }));
      }
    } catch (_e) {}
    return ms;
  }
  HOST.mark = mark;
  HOST.quiet = true;

  global.__RNHost = HOST;
  // Capture the browser's native timers BEFORE RN InitializeCore replaces
  // global setTimeout/setInterval with JSTimers (which route back into Timing.createTimer).
  var _nST = global.setTimeout.bind(global);
  var _nSI = global.setInterval.bind(global);
  var _nCT = global.clearTimeout.bind(global);
  var _nCI = global.clearInterval.bind(global);
  HOST.nativeTimers = { setTimeout: _nST, setInterval: _nSI, clearTimeout: _nCT, clearInterval: _nCI };
  HOST.nativeRaf = typeof global.requestAnimationFrame === 'function' ? global.requestAnimationFrame.bind(global) : null;
  global.__RNHostLog = log;

  // ---------- DOM helpers ----------
  var doc = typeof document !== 'undefined' ? document : null;
  var SVG_NS = 'http://www.w3.org/2000/svg';
  var unresolvedImages = Object.create(null);
  var resIndex = null; // basename -> relative url under plugin/res/

  function ensureRootMount() {
    if (!doc) return null;
    var m = doc.getElementById('rn-root');
    if (!m) {
      m = doc.createElement('div');
      m.id = 'rn-root';
      doc.body.appendChild(m);
    }
    // Must fill Web area so flex:1 children work
    m.style.cssText = 'position:fixed;left:0;right:0;top:0;bottom:0;width:100%;height:auto;overflow:hidden;background:#fff;display:flex;flex-direction:column;box-sizing:border-box;' +
      'font-family:' + RN_FONT_STACK + ';font-size:14px;color:#000;line-height:normal;-webkit-font-smoothing:antialiased;';
    if (HOST.layoutRootPanel && global.__RNHOST_DIMENSIONS__) HOST.layoutRootPanel();
    // Clear boot placeholder once we start mounting RN views
    if (m.getAttribute('data-rn-ready') !== '1') {
      m.setAttribute('data-rn-ready', '1');
      while (m.firstChild) m.removeChild(m.firstChild);
    }
    return m;
  }

  var RN_FONT_STACK = '"MiSans","MiSans VF","HarmonyOS Sans SC","HarmonyOS Sans","Noto Sans CJK SC","Roboto",sans-serif';
  // Android font family names used by RN/mhui -> CSS font + weight
  var ANDROID_FONTS = {
    'sans-serif': ['', null], 'sans-serif-thin': ['', '100'], 'sans-serif-light': ['', '300'],
    'sans-serif-medium': ['', '500'], 'sans-serif-black': ['', '900'], 'sans-serif-condensed': ['', null],
    'sans-serif-condensed-light': ['', '300'], 'serif': ['serif', null], 'monospace': ['monospace', null],
    'normal': ['', null], 'System': ['', null]
  };

  function tagEl(tag) {
    return HOST.views[tag] && HOST.views[tag].el;
  }

  function toCssColor(c) {
    if (c == null || c === '') return undefined;
    if (typeof c === 'string') {
      if (c.charAt(0) === '#' || c.indexOf('rgb') === 0 || c.indexOf('hsl') === 0) return c;
      // named / transparent
      return c;
    }
    if (typeof c === 'number') {
      // RN processColor: 32-bit ARGB, may be negative signed
      var u = c >>> 0;
      var a = ((u >>> 24) & 255) / 255;
      var r = (u >>> 16) & 255;
      var g = (u >>> 8) & 255;
      var b = u & 255;
      if (a >= 0.999) return 'rgb(' + r + ',' + g + ',' + b + ')';
      // avoid huge black blocks from accidental opaque black unless intended
      return 'rgba(' + r + ',' + g + ',' + b + ',' + (Math.round(a * 1000) / 1000) + ')';
    }
    if (typeof c === 'object') {
      // {r,g,b,a} 0-255 or 0-1
      if (c.r != null) {
        var rr = c.r <= 1 && c.g <= 1 ? Math.round(c.r * 255) : c.r;
        var gg = c.g <= 1 && c.r <= 1 ? Math.round(c.g * 255) : c.g;
        var bb = c.b <= 1 && c.r <= 1 ? Math.round(c.b * 255) : c.b;
        var aa = c.a == null ? 1 : (c.a > 1 ? c.a / 255 : c.a);
        return 'rgba(' + rr + ',' + gg + ',' + bb + ',' + aa + ')';
      }
    }
    return undefined;
  }

  function px(v) {
    if (typeof v === 'number' && isFinite(v)) return v + 'px';
    return v;
  }

  function dim(v) {
    if (v == null) return undefined;
    if (typeof v === 'number' && isFinite(v)) return v + 'px';
    if (typeof v === 'string') return v;
    return undefined;
  }

  function applyFlex(s, v) {
    // RN: flex > 0 => grow=flex, shrink=1, basis=0; flex==0 => grow0 shrink0; flex<0 => grow0 shrink=-flex basis=auto
    if (typeof v !== 'number' || !isFinite(v)) {
      s.flex = String(v);
      return;
    }
    if (v > 0) {
      s.flexGrow = String(v);
      s.flexShrink = '1';
      s.flexBasis = '0%';
      s.flex = v + ' 1 0%';
    } else if (v === 0) {
      s.flexGrow = '0';
      s.flexShrink = '0';
      s.flexBasis = 'auto';
      s.flex = '0 0 auto';
    } else {
      s.flexGrow = '0';
      s.flexShrink = String(-v);
      s.flexBasis = 'auto';
      s.flex = '0 ' + (-v) + ' auto';
    }
  }

  function transformToCss(arr) {
    if (!Array.isArray(arr)) return typeof arr === 'string' ? arr : '';
    return arr.map(function (t) {
      if (!t || typeof t !== 'object') return '';
      var key = Object.keys(t)[0];
      var val = t[key];
      if (key === 'translateX' || key === 'translateY' || key === 'translateZ') return key + '(' + px(val) + ')';
      if (key === 'translate') {
        if (Array.isArray(val)) return 'translate(' + px(val[0]) + ',' + px(val[1] || 0) + ')';
        return 'translate(' + px(val) + ')';
      }
      if (key === 'rotate' || key === 'rotateZ' || key === 'rotateX' || key === 'rotateY') {
        var rv = typeof val === 'number' ? val + 'deg' : String(val);
        return (key === 'rotateZ' ? 'rotate' : key) + '(' + rv + ')';
      }
      if (key === 'scale' || key === 'scaleX' || key === 'scaleY') return key + '(' + val + ')';
      if (key === 'skewX' || key === 'skewY') {
        var sv = typeof val === 'number' ? val + 'deg' : String(val);
        return key + '(' + sv + ')';
      }
      if (key === 'perspective') return 'perspective(' + px(val) + ')';
      if (key === 'matrix' && Array.isArray(val)) return 'matrix(' + val.join(',') + ')';
      return '';
    }).filter(Boolean).join(' ');
  }

  var STYLE_KEYS = {
    width: 1, height: 1, minWidth: 1, minHeight: 1, maxWidth: 1, maxHeight: 1,
    margin: 1, marginTop: 1, marginBottom: 1, marginLeft: 1, marginRight: 1,
    marginHorizontal: 1, marginVertical: 1, marginStart: 1, marginEnd: 1,
    padding: 1, paddingTop: 1, paddingBottom: 1, paddingLeft: 1, paddingRight: 1,
    paddingHorizontal: 1, paddingVertical: 1, paddingStart: 1, paddingEnd: 1,
    left: 1, right: 1, top: 1, bottom: 1, start: 1, end: 1,
    zIndex: 1, opacity: 1, overflow: 1, display: 1, position: 1,
    flex: 1, flexGrow: 1, flexShrink: 1, flexBasis: 1, flexDirection: 1, flexWrap: 1,
    alignItems: 1, alignSelf: 1, alignContent: 1, justifyContent: 1,
    borderWidth: 1, borderTopWidth: 1, borderBottomWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderStartWidth: 1, borderEndWidth: 1,
    borderRadius: 1, borderTopLeftRadius: 1, borderTopRightRadius: 1,
    borderBottomLeftRadius: 1, borderBottomRightRadius: 1,
    borderStyle: 1, borderColor: 1, borderTopColor: 1, borderBottomColor: 1,
    borderLeftColor: 1, borderRightColor: 1,
    backgroundColor: 1, color: 1, shadowColor: 1, tintColor: 1,
    fontSize: 1, fontWeight: 1, fontFamily: 1, fontStyle: 1, fontVariant: 1,
    lineHeight: 1, textAlign: 1, textDecorationLine: 1, letterSpacing: 1,
    textTransform: 1, includeFontPadding: 1,
    transform: 1, aspectRatio: 1, gap: 1, rowGap: 1, columnGap: 1,
    backfaceVisibility: 1, direction: 1
  };

  function flattenStyle(style) {
    if (!style) return null;
    if (Array.isArray(style)) {
      var out = {};
      for (var i = 0; i < style.length; i++) {
        var part = flattenStyle(style[i]);
        if (part) Object.keys(part).forEach(function (k) { out[k] = part[k]; });
      }
      return out;
    }
    if (typeof style === 'object') return style;
    return null;
  }

  function applyStyle(el, style) {
    style = flattenStyle(style);
    if (!style || !el || !el.style) return;
    var s = el.style;
    var isSvg = el.namespaceURI === SVG_NS;
    var inlineText = !!el._rnInline;
    var blockText = !!el._rnText;
    if (!isSvg && !inlineText) {
      if (!s.display) s.display = blockText ? 'block' : 'flex';
      if (!blockText) {
        if (!s.flexDirection) s.flexDirection = 'column';
        if (!s.alignItems) s.alignItems = 'stretch';
        if (!s.alignContent) s.alignContent = 'flex-start';
      }
      s.boxSizing = 'border-box';
      if (!s.position) s.position = 'relative';
      if (!s.minWidth) s.minWidth = '0';
      if (!s.minHeight) s.minHeight = '0';
      if (!s.flexShrink) s.flexShrink = '0';
    }

    Object.keys(style).forEach(function (k) {
      var v = style[k];
      if (v === null) { resetStyleKey(el, k); return; }
      if (v == null) return;
      if (k === 'marginHorizontal' || k === 'marginStart' && style.marginEnd == null) {
        if (k === 'marginHorizontal') { s.marginLeft = s.marginRight = dim(v); return; }
      }
      if (k === 'marginHorizontal') { s.marginLeft = s.marginRight = dim(v); return; }
      if (k === 'marginVertical') { s.marginTop = s.marginBottom = dim(v); return; }
      if (k === 'paddingHorizontal') { s.paddingLeft = s.paddingRight = dim(v); return; }
      if (k === 'paddingVertical') { s.paddingTop = s.paddingBottom = dim(v); return; }
      if (k === 'marginStart') { s.marginLeft = dim(v); return; }
      if (k === 'marginEnd') { s.marginRight = dim(v); return; }
      if (k === 'paddingStart') { s.paddingLeft = dim(v); return; }
      if (k === 'paddingEnd') { s.paddingRight = dim(v); return; }
      if (k === 'start') { s.left = dim(v); return; }
      if (k === 'end') { s.right = dim(v); return; }

      if (k === 'backgroundColor' || k === 'borderColor' || k === 'color' || k === 'shadowColor' ||
          k === 'borderTopColor' || k === 'borderBottomColor' || k === 'borderLeftColor' || k === 'borderRightColor') {
        var col = toCssColor(v);
        if (col != null) {
          if (k === 'shadowColor') {
            // ignore heavy shadows; keep color for potential box-shadow
            s.setProperty('--rn-shadow', col);
          } else {
            s[k] = col;
          }
        }
        return;
      }
      if (k === 'tintColor') {
        // applied specially on images
        el._rnTint = toCssColor(v);
        if (el.tagName === 'IMG' && el._rnTint) {
          // approximate via CSS filter only if needed later
        }
        return;
      }
      if (k === 'fontFamily') {
        var fam = String(v);
        var af = ANDROID_FONTS[fam];
        if (af) {
          s.fontFamily = af[0] ? af[0] : '';
          if (af[1] && !style.fontWeight) s.fontWeight = af[1];
        } else {
          s.fontFamily = '"' + fam.replace(/"/g, '') + '",' + RN_FONT_STACK;
        }
        return;
      }
      if (k === 'flex') { applyFlex(s, v); return; }
      if (k === 'flexGrow' || k === 'flexShrink') { s[k] = String(v); return; }
      if (k === 'flexBasis') { s.flexBasis = typeof v === 'number' ? (v === 0 ? '0%' : px(v)) : v; return; }
      if (k === 'transform') { s.transform = transformToCss(v); return; }
      if (k === 'aspectRatio' && typeof v === 'number' && v > 0) {
        s.aspectRatio = String(v);
        return;
      }
      if (k === 'display') {
        s.display = v === 'none' ? 'none' : (v === 'flex' || v === 'block' ? v : s.display || 'flex');
        return;
      }
      if (k === 'overflow') {
        s.overflow = v === 'visible' ? 'visible' : (v === 'scroll' ? 'auto' : v);
        return;
      }
      if (k === 'fontWeight') { s.fontWeight = String(v); return; }
      if (k === 'fontSize') { s.fontSize = dim(v); return; }
      if (k === 'lineHeight') {
        s.lineHeight = typeof v === 'number' ? (v < 8 ? String(v) : px(v)) : v;
        return;
      }
      if (k === 'letterSpacing') { s.letterSpacing = typeof v === 'number' ? px(v) : v; return; }
      if (k === 'textDecorationLine') { s.textDecoration = v; return; }
      if (k === 'zIndex' || k === 'opacity') { s[k] = String(v); return; }
      if (k === 'shadowOpacity' || k === 'shadowRadius' || k === 'shadowOffset' || k === 'elevation') return; // ignore
      if (k === 'includeFontPadding') return;

      // dimensions / positions / borders
      if (/^(width|height|minWidth|minHeight|maxWidth|maxHeight|margin|padding|top|left|right|bottom|border.*Width|border.*Radius|gap|rowGap|columnGap)$/i.test(k) ||
          /Width$|Radius$|Height$|^margin|^padding|^(top|left|right|bottom)$/.test(k)) {
        if (typeof v === 'number' || (typeof v === 'string' && v !== '')) {
          s[k] = dim(v);
        }
        return;
      }
      if (k === 'flexDirection' || k === 'flexWrap' || k === 'alignItems' || k === 'alignSelf' ||
          k === 'alignContent' || k === 'justifyContent' || k === 'position' ||
          k === 'fontStyle' || k === 'textAlign' || k === 'textTransform' || k === 'borderStyle' ||
          k === 'direction' || k === 'backfaceVisibility') {
        s[k] = String(v);
        return;
      }
    });
  }

  // Paper sends null when a style key is removed; restore the Yoga default instead of keeping the stale value.
  var YOGA_DEFAULTS = {
    flexDirection: 'column', alignItems: 'stretch', alignContent: 'flex-start', justifyContent: 'flex-start',
    position: 'relative', flexShrink: '0', flexGrow: '0', flexBasis: 'auto', flexWrap: 'nowrap', display: 'flex',
    minWidth: '0', minHeight: '0', opacity: '', overflow: ''
  };
  function cssName(k) { return k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }); }
  function resetStyleKey(el, k) {
    var s = el.style;
    if (k === 'tintColor') { el._rnTint = null; return; }
    if (k === 'fontFamily') { s.fontFamily = ''; return; }
    var map = {
      marginHorizontal: ['marginLeft', 'marginRight'], marginVertical: ['marginTop', 'marginBottom'],
      paddingHorizontal: ['paddingLeft', 'paddingRight'], paddingVertical: ['paddingTop', 'paddingBottom'],
      marginStart: ['marginLeft'], marginEnd: ['marginRight'], paddingStart: ['paddingLeft'], paddingEnd: ['paddingRight'],
      start: ['left'], end: ['right'], flex: ['flexGrow', 'flexShrink', 'flexBasis'], textDecorationLine: ['textDecoration'],
      transform: ['transform']
    };
    var list = map[k] || [k];
    list.forEach(function (n) {
      if (el.namespaceURI === SVG_NS) { s.removeProperty(cssName(n)); return; }
      if (el._rnText && (n === 'display' || n === 'flexDirection' || n === 'alignItems')) {
        if (n === 'display') s.display = 'block';
        return;
      }
      if (YOGA_DEFAULTS[n] != null && !el._rnInline) s[n] = YOGA_DEFAULTS[n];
      else s.removeProperty(cssName(n));
    });
  }

  function collectStyleFromProps(props) {
    var merged = {};
    if (!props) return merged;
    if (props.style) {
      var st = flattenStyle(props.style);
      if (st) Object.keys(st).forEach(function (k) { merged[k] = st[k]; });
    }
    // Paper may flatten style keys onto props
    Object.keys(props).forEach(function (k) {
      if (STYLE_KEYS[k] && k !== 'style') merged[k] = props[k];
    });
    return merged;
  }

  function ensureResIndex() {
    if (resIndex) return resIndex;
    resIndex = Object.create(null);
    // Prefer prebuilt map if host filled it; also scan known names from optional global
    if (HOST.resFiles && Array.isArray(HOST.resFiles)) {
      HOST.resFiles.forEach(function (n) { resIndex[n] = HOST.sharedResBase + n; });
    }
    // 当前插件的资源覆盖共享资源（按设备型号动态下载的插件）
    if (HOST.pluginResFiles && Array.isArray(HOST.pluginResFiles)) {
      HOST.pluginResFiles.forEach(function (n) { resIndex[n] = HOST.plugBase + 'res/' + n; });
    }
    return resIndex;
  }

  function androidResName(httpServerLocation, name, type) {
    var path = String(httpServerLocation || '').replace(/^\/assets\//, '').replace(/^\//, '');
    var full = (path ? path + '/' : '') + String(name || 'asset');
    var base = full.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    var ext = type ? String(type) : 'png';
    return base + '.' + ext;
  }

  function logUnresolved(uri) {
    var key = String(uri || '');
    if (!key || unresolvedImages[key]) return;
    unresolvedImages[key] = 1;
    log('unresolved image', key);
  }

  function lookupResFile(fileName) {
    ensureResIndex();
    if (!fileName) return '';
    var base = fileName.split('/').pop();
    if (resIndex[base]) return resIndex[base];
    // try without worrying about exact map — direct path
    var direct = HOST.plugBase + 'res/' + base;
    // also try node_modules_ alias of projects_xiaomi..._node_modules_
    if (base.indexOf('projects_') === 0) {
      var idx = base.indexOf('_node_modules_');
      if (idx > 0) {
        var alt = 'node_modules_' + base.substring(idx + '_node_modules_'.length);
        if (resIndex[alt]) return resIndex[alt];
      }
    }
    if (resIndex[base]) return resIndex[base];
    return direct;
  }

  function resolveUri(uri) {
    if (!uri) return '';
    if (/^(https?:|data:|file:|blob:|content:)/i.test(uri)) return uri;
    if (uri.indexOf('asset:/') === 0) {
      var rest = uri.replace(/^asset:\/*/, '');
      return lookupResFile(androidResName('/assets/' + rest.replace(/\.[a-z0-9]+$/i, ''), rest.replace(/\.[^.]+$/, ''), (rest.split('.').pop() || 'png')));
    }
    // bare drawable / resource name
    var name = String(uri);
    if (name.indexOf('/') >= 0) name = name.split('/').pop();
    // strip query
    name = name.split('?')[0];
    ensureResIndex();
    if (resIndex[name]) return resIndex[name];
    if (resIndex[name + '.png']) return resIndex[name + '.png'];
    if (resIndex[name + '.jpg']) return resIndex[name + '.jpg'];
    // fuzzy: ends with _name.png
    var keys = Object.keys(resIndex);
    var needle = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    for (var i = 0; i < keys.length; i++) {
      var f = keys[i];
      var stem = f.replace(/\.[^.]+$/, '');
      if (stem === needle || stem.endsWith('_' + needle) || stem.endsWith(needle)) {
        return lookupResFile(f);
      }
    }
    var guess = lookupResFile(name.indexOf('.') > 0 ? name : name + '.png');
    logUnresolved(uri);
    return guess;
  }

  function resolveAsset(asset) {
    if (!asset) return '';
    if (typeof asset === 'string') return resolveUri(asset);
    if (typeof asset === 'number') return resolveAssetId(asset);
    if (asset.uri && !asset.__packager_asset) return resolveUri(asset.uri);
    if (asset.__packager_asset || asset.httpServerLocation) {
      var fileName = androidResName(asset.httpServerLocation, asset.name, asset.type || 'png');
      ensureResIndex();
      if (resIndex[fileName]) return resIndex[fileName];
      // projects_ vs path variants
      var url = lookupResFile(fileName);
      if (!resIndex[fileName]) logUnresolved(fileName);
      return url;
    }
    if (asset.uri) return resolveUri(asset.uri);
    return '';
  }

  function resolveAssetId(id) {
    ensureResIndex();
    if (HOST.assetMap['#' + id]) return HOST.assetMap['#' + id];
    // transparent 1x1 placeholder
    logUnresolved('#' + id);
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
  }

  function applyImageSource(el, src) {
    if (!el) return;
    var resolved = '';
    if (Array.isArray(src)) src = src[0];
    if (src == null) return;
    if (typeof src === 'number') resolved = resolveAssetId(src);
    else if (typeof src === 'string') resolved = resolveUri(src);
    else if (typeof src === 'object') resolved = resolveAsset(src);
    if (resolved) el.setAttribute('src', resolved);
  }

  // react-native-svg 9.x (Android) brush: [0, argbInt] solid | [1, 'brushRef'] gradient/pattern | [2] currentColor
  function svgBrush(val) {
    if (val == null) return null;
    if (typeof val === 'number') return toCssColor(val) || 'none';
    if (typeof val === 'string') return val === '' ? 'none' : val;
    if (Array.isArray(val)) {
      var t0 = val[0];
      if (t0 === 0) return val[1] == null ? 'none' : (toCssColor(val[1]) || 'none');
      if (t0 === 1) return val[1] != null ? 'url(#' + val[1] + ')' : 'none';
      if (t0 === 2) return 'currentColor';
      return 'none';
    }
    if (typeof val === 'object') {
      if (val.brushRef) return 'url(#' + val.brushRef + ')';
      if (val.value != null) return toCssColor(val.value) || 'none';
    }
    return 'none';
  }
  var SVG_CAP = ['butt', 'round', 'square'];
  var SVG_JOIN = ['miter', 'round', 'bevel'];
  function setSvgAttr(el, name, v) {
    if (v == null || v === '') el.removeAttribute(name);
    else el.setAttribute(name, String(v));
  }
  function applySvgPaint(el, props) {
    if (!el || el.namespaceURI !== SVG_NS) return;
    if ('fill' in props) {
      var f = svgBrush(props.fill);
      if (f == null) el.removeAttribute('fill'); else el.setAttribute('fill', f);
    }
    if ('stroke' in props) {
      var st = svgBrush(props.stroke);
      if (st == null) el.removeAttribute('stroke'); else el.setAttribute('stroke', st);
    }
    if ('fillOpacity' in props) setSvgAttr(el, 'fill-opacity', props.fillOpacity);
    if ('strokeOpacity' in props) setSvgAttr(el, 'stroke-opacity', props.strokeOpacity);
    if ('fillRule' in props) setSvgAttr(el, 'fill-rule', props.fillRule === 0 ? 'evenodd' : props.fillRule === 1 ? 'nonzero' : props.fillRule);
    if ('clipRule' in props) setSvgAttr(el, 'clip-rule', props.clipRule === 0 ? 'evenodd' : props.clipRule === 1 ? 'nonzero' : props.clipRule);
    if ('strokeWidth' in props) setSvgAttr(el, 'stroke-width', props.strokeWidth);
    if ('strokeLinecap' in props) setSvgAttr(el, 'stroke-linecap', typeof props.strokeLinecap === 'number' ? SVG_CAP[props.strokeLinecap] : props.strokeLinecap);
    if ('strokeLinejoin' in props) setSvgAttr(el, 'stroke-linejoin', typeof props.strokeLinejoin === 'number' ? SVG_JOIN[props.strokeLinejoin] : props.strokeLinejoin);
    if ('strokeDasharray' in props) setSvgAttr(el, 'stroke-dasharray', Array.isArray(props.strokeDasharray) ? props.strokeDasharray.join(' ') : props.strokeDasharray);
    if ('strokeDashoffset' in props) setSvgAttr(el, 'stroke-dashoffset', props.strokeDashoffset);
    if ('strokeMiterlimit' in props) setSvgAttr(el, 'stroke-miterlimit', props.strokeMiterlimit);
    if ('opacity' in props) setSvgAttr(el, 'opacity', props.opacity);
    if ('d' in props) setSvgAttr(el, 'd', props.d);
    if ('points' in props) setSvgAttr(el, 'points', props.points);
    if ('clipPath' in props) setSvgAttr(el, 'clip-path', props.clipPath ? 'url(#' + props.clipPath + ')' : null);
    if ('mask' in props) setSvgAttr(el, 'mask', props.mask ? 'url(#' + props.mask + ')' : null);
    if ('color' in props && props.color != null) el.setAttribute('color', toCssColor(props.color) || '');
    var tag = el.localName;
    if (tag !== 'linearGradient' && tag !== 'radialGradient') {
      ['x', 'y', 'width', 'height', 'rx', 'ry', 'cx', 'cy', 'r', 'x1', 'y1', 'x2', 'y2'].forEach(function (a) {
        if (a in props) setSvgAttr(el, a, props[a]);
      });
    }
    if ('name' in props && props.name) el.setAttribute('id', props.name);
    if (props.matrix && Array.isArray(props.matrix) && tag !== 'svg') {
      el.setAttribute('transform', 'matrix(' + props.matrix.join(' ') + ')');
    }
  }

  function isPlainNumber(v) {
    return typeof v === 'number' || (typeof v === 'string' && v !== '' && v.charAt(v.length - 1) !== '%' && isFinite(Number(v)));
  }

  // RNSVG Android: in objectBoundingBox units, plain numbers are absolute user units (only % are relative).
  function buildSvgGradient(rec) {
    var el = rec.el;
    var p = rec.props;
    if (!el) return;
    var isLinear = rec.className === 'RNSVGLinearGradient';
    var keys = isLinear ? ['x1', 'y1', 'x2', 'y2'] : ['cx', 'cy', 'fx', 'fy', 'rx', 'ry'];
    var anyNumber = keys.some(function (k) { return p[k] != null && isPlainNumber(p[k]); });
    var units = p.gradientUnits === 1 || anyNumber ? 'userSpaceOnUse' : 'objectBoundingBox';
    el.setAttribute('gradientUnits', units);
    if (isLinear) {
      ['x1', 'y1', 'x2', 'y2'].forEach(function (k) { if (p[k] != null) el.setAttribute(k, String(p[k])); });
    } else {
      ['cx', 'cy', 'fx', 'fy'].forEach(function (k) { if (p[k] != null) el.setAttribute(k, String(p[k])); });
      var rx = p.rx != null ? p.rx : p.r;
      var ry = p.ry != null ? p.ry : rx;
      if (rx != null) el.setAttribute('r', String(rx));
      var nrx = parseFloat(rx), nry = parseFloat(ry);
      if (isFinite(nrx) && isFinite(nry) && nrx > 0 && nry !== nrx && isPlainNumber(p.cy)) {
        var cy = parseFloat(p.cy) || 0;
        var sy = nry / nrx;
        el.setAttribute('gradientTransform', 'matrix(1 0 0 ' + sy + ' 0 ' + (cy - cy * sy) + ')');
      }
    }
    if (Array.isArray(p.gradientTransform) && p.gradientTransform.length === 6) {
      el.setAttribute('gradientTransform', 'matrix(' + p.gradientTransform.join(' ') + ')');
    }
    if (p.name) el.setAttribute('id', p.name);
    while (el.firstChild) el.removeChild(el.firstChild);
    var g = p.gradient;
    if (Array.isArray(g)) {
      var pairs = g.length % 2 === 0 && (g.length < 5 || typeof g[1] === 'number' && Math.abs(g[1]) > 1);
      if (pairs) {
        for (var gi = 0; gi + 1 < g.length; gi += 2) {
          var u = g[gi + 1] >>> 0;
          var stop = doc.createElementNS(SVG_NS, 'stop');
          stop.setAttribute('offset', String(g[gi]));
          stop.setAttribute('stop-color', 'rgb(' + ((u >>> 16) & 255) + ',' + ((u >>> 8) & 255) + ',' + (u & 255) + ')');
          stop.setAttribute('stop-opacity', String(Math.round((((u >>> 24) & 255) / 255) * 1000) / 1000));
          el.appendChild(stop);
        }
      } else {
        for (var gj = 0; gj + 4 < g.length; gj += 5) {
          var st2 = doc.createElementNS(SVG_NS, 'stop');
          st2.setAttribute('offset', String(g[gj]));
          st2.setAttribute('stop-color', 'rgb(' + Math.round(g[gj + 1] * 255) + ',' + Math.round(g[gj + 2] * 255) + ',' + Math.round(g[gj + 3] * 255) + ')');
          st2.setAttribute('stop-opacity', String(g[gj + 4]));
          el.appendChild(st2);
        }
      }
    }
  }

  function applyProps(rec, props) {
    if (!props) return;
    var el = rec.el;
    if (!el) return;

    var styleMerged = collectStyleFromProps(props);
    applyStyle(el, styleMerged);
    if (el._rnScroll) {
      if ('scrollEnabled' in props) el._rnScrollEnabled = props.scrollEnabled !== false;
      fixScrollOverflow(el, props);
      if ('showsVerticalScrollIndicator' in props || 'showsHorizontalScrollIndicator' in props) {
        var hide = el._rnScroll === 'x' ? props.showsHorizontalScrollIndicator === false : props.showsVerticalScrollIndicator === false;
        el.classList.toggle('rn-noscrollbar', !!hide);
      }
    }

    Object.keys(props).forEach(function (k) {
      if (k === 'style' || STYLE_KEYS[k]) return;
      if (k === 'text' || (k === 'value' && rec.className === 'RCTRawText')) {
        el.textContent = props[k] == null ? '' : String(props[k]);
        return;
      }
      if (k === 'source' && (rec.className === 'RCTImageView' || el.tagName === 'IMG')) {
        applyImageSource(el, props.source);
        return;
      }
      if (k === 'src') {
        if (el.tagName === 'IMG') applyImageSource(el, props.src);
        else if (el.namespaceURI === SVG_NS) applySvgPaint(el, props);
        return;
      }
      if (k === 'resizeMode' && el.tagName === 'IMG') {
        var rm = props.resizeMode;
        el.style.objectFit = rm === 'cover' ? 'cover' : rm === 'stretch' ? 'fill' : rm === 'center' ? 'none' : 'contain';
        return;
      }
      if (k === 'numberOfLines' || k === 'ellipsizeMode') {
        var n = props.numberOfLines;
        if (n === 1) {
          el.style.overflow = 'hidden';
          el.style.textOverflow = 'ellipsis';
          el.style.whiteSpace = 'nowrap';
        } else if (n > 1) {
          el.style.overflow = 'hidden';
          el.style.display = '-webkit-box';
          el.style.webkitLineClamp = String(n);
          el.style.webkitBoxOrient = 'vertical';
        }
        return;
      }
      if (k === 'enabled' && el.tagName === 'INPUT') { el.disabled = !props.enabled; rec.props.enabled = props.enabled; return; }
      if (k === 'disabled' && el.tagName === 'INPUT') { el.disabled = !!props.disabled; rec.props.disabled = props.disabled; return; }
      if (el.type === 'range') {
        if (k === 'minimumValue') { el.min = String(props[k]); rec.props[k] = props[k]; return; }
        if (k === 'maximumValue') { el.max = String(props[k]); rec.props[k] = props[k]; return; }
        if (k === 'step') { el.step = props[k] > 0 ? String(props[k]) : 'any'; rec.props[k] = props[k]; return; }
        if (k === 'value') { rec.props.value = props.value; if (!rec._dragging) el.value = String(props.value); updateSliderLook(rec); return; }
        if (k === 'minimumTrackTintColor' || k === 'maximumTrackTintColor' || k === 'thumbTintColor') {
          rec.props[k] = props[k]; updateSliderLook(rec); return;
        }
      }
      if (el.type === 'checkbox' && (k === 'trackColorForTrue' || k === 'trackColorForFalse' || k === 'thumbColor' || k === 'thumbTintColor' || k === 'trackTintColor')) {
        rec.props[k] = props[k]; updateSwitchLook(rec); return;
      }
      if (k === 'on' || k === 'value') {
        if (el.tagName === 'INPUT' && el.type === 'checkbox') {
          if (k === 'on' && props.on != null) el.checked = !!props.on;
          if (k === 'value' && typeof props.value === 'boolean') el.checked = !!props.value;
          rec.props[k] = props[k];
          updateSwitchLook(rec);
        }
        return;
      }
      if (k === 'title' && el.tagName === 'BUTTON') { el.textContent = String(props.title); return; }
      if (k === 'testID') { el.setAttribute('data-testid', props.testID); return; }
      if (k === 'accessibilityLabel') { el.setAttribute('aria-label', props.accessibilityLabel); return; }
      if (k === 'pointerEvents') {
        el.style.pointerEvents = props.pointerEvents === 'none' ? 'none' : 'auto';
        return;
      }
      if (k === 'overflow') { el.style.overflow = props.overflow === 'scroll' ? 'auto' : props.overflow; return; }
      if (k === 'collapsable' || k === 'removeClippedSubviews' || k === 'needsOffscreenAlphaCompositing') return;
      if (rec.className === 'RNSVGSvgView') {
        if (props.bbWidth != null) el.setAttribute('width', props.bbWidth);
        if (props.bbHeight != null) el.setAttribute('height', props.bbHeight);
      }
      rec.props[k] = props[k];
    });

    if (el.namespaceURI === SVG_NS) {
      if (rec.className === 'RNSVGLinearGradient' || rec.className === 'RNSVGRadialGradient') {
        buildSvgGradient(rec);
      } else {
        applySvgPaint(el, props);
      }
      if (rec.className === 'RNSVGSvgView') {
        var vp = rec.props;
        if (vp.vbWidth || vp.vbHeight) {
          el.setAttribute('viewBox', (vp.minX || 0) + ' ' + (vp.minY || 0) + ' ' + (vp.vbWidth || vp.bbWidth || 0) + ' ' + (vp.vbHeight || vp.bbHeight || 0));
          var al = vp.align || 'xMidYMid';
          el.setAttribute('preserveAspectRatio', al === 'none' ? 'none' : al + (vp.meetOrSlice === 1 ? ' slice' : ' meet'));
        }
        if (vp.tintColor != null) el.setAttribute('color', toCssColor(vp.tintColor) || '');
      }
    }

    if (el.tagName === 'IMG') applyImageTint(el);

    if (rec.className === 'AndroidSwitch' && !rec._boundChange) {
      rec._boundChange = true;
      el.addEventListener('change', function () {
        var want = !!el.checked;
        // controlled component: revert until JS sends the new `on`/`value`
        el.checked = !!(rec.props.on != null ? rec.props.on : rec.props.value);
        emitEvent(rec.tag, 'topChange', { value: want, target: rec.tag });
        updateSwitchLook(rec);
      });
      updateSwitchLook(rec);
    }
    if ((rec.className === 'RCTSlider' || rec.className === 'AndroidSlider') && !rec._boundChange) {
      rec._boundChange = true;
      if (!el.step) el.step = 'any';
      var onInput = function () {
        rec._dragging = true;
        var v = Number(el.value);
        updateSliderLook(rec);
        emitEvent(rec.tag, 'topChange', { value: v, fromUser: true, target: rec.tag });
        emitEvent(rec.tag, 'topValueChange', { value: v, fromUser: true, target: rec.tag });
      };
      var onDone = function () {
        if (!rec._dragging) return;
        rec._dragging = false;
        emitEvent(rec.tag, 'topSlidingComplete', { value: Number(el.value), target: rec.tag });
      };
      el.addEventListener('input', onInput);
      el.addEventListener('change', onDone);
      el.addEventListener('touchend', function () { _nST(onDone, 0); });
      el.addEventListener('pointerup', function () { _nST(onDone, 0); });
      updateSliderLook(rec);
    }
  }

  // RN Image tintColor: recolor opaque pixels. Draw the tint as background and use the image as alpha mask.
  function applyImageTint(el) {
    var tint = el._rnTint;
    var src = el.getAttribute('src');
    var s = el.style;
    if (tint && src) {
      var fit = s.objectFit || 'cover';
      var size = fit === 'fill' ? '100% 100%' : (fit === 'none' ? 'auto' : fit);
      s.backgroundColor = tint;
      s.webkitMaskImage = 'url("' + src + '")';
      s.webkitMaskSize = size;
      s.webkitMaskRepeat = 'no-repeat';
      s.webkitMaskPosition = 'center';
      s.objectPosition = '-99999px -99999px';
      el._rnTinted = true;
    } else if (el._rnTinted) {
      s.backgroundColor = ''; s.webkitMaskImage = ''; s.objectPosition = '';
      el._rnTinted = false;
    }
  }

  function colorOr(v, d) { var c = v != null ? toCssColor(v) : null; return c || d; }
  function updateSliderLook(rec) {
    var el = rec.el, p = rec.props;
    if (!el) return;
    var min = Number(el.min || 0), max = Number(el.max || 1), v = Number(el.value);
    var pct = max > min ? Math.max(0, Math.min(100, (v - min) / (max - min) * 100)) : 0;
    var on = colorOr(p.minimumTrackTintColor, '#32BAC0');
    var off = colorOr(p.maximumTrackTintColor, 'rgba(0,0,0,0.1)');
    el.style.setProperty('--rn-track', 'linear-gradient(to right,' + on + ' 0%,' + on + ' ' + pct + '%,' + off + ' ' + pct + '%,' + off + ' 100%)');
    el.style.setProperty('--rn-thumb', colorOr(p.thumbTintColor, '#ffffff'));
    el.style.opacity = el.disabled ? '0.3' : '';
  }
  function updateSwitchLook(rec) {
    var el = rec.el, p = rec.props;
    if (!el) return;
    var tc = p.trackColorForTrue != null ? p.trackColorForTrue : (p.trackTintColor != null ? p.trackTintColor : null);
    el.style.setProperty('--rn-on', colorOr(tc, '#32BAC0'));
    el.style.setProperty('--rn-off', colorOr(p.trackColorForFalse, 'rgba(0,0,0,0.12)'));
    el.style.setProperty('--rn-thumb', colorOr(p.thumbColor != null ? p.thumbColor : p.thumbTintColor, '#ffffff'));
  }
  function ensureNativeCss() {
    if (!doc || doc.getElementById('rn-native-css')) return;
    var st = doc.createElement('style');
    st.id = 'rn-native-css';
    st.textContent =
      '.rn-noscrollbar{scrollbar-width:none;}.rn-noscrollbar::-webkit-scrollbar{display:none;}' +
      'input.rn-slider{-webkit-appearance:none;appearance:none;background:transparent;width:100%;touch-action:none;}' +
      'input.rn-slider::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:var(--rn-track,#ddd);}' +
      'input.rn-slider::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;margin-top:-9px;border-radius:50%;' +
      'background:var(--rn-thumb,#fff);box-shadow:0 1px 4px rgba(0,0,0,0.25);}' +
      'input.rn-switch{-webkit-appearance:none;appearance:none;position:relative;width:44px;height:24px;min-width:44px;margin:0;border-radius:12px;' +
      'background:var(--rn-off,rgba(0,0,0,0.12));transition:background .2s;outline:none;flex-shrink:0;}' +
      'input.rn-switch:checked{background:var(--rn-on,#32BAC0);}' +
      'input.rn-switch::after{content:"";position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;' +
      'background:var(--rn-thumb,#fff);box-shadow:0 1px 3px rgba(0,0,0,0.3);transition:left .2s;}' +
      'input.rn-switch:checked::after{left:22px;}input.rn-switch:disabled{opacity:.4;}' +
      '#rn-root img{-webkit-user-drag:none;user-select:none;}#rn-root{user-select:none;-webkit-tap-highlight-color:transparent;}';
    (doc.head || doc.documentElement).appendChild(st);
  }

  function createDom(className) {
    ensureNativeCss();
    if (!doc) return null;
    var el;
    switch (className) {
      case 'RCTRawText':
        el = doc.createElement('span');
        el.style.display = 'inline';
        el._rnInline = true;
        break;
      case 'RCTVirtualText':
        el = doc.createElement('span');
        el.style.display = 'inline';
        el._rnInline = true;
        break;
      case 'RCTText':
        // Yoga measures text with the available width; a block box that wraps (pre-wrap like Android TextView)
        el = doc.createElement('div');
        el._rnText = true;
        el.style.display = 'block';
        el.style.whiteSpace = 'pre-wrap';
        el.style.overflowWrap = 'break-word';
        el.style.maxWidth = '100%';
        el.style.flexShrink = '0';
        break;
      case 'RCTSlider':
      case 'AndroidSlider':
        el = doc.createElement('input');
        el.type = 'range';
        el.className = 'rn-slider';
        el.style.display = 'block';
        el.style.margin = '0';
        el.style.flexShrink = '0';
        el.style.height = '40px';
        el._rnNative = true;
        break;
      case 'RCTImageView':
        el = doc.createElement('img');
        el.style.objectFit = 'cover'; // RN Image default resizeMode
        el.style.display = 'flex';
        el.style.flexShrink = '0';
        el.alt = '';
        el.addEventListener('error', function () {
          logUnresolved(el.getAttribute('src') || '(img error)');
        });
        el.addEventListener('load', function () { scheduleLayoutEvents(); });
        break;
      case 'RCTScrollView':
      case 'AndroidHorizontalScrollView':
        // 与 Yoga 一致：flex 由 RN 的 baseVertical/baseHorizontal 样式给（flexGrow/flexShrink:1，basis auto），
        // 不再写死 flex:1 1 0%（父容器高度不定时会被压成 0 高、无法滚动）
        el = doc.createElement('div');
        el._rnScroll = className === 'AndroidHorizontalScrollView' ? 'x' : 'y';
        el.className = 'rn-scroll';
        el.style.WebkitOverflowScrolling = 'touch';
        el.style.minHeight = '0';
        el.style.minWidth = '0';
        fixScrollOverflow(el);
        break;
      case 'AndroidHorizontalScrollContentView':
        el = doc.createElement('div');
        el.style.display = 'flex';
        el.style.flexDirection = 'row';
        break;
      case 'AndroidSwitch':
        el = doc.createElement('input');
        el.type = 'checkbox';
        el.className = 'rn-switch';
        el._rnNative = true;
        break;
      case 'AndroidCheckBox':
        el = doc.createElement('input');
        el.type = 'checkbox';
        break;
      case 'AndroidTextInput':
        el = doc.createElement('input');
        el.type = 'text';
        break;
      case 'RNCViewPager':
        el = doc.createElement('div');
        el.style.display = 'flex';
        el.style.flexDirection = 'row';
        el.style.overflow = 'hidden';
        break;
      case 'RNSVGSvgView':
        el = doc.createElementNS(SVG_NS, 'svg');
        el.setAttribute('overflow', 'visible');
        el.style.display = 'block';
        el.style.overflow = 'visible';
        el.style.flexShrink = '0';
        el.style.background = 'transparent';
        break;
      case 'RNSVGGroup':
        el = doc.createElementNS(SVG_NS, 'g');
        break;
      case 'RNSVGPath':
        el = doc.createElementNS(SVG_NS, 'path');
        break;
      case 'RNSVGRect':
        el = doc.createElementNS(SVG_NS, 'rect');
        break;
      case 'RNSVGCircle':
        el = doc.createElementNS(SVG_NS, 'circle');
        break;
      case 'RNSVGEllipse':
        el = doc.createElementNS(SVG_NS, 'ellipse');
        break;
      case 'RNSVGLine':
        el = doc.createElementNS(SVG_NS, 'line');
        break;
      case 'RNSVGDefs':
        el = doc.createElementNS(SVG_NS, 'defs');
        break;
      case 'RNSVGLinearGradient':
        el = doc.createElementNS(SVG_NS, 'linearGradient');
        break;
      case 'RNSVGRadialGradient':
        el = doc.createElementNS(SVG_NS, 'radialGradient');
        break;
      case 'RNSVGUse':
        el = doc.createElementNS(SVG_NS, 'use');
        break;
      case 'RNSVGText':
        el = doc.createElementNS(SVG_NS, 'text');
        break;
      case 'RNSVGTSpan':
        el = doc.createElementNS(SVG_NS, 'tspan');
        break;
      case 'RNSVGClipPath':
        el = doc.createElementNS(SVG_NS, 'clipPath');
        break;
      default:
        el = doc.createElement('div');
    }
    if (el.namespaceURI !== SVG_NS && !el._rnInline) {
      el.style.display = el.style.display || 'flex';
      if (!el._rnText) {
        el.style.flexDirection = el.style.flexDirection || 'column';
        el.style.alignItems = el.style.alignItems || 'stretch';
        el.style.alignContent = el.style.alignContent || 'flex-start';
      }
      el.style.boxSizing = 'border-box';
      el.style.position = el.style.position || 'relative';
      el.style.minWidth = el.style.minWidth || '0';
      el.style.minHeight = el.style.minHeight || '0';
      // Yoga default flexShrink is 0 (CSS default is 1)
      el.style.flexShrink = el.style.flexShrink || '0';
    }
    el.setAttribute('data-rn', className || '');
    return el;
  }

  // ---------- Bridge / modules ----------
  var MODULES = []; // {name, constants, methods, promiseIdx, syncIdx, impl}
  var NAME_TO_ID = Object.create(null);

  function registerModule(name, methods, constants, impl, promiseMethods, syncMethods) {
    methods = methods || [];
    constants = constants || {};
    impl = impl || {};
    var promiseIdx = [];
    var syncIdx = [];
    (promiseMethods || []).forEach(function (m) {
      var i = methods.indexOf(m); if (i >= 0) promiseIdx.push(i);
    });
    (syncMethods || []).forEach(function (m) {
      var i = methods.indexOf(m); if (i >= 0) syncIdx.push(i);
    });
    // auto: methods returning non-undefined without callback → sync if listed; promises if return Promise
    var id = MODULES.length;
    MODULES.push({ name: name, constants: constants, methods: methods, promiseIdx: promiseIdx, syncIdx: syncIdx, impl: impl });
    NAME_TO_ID[name] = id;
    return id;
  }

  function viewConfig(nativeProps, extras) {
    extras = extras || {};
    return {
      Manager: extras.Manager || 'ViewManager',
      NativeProps: nativeProps || {},
      bubblingEventTypes: extras.bubblingEventTypes || {
        topPress: { phasedRegistrationNames: { bubbled: 'onPress', captured: 'onPressCapture' } },
        topChange: { phasedRegistrationNames: { bubbled: 'onChange', captured: 'onChangeCapture' } },
        topTouchStart: { phasedRegistrationNames: { bubbled: 'onTouchStart', captured: 'onTouchStartCapture' } },
        topTouchMove: { phasedRegistrationNames: { bubbled: 'onTouchMove', captured: 'onTouchMoveCapture' } },
        topTouchEnd: { phasedRegistrationNames: { bubbled: 'onTouchEnd', captured: 'onTouchEndCapture' } },
        topTouchCancel: { phasedRegistrationNames: { bubbled: 'onTouchCancel', captured: 'onTouchCancelCapture' } },
        topClick: { phasedRegistrationNames: { bubbled: 'onClick', captured: 'onClickCapture' } },
        topFocus: { phasedRegistrationNames: { bubbled: 'onFocus', captured: 'onFocusCapture' } },
        topBlur: { phasedRegistrationNames: { bubbled: 'onBlur', captured: 'onBlurCapture' } },
        topSubmitEditing: { phasedRegistrationNames: { bubbled: 'onSubmitEditing', captured: 'onSubmitEditingCapture' } },
        topEndEditing: { phasedRegistrationNames: { bubbled: 'onEndEditing', captured: 'onEndEditingCapture' } }
      },
      directEventTypes: extras.directEventTypes || {
        topLayout: { registrationName: 'onLayout' },
        topLoad: { registrationName: 'onLoad' },
        topLoadStart: { registrationName: 'onLoadStart' },
        topLoadEnd: { registrationName: 'onLoadEnd' },
        topLoadError: { registrationName: 'onError' },
        topMomentumScrollBegin: { registrationName: 'onMomentumScrollBegin' },
        topMomentumScrollEnd: { registrationName: 'onMomentumScrollEnd' },
        topScroll: { registrationName: 'onScroll' },
        topScrollBeginDrag: { registrationName: 'onScrollBeginDrag' },
        topScrollEndDrag: { registrationName: 'onScrollEndDrag' },
        topContentSizeChange: { registrationName: 'onContentSizeChange' },
        topSelectionChange: { registrationName: 'onSelectionChange' }
      },
      baseModuleName: extras.baseModuleName
    };
  }

  var commonViewProps = {
    accessible: 'boolean',
    accessibilityLabel: 'String',
    accessibilityHint: 'String',
    accessibilityRole: 'String',
    accessibilityState: 'Map',
    accessibilityActions: 'Array',
    accessibilityValue: 'Map',
    accessibilityLiveRegion: 'String',
    importantForAccessibility: 'String',
    testID: 'String',
    nativeID: 'String',
    pointerEvents: 'String',
    collapsable: 'boolean',
    needsOffscreenAlphaCompositing: 'boolean',
    renderToHardwareTextureAndroid: 'boolean',
    removeClippedSubviews: 'boolean',
    hitSlop: 'Map',
    onLayout: 'boolean',
    overflow: 'String',
    backfaceVisibility: 'String',
    style: 'Map'
  };

  function buildUIManagerConstants() {
    var textProps = Object.assign({}, commonViewProps, {
      numberOfLines: 'number',
      ellipsizeMode: 'String',
      allowFontScaling: 'boolean',
      maxFontSizeMultiplier: 'number',
      selectable: 'boolean',
      selectionColor: 'Color',
      adjustFontSizeToFit: 'boolean',
      textBreakStrategy: 'String',
      dataDetectorType: 'String'
    });
    var imageProps = Object.assign({}, commonViewProps, {
      src: 'Map',
      source: 'RCTImageSource',
      defaultSrc: 'String',
      loadingIndicatorSrc: 'String',
      resizeMode: 'String',
      tintColor: 'Color',
      resizeMethod: 'String',
      fadeDuration: 'number',
      progressiveRenderingEnabled: 'boolean',
      shouldNotifyLoadEvents: 'boolean',
      headers: 'Map'
    });
    var scrollProps = Object.assign({}, commonViewProps, {
      scrollEnabled: 'boolean',
      showsHorizontalScrollIndicator: 'boolean',
      showsVerticalScrollIndicator: 'boolean',
      persistentScrollbar: 'boolean',
      pagingEnabled: 'boolean',
      decelerationRate: 'number',
      contentOffset: 'Map',
      contentInset: 'Map',
      snapToInterval: 'number',
      snapToAlignment: 'String',
      disableIntervalMomentum: 'boolean',
      nestedScrollEnabled: 'boolean',
      overScrollMode: 'String',
      refreshControl: 'Map'
    });
    var switchProps = Object.assign({}, commonViewProps, {
      enabled: 'boolean',
      on: 'boolean',
      value: 'boolean',
      thumbTintColor: 'Color',
      trackColorForFalse: 'Color',
      trackColorForTrue: 'Color',
      thumbColor: 'Color',
      trackColor: 'Map',
      disabled: 'boolean'
    });
    var inputProps = Object.assign({}, commonViewProps, {
      text: 'String',
      value: 'String',
      mostRecentEventCount: 'number',
      placeholder: 'String',
      placeholderTextColor: 'Color',
      editable: 'boolean',
      multiline: 'boolean',
      keyboardType: 'String',
      returnKeyType: 'String',
      autoCapitalize: 'String',
      autoCorrect: 'boolean',
      secureTextEntry: 'boolean',
      selectionColor: 'Color',
      maxLength: 'number',
      numberOfLines: 'number'
    });

    var sliderProps = Object.assign({}, commonViewProps, {
      value: 'number', minimumValue: 'number', maximumValue: 'number', step: 'number',
      enabled: 'boolean', disabled: 'boolean', minimumTrackTintColor: 'Color', maximumTrackTintColor: 'Color',
      thumbTintColor: 'Color', thumbImage: 'Map', trackImage: 'Map', minimumTrackImage: 'Map', maximumTrackImage: 'Map',
      inverted: 'boolean', testID: 'String'
    });
    var sliderEvents = {
      bubblingEventTypes: {
        topChange: { phasedRegistrationNames: { bubbled: 'onChange', captured: 'onChangeCapture' } },
        topValueChange: { phasedRegistrationNames: { bubbled: 'onValueChange', captured: 'onValueChangeCapture' } }
      },
      directEventTypes: Object.assign({}, viewConfig().directEventTypes, {
        topSlidingComplete: { registrationName: 'onSlidingComplete' }
      })
    };
    return {
      Dimensions: {
        windowPhysicalPixels: { width: 1080, height: 1920, scale: 3, fontScale: 1, densityDpi: 480 },
        screenPhysicalPixels: { width: 1080, height: 1920, scale: 3, fontScale: 1, densityDpi: 480 }
      },
      StyleConstants: {
        PointerEventsValues: { none: 0, boxNone: 1, boxOnly: 2, unspecified: 3 },
        AccessibilityEventTypes: { typeWindowStateChanged: 32, typeViewFocused: 8, typeViewClicked: 1 },
      },
      AccessibilityEventTypes: { typeWindowStateChanged: 32, typeViewFocused: 8, typeViewClicked: 1 },
      genericBubblingEventTypes: viewConfig().bubblingEventTypes,
      genericDirectEventTypes: viewConfig().directEventTypes,
      LazyViewManagersEnabled: false,
      RCTView: viewConfig(commonViewProps),
      RCTText: viewConfig(textProps),
      RCTVirtualText: viewConfig(textProps),
      RCTRawText: viewConfig({ text: 'String' }),
      RCTTextInlineImage: viewConfig(imageProps),
      RCTImageView: viewConfig(imageProps),
      RCTScrollView: viewConfig(scrollProps),
      AndroidHorizontalScrollView: viewConfig(scrollProps),
      AndroidHorizontalScrollContentView: viewConfig(commonViewProps),
      AndroidSwitch: viewConfig(switchProps),
      AndroidCheckBox: viewConfig(Object.assign({}, commonViewProps, { on: 'boolean', value: 'boolean', enabled: 'boolean' })),
      AndroidTextInput: viewConfig(inputProps),
      RNCViewPager: viewConfig(Object.assign({}, commonViewProps, { scrollEnabled: 'boolean', initialPage: 'number' })),
      ARTSurfaceView: viewConfig(commonViewProps),
      ARTShape: viewConfig(commonViewProps),
      ARTGroup: viewConfig(commonViewProps),
      ARTText: viewConfig(commonViewProps),
      GLCanvas: viewConfig(commonViewProps),
      LottieAnimationView: viewConfig(Object.assign({}, commonViewProps, { sourceJson: 'String', sourceName: 'String', progress: 'number', speed: 'number', loop: 'boolean' })),
      RNSVGSvgView: viewConfig(Object.assign({}, commonViewProps, { bbWidth: 'String', bbHeight: 'String', minX: 'number', minY: 'number', vbWidth: 'number', vbHeight: 'number', align: 'String', meetOrSlice: 'number', tintColor: 'Color' })),
      RNSVGGroup: viewConfig(Object.assign({}, commonViewProps, { name: 'String', opacity: 'number', matrix: 'Array', fill: 'String', stroke: 'String' })),
      RNSVGPath: viewConfig(Object.assign({}, commonViewProps, { d: 'String', fill: 'String', stroke: 'String', strokeWidth: 'String' })),
      RNSVGCircle: viewConfig(Object.assign({}, commonViewProps, { cx: 'String', cy: 'String', r: 'String', fill: 'String', stroke: 'String' })),
      RNSVGRect: viewConfig(Object.assign({}, commonViewProps, { x: 'String', y: 'String', width: 'String', height: 'String', rx: 'String', ry: 'String', fill: 'String' })),
      RNSVGText: viewConfig(Object.assign({}, commonViewProps, { text: 'String', fontSize: 'number', fill: 'String', font: 'Map' })),
      RNSVGTSpan: viewConfig(Object.assign({}, commonViewProps, { content: 'String', font: 'Map' })),
      RNSVGDefs: viewConfig(commonViewProps),
      RNSVGUse: viewConfig(Object.assign({}, commonViewProps, { href: 'String', x: 'String', y: 'String', width: 'String', height: 'String' })),
      RNSVGLinearGradient: viewConfig(Object.assign({}, commonViewProps, { x1: 'String', y1: 'String', x2: 'String', y2: 'String', gradient: 'Array', gradientUnits: 'number' })),
      RNSVGRadialGradient: viewConfig(Object.assign({}, commonViewProps, { cx: 'String', cy: 'String', fx: 'String', fy: 'String', rx: 'String', ry: 'String', gradient: 'Array', gradientUnits: 'number' })),
      RNSVGClipPath: viewConfig(commonViewProps),
      RNSVGImage: viewConfig(Object.assign({}, commonViewProps, { x: 'String', y: 'String', width: 'String', height: 'String', src: 'Map' })),
      RNSVGLine: viewConfig(Object.assign({}, commonViewProps, { x1: 'String', y1: 'String', x2: 'String', y2: 'String', stroke: 'String' })),
      RNSVGEllipse: viewConfig(Object.assign({}, commonViewProps, { cx: 'String', cy: 'String', rx: 'String', ry: 'String' })),
      RNSVGPolygon: viewConfig(Object.assign({}, commonViewProps, { points: 'String' })),
      RNSVGPolyline: viewConfig(Object.assign({}, commonViewProps, { points: 'String' })),
      RNSVGSymbol: viewConfig(commonViewProps),
      RNSVGMask: viewConfig(commonViewProps),
      RNSVGPattern: viewConfig(commonViewProps),
      RNSVGStop: viewConfig(Object.assign({}, commonViewProps, { offset: 'String', stopColor: 'Color', stopOpacity: 'number' })),
      RCTSlider: viewConfig(sliderProps, sliderEvents),
      AndroidSlider: viewConfig(sliderProps, sliderEvents)
    };
  }

  // react-native-svg 9.x Android attributes; Paper only forwards props listed in validAttributes,
  // so without e.g. 'name' gradients never get an id and fills referencing them break.
  var SVG_COMMON_ATTRS = {
    name: 'String', matrix: 'Array', propList: 'Array', opacity: 'number', responsible: 'boolean',
    fill: 'Array', fillOpacity: 'number', fillRule: 'number',
    stroke: 'Array', strokeOpacity: 'number', strokeWidth: 'String', strokeLinecap: 'number', strokeLinejoin: 'number',
    strokeDasharray: 'Array', strokeDashoffset: 'number', strokeMiterlimit: 'number', vectorEffect: 'number',
    clipPath: 'String', clipRule: 'number', mask: 'String', display: 'String', color: 'Color',
    gradientTransform: 'Array', gradientUnits: 'number', gradient: 'Array',
    x: 'String', y: 'String', width: 'String', height: 'String', rx: 'String', ry: 'String',
    cx: 'String', cy: 'String', r: 'String', fx: 'String', fy: 'String',
    x1: 'String', y1: 'String', x2: 'String', y2: 'String', d: 'String', points: 'String',
    href: 'String', src: 'Map', align: 'String', meetOrSlice: 'number',
    minX: 'number', minY: 'number', vbWidth: 'number', vbHeight: 'number', bbWidth: 'String', bbHeight: 'String',
    tintColor: 'Color', font: 'Map', content: 'String'
  };
  function mergeSvgAttrs(u) {
    Object.keys(u).forEach(function (n) {
      if (n.indexOf('RNSVG') === 0 && u[n] && u[n].NativeProps) {
        Object.keys(SVG_COMMON_ATTRS).forEach(function (a) {
          if (!(a in u[n].NativeProps)) u[n].NativeProps[a] = SVG_COMMON_ATTRS[a];
        });
      }
    });
    return u;
  }

  // measure helpers
  function rootOrigin() {
    var m = doc && doc.getElementById('rn-root');
    if (!m) return { left: 0, top: 0 };
    var r = m.getBoundingClientRect();
    return { left: r.left, top: r.top };
  }
  // RN measure: [x, y, width, height, pageX, pageY]; x/y relative to the parent view
  function measureTag(tag) {
    var el = tagEl(tag);
    if (!el || !el.getBoundingClientRect) return [0, 0, 0, 0, 0, 0];
    var r = el.getBoundingClientRect();
    var o = rootOrigin();
    var pr = el.parentElement && el.parentElement.getBoundingClientRect ? el.parentElement.getBoundingClientRect() : { left: o.left, top: o.top };
    return [r.left - pr.left, r.top - pr.top, r.width, r.height, r.left - o.left, r.top - o.top];
  }

  // onLayout: Paper sets prop onLayout=true on views that listen; emit topLayout whenever the box changes.
  var _layoutScheduled = false;
  function scheduleLayoutEvents() {
    if (_layoutScheduled) return;
    _layoutScheduled = true;
    var raf = (typeof requestAnimationFrame === 'function' && HOST.nativeRaf) ? HOST.nativeRaf : function (f) { return _nST(f, 16); };
    raf(function () {
      _layoutScheduled = false;
      flushLayoutEvents();
    });
  }
  // RNSVG ids (gradient/clipPath names) are local to each <Svg> on Android, but in one HTML document
  // url(#id) resolves to the first matching element. Scope ids per SvgView: id -> rs<tag>_<name>.
  var URL_ATTRS = ['fill', 'stroke', 'clip-path', 'mask'];
  function scopeSvgIds() {
    if (!doc) return;
    var roots = doc.querySelectorAll('svg[data-tag]');
    for (var r = 0; r < roots.length; r++) {
      var root = roots[r], pre = 'rs' + root.getAttribute('data-tag') + '_';
      var map = {}, any = false;
      var withId = root.querySelectorAll('[id]');
      for (var i = 0; i < withId.length; i++) {
        var id = withId[i].getAttribute('id');
        if (id.indexOf(pre) === 0) { map[id.slice(pre.length)] = id; any = true; continue; }
        if (/^rs\d+_/.test(id)) continue;
        withId[i].setAttribute('id', pre + id); map[id] = pre + id; any = true;
      }
      if (!any) continue;
      for (var k = 0; k < URL_ATTRS.length; k++) {
        var refs = root.querySelectorAll('[' + URL_ATTRS[k] + '^="url(#"]');
        for (var j = 0; j < refs.length; j++) {
          var v = refs[j].getAttribute(URL_ATTRS[k]);
          var mm = /^url\(#([^)]+)\)$/.exec(v);
          if (mm && map[mm[1]] && map[mm[1]] !== mm[1]) refs[j].setAttribute(URL_ATTRS[k], 'url(#' + map[mm[1]] + ')');
        }
      }
    }
  }
  function flushLayoutEvents() {
    try { scopeSvgIds(); } catch (e) {}
    var tags = Object.keys(HOST.views);
    for (var i = 0; i < tags.length; i++) {
      var rec = HOST.views[tags[i]];
      if (!rec || !rec.el || !rec.props || !rec.props.onLayout || !rec.el.isConnected) continue;
      var m = measureTag(rec.tag);
      var x = Math.round(m[0] * 100) / 100, y = Math.round(m[1] * 100) / 100;
      var w = Math.round(m[2] * 100) / 100, h = Math.round(m[3] * 100) / 100;
      var key = x + ',' + y + ',' + w + ',' + h;
      if (rec._lastLayout === key) continue;
      rec._lastLayout = key;
      emitEvent(rec.tag, 'topLayout', { layout: { x: x, y: y, width: w, height: h }, target: rec.tag });
    }
  }
  HOST.flushLayoutEvents = flushLayoutEvents;

  function hitTagFromPoint(x, y) {
    if (!doc || !doc.elementFromPoint) return null;
    var el = doc.elementFromPoint(x, y);
    while (el && el !== doc.body) {
      if (el.getAttribute) {
        var t = el.getAttribute('data-tag');
        if (t) return Number(t);
      }
      el = el.parentElement;
    }
    return null;
  }

  var _touchId = 1;

  function makeTouch(tag, x, y, identifier) {
    var o = rootOrigin();
    var lx = x, ly = y;
    var tel = tagEl(tag);
    if (tel && tel.getBoundingClientRect) { var tr = tel.getBoundingClientRect(); lx = x - tr.left; ly = y - tr.top; }
    return {
      pageX: x - o.left,
      pageY: y - o.top,
      locationX: lx,
      locationY: ly,
      target: tag,
      identifier: identifier,
      timestamp: Date.now()
    };
  }

  // ---------- 触摸 / 滚动 ----------
  // 与 RN Android 一致：
  //  * 默认不拦截浏览器手势，ScrollView 原生（带惯性）滚动；一旦滚动开始，给 JS 发 topTouchCancel，
  //    这样按钮不会因为滑动而被点中（对应 Android 的 onChildStartedNativeGesture）。
  //  * JS 响应者通过 UIManager.setJSResponder(tag, blockNativeResponder=true) 声明独占（PanResponder、滑杆等）时，
  //    touchmove 上 preventDefault，阻止原生滚动，JS 收到完整的 move。
  //  * 滚动容器的 scroll 事件按帧节流回传 topScroll（contentOffset/contentSize/layoutMeasurement），
  //    VirtualizedList/FlatList 靠它继续渲染后面的行；另发 Begin/EndDrag、Momentum Begin/End。
  var _activeTouch = null;
  HOST._jsResponder = { tag: null, block: false };
  HOST.scrollStats = {}; // 调试计数：各类滚动事件发送次数

  function touchPoint(ev) {
    var t = ev.changedTouches && ev.changedTouches[0];
    if (t) return { x: t.clientX, y: t.clientY, id: t.identifier };
    return { x: ev.clientX, y: ev.clientY, id: -1 };
  }

  function findTouch(ev, id) {
    var l = ev.changedTouches;
    if (!l) return touchPoint(ev);
    for (var i = 0; i < l.length; i++) if (l[i].identifier === id) return { x: l[i].clientX, y: l[i].clientY, id: id };
    return null;
  }

  function scrollRecOf(el) {
    while (el && el !== doc.body) {
      if (el._rnScroll) return el;
      el = el.parentElement;
    }
    return null;
  }

  function fixScrollOverflow(el, props) {
    // RN Android 的 ScrollView 不受 style.overflow 影响（overflow 只决定裁剪），scrollEnabled=false 才禁止滚动
    var enabled = !(props && props.scrollEnabled === false) && el._rnScrollEnabled !== false;
    if (el._rnScroll === 'x') {
      el.style.overflowX = enabled ? 'auto' : 'hidden';
      el.style.overflowY = 'hidden';
    } else {
      el.style.overflowY = enabled ? 'auto' : 'hidden';
      el.style.overflowX = 'hidden';
    }
    el.style.overscrollBehavior = 'contain';
  }

  function scrollPayload(el, tag) {
    return {
      contentOffset: { x: el.scrollLeft, y: el.scrollTop },
      contentSize: { width: el.scrollWidth, height: el.scrollHeight },
      layoutMeasurement: { width: el.clientWidth, height: el.clientHeight },
      contentInset: { top: 0, left: 0, bottom: 0, right: 0 },
      zoomScale: 1,
      velocity: { x: 0, y: 0 },
      responderIgnoreScroll: true,
      target: tag
    };
  }

  function emitScroll(el, name) {
    var t = el.getAttribute && el.getAttribute('data-tag');
    if (!t) return;
    emitEvent(Number(t), name, scrollPayload(el, Number(t)));
    HOST.scrollStats[name] = (HOST.scrollStats[name] || 0) + 1;
  }

  function onAnyScroll(ev) {
    var el = ev.target;
    if (!el || !el._rnScroll) return;
    // 正在拖动的触摸点在这个滚动容器里 → 原生滚动接管，取消 JS 触摸
    var T = _activeTouch;
    if (T && !T.canceled && !HOST._jsResponder.block) {
      var tel = tagEl(T.tag);
      if (tel && el.contains(tel)) {
        T.canceled = true;
        T.dragEl = el;
        receiveTouches('topTouchCancel', [makeTouch(T.tag, T.lastX, T.lastY, T.id)], [0]);
        emitScroll(el, 'topScrollBeginDrag');
      }
    }
    if (!el._rnScrollActive) {
      el._rnScrollActive = true;
      if (!(T && T.dragEl === el)) {
        el._rnMomentum = true;
        emitScroll(el, 'topMomentumScrollBegin');
      }
    }
    if (!el._rnScrollRaf) {
      el._rnScrollRaf = true;
      var raf = (typeof requestAnimationFrame === 'function' && HOST.nativeRaf) ? HOST.nativeRaf : function (f) { return _nST(f, 16); };
      raf(function () {
        el._rnScrollRaf = false;
        emitScroll(el, 'topScroll');
      });
    }
    if (el._rnScrollIdle) _nCT(el._rnScrollIdle);
    el._rnScrollIdle = _nST(function () {
      el._rnScrollIdle = null;
      if (_activeTouch && _activeTouch.dragEl === el) return; // 手指还在
      el._rnScrollActive = false;
      emitScroll(el, 'topScroll');
      if (el._rnMomentum) {
        el._rnMomentum = false;
        emitScroll(el, 'topMomentumScrollEnd');
      }
    }, 140);
  }

  function touchStart(ev) {
    var tgt = ev.target;
    if (tgt && tgt.tagName === 'INPUT') return; // 原生滑杆/开关自行处理
    if (_activeTouch && ev.touches && ev.touches.length > 1) return; // 只跟踪第一根手指（单指时旧记录视为丢失的 end）
    var p = touchPoint(ev);
    var tag = hitTagFromPoint(p.x, p.y);
    if (tag == null) return;
    var id = _touchId++;
    _activeTouch = { id: id, tag: tag, tid: p.id, x0: p.x, y0: p.y, lastX: p.x, lastY: p.y, canceled: false, dragEl: null };
    HOST._jsResponder = { tag: null, block: false };
    // 手指按住正在惯性滚动的列表：停下，且这次触摸不当作点击（Android 行为）
    var sc = scrollRecOf(tgt);
    if (sc && sc._rnMomentum) {
      sc.scrollTo({ left: sc.scrollLeft, top: sc.scrollTop, behavior: 'auto' });
    }
    receiveTouches('topTouchStart', [makeTouch(tag, p.x, p.y, id)], [0]);
  }

  function touchMove(ev) {
    var T = _activeTouch;
    if (!T) return;
    var p = ev.type === 'mousemove' ? touchPoint(ev) : findTouch(ev, T.tid);
    if (!p) return;
    T.lastX = p.x; T.lastY = p.y;
    if (T.canceled) return;
    receiveTouches('topTouchMove', [makeTouch(T.tag, p.x, p.y, T.id)], [0]);
    // JS 响应者要求独占（PanResponder 默认如此）→ 阻止原生滚动
    if (HOST._jsResponder.block && ev.cancelable) {
      try { ev.preventDefault(); } catch (_e) {}
    }
  }

  function touchEnd(ev, cancel) {
    var T = _activeTouch;
    if (!T) return;
    var p = ev.type && ev.type.indexOf('mouse') === 0 ? touchPoint(ev) : findTouch(ev, T.tid);
    if (!p) return;
    _activeTouch = null;
    if (!T.canceled) {
      receiveTouches(cancel ? 'topTouchCancel' : 'topTouchEnd', [makeTouch(T.tag, p.x, p.y, T.id)], [0]);
    }
    if (T.dragEl) {
      var el = T.dragEl;
      emitScroll(el, 'topScrollEndDrag');
      // 松手后可能还有惯性滚动：没有后续 scroll 就直接结束
      el._rnMomentum = true;
      emitScroll(el, 'topMomentumScrollBegin');
      if (el._rnScrollIdle) _nCT(el._rnScrollIdle);
      el._rnScrollIdle = _nST(function () {
        el._rnScrollIdle = null;
        el._rnScrollActive = false;
        el._rnMomentum = false;
        emitScroll(el, 'topScroll');
        emitScroll(el, 'topMomentumScrollEnd');
      }, 160);
    }
    HOST._jsResponder = { tag: null, block: false };
    HOST._lastTouchEndAt = Date.now();
  }

  function installGlobalTouch() {
    if (!doc || HOST._touchInstalled) return;
    HOST._touchInstalled = true;
    var opt = { passive: false, capture: true };
    doc.addEventListener('touchstart', touchStart, opt);
    doc.addEventListener('touchmove', touchMove, opt);
    doc.addEventListener('touchend', function (ev) { touchEnd(ev, false); }, opt);
    doc.addEventListener('touchcancel', function (ev) { touchEnd(ev, true); }, opt);
    doc.addEventListener('scroll', onAnyScroll, { passive: true, capture: true });
    // 桌面 / CDP 鼠标回退（没有原生滚动，拖动就是 JS move）
    var mouseDown = false;
    doc.addEventListener('mousedown', function (ev) {
      if (HOST._lastTouchEndAt && Date.now() - HOST._lastTouchEndAt < 800) return; // 触摸后的兼容鼠标事件
      if (_activeTouch) return;
      mouseDown = true; touchStart(ev);
    }, true);
    doc.addEventListener('mousemove', function (ev) { if (mouseDown) touchMove(ev); }, true);
    doc.addEventListener('mouseup', function (ev) { if (mouseDown) { mouseDown = false; touchEnd(ev, false); } }, true);
  }

  function wireTouches(rec) {
    installGlobalTouch();
  }

  function uiCreateView(tag, className, rootTag, props) {
    var el = createDom(className);
    var rec = { tag: tag, className: className, rootTag: rootTag, el: el, props: {}, children: [] };
    HOST.views[tag] = rec;
    if (el) {
      el.setAttribute('data-tag', String(tag));
      applyProps(rec, props || {});
      wireTouches(rec);
    }
    if (!HOST.roots[rootTag]) {
      HOST.roots[rootTag] = { tag: rootTag, children: [] };
    }
    scheduleLayoutEvents();
    var mount = ensureRootMount();
    if (mount && el && String(tag) === String(rootTag)) {
      el.style.flex = '1 1 auto';
      el.style.width = '100%';
      el.style.height = '100%';
      el.style.minHeight = '100%';
      mount.appendChild(el);
    }
    // quiet: skip per-view createView logs
  }

  function uiUpdateView(tag, className, props) {
    var rec = HOST.views[tag];
    if (!rec) return;
    applyProps(rec, props || {});
    scheduleLayoutEvents();
  }

  function uiSetChildren(containerTag, childrenTags) {
    scheduleLayoutEvents();
    var parent = HOST.views[containerTag];
    if (!parent || !parent.el) {
      // maybe root
      var mount = ensureRootMount();
      if (!mount) return;
      childrenTags.forEach(function (t) {
        var c = HOST.views[t];
        if (c && c.el) {
          c.el.style.flex = c.el.style.flex || '1 1 auto';
          c.el.style.width = c.el.style.width || '100%';
          c.el.style.minHeight = c.el.style.minHeight || '100%';
          mount.appendChild(c.el);
        }
      });
      return;
    }
    while (parent.el.firstChild) parent.el.removeChild(parent.el.firstChild);
    parent.children = [];
    (childrenTags || []).forEach(function (t) {
      var c = HOST.views[t];
      if (c && c.el) {
        parent.el.appendChild(c.el);
        parent.children.push(t);
      }
    });
  }

  function uiManageChildren(containerTag, moveFrom, moveTo, addChildTags, addAtIndices, removeFrom) {
    scheduleLayoutEvents();
    var parent = HOST.views[containerTag];
    var parentEl = parent && parent.el;
    if (!parentEl) {
      parentEl = ensureRootMount();
      if (!parentEl) return;
    }
    var children = Array.prototype.slice.call(parentEl.childNodes);
    var removed = [];
    (removeFrom || []).slice().sort(function (a, b) { return b - a; }).forEach(function (idx) {
      if (children[idx]) {
        removed.push(children[idx]);
        parentEl.removeChild(children[idx]);
      }
    });
    children = Array.prototype.slice.call(parentEl.childNodes);
    var moving = [];
    (moveFrom || []).forEach(function (idx) {
      moving.push(children[idx]);
    });
    (moveFrom || []).slice().sort(function (a, b) { return b - a; }).forEach(function (idx) {
      if (children[idx] && children[idx].parentNode === parentEl) parentEl.removeChild(children[idx]);
    });
    children = Array.prototype.slice.call(parentEl.childNodes);
    (moveTo || []).forEach(function (toIdx, i) {
      var node = moving[i];
      if (!node) return;
      var ref = parentEl.childNodes[toIdx] || null;
      parentEl.insertBefore(node, ref);
    });
    (addChildTags || []).forEach(function (tag, i) {
      var c = HOST.views[tag];
      if (!c || !c.el) return;
      var at = (addAtIndices || [])[i] || 0;
      var ref = parentEl.childNodes[at] || null;
      parentEl.insertBefore(c.el, ref);
    });
    if (parent) {
      parent.children = Array.prototype.map.call(parentEl.childNodes, function (n) {
        return parseInt(n.getAttribute && n.getAttribute('data-tag'), 10);
      }).filter(Boolean);
    }
  }

  function uiRemoveRootView(rootTag) {
    var mount = ensureRootMount();
    if (mount) mount.innerHTML = '';
    delete HOST.roots[rootTag];
  }

  var AUTO_VIEW_CONSTANTS = {
    AndroidSwipeRefreshLayout: { SIZE: { DEFAULT: 1, LARGE: 0 } },
    AndroidDrawerLayout: { DrawerPosition: { Left: 8388611, Right: 8388613 } },
    RCTRefreshControl: { SIZE: { DEFAULT: 1, LARGE: 0 } },
    AndroidDropdownPicker: { MODE_DIALOG: 0, MODE_DROPDOWN: 1 },
    AndroidDialogPicker: { MODE_DIALOG: 0, MODE_DROPDOWN: 1 }
  };

  // 视图命令：RN 组件调用 getViewManagerConfig(name).Commands.xxx（WebView.postMessage、ViewPager.setPage …）
  var COMMON_VIEW_COMMANDS = {};
  ['goBack', 'goForward', 'reload', 'stopLoading', 'postMessage', 'injectJavaScript', 'loadUrl', 'requestFocus',
    'clearFormData', 'clearCache', 'clearHistory', 'setPage', 'setPageWithoutAnimation', 'setScrollEnabled',
    'openDrawer', 'closeDrawer', 'setNativeRefreshing', 'scrollTo', 'scrollToEnd', 'flashScrollIndicators',
    'focusTextInput', 'blurTextInput', 'setTextAndSelection', 'setMostRecentEventCount', 'hotspotUpdate', 'setPressed',
    'play', 'pause', 'stop', 'reset', 'seek', 'start', 'snapShot', 'startRender', 'stopRender', 'refresh', 'update'
  ].forEach(function (n, i) { COMMON_VIEW_COMMANDS[n] = i + 1; });
  function withCommands(cfg) {
    if (cfg && typeof cfg === 'object' && cfg.NativeProps && !cfg.Commands) cfg.Commands = Object.assign({}, COMMON_VIEW_COMMANDS);
    return cfg;
  }

  var COMMAND_NAMES = {};
  Object.keys(COMMON_VIEW_COMMANDS).forEach(function (n) { COMMAND_NAMES[COMMON_VIEW_COMMANDS[n]] = n; });
  function dispatchViewCommand(tag, cmd, args) {
    var rec = HOST.views[tag];
    var el = rec && rec.el;
    if (!el) return;
    var name = typeof cmd === 'string' ? cmd : COMMAND_NAMES[cmd];
    args = args || [];
    try {
      if (el._rnScroll) {
        if (name === 'scrollTo') {
          el.scrollTo({ left: Number(args[0]) || 0, top: Number(args[1]) || 0, behavior: args[2] === false ? 'auto' : 'smooth' });
        } else if (name === 'scrollToEnd') {
          el.scrollTo({ left: el._rnScroll === 'x' ? el.scrollWidth : el.scrollLeft, top: el._rnScroll === 'x' ? el.scrollTop : el.scrollHeight,
            behavior: args[0] === false ? 'auto' : 'smooth' });
        }
        return;
      }
    } catch (e) {
      log('view command error', name, String(e && e.message || e));
    }
  }

  // Build module table
  var uic = mergeSvgAttrs(buildUIManagerConstants());
  Object.keys(uic).forEach(function (k) { withCommands(uic[k]); });
  registerModule('UIManager', [
    'getConstants', 'getConstantsForViewManager', 'getDefaultEventTypes',
    'createView', 'updateView', 'manageChildren', 'setChildren',
    'measure', 'measureInWindow', 'measureLayout', 'measureLayoutRelativeToParent',
    'setJSResponder', 'clearJSResponder', 'dispatchViewManagerCommand',
    'setLayoutAnimationEnabledExperimental', 'configureNextLayoutAnimation',
    'removeRootView', 'removeSubviewsFromContainerWithID', 'replaceExistingNonRootView',
    'showPopupMenu', 'dismissPopupMenu', 'playTouchSound', 'sendAccessibilityEvent',
    'viewIsDescendantOf', 'findSubviewIn', 'lazilyLoadView', 'blur', 'focus'
  ], uic, {
    getConstants: function () { return uic; },
    getConstantsForViewManager: function (name) {
      if (!uic[name]) {
        log('auto viewConfig', name);
        uic[name] = viewConfig(Object.assign({}, commonViewProps, {
          d: 'String', x: 'String', y: 'String', width: 'String', height: 'String',
          fill: 'String', stroke: 'String', strokeWidth: 'String', opacity: 'number',
          cx: 'String', cy: 'String', r: 'String', rx: 'String', ry: 'String',
          fx: 'String', fy: 'String', gradient: 'Array', gradientUnits: 'number',
          href: 'String', id: 'String', name: 'String',
          points: 'String', transform: 'String', viewBox: 'String',
          preserveAspectRatio: 'String', src: 'Map', source: 'RCTImageSource',
          progress: 'number', speed: 'number', loop: 'boolean',
          text: 'String', alignment: 'number', font: 'Map', fontSize: 'number',
          fontWeight: 'String', fontFamily: 'String'
        }), { Manager: name + 'Manager' });
        // 一些 RN 组件在模块加载时读 viewManager 的 Constants（如 RefreshControl.SIZE），缺了会整模块抛错
        uic[name].Constants = Object.assign({}, AUTO_VIEW_CONSTANTS[name] || {});
        withCommands(uic[name]);
        uic[name].directEventTypes = Object.assign({
          topRefresh: { registrationName: 'onRefresh' },
          topDrawerOpened: { registrationName: 'onDrawerOpen' },
          topDrawerClosed: { registrationName: 'onDrawerClose' },
          topSelect: { registrationName: 'onSelect' },
          topPageSelected: { registrationName: 'onPageSelected' },
          topPageScroll: { registrationName: 'onPageScroll' },
          topPageScrollStateChanged: { registrationName: 'onPageScrollStateChanged' },
          topLoadingStart: { registrationName: 'onLoadingStart' },
          topLoadingFinish: { registrationName: 'onLoadingFinish' },
          topLoadingError: { registrationName: 'onLoadingError' },
          topMessage: { registrationName: 'onMessage' }
        }, uic[name].directEventTypes || {});
      }
      return uic[name];
    },
    getDefaultEventTypes: function () {
      return { bubblingEventTypes: uic.genericBubblingEventTypes, directEventTypes: uic.genericDirectEventTypes };
    },
    createView: uiCreateView,
    updateView: uiUpdateView,
    setChildren: uiSetChildren,
    manageChildren: uiManageChildren,
    removeRootView: uiRemoveRootView,
    measure: function (tag, cb) {
      var m = measureTag(tag);
      if (typeof cb === 'function') cb.apply(null, m);
      return m;
    },
    measureInWindow: function (tag, cb) {
      var m = measureTag(tag);
      var out = [m[4], m[5], m[2], m[3]];
      if (typeof cb === 'function') cb.apply(null, out);
      return out;
    },
    measureLayout: function (tag, ancestor, err, succ) {
      var m = measureTag(tag);
      if (typeof succ === 'function') succ(m[0], m[1], m[2], m[3]);
    },
    measureLayoutRelativeToParent: function (tag, err, succ) {
      var m = measureTag(tag);
      if (typeof succ === 'function') succ(m[0], m[1], m[2], m[3]);
    },
    setJSResponder: function (tag, block) { HOST._jsResponder = { tag: tag, block: !!block }; },
    clearJSResponder: function () { HOST._jsResponder = { tag: null, block: false }; },
    dispatchViewManagerCommand: dispatchViewCommand,
    setLayoutAnimationEnabledExperimental: function () {},
    configureNextLayoutAnimation: function (c, sb, eb) { if (typeof sb === 'function') sb(); },
    removeSubviewsFromContainerWithID: function (tag) {
      var rec = HOST.views[tag];
      if (rec && rec.el) rec.el.innerHTML = '';
    },
    replaceExistingNonRootView: function () {},
    showPopupMenu: function () {},
    dismissPopupMenu: function () {},
    playTouchSound: function () {},
    sendAccessibilityEvent: function () {},
    viewIsDescendantOf: function (t, a, cb) { if (typeof cb === 'function') cb(false); },
    findSubviewIn: function () {},
    lazilyLoadView: function (name) { return { viewConfig: uic[name] }; },
    blur: function () {},
    focus: function () {}
  }, [], ['getConstants', 'getConstantsForViewManager', 'getDefaultEventTypes', 'lazilyLoadView']);

  // Timing
  var timers = Object.create(null);
  registerModule('Timing', ['createTimer', 'deleteTimer', 'setSendIdleEvents'], {}, {
    createTimer: function (id, duration, jsSchedulingTime, repeats) {
      var delay = Math.max(0, (jsSchedulingTime || Date.now()) + duration - Date.now());
      var fn = function () {
        callJs('JSTimers', 'callTimers', [[id]]);
        if (!repeats) delete timers[id];
      };
      if (repeats) timers[id] = { r: true, h: _nSI(fn, duration || 1) };
      else timers[id] = { r: false, h: _nST(fn, delay) };
    },
    deleteTimer: function (id) {
      var t = timers[id]; if (t) { if (t.r) _nCI(t.h); else _nCT(t.h); delete timers[id]; }
    },
    setSendIdleEvents: function () {}
  });

  registerModule('DeviceInfo', [], {
    Dimensions: uic.Dimensions,
    isIPhoneX_deprecated: false
  }, {});

  registerModule('PlatformConstants', [], {
    isTesting: false,
    reactNativeVersion: { major: 0, minor: 61, patch: 0, prerelease: null },
    Version: 28,
    Release: '9',
    Serial: 'HOST',
    Fingerprint: 'rn-host',
    Model: 'HarmonyRNHost',
    uiMode: 'normal',
    Brand: 'xiaomi',
    Manufacturer: 'xiaomi'
  }, {});

  // Status bar height (dp) the Web view sits under; ArkTS passes the real top avoid-area via ?sb= / __statusBarDp.
  function statusBarDp() {
    var v = Number(global.__statusBarDp);
    if (!isFinite(v) || v < 0) {
      var m = typeof location !== 'undefined' && location.search ? location.search.match(/[?&]sb=([0-9.]+)/) : null;
      v = m ? Number(m[1]) : 0;
    }
    return isFinite(v) ? v : 0;
  }
  registerModule('StatusBarManager', ['getHeight', 'setStyle', 'setHidden', 'setNetworkActivityIndicatorVisible', 'setBackgroundColor', 'setTranslucent', 'setColor', 'setHidden'], {
    HEIGHT: statusBarDp(),
    DEFAULT_BACKGROUND_COLOR: 0
  }, {
    getHeight: function (cb) { var h = statusBarDp(); if (typeof cb === 'function') cb({ height: h }); return { height: h }; },
    setStyle: function (style) { HOST.statusBarStyle = style; hostInvoke('statusBarStyle', { style: String(style || '') }).catch(function () {}); },
    setHidden: function () {}, setNetworkActivityIndicatorVisible: function () {},
    setBackgroundColor: function () {}, setTranslucent: function () {}, setColor: function () {}
  }, [], ['getHeight']);

  registerModule('AppState', ['getCurrentAppState'], { initialAppState: 'active' }, {
    getCurrentAppState: function (succ) { if (typeof succ === 'function') succ({ app_state: 'active' }); }
  });

  registerModule('I18nManager', ['allowRTL', 'forceRTL', 'swapLeftAndRightInRTL'], {
    isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: 'zh_CN'
  }, { allowRTL: function () {}, forceRTL: function () {}, swapLeftAndRightInRTL: function () {} });

  registerModule('SourceCode', [], {
    scriptURL: 'file:///android_asset/plugin_rn_sdk/sdk.bundle'
  }, {});

  registerModule('ExceptionsManager', ['reportFatalException', 'reportSoftException', 'updateExceptionMessage', 'dismissRedbox'], {}, {
    reportFatalException: function (m, st, i) { if (!HOST.firstFatal) HOST.firstFatal = String(m); log('FATAL', m, st); },
    reportSoftException: function (m, s, i) { log('SOFT', m); },
    updateExceptionMessage: function () {},
    dismissRedbox: function () {}
  });

  registerModule('DeviceEventManager', ['invokeDefaultBackButtonHandler', 'invokeDefaultBackPressHandler'], {}, {
    invokeDefaultBackButtonHandler: function () { log('back -> exit'); exitPlugin(); },
    // RN 0.61 BackHandler.exitApp() 调的是 invokeDefaultBackPressHandler
    invokeDefaultBackPressHandler: function () { log('back -> exit'); exitPlugin(); }
  });

  registerModule('Networking', ['sendRequest', 'abortRequest', 'clearCookies'], {}, {
    sendRequest: function () { log('Networking.sendRequest stub'); },
    abortRequest: function () {},
    clearCookies: function (cb) { if (typeof cb === 'function') cb(false); }
  });

  registerModule('WebSocketModule', ['connect', 'send', 'sendBinary', 'ping', 'close'], {}, {
    connect: function () {}, send: function () {}, sendBinary: function () {}, ping: function () {}, close: function () {}
  });

  registerModule('BlobModule', ['addNetworkingHandler', 'addWebSocketHandler', 'removeWebSocketHandler', 'sendOverSocket', 'createFromParts', 'release'], {
    BLOB_URI_SCHEME: 'blob', BLOB_URI_HOST: null
  }, {
    addNetworkingHandler: function () {}, addWebSocketHandler: function () {}, removeWebSocketHandler: function () {},
    sendOverSocket: function () {}, createFromParts: function () {}, release: function () {}
  });

  registerModule('ImageLoader', ['getSize', 'getSizeWithHeaders', 'prefetchImage', 'prefetchImageWithMetadata', 'queryCache', 'abortRequest'], {}, {
    getSize: function (uri, succ, err) { if (typeof succ === 'function') succ(100, 100); },
    getSizeWithHeaders: function (uri, h) { return Promise.resolve({ width: 100, height: 100 }); },
    prefetchImage: function () { return Promise.resolve(true); },
    prefetchImageWithMetadata: function () { return Promise.resolve(true); },
    queryCache: function (uris) { return Promise.resolve({}); },
    abortRequest: function () {}
  }, ['getSizeWithHeaders', 'prefetchImage', 'prefetchImageWithMetadata', 'queryCache']);

  registerModule('AsyncLocalStorage', ['multiGet', 'multiSet', 'multiRemove', 'multiMerge', 'clear', 'getAllKeys'], {}, {
    multiGet: function (keys, cb) { if (typeof cb === 'function') cb(null, keys.map(function (k) { return [k, null]; })); },
    multiSet: function (kv, cb) { if (typeof cb === 'function') cb(null); },
    multiRemove: function (keys, cb) { if (typeof cb === 'function') cb(null); },
    multiMerge: function (kv, cb) { if (typeof cb === 'function') cb(null); },
    clear: function (cb) { if (typeof cb === 'function') cb(null); },
    getAllKeys: function (cb) { if (typeof cb === 'function') cb(null, []); }
  });
  registerModule('AsyncSQLiteDBStorage', ['multiGet', 'multiSet', 'multiRemove', 'multiMerge', 'clear', 'getAllKeys'], {}, {
    multiGet: function (keys, cb) { if (typeof cb === 'function') cb(null, keys.map(function (k) { return [k, null]; })); },
    multiSet: function (kv, cb) { if (typeof cb === 'function') cb(null); },
    multiRemove: function (keys, cb) { if (typeof cb === 'function') cb(null); },
    multiMerge: function (kv, cb) { if (typeof cb === 'function') cb(null); },
    clear: function (cb) { if (typeof cb === 'function') cb(null); },
    getAllKeys: function (cb) { if (typeof cb === 'function') cb(null, []); }
  });

  registerModule('Clipboard', ['getString', 'setString'], {}, {
    getString: function () { return Promise.resolve(''); },
    setString: function () {}
  }, ['getString']);

  registerModule('Vibration', ['vibrate', 'vibrateByPattern', 'cancel'], {}, {
    vibrate: function () {}, vibrateByPattern: function () {}, cancel: function () {}
  });

  registerModule('ToastAndroid', ['show', 'showWithGravity', 'showWithGravityAndOffset'], {
    SHORT: 0, LONG: 1, TOP: 49, BOTTOM: 81, CENTER: 17
  }, {
    show: function (m) { log('Toast', m); },
    showWithGravity: function (m) { log('Toast', m); },
    showWithGravityAndOffset: function (m) { log('Toast', m); }
  });

  registerModule('LinkingManager', ['openURL', 'canOpenURL', 'getInitialURL', 'openSettings'], {}, {
    openURL: function (u) { return Promise.resolve(true); },
    canOpenURL: function (u) { return Promise.resolve(true); },
    getInitialURL: function () { return Promise.resolve(null); },
    openSettings: function () { return Promise.resolve(); }
  }, ['openURL', 'canOpenURL', 'getInitialURL', 'openSettings']);

  registerModule('IntentAndroid', ['openURL', 'canOpenURL', 'getInitialURL', 'openSettings', 'sendIntent'], {}, {
    openURL: function (u) { return Promise.resolve(true); },
    canOpenURL: function () { return Promise.resolve(true); },
    getInitialURL: function () { return Promise.resolve(null); },
    openSettings: function () { return Promise.resolve(); },
    sendIntent: function () { return Promise.resolve(); }
  }, ['openURL', 'canOpenURL', 'getInitialURL', 'openSettings', 'sendIntent']);

  registerModule('PermissionsAndroid', ['checkPermission', 'requestPermission', 'shouldShowRequestPermissionRationale', 'requestMultiplePermissions'], {}, {
    checkPermission: function () { return Promise.resolve(true); },
    requestPermission: function () { return Promise.resolve('granted'); },
    shouldShowRequestPermissionRationale: function () { return Promise.resolve(false); },
    requestMultiplePermissions: function () { return Promise.resolve({}); }
  }, ['checkPermission', 'requestPermission', 'shouldShowRequestPermissionRationale', 'requestMultiplePermissions']);

  registerModule('DialogManagerAndroid', ['showAlert'], {
    buttonClicked: 'buttonClicked', dismissed: 'dismissed', buttonPositive: -1, buttonNegative: -2, buttonNeutral: -3
  }, {
    showAlert: function (cfg, onError, onAction) { if (typeof onAction === 'function') onAction('buttonClicked', -1); }
  });

  registerModule('DatePickerAndroid', ['open'], {}, {
    open: function () { return Promise.resolve({ action: 'dismissedAction' }); }
  }, ['open']);
  registerModule('TimePickerAndroid', ['open'], {}, {
    open: function () { return Promise.resolve({ action: 'dismissedAction' }); }
  }, ['open']);

  registerModule('ShareModule', ['share'], {}, {
    share: function () { return Promise.resolve({ action: 'sharedAction' }); }
  }, ['share']);

  registerModule('AccessibilityInfo', ['isReduceMotionEnabled', 'isTouchExplorationEnabled', 'setAccessibilityFocus', 'announceForAccessibility'], {}, {
    isReduceMotionEnabled: function () { return Promise.resolve(false); },
    isTouchExplorationEnabled: function () { return Promise.resolve(false); },
    setAccessibilityFocus: function () {},
    announceForAccessibility: function () {}
  }, ['isReduceMotionEnabled', 'isTouchExplorationEnabled']);

  registerModule('KeyboardObserver', [], {}, {});
  registerModule('NativeAnimatedModule', [
    'createAnimatedNode', 'startListeningToAnimatedNodeValue', 'stopListeningToAnimatedNodeValue',
    'connectAnimatedNodes', 'disconnectAnimatedNodes', 'startAnimatingNode', 'stopAnimation',
    'setAnimatedNodeValue', 'setAnimatedNodeOffset', 'flattenAnimatedNodeOffset', 'extractAnimatedNodeOffset',
    'connectAnimatedNodeToView', 'disconnectAnimatedNodeFromView', 'restoreDefaultValues', 'dropAnimatedNode',
    'addAnimatedEventToView', 'removeAnimatedEventFromView', 'addListener', 'removeListeners'
  ], {}, new Proxy({}, { get: function () { return function () {}; } }));

  registerModule('Appearance', ['getColorScheme'], {}, {
    getColorScheme: function () { return 'light'; }
  }, [], ['getColorScheme']);

  registerModule('SegmentFetcher', ['fetchSegment'], {}, {
    fetchSegment: function (id, opt, cb) { if (typeof cb === 'function') cb(null); }
  });

  registerModule('HeadlessJsTaskSupport', ['notifyTaskFinished', 'notifyTaskRetry'], {}, {
    notifyTaskFinished: function () {}, notifyTaskRetry: function () { return Promise.resolve(false); }
  }, ['notifyTaskRetry']);

  registerModule('BugReporting', ['startExtraDataCapture', 'stopExtraDataCapture'], {}, {
    startExtraDataCapture: function () {}, stopExtraDataCapture: function () {}
  });

  registerModule('FileReaderModule', ['readAsDataURL', 'readAsText'], {}, {
    readAsDataURL: function () { return Promise.resolve(''); },
    readAsText: function () { return Promise.resolve(''); }
  }, ['readAsDataURL', 'readAsText']);

  registerModule('ModalManager', [], {}, {});
  registerModule('RedBox', ['setExtraData', 'dismiss'], {}, { setExtraData: function () {}, dismiss: function () {} });
  registerModule('FrameRateLogger', ['setGlobalOptions', 'setContext', 'beginScroll', 'endScroll'], {}, {
    setGlobalOptions: function () {}, setContext: function () {}, beginScroll: function () {}, endScroll: function () {}
  });
  registerModule('JSDevSupport', ['getJSHierarchy'], {}, {
    getJSHierarchy: function (t, s, e) { if (typeof e === 'function') e({ message: 'na' }); }
  });
  registerModule('JSCSamplingProfiler', ['poke'], {}, { poke: function (cb) { if (typeof cb === 'function') cb(null, null); } });
  registerModule('HeapCapture', ['captureHeap'], {}, { captureHeap: function () {} });
  registerModule('ActionSheetManager', ['showActionSheetWithOptions', 'showShareActionSheetWithOptions'], {}, {
    showActionSheetWithOptions: function (o, cb) { if (typeof cb === 'function') cb(0); },
    showShareActionSheetWithOptions: function () {}
  });
  registerModule('PushNotificationManager', [], {}, {});
  registerModule('TVNavigationEventEmitter', ['addListener', 'removeListeners'], {}, {
    addListener: function () {}, removeListeners: function () {}
  });
  registerModule('ImagePickerIOS', [], {}, {});
  registerModule('RNCWebView', ['isFileUploadSupported', 'shouldStartLoadWithLockIdentifier'], {}, {
    isFileUploadSupported: function () { return Promise.resolve(false); },
    shouldStartLoadWithLockIdentifier: function () {}
  }, ['isFileUploadSupported']);
  registerModule('RNCNetInfo', ['getCurrentState', 'addListener', 'removeListeners'], {}, {
    getCurrentState: function () { return Promise.resolve({ type: 'wifi', isConnected: true, isInternetReachable: true }); },
    addListener: function () {}, removeListeners: function () {}
  }, ['getCurrentState']);
  // react-native-gesture-handler（部分插件自带）：模块加载即读 Direction/State 常量；手势本身退化为普通触摸
  registerModule('RNGestureHandlerModule', ['createGestureHandler', 'attachGestureHandler', 'updateGestureHandler',
    'dropGestureHandler', 'handleSetJSResponder', 'handleClearJSResponder'], {
    State: { UNDETERMINED: 0, FAILED: 1, BEGAN: 2, CANCELLED: 3, ACTIVE: 4, END: 5 },
    Direction: { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 }
  }, {
    createGestureHandler: function () {}, attachGestureHandler: function () {}, updateGestureHandler: function () {},
    dropGestureHandler: function () {}, handleSetJSResponder: function () {}, handleClearJSResponder: function () {}
  });
  registerModule('Orientation', ['lockToPortrait', 'lockToLandscape', 'unlockAllOrientations', 'getOrientation'], {}, {
    lockToPortrait: function () {}, lockToLandscape: function () {}, unlockAllOrientations: function () {},
    getOrientation: function (cb) { if (typeof cb === 'function') cb('PORTRAIT'); }
  });
  registerModule('ScrollViewManager', [], {}, {});

  // ---- MIOT modules ----
  function makeStub(name, constants, methodNames, impl) {
    impl = impl || {};
    var methods = methodNames || [];
    var handler = {
      get: function (t, prop) {
        if (prop in impl) return impl[prop];
        if (prop === 'then' || prop === 'toJSON' || typeof prop === 'symbol') return undefined;
        return function () {
          log(name + '.' + String(prop), 'noop', arguments.length);
          var args = Array.prototype.slice.call(arguments);
          var last = args[args.length - 1];
          var second = args[args.length - 2];
          if (typeof last === 'function' && typeof second === 'function') { last(null); return; }
          if (typeof last === 'function') { last(true, {}); return; }
          return Promise.resolve(null);
        };
      }
    };
    var base = Object.assign({}, impl);
    registerModule(name, methods, constants || {}, new Proxy(base, handler), [], []);
  }

  var deviceConst = Object.assign({}, HOST.device);
  registerModule('MIOTDevice', [
    'callMethod', 'callMethodFromCloud', 'callMethodFromLocal', 'callMethodForceWay',
    'getVersion', 'getDeviceTimeZone', 'localPingWithCallback', 'changeDeviceName',
    'loadSubDevices', 'getLinkedBTDevices', 'getRecommendScenes', 'getRoomInfoForCurrentHome',
    'getRoomLocation', 'getHomeDeviceList', 'getHomeMemberList', 'getAllDeviceList',
    'getAllDevicesOfBelongedCompanies', 'getCurrentSelectHomeInfo', 'getCurrentDeviceValue',
    'getFreqFlag', 'getFreqCameraFlag', 'hasSetDeviceCall', 'isBelongToCarRoom',
    'readDeviceNetWorkInfo', 'subscribeMessages', 'unsubscribeMessages',
    'requestAuthorizedDeviceListData', 'getDevicesInfoFromDids',
    'setPrivacyConfirmation', 'getNativePrivacyConfirmationVersion', 'setNativePrivacyConfirmationVersion',
    'setCommonUseDeviceSwitch', 'reportDeviceGPSInfo', 'sendWakeUpCommandToDevice', 'sendKeyFramePayLoad'
  ], { currentDevice: deviceConst }, {
    callMethod: function (didOrMethod, methodOrParams, paramsOrExtra, extra) {
      // Real SDK: MIOTDevice.callMethod(did, method, argsJson, extraJson, cb(ok,res))
      // Callbacks are peeled by invokeNative; here we only see data args.
      var did = HOST.device && HOST.device.did;
      var method;
      var params;
      if (typeof methodOrParams === 'string') {
        did = String(didOrMethod);
        method = methodOrParams;
        params = paramsOrExtra;
      } else {
        method = didOrMethod;
        params = methodOrParams;
      }
      if (typeof params === 'string') {
        try { params = JSON.parse(params); } catch (e1) {}
      }
      log('MIOTDevice.callMethod', method, params);
      return hostInvoke('callMethod', { did: did, method: method, params: params });
    },
    callMethodFromCloud: function (didOrMethod, methodOrParams, paramsOrExtra, extra) {
      return this.callMethod(didOrMethod, methodOrParams, paramsOrExtra, extra);
    },
    callMethodFromLocal: function (didOrMethod, methodOrParams, paramsOrExtra, extra) {
      return this.callMethod(didOrMethod, methodOrParams, paramsOrExtra, extra);
    },
    callMethodForceWay: function (didOrMethod, methodOrParams, paramsOrExtra, wayOrExtra, extra) {
      // (did, method, params, way, extra) or (method, params, way)
      if (typeof methodOrParams === 'string') {
        return this.callMethod(didOrMethod, methodOrParams, paramsOrExtra, extra || wayOrExtra);
      }
      return this.callMethod(didOrMethod, methodOrParams, paramsOrExtra);
    },
    getVersion: function (force, cb) { if (typeof force === 'function') { force('1.0.0'); return; } if (typeof cb === 'function') cb('1.0.0'); return Promise.resolve('1.0.0'); },
    getDeviceTimeZone: function () { return Promise.resolve({ timeZone: 'Asia/Shanghai' }); },
    localPingWithCallback: function (cb) { if (typeof cb === 'function') cb(true); },
    changeDeviceName: function () { return Promise.resolve(true); },
    loadSubDevices: function () { return Promise.resolve([]); },
    getLinkedBTDevices: function () { return Promise.resolve([]); },
    getRecommendScenes: function () { return Promise.resolve([]); },
    getRoomInfoForCurrentHome: function () { return Promise.resolve({}); },
    getRoomLocation: function () { return Promise.resolve({}); },
    getHomeDeviceList: function () { return Promise.resolve([]); },
    getHomeMemberList: function () { return Promise.resolve([]); },
    getAllDeviceList: function () { return Promise.resolve([]); },
    getAllDevicesOfBelongedCompanies: function () { return Promise.resolve([]); },
    getCurrentSelectHomeInfo: function () { return Promise.resolve({}); },
    getCurrentDeviceValue: function () { return Promise.resolve({}); },
    getFreqFlag: function () { return Promise.resolve(false); },
    getFreqCameraFlag: function () { return Promise.resolve(false); },
    hasSetDeviceCall: function () { return Promise.resolve(false); },
    isBelongToCarRoom: function () { return Promise.resolve(false); },
    readDeviceNetWorkInfo: function (did, cb) { if (typeof cb === 'function') cb({ ssid: '', bssid: '', rssi: 0 }); },
    subscribeMessages: function () { return Promise.resolve(true); },
    unsubscribeMessages: function () { return Promise.resolve(true); },
    requestAuthorizedDeviceListData: function () { return Promise.resolve([]); },
    getDevicesInfoFromDids: function () { return Promise.resolve([]); },
    setPrivacyConfirmation: function () { return Promise.resolve(true); },
    getNativePrivacyConfirmationVersion: function () { return Promise.resolve(0); },
    setNativePrivacyConfirmationVersion: function () { return Promise.resolve(true); },
    setCommonUseDeviceSwitch: function () { return Promise.resolve(true); },
    reportDeviceGPSInfo: function () { return Promise.resolve(true); },
    sendWakeUpCommandToDevice: function () { return Promise.resolve(true); },
    sendKeyFramePayLoad: function () { return Promise.resolve(true); }
  }, ['getVersion', 'getDeviceTimeZone', 'changeDeviceName', 'loadSubDevices', 'getLinkedBTDevices', 'getRecommendScenes',
    'getRoomInfoForCurrentHome', 'getRoomLocation', 'getHomeDeviceList', 'getHomeMemberList', 'getAllDeviceList',
    'getAllDevicesOfBelongedCompanies', 'getCurrentSelectHomeInfo', 'getCurrentDeviceValue', 'getFreqFlag',
    'getFreqCameraFlag', 'hasSetDeviceCall', 'isBelongToCarRoom', 'requestAuthorizedDeviceListData',
    'getDevicesInfoFromDids', 'setPrivacyConfirmation', 'getNativePrivacyConfirmationVersion',
    'setNativePrivacyConfirmationVersion', 'setCommonUseDeviceSwitch', 'reportDeviceGPSInfo',
    'sendWakeUpCommandToDevice', 'sendKeyFramePayLoad', 'subscribeMessages', 'unsubscribeMessages']);

  registerModule('MIOTPackage', [
    'apiReport', 'getPluginAppConfigValueForKey', 'installModule', 'onDeventJs', 'onPackageLifecycle',
    'setExitInfo', 'setParentControllerGestureEnabled', 'specModelNames', 'specPluginIDs',
    'specPluginNames', 'specPluginNamesModels'
  ], {
    packageName: HOST.packageName,
    packageID: '0',
    pluginID: HOST.pluginId,
    version: '1.0.55',
    apiLevel: 10055,
    buildType: 'release',
    models: HOST.device.model,
    basePath: HOST.sdkBase,
    plugPath: HOST.plugBase,
    localFilePath: HOST.localBase,
    entryInfo: { type: 'main', payload: {} },
    eventRandom: '',
    packageNameLastComponent: 'prototype'
  }, {
    apiReport: function () {},
    getPluginAppConfigValueForKey: function () { return null; },
    installModule: function () { return Promise.resolve(true); },
    onDeventJs: function () {},
    onPackageLifecycle: function () {},
    setExitInfo: function () {},
    setParentControllerGestureEnabled: function () {},
    specModelNames: function () { return []; },
    specPluginIDs: function () { return []; },
    specPluginNames: function () { return []; },
    specPluginNamesModels: function () { return []; }
  }, ['installModule']);

  registerModule('MIOTHost', [
    'closeCurrentPage', 'backToPluginPage', 'copyToClipboard', 'getWifiList',
    'loadFloatWindowSettingPage', 'openPrivacyPage', 'openNewPage', 'openPluginPage',
    'openConsumerGoodsPage', 'openShopPage', 'openCustomerServicePage', 'openFeedbackPage',
    'loadUrlPage', 'openUrlPage', 'keepScreenOn', 'getDarkModeStatus', 'showBLESwitchGuide',
    'dismissBLESwitchGuide', 'getDevicesWithModel', 'getConnectedWifi',
    'encodeMD5', 'encodeBase64', 'decodeBase64', 'encodeSHA1', 'encodeSHA2',
    'getAvailableAudioRecordSettingValues', 'startAudioRecord', 'stopAudioRecord',
    'startPlayAudio', 'stopPlayAudio', 'isAudioRecording', 'isAudioPlaying',
    'getLocalFileList', 'deleteFile', 'writeFile', 'readFile', 'appendFile',
    'createDirectory', 'isFileExists', 'getFileInfo',
    'getPhoneScreenInfo', 'getAppSystemSupport', 'addLog',
    'executeMethod', 'convertCronToDate', 'convertDateToCron'
  ], {
    language: 'zh',
    systemInfo: {
      hostApiLevel: 10055,
      sysVersion: '9',
      mobileModel: 'HarmonyRNHost',
      isAndroidPad: false,
      isAndroidFold: false
    },
    apiLevel: 10055,
    appVersion: '8.0.0',
    isDebug: false,
    displayOrder: 0
  }, {
    closeCurrentPage: function () { log('MIOTHost.closeCurrentPage'); exitPlugin(); },
    backToPluginPage: function () {},
    copyToClipboard: function (t) {},
    getWifiList: function () { return Promise.resolve([]); },
    openPrivacyPage: function () {},
    openNewPage: function () {},
    openPluginPage: function () {},
    loadUrlPage: function () {},
    openUrlPage: function () {},
    keepScreenOn: function () {},
    getDarkModeStatus: function () { return Promise.resolve('light'); },
    showBLESwitchGuide: function () {},
    dismissBLESwitchGuide: function () {},
    getDevicesWithModel: function () { return Promise.resolve([]); },
    getConnectedWifi: function () { return Promise.resolve({ SSID: '', BSSID: '' }); },
    encodeMD5: function (s) { return Promise.resolve(''); },
    encodeBase64: function (s) { return Promise.resolve(''); },
    decodeBase64: function (s) { return Promise.resolve(''); },
    encodeSHA1: function (s) { return Promise.resolve(''); },
    encodeSHA2: function (s) { return Promise.resolve(''); },
    // Android SDK: MIOTHost.getPhoneScreenInfo((ok, info) => { width = info.viewWidth; height = info.viewHeight })
    getPhoneScreenInfo: function () {
      var d = global.__RNHOST_DIMENSIONS__ || { window: { width: 392, height: 800, scale: 3 } };
      var w = d.window;
      return { viewWidth: w.width, viewHeight: w.height, width: w.width, height: w.height, scale: w.scale,
        screenWidth: d.screen ? d.screen.width : w.width, screenHeight: d.screen ? d.screen.height : w.height, density: w.scale };
    },
    getAppSystemSupport: function () { return Promise.resolve({}); },
    addLog: function () {},
    executeMethod: function () { return Promise.resolve(null); },
    convertCronToDate: function () { return Promise.resolve({}); },
    convertDateToCron: function () { return Promise.resolve(''); }
  }, [
    'getWifiList', 'getDarkModeStatus', 'getDevicesWithModel', 'getConnectedWifi',
    'encodeMD5', 'encodeBase64', 'decodeBase64', 'encodeSHA1', 'encodeSHA2',
    'getAppSystemSupport', 'executeMethod', 'convertCronToDate', 'convertDateToCron'
  ]);

  // After a successful cloud set, push the new values like the native device-message channel
  // ('deviceRecievedMessages' + MIOTPackage.eventRandom, {did, data:[{key:'prop.s.p', value:[v], time}]}),
  // so subscribers (DeviceEvent.deviceReceivedMessages) update without waiting for the SDK poll.
  function pushSetResultAsMessages(params, res) {
    var body = typeof res === 'string' ? JSON.parse(res) : res;
    var req = typeof params === 'string' ? JSON.parse(params) : params;
    var list = (req && req.params) || [];
    var results = (body && body.result) || [];
    var data = [];
    list.forEach(function (p, i) {
      var r = results[i] || {};
      if (r.code !== undefined && r.code !== 0 && r.code !== 1) return;
      if (String(p.did || HOST.device.did) !== String(HOST.device.did)) return;
      data.push({ key: 'prop.' + p.siid + '.' + p.piid, value: [p.value], time: Math.floor(Date.now() / 1000) });
    });
    if (!data.length) return;
    var pid = NAME_TO_ID.MIOTPackage;
    var rnd = (pid != null && MODULES[pid].constants.eventRandom) || '';
    _nST(function () {
      callJs('RCTDeviceEventEmitter', 'emit', ['deviceRecievedMessages' + rnd, { did: String(HOST.device.did), data: data }]);
      log('pushed device messages', JSON.stringify(data));
    }, 0);
  }

  registerModule('MIOTService', [
    'callSmartHomeAPI', 'callMiCloudAPI', 'callSpecificAPI', 'callSmartHomeCameraAPI',
    'callSmartHomeCameraAPIWithStringParam', 'callSmartChatAPI',
    'getServerName', 'getServiceTokenWithSid', 'getHomeList', 'getDeviceIcon',
    'getCustomPluginInfo', 'getHomepageSettings', 'getSTDGuideSettings',
    'getABTestConfigByPath', 'getABTestConfigByDidAndPath', 'activeABTestByPath',
    'addLog', 'addStat', 'deleteDevice', 'connectWifi', 'cancelSSE',
    'fetchMultilingualResources', 'actionTemplatesForQualifiedDid',
    'deleteSceneRecords', 'editSceneRecord'
  ], {
    account: { ID: '0', nickName: 'user', avatarURL: '', sex: 0 },
    currentDarkMode: 'light',
    currentCountry: 'CN',
    currentCountryCode: 'cn',
    serverCode: 'cn'
  }, {
    callSmartHomeAPI: function (path, params) {
      log('MIOTService.callSmartHomeAPI', path);
      return hostInvoke('callSmartHomeAPI', { path: path, params: params, __did: HOST.device.did }).then(function (res) {
        // Android SDK nativeCall: callback(ok, resJsonString) then JSON.parse(res) and reads .result.
        // Passing an object makes JSON.parse throw and the SDK silently substitutes {} (=> all props null).
        if (res == null) res = { code: 0, result: {} };
        try { if (/\/miotspec\/prop\/set/.test(String(path))) pushSetResultAsMessages(params, res); } catch (_ep) {}
        if (typeof res === 'string') return res;
        try { return JSON.stringify(res); } catch (_e) { return '{}'; }
      });
    },
    callMiCloudAPI: function (sid, path, method, params, cb) {
      this.callSmartHomeAPI(path, params, cb);
    },
    callSpecificAPI: function (url, method, params, cb) {
      if (typeof cb === 'function') cb(true, '{}', '', null);
    },
    callSmartHomeCameraAPI: function () { var cb = arguments[arguments.length - 1]; if (typeof cb === 'function') cb(true, '{}'); },
    callSmartHomeCameraAPIWithStringParam: function () { var cb = arguments[arguments.length - 1]; if (typeof cb === 'function') cb(true, '{}'); },
    callSmartChatAPI: function () { var cb = arguments[arguments.length - 1]; if (typeof cb === 'function') cb(true, '{}'); },
    getServerName: function () { return Promise.resolve({ countryCode: 'cn', serverCode: 'cn' }); },
    getServiceTokenWithSid: function () { return Promise.resolve({}); },
    getHomeList: function () { return Promise.resolve([]); },
    getDeviceIcon: function () { return Promise.resolve(''); },
    getCustomPluginInfo: function () { return Promise.resolve({}); },
    getHomepageSettings: function () { return Promise.resolve({}); },
    getSTDGuideSettings: function () { return Promise.resolve({}); },
    getABTestConfigByPath: function () { return Promise.resolve({}); },
    getABTestConfigByDidAndPath: function () { return Promise.resolve({}); },
    activeABTestByPath: function () { return Promise.resolve({}); },
    addLog: function () {},
    addStat: function () {},
    deleteDevice: function () { return Promise.resolve(true); },
    connectWifi: function () { return Promise.resolve(true); },
    cancelSSE: function () {},
    fetchMultilingualResources: function () { return Promise.resolve({}); },
    actionTemplatesForQualifiedDid: function () { return Promise.resolve([]); },
    deleteSceneRecords: function () { return Promise.resolve(true); },
    editSceneRecord: function () { return Promise.resolve(true); }
  }, [
    'getServerName', 'getServiceTokenWithSid', 'getHomeList', 'getDeviceIcon', 'getCustomPluginInfo',
    'getHomepageSettings', 'getSTDGuideSettings', 'getABTestConfigByPath', 'getABTestConfigByDidAndPath',
    'activeABTestByPath', 'deleteDevice', 'connectWifi', 'fetchMultilingualResources',
    'actionTemplatesForQualifiedDid', 'deleteSceneRecords', 'editSceneRecord'
  ]);

  registerModule('MIOTSpec', ['getCurrentSpecValueWithDid', 'getSpecString', 'getSpec', 'setSpec'], {}, {
    getCurrentSpecValueWithDid: function (did) {
      return hostInvoke('getSpecProps', { did: did });
    },
    getSpecString: function () { return Promise.resolve(''); },
    getSpec: function () { return Promise.resolve({}); },
    setSpec: function () { return Promise.resolve(true); }
  }, ['getCurrentSpecValueWithDid', 'getSpecString', 'getSpec', 'setSpec']);

  registerModule('MIOTRPC', ['nativeCall', 'standardCall'], {}, {
    nativeCall: function (api, params) {
      log('MIOTRPC.nativeCall', api);
      return hostInvoke('callSmartHomeAPI', { path: api, params: params }).then(function (res) {
        // standardCall JS wrapper expects full body with .result
        if (typeof res === 'string') {
          try { res = JSON.parse(res); } catch (e2) { res = { result: res }; }
        }
        if (res == null) res = { code: 0, result: {} };
        if (typeof res === 'object' && res.result === undefined && res.code === undefined) {
          // already a bare result — wrap
          res = { code: 0, result: res };
        }
        return res;
      });
    },
    // Some older paths may call native standardCall directly
    standardCall: function (api, params) {
      return this.nativeCall(api, params);
    }
  });

  registerModule('MHPluginSDK', ['startSendWiFiConfig'], {}, {
    startSendWiFiConfig: function () {}
  });

  ['MIOTFile', 'MIOTAudio', 'MIOTSystem', 'MIOTBluetooth', 'MIOTXimalaya', 'MIOTWifiSpeaker',
    'MIOTXiaoai', 'MIOTMiTvModule', 'ClassicBluetooth', 'HmPaceScalesModule', 'TJInfra',
    'MHRoom', 'KooKong', 'MHMapSearch', 'MHMapLocation', 'MHCameraSDK', 'MHPluginFS',
    'MHAudio', 'MHSystem', 'MHGateway', 'MHDeviceList', 'MHMiotStore', 'MHDeviceGroup',
    'SSEBridge', 'Ximalaya', 'HTRCTEABluetooth', 'PdfManager', 'RNGLContext',
    'MHCameraFishEyeViewManager', 'MHCameraOpenGLViewManager', 'MHOrbitViewManager',
    'MHSweepingMapManager', 'MHRTSPViewManager', 'MHCameraCloudPurchaseViewManager',
    'RNSVGSvgViewManager', 'PdfViewManager'].forEach(function (n) {
    makeStub(n, {}, []);
  });

  // Auto-stubs: every native method the SDK/plugin calls but this host does not implement.
  // Without them, e.g. MIOTService.reportEvent being undefined throws inside the SDK's
  // @resultReport decorator and Service.spec.getPropertiesValue() never settles.
  // Stubs fail softly: callbacks get (false, {code:-1}) / promise rejects; fire-and-forget is a no-op.
  var AUTO_STUBS = {"MIOTHost":["addNewLockToHomeKit","addOrCopyIR","addToHomeKit","applyForDeviceIDAndToken","bindProcessToNetwork","canOpenIrController","checkAbilityOfJumpToThirdpartyApplication","checkAppIsExist","checkPhoneLocationServerIsOpen","checkStoreSupportted","clearFreqCameraNeedShowRedPoint","clickJumpByTempelateID","colorsToImageBase64","connectWifiWithSSID","createExecutor","feedbackRequestForModelAlgorithm","fillAutomationConfig","firmwareNotCheckUpdate","generateECCCryptoObjectWithCurveType","getAppName","getAvailableFirmwareForDids","getBtGateWaySubDeviceRSSIWithMac","getCurrentCountryInfoCallback","getFreqCameraNeedShowRedPoint","getIrDeviceList","getLocation","getLocationAuthorizationStatus","getMiWatchConfigWithCallback","getNavigationBarHeight","getPhysicsDimension","getRealWindowSize","getSafeAreaInsets","getServiceTokenWithSid","getSystemTimeZoneOffset","getSystemTimezoneNameWithCallback","getWindowMode","goCustomPlugin","ijaiBeautifyMap","isBatchConvertSceneVisisble","isBatchConvertSceneVisisbleWith","isBtGateWaySubDeviceWithMac","isHomeKitConnected","isHomeKitDevice","isNewLockHomeKitBinded","isSupportAccessoryFind","jumpToThirdpartyApplication","keepScreenNotLock","launchCountDownWhenDevice","loadCurrentCountryCode","loadInfoCallback","loadOperatorsType","loadRealDeviceConfig","localPingWithCallback","locateWxDevice","notifyCameraStorageChangeStateChanged","notifyMultikeyStateChanged","openAddDeviceGroupPage","openAddDeviceGroupPageWithGroupModel","openAddIRController","openAddIrDevicePage","openAddToDesktopPage","openAssociatePage","openAutomationDetail","openBatchConvertScene","openBleGroupUpgradePage","openBleMeshDeviceUpgradePage","openBleOtaDeviceUpgradePage","openBtGatewayPage","openBtGatewayPageWithParams","openCameraMultiViewPage","openCarMiHomeManager","openChangeDeviceIconDialog","openChangeDeviceName","openCloseUsedOnMiHomeConfirmDialog","openCommonDeviceSettingPage","openConfigRouterSubPage","openConnectSucceedPage","openConsumesDetailPage","openConsumesPageWithParams","openCurtainGroupNamePage","openDeclarationWithConfig","openDeleteDevice","openDeleteDeviceWithCallback","openDeleteDeviceWithCustomMessage","openDevice","openDeviceCallSettingPage","openDeviceCallSettingPageWithExtra","openDeviceHubGatewayPage","openDeviceNetworkInfoPage","openDeviceOfflineAlert","openDeviceRoamingManager","openDeviceServicePage","openDeviceSettingPageWithType","openDeviceTimeZoneSettingPage","openDeviceUpgradeHistoryPage","openDeviceUpgradePage","openDirectorySelectPage","openDoubleGraftingAuth","openEditDeviceGroupPage","openFamilyAlbumPage","openFamilyManagerPage","openFeedback","openFeedbackInput","openFileSelectPage","openFirmWareAutoOTAPage","openFirmwareAutoUpgradeSwitch","openGenerateCrontabStringPage","openHelpPage","openIOSDocumentFileChoosePage","openIftttAutoPage","openIftttAutoPageWithDid","openIrDeviceManagerPage","openIrDevicePage","openLightGroupUpgradePage","openMatterConnectPage","openMeshDeviceGroupPage","openMiPayPage","openMicoWebPage","openNFCWriteDeviceInfoPage","openNFCWriteDeviceInfoPage_debugonly","openNFCWritePageForConnectTV","openNetEaseMusicAuthPage","openNewMorePage","openNewOneTimePassword","openOneTimePassword","openOperationUrl","openPageWithClassName","openPhoneBluSettingActivity","openPhoneLocationServerSettingPage","openPhotoLibrarySettingPage","openPickLivePhotoPage","openPluginRecommendScene","openPowerMultikeyPage","openPowerMultikeyPageV2","openProductBaikeWebPage","openRemoteControlDialog","openResetAndConnectDevicePage","openRoomManagementPage","openRoomManagementPageByDid","openSecuritySetting","openSelectLocationMapDialog","openShareDevicePage","openShareListBar","openSystemFileWindow","openSystemShareWindow","openTimerSettingPage","openTimerSettingPageWithCustomIdentifier","openTimerSettingPageWithOptions","openTimerSettingPageWithOptionsV2","openTimerSettingPageWithVariousTypeParams","openVirtualGroupInitPage","openVoiceCtrlDevListPage","openVoiceCtrlDeviceAuthPage","openVoicePrintPage","openWeChatMinProgramForBindOrSubscribe","openWeChatMiniProgram","openWebPage","openWifiChoosePage","openXiaoAiLearnPage","openZigbeeConnectDeviceList","pageShouldAdapterSoftKeyboard","phoneHasNfc","pointsScaleToImageBase64","pointsScaleToImageBase64V2","pointsToImageBase64","privacyAndProtocolReview","refreshDeviceList","registerFontEnable","removeExecutor","removeNewLockFromHomeKit","requestWxDeviceVoIP","saveInfo","setFirmwareUpdateErrDic","setPadScrollDealStrategy","shareWxDeviceVoIP","shareWxForInviteFriends","shareWxMiniProgramCardToContact","sharedSecretFromCryptoObject","showDeclarationWithConfig","showToast","updateHomeKitAuthorizationData","zhuimiRobotTracesToImageBase64","zhuimiRobotTracesToImageBase64V2"],"MIOTService":["getTvList","getVirtualDeviceCombineStatus","loadAccountInfo","openSSE","queryCloudStatus","recordEvent","reportEvent","reportEventRefChannel","reportMJFStatLog","requestAuthForAlexaVoiceService","revokePrivacyLicense","setHomepageSettings","setSTDGuideSettings","triggerTemplatesForQualifiedDid","updatePluginPageRef"],"MIOTFile":["amapScreenShot","appendFile","appendFileThroughBase64","cancelDownloadFile","copyFile","createMediaWithPoints","cropImage","dataLengthOfBase64Data","deleteAssetsFromAlbumByUrls","deleteFile","deleteFontFile","downloadFile","downloadFileWithParams","downloadFontFile","fetchLocalVideoFilePathFromDidAlbumByUrl","generateImageWithWatermarkParams","generateQRCodeAndSave","getAlbums","getAllSourceFromPhotosDidAlbum","getAssets","getRGBAValueFromImageAtPath","getStorageInfo","getWatermarkInfoFromAssetWithUrl","isFileExists","longScreenShot","mergeFiles","mergeImages","mergeImagesV2","mergeVideos","mergeVideosUseHarewareAccelerate","mergeVideosUseHarewareAccelerateV2","mergeVideosV2","mergeVideosWithFFmpeg","mkdir","pdfToImage","queryFile","readFile","readFileInfo","readFileListFrom","readFileSegmentToBase64","readFileToBase64","readFileToHexString","readFolderSize","readFontFileList","readPdfMetaData","saveFileToNotesAppOnMIUI","saveFileToPhotosAlbum","saveImageToPhotosAlbum","saveImageToPhotosDidAlbum","saveVideoToPhotosDidAlbum","screenShot","screenShotInRect","subBase64DataOfBase64Data","ungzFile","ungzYunMiFile","ungzipFileToString","unzipFile","uploadFile","uploadFileToFDS","uploadFileToMiCloud","writeFile","writeFileThroughBase64","writePdfFile"],"MIOTAudio":["amrToWav","getMediaDuration","getRecordingPeakPower","startPlay","startRecord","stopPlay","stopRecord","wavToAmr"],"MIOTSystem":["checkAPPSystemConfigEnable","checkPermission","connectWifiAfterQ","getBatteryInfo","getGatewayIpAddress","getHealthAuthorizationStatus","getHighTextContrastState","getLocation","getLocationServerState","getNfcInfo","getScreenLockState","getVolumeInfo","getWifiBroadcastAddress","isMiConnectSupportNFC","openAPPSystemConfigPage","requestHealthAuthorization","scanCode","startAccelerometer","startAdvertising","startCompass","startGyroscope","startShakeListener","startVolume","stopAccelerometer","stopCompass","stopGyroscope","stopShakeListener","stopVolume","vibrateLong","vibrateShort","writeDataToHealthApp","writeNFCData"],"MIOTBluetooth":["bindDevice","changeLockPassword","checkBluetoothPermission","checkLockSecureRisk","checkShareCodeStatus","connect","createBond","createDigitalKey","decryptMessageXiaoMiBLE","disconnectDeviceWithDelay","discoverCharacteristics","discoverServices","doSpecOperation","encryptLockMessage","encryptMessageXiaoMiBLE","generateOneTimePwdBySelf","getBluetoothStateCallback","getUWBUserAgreementStatus","getVersion","goToWifiConfigStep","gotoShareCodeVerifyPage","initOneTimeContextBySelf","isBleGatewayConnected","isBleOrMeshGatewayConnected","isBluetoothHalfOpen","isBluetoothOpen","isShareSecureKeyValid","maximumWriteValueLengthForType","miotBleDecrypt","miotBleEncrypt","oneTimePassword","openBluetooth","readHexStringWithCallback","readRSSI","readReliableMTU","removeBond","retrievePeripheralsWithIdentifiers","retrievePeripheralsWithServices","rollbackLockPassword","setAlertConfigs","setIndicationWithCallback","setNotifyWithCallback","showUWBUserAgreement","startLeScan","stopScan","toggleLockXiaoMiBLE","unBindDevice","verifyLockOOB","verifyLockPassword","wechatUnlock","writeHexStringWithCallback"],"MIOTWifiSpeaker":["callXiaoaiNetworkAPI","openClockMusicSelector","openEarthquakeLocationSelector","openStereoSettingPage","openXiaoaiContentPage","openXiaoaiPage"],"MIOTMiTvModule":["sendInfrared"],"ClassicBluetooth":["connectBluetoothProfile","connectSocket","create","destroy","disconnectBluetoothProfile","disconnectSocket","getBluetoothProfileState","prepareBluetoothProfile","write"],"MHRoom":["addNewRoomWithName","editRoom","getRoomList","getRoomNames"],"KooKong":["canControlWithType","changeStateValueForType","createNonACManager","createZipACManager","getAllSupportValueWithType","getCurrentValueWithType","registerWithKey","removeACManager"],"MHMapSearch":["getAddressByCoordinate"],"MHMapLocation":["getLocation","reLocationWithReGeocode"],"MHCameraSDK":["audioCodec","bindBpsDataCallback","bindMoveTypeChangeCallback","bindP2PCommandReceiveWithDid","bindRDTDataReceiveCallback","bindRDTDataReceiveWithDid","bindTimelinePlaybackEndListener","callTutkSpecial","cancelDownloadM3U8ToMP4","cancelDownloadM3U8ToMP4V2","closeFloatWindow","connectToDeviceWithDid","convertG711VideoIntoAACVideo","convertH26xVideoIntoMp4","decryptBigFile","decryptFile","decryptSmallFile","disconnectToDeviceWithDid","downloadCloudVideoIntoCloudSetting","downloadCloudVideoMp4","downloadM3U8ToMP4","downloadM3U8ToMP4ByUrl","downloadM3U8ToMP4V2","encryptFile","enterFullscreenForPad","ffmpegCommand","getAlbumName","getCommonImgWithParams","getCurrentFrameInfo","getCurrentSpeakerVolumn","getFaceImgWithDid","getVideoFileUrl","getVideoFileUrlV2","getVoiceChangePathBySourceAndModel","getfileIdImage","launchRecommend","loadMonitoringDetail","markCurrentDeviceHualaiEncrypted","openAlarmVideoPlayer","openBabySleepSetting","openCloudSettingDownloadListPage","openDailyStorySetting","openFloatWindow","openIDMSetting","openLongTimeNobody","reactNativeVideoScreenShot","release","requestDeviceP2pInfo","sendAudioData","sendP2PCommandToDeviceWith","sendP2PCommandToDeviceWithBase64Param","sendP2PCommandToDeviceWithStringParam","sendRDTCommandJSONToDevice","sendRDTCommandJSONToDeviceWith","sendRDTCommandToDevice","sendRDTCommandToDeviceWith","sendServerCmd","sendServerCmdWithBase64Param","setCurrentDeviceIsMissFirmware","setCurrentDeviceUseFixedRdtChannel","setCurrentDeviceUseFixedUid","setCurrentVoiceChangerType","setFrameFilter","setGeneralIjkPlayerEnable","setTimelinePlaybackMode","showAlarmVideos","showAlbum","showCloudStorage","showCloudStorageMoreSetting","showCloudStorageSetting","showFaceRecognize","showLastAlbumMediaFile","showNASSettingPage","showOperationBannerPage","showPlaybackVideos","showScreenLinkagePage","snapShot","startConnect","startRecord","startUnlockDevice","stopRecord","tryBindAlarmNotifyWithWechatMijia","tutkSessionRead","tutkSessionWrite","uploadImageToCameraServer"],"MHMiotStore":["openURL"],"MHDeviceGroup":["create","edit"],"HTRCTEABluetooth":["connectSocket","create","disconnectSocket","isConnected","write"],"MHCameraFishEyeViewManager":["setRenderType","snapShot","startAudioPlay","startAudioRecord","startRecord","startRender","stopAudioPlay","stopAudioRecord","stopRecord","stopRender"],"MHCameraOpenGLViewManager":["snapShot","startAudioPlay","startAudioRecord","startRecord","startRender","stopAudioPlay","stopAudioRecord","stopRecord","stopRender"],"MHOrbitViewManager":["canRevoke","clear","displayPoints","revoke"],"MHRTSPViewManager":["stopPlay"],"MHCameraCloudPurchaseViewManager":["openH5RetentionPopUpWindow"]};
  var NOOP_OK = { reportEvent: 1, reportEventRefChannel: 1, recordEvent: 1, reportMJFStatLog: 1, updatePluginPageRef: 1,
    setHomepageSettings: 1, setSTDGuideSettings: 1, showToast: 1, keepScreenNotLock: 1, registerFontEnable: 1,
    setPadScrollDealStrategy: 1, pageShouldAdapterSoftKeyboard: 1, vibrateShort: 1, vibrateLong: 1 };
  Object.keys(AUTO_STUBS).forEach(function (modName) {
    var id = NAME_TO_ID[modName];
    if (id == null) return;
    var mod = MODULES[id];
    AUTO_STUBS[modName].forEach(function (m) {
      if (mod.methods.indexOf(m) >= 0 || (mod.constants && m in mod.constants)) return;
      mod.methods.push(m);
      mod.impl[m] = NOOP_OK[m] ? function () { return undefined; } : function () {
        log('stub', modName + '.' + m);
        return Promise.reject({ code: -1, message: modName + '.' + m + ' not supported in RN host' });
      };
    });
  });

  // Bridge config
  global.__fbBatchedBridgeConfig = {
    remoteModuleConfig: MODULES.map(function (m) {
      return [m.name, m.constants, m.methods, m.promiseIdx, m.syncIdx];
    })
  };

  function invokeBridgeCallback(cbId, args) {
    var bb = global.__fbBatchedBridge;
    if (!bb || typeof bb.invokeCallbackAndReturnFlushedQueue !== 'function') {
      log('invokeBridgeCallback: no BatchedBridge', cbId);
      return;
    }
    try {
      var q = bb.invokeCallbackAndReturnFlushedQueue(cbId, args || []);
      processQueue(q);
    } catch (e) {
      log('invokeBridgeCallback error', String(e && e.message || e));
    }
  }

  function peelBridgeCallbacks(params) {
    var args = (params || []).slice();
    var succId = null;
    var failId = null;
    // MessageQueue.processCallbacks appends failId (even) then succId (odd)
    while (args.length && typeof args[args.length - 1] === 'number') {
      var id = args.pop();
      if ((id & 1) === 1) succId = id;
      else failId = id;
      if (succId != null && failId != null) break;
    }
    return { args: args, succId: succId, failId: failId };
  }

  function settleNativeCallbacks(succId, failId, ok, value) {
    if (succId == null && failId == null) return;
    // Promise-style (both ids): success=[data], fail=[error]
    if (succId != null && failId != null) {
      if (ok) invokeBridgeCallback(succId, [value]);
      else invokeBridgeCallback(failId, [value]);
      return;
    }
    // Xiaomi single-callback style: cb(ok, res)
    if (succId != null) invokeBridgeCallback(succId, [ok, value]);
    else if (failId != null) invokeBridgeCallback(failId, [value]);
  }

  function invokeNative(moduleID, methodID, params) {
    var mod = MODULES[moduleID];
    if (!mod) { log('missing module', moduleID); return; }
    var methodName = mod.methods[methodID];
    var fn = mod.impl[methodName];
    if (typeof fn !== 'function') {
      log('missing method', mod.name + '.' + methodName);
      var peeled0 = peelBridgeCallbacks(params);
      var isP0 = mod.promiseIdx.indexOf(methodID) >= 0 && peeled0.succId != null && peeled0.failId != null;
      settleNativeCallbacks(isP0 ? peeled0.failId : peeled0.succId, isP0 ? peeled0.succId : peeled0.failId, false, { message: 'missing method ' + mod.name + '.' + methodName });
      return undefined;
    }
    var peeled = peelBridgeCallbacks(params);
    // Promise 方法：RN 的 genMethod 先传 resolve（偶数 id）再传 reject（奇数 id），与回调风格相反
    if (mod.promiseIdx.indexOf(methodID) >= 0 && peeled.succId != null && peeled.failId != null) {
      var resolveId = peeled.failId;
      peeled.failId = peeled.succId;
      peeled.succId = resolveId;
    }
    try {
      var ret = fn.apply(mod.impl, peeled.args);
      if (ret && typeof ret.then === 'function') {
        ret.then(function (r) {
          settleNativeCallbacks(peeled.succId, peeled.failId, true, r);
        }, function (e) {
          settleNativeCallbacks(peeled.succId, peeled.failId, false, e);
        });
        return undefined;
      }
      // sync / fire-and-forget return
      if (peeled.succId != null || peeled.failId != null) {
        settleNativeCallbacks(peeled.succId, peeled.failId, true, ret);
      }
      return ret;
    } catch (e) {
      log('invoke error', mod.name + '.' + methodName, String(e && e.message || e));
      settleNativeCallbacks(peeled.succId, peeled.failId, false, { message: String(e && e.message || e) });
      return undefined;
    }
  }

  global.nativeCallSyncHook = function (moduleID, methodID, params) {
    return invokeNative(moduleID, methodID, params);
  };

  global.nativeFlushQueueImmediate = function (queue) {
    processQueue(queue);
  };

  function processQueue(queue) {
    if (!queue) return;
    var moduleIds = queue[0];
    var methodIds = queue[1];
    var args = queue[2];
    if (!moduleIds) return;
    for (var i = 0; i < moduleIds.length; i++) {
      try {
        invokeNative(moduleIds[i], methodIds[i], args[i]);
      } catch (e) {
        log('queue item error', String(e && e.stack || e));
      }
    }
  }

  function pollQueue() {
    var bb = global.__fbBatchedBridge;
    if (!bb || typeof bb.flushedQueue !== 'function') return;
    try {
      processQueue(bb.flushedQueue());
    } catch (e) {
      log('poll error', String(e && e.message || e));
    }
  }

  function callJs(module, method, args) {
    var bb = global.__fbBatchedBridge;
    if (!bb) return;
    try {
      var q = bb.callFunctionReturnFlushedQueue(module, method, args);
      processQueue(q);
    } catch (e) {
      log('callJs error', module + '.' + method, String(e && e.message || e));
    }
  }

  function emitEvent(tag, eventName, event) {
    callJs('RCTEventEmitter', 'receiveEvent', [tag, eventName, event || {}]);
  }

  function receiveTouches(type, touches, indices) {
    callJs('RCTEventEmitter', 'receiveTouches', [type, touches, indices]);
  }

  function hostInvoke(action, payload) {
    return new Promise(function (resolve, reject) {
      var id = ++HOST._reqId;
      HOST._pending[id] = { resolve: resolve, reject: reject };
      if (HOST.bridgeProxy && typeof HOST.bridgeProxy.invoke === 'function') {
        try {
          var ret = HOST.bridgeProxy.invoke(JSON.stringify({ id: id, action: action, payload: payload || {} }));
          if (ret && typeof ret.then === 'function') {
            ret.then(function (r) { settleBridge(id, true, r); }, function (e) { settleBridge(id, false, e); });
            return;
          }
          if (typeof ret === 'string') {
            try {
              var parsed = JSON.parse(ret);
              if (parsed && parsed.pending) {
                _nST(function () {
                  if (HOST._pending[id]) {
                    settleBridge(id, true, 'null');
                  }
                }, 15000);
                return;
              }
              settleBridge(id, true, ret);
              return;
            } catch (e2) {
              settleBridge(id, true, ret);
              return;
            }
          }
          settleBridge(id, true, ret);
          return;
        } catch (e3) {
          log('bridgeProxy error', String(e3));
        }
      }
      if (action === 'callMethod') {
        log('mock callMethod', payload);
        settleBridge(id, true, JSON.stringify({ result: ['ok'], id: 1 }));
        return;
      }
      if (action === 'callSmartHomeAPI') {
        log('mock callSmartHomeAPI', payload && payload.path);
        settleBridge(id, true, JSON.stringify({}));
        return;
      }
      if (action === 'getSpecProps') {
        settleBridge(id, true, JSON.stringify({}));
        return;
      }
      settleBridge(id, true, 'null');
    });
  }

  function settleBridge(id, ok, body) {
    var pend = HOST._pending[id];
    if (!pend) return;
    delete HOST._pending[id];
    var val = body;
    if (typeof body === 'string') {
      try { val = JSON.parse(body); } catch (e4) { val = body; }
    }
    if (ok) pend.resolve(val);
    else pend.reject(typeof body === 'string' ? new Error(body) : body);
  }

  HOST.hostInvoke = hostInvoke;
  HOST.onBridgeResult = function (id, ok, body) { settleBridge(id, ok, body); };

  HOST.pollQueue = pollQueue;
  HOST.callJs = callJs;
  HOST.emitEvent = emitEvent;

  // Real Web viewport -> RN Dimensions (Android reads DeviceInfo.Dimensions.*PhysicalPixels / scale)
  // On wide (tablet/landscape) viewports Mi Home plugins are laid out for a phone: sizes scale with
  // window.width/1080 (miot-sdk adjustSize). Render them in a centered phone-width panel (default 392dp,
  // the HyperOS baseline; override with ?w=) instead of stretching x3.
  function panelWidth(full) {
    var m = typeof location !== 'undefined' && location.search ? location.search.match(/[?&]w=([0-9.]+)/) : null;
    if (m) return Math.min(full, Number(m[1]));
    return full > 600 ? 392 : full;
  }
  function layoutRootPanel(pw, full) {
    var m = doc && doc.getElementById('rn-root');
    if (!m) return;
    if (pw < full) {
      m.style.left = Math.round((full - pw) / 2) + 'px';
      m.style.right = 'auto';
      m.style.width = pw + 'px';
      m.style.boxShadow = '0 0 24px rgba(0,0,0,0.18)';
    } else {
      m.style.left = '0'; m.style.right = '0'; m.style.width = '100%'; m.style.boxShadow = '';
    }
  }
  HOST.layoutRootPanel = function () { var d = global.__RNHOST_DIMENSIONS__; layoutRootPanel(d.window.width, innerWidth); };
  function computeDimensions() {
    var fullW = (typeof innerWidth === 'number' && innerWidth > 0) ? innerWidth : 360;
    var w = panelWidth(fullW);
    var h = (typeof innerHeight === 'number' && innerHeight > 0) ? innerHeight : 640;
    var dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio > 0) ? devicePixelRatio : 3;
    var sw = w;
    var sh = h;
    layoutRootPanel(w, fullW);
    var win = { width: Math.round(w * dpr), height: Math.round(h * dpr), scale: dpr, fontScale: 1, densityDpi: Math.round(dpr * 160) };
    var scr = { width: Math.round(sw * dpr), height: Math.round(sh * dpr), scale: dpr, fontScale: 1, densityDpi: Math.round(dpr * 160) };
    uic.Dimensions.windowPhysicalPixels = win;
    uic.Dimensions.screenPhysicalPixels = scr;
    global.__RNHOST_DIMENSIONS__ = {
      window: { width: w, height: h, scale: dpr, fontScale: 1 },
      screen: { width: sw, height: sh, scale: dpr, fontScale: 1 }
    };
    return uic.Dimensions;
  }
  computeDimensions();
  HOST.computeDimensions = computeDimensions;
  var _lastDimKey = '';
  if (typeof addEventListener === 'function') {
    addEventListener('resize', function () {
      var d = computeDimensions();
      var key = d.windowPhysicalPixels.width + 'x' + d.windowPhysicalPixels.height;
      if (key === _lastDimKey) return;
      _lastDimKey = key;
      if (global.__fbBatchedBridge) {
        callJs('RCTDeviceEventEmitter', 'emit', ['didUpdateDimensions', { windowPhysicalPixels: d.windowPhysicalPixels, screenPhysicalPixels: d.screenPhysicalPixels }]);
      }
      scheduleLayoutEvents();
    });
  }

  function exitPlugin() {
    hostInvoke('exitPlugin', {}).catch(function () {});
  }
  // ArkTS onBackPress -> RN BackHandler; if JS does not consume it, DeviceEventManager.invokeDefaultBackButtonHandler exits.
  HOST.hardwareBack = function () {
    if (!global.__fbBatchedBridge) { exitPlugin(); return; }
    callJs('RCTDeviceEventEmitter', 'emit', ['hardwareBackPress']);
  };

  // nativePerformanceNow
  if (typeof global.nativePerformanceNow !== 'function') {
    global.nativePerformanceNow = function () {
      return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    };
  }

  // ErrorUtils early
  if (!global.ErrorUtils) {
    global.ErrorUtils = {
      setGlobalHandler: function () {},
      getGlobalHandler: function () { return function () {}; },
      reportFatalError: function (e) { log('ErrorUtils.fatal', String(e && e.stack || e)); },
      reportError: function (e) { log('ErrorUtils.error', String(e && e.message || e)); }
    };
  }

  global.__DEV__ = false;
  global.RN$Bridgeless = false;

  // Public boot API
  HOST.installBridgeProxy = function (proxy) {
    HOST.bridgeProxy = proxy;
  };

  HOST.setDevice = function (d) {
    Object.assign(HOST.device, d || {});
    // refresh constants on MIOTDevice module
    var id = NAME_TO_ID.MIOTDevice;
    if (id != null) MODULES[id].constants.currentDevice = Object.assign({}, HOST.device);
    var pid = NAME_TO_ID.MIOTPackage;
    if (pid != null) {
      MODULES[pid].constants.models = HOST.device.model;
      MODULES[pid].constants.packageName = HOST.packageName;
    }
    // rebuild bridge config constants snapshot
    global.__fbBatchedBridgeConfig = {
      remoteModuleConfig: MODULES.map(function (m) {
        return [m.name, m.constants, m.methods, m.promiseIdx, m.syncIdx];
      })
    };
  };

  HOST.snapshotViews = function () {
    return Object.keys(HOST.views).map(function (k) {
      var v = HOST.views[k];
      return { tag: v.tag, className: v.className, children: v.children.slice(), text: v.el && v.el.textContent || '' };
    });
  };

  HOST.startPolling = function () {
    if (HOST._poll) return;
    HOST._poll = _nSI(pollQueue, 16);
  };

  HOST.setPluginInfo = function (p) {
    if (!p) return;
    if (p.base) { HOST.plugBase = p.base; HOST.localBase = p.base; }
    if (p.packageName) HOST.packageName = p.packageName;
    if (p.pluginId != null) HOST.pluginId = String(p.pluginId);
    var pid = NAME_TO_ID.MIOTPackage;
    if (pid != null) {
      var c = MODULES[pid].constants;
      c.packageName = HOST.packageName;
      c.packageNameLastComponent = String(HOST.packageName).split('.').pop();
      c.pluginID = HOST.pluginId;
      if (p.packageId != null) c.packageID = String(p.packageId);
      if (p.versionName) c.version = String(p.versionName);
      if (p.apiLevel) c.apiLevel = Number(p.apiLevel);
      c.plugPath = HOST.plugBase;
      c.localFilePath = HOST.localBase;
    }
  };

  HOST.boot = function (opts) {
    opts = opts || {};
    if (opts.plugin) HOST.setPluginInfo(opts.plugin);
    if (opts.packageName) HOST.packageName = opts.packageName;
    if (opts.device) HOST.setDevice(opts.device);
    try {
      var prf = global.__RNHostPluginResFiles;
      if (prf && prf.length) { HOST.pluginResFiles = prf.slice(); resIndex = null; }
    } catch (_e0) {}
    // Image res index from plugin/res/files.js or ArkTS
    try {
      var rf = (typeof global !== 'undefined' && global.__RNHostResFiles) ||
        (typeof window !== 'undefined' && window.__RNHostResFiles) || null;
      if (rf && rf.length) {
        HOST.resFiles = rf.slice();
        resIndex = null;
        ensureResIndex();
        log('res files', HOST.resFiles.length);
      }
    } catch (_e) {}
    HOST.startPolling();
    log('host ready, modules=', MODULES.length);
    return HOST;
  };

  log('host.js loaded'); mark('hostParsed');
})(typeof window !== 'undefined' ? window : typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : this);
