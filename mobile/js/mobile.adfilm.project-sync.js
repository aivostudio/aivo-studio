(function AIVO_MOBILE_ADFILM_RUNTIME_I18N(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_RUNTIME_I18N_V1__) return;
  window.__AIVO_MOBILE_ADFILM_RUNTIME_I18N_V1__ = true;

  const ROOT_SELECTOR = "#mobileAdFilmSection";
  const REPORT_SELECTOR = "#aivoMobileAdFilmReportSheet";
  const PREFIXES = ["adfilm.", "radioad."];
  const ATTRIBUTES = ["placeholder", "aria-label", "title"];
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
  const templateCache = new Map();
  let observer = null;

  const aliases = {
    "Örn: modern, premium ve sinematik bir reklam olsun. Ürün yakın planlarla başlasın, ardından kullanım sahneleri ve güçlü final marka karesi gelsin...": "adfilm.design.placeholder",
    "10 saniye kısa marka mesajları, 15–30 saniye standart kampanyalar ve 45–60 saniye detaylı anlatımlar için uygundur.": "radioad.settings.tip",
    "Radyo Reklamı mobil iskeleti hazır. Sistem bağlantısı sonraki adımda yapılacak.": "radioad.action.needNarration"
  };

  function clean(value){ return String(value == null ? "" : value).trim(); }

  function allowedKey(key){
    return PREFIXES.some(function(prefix){ return String(key || "").indexOf(prefix) === 0; });
  }

  function dictionary(lang){
    const all = window.AIVO_I18N || {};
    const pack = all[lang] || {};
    return pack && typeof pack === "object" ? pack : {};
  }

  function translate(key, params, fallback){
    try {
      if (typeof window.t === "function") {
        const value = window.t(key, params);
        if (value && value !== key) return String(value);
      }
    } catch (_) {}
    return fallback == null ? key : String(fallback);
  }

  function escapeRegExp(value){
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function compileTemplate(key, source){
    const cacheKey = key + "\u0000" + source;
    if (templateCache.has(cacheKey)) return templateCache.get(cacheKey);

    const names = [];
    let pattern = "^";
    let lastIndex = 0;
    const token = /\{([a-zA-Z0-9_]+)\}/g;
    let match;

    while ((match = token.exec(source))) {
      pattern += escapeRegExp(source.slice(lastIndex, match.index));
      pattern += "(.+?)";
      names.push(match[1]);
      lastIndex = match.index + match[0].length;
    }

    pattern += escapeRegExp(source.slice(lastIndex)) + "$";
    const result = { regex: new RegExp(pattern), names: names };
    templateCache.set(cacheKey, result);
    return result;
  }

  function exactKeyFor(text){
    const sourceText = clean(text);
    if (!sourceText) return "";
    if (aliases[sourceText]) return aliases[sourceText];

    for (const lang of ["tr", "en"]) {
      const pack = dictionary(lang);
      for (const key of Object.keys(pack)) {
        if (!allowedKey(key)) continue;
        const value = String(pack[key] == null ? "" : pack[key]);
        if (value.indexOf("{") >= 0) continue;
        if (value === sourceText) return key;
      }
    }
    return "";
  }

  function templateMatchFor(text){
    const sourceText = clean(text);
    if (!sourceText) return null;

    for (const lang of ["tr", "en"]) {
      const pack = dictionary(lang);
      for (const key of Object.keys(pack)) {
        if (!allowedKey(key)) continue;
        const value = String(pack[key] == null ? "" : pack[key]);
        if (value.indexOf("{") < 0) continue;

        const compiled = compileTemplate(key, value);
        const match = sourceText.match(compiled.regex);
        if (!match) continue;

        const params = {};
        compiled.names.forEach(function(name, index){ params[name] = match[index + 1]; });
        return { key: key, params: params };
      }
    }
    return null;
  }

  function translateValue(value){
    const original = String(value == null ? "" : value);
    const leading = (original.match(/^\s*/) || [""])[0];
    const trailing = (original.match(/\s*$/) || [""])[0];
    const end = trailing.length ? original.length - trailing.length : original.length;
    const body = original.slice(leading.length, end);
    const sourceText = clean(body);
    if (!sourceText) return original;

    const exact = exactKeyFor(sourceText);
    if (exact) return leading + translate(exact, null, sourceText) + trailing;

    const template = templateMatchFor(sourceText);
    if (template) return leading + translate(template.key, template.params, sourceText) + trailing;

    return original;
  }

  function inScope(node){
    const element = node && node.nodeType === 1 ? node : node && node.parentElement;
    return !!(element && element.closest && element.closest(ROOT_SELECTOR + "," + REPORT_SELECTOR));
  }

  function translateAttribute(element, name){
    if (!element || !element.hasAttribute || !element.hasAttribute(name)) return;
    const before = element.getAttribute(name);
    const after = translateValue(before);
    if (after !== before) element.setAttribute(name, after);
  }

  function translateTextNode(node){
    if (!node || node.nodeType !== 3 || !node.parentElement || SKIP_TAGS.has(node.parentElement.tagName)) return;
    const before = node.nodeValue;
    const after = translateValue(before);
    if (after !== before) node.nodeValue = after;
  }

  function translateElement(element){
    if (!element || element.nodeType !== 1 || SKIP_TAGS.has(element.tagName)) return;
    ATTRIBUTES.forEach(function(name){ translateAttribute(element, name); });
    Array.from(element.childNodes || []).forEach(function(node){
      if (node.nodeType === 3) translateTextNode(node);
    });
  }

  function applyRuntimeI18n(scope){
    const root = scope && scope.querySelectorAll ? scope : document;
    if (scope && scope.nodeType === 1 && inScope(scope)) translateElement(scope);
    if (!root.querySelectorAll) return;
    root.querySelectorAll(ROOT_SELECTOR + "," + REPORT_SELECTOR + "," + ROOT_SELECTOR + " *," + REPORT_SELECTOR + " *").forEach(translateElement);
  }

  function wrapToastObject(object){
    if (!object || object.__aivoAdFilmI18nWrapped) return;
    ["success", "error", "warning", "info", "loading"].forEach(function(name){
      const original = object[name];
      if (typeof original !== "function" || original.__aivoAdFilmI18nWrapped) return;
      const wrapped = function(payload){
        const args = Array.from(arguments);
        if (typeof payload === "string") args[0] = translateValue(payload);
        else if (payload && typeof payload === "object" && typeof payload.message === "string") {
          args[0] = Object.assign({}, payload, { message: translateValue(payload.message) });
        }
        return original.apply(this, args);
      };
      wrapped.__aivoAdFilmI18nWrapped = true;
      object[name] = wrapped;
    });
    try { Object.defineProperty(object, "__aivoAdFilmI18nWrapped", { value:true, configurable:true }); }
    catch (_) { object.__aivoAdFilmI18nWrapped = true; }
  }

  function wrapToastFunction(name){
    const original = window[name];
    if (typeof original !== "function" || original.__aivoAdFilmI18nWrapped) return;
    const wrapped = function(message){
      const args = Array.from(arguments);
      if (typeof message === "string") args[0] = translateValue(message);
      return original.apply(this, args);
    };
    wrapped.__aivoAdFilmI18nWrapped = true;
    window[name] = wrapped;
  }

  function installToastBindings(){
    wrapToastObject(window.toast);
    wrapToastObject(window.mobileToast);
    wrapToastFunction("showToast");
    wrapToastFunction("toastSafe");
    wrapToastFunction("toastMsg");
  }

  if (typeof window.confirm === "function" && !window.confirm.__aivoAdFilmI18nWrapped) {
    const originalConfirm = window.confirm;
    const wrappedConfirm = function(message){ return originalConfirm.call(window, translateValue(message)); };
    wrappedConfirm.__aivoAdFilmI18nWrapped = true;
    window.confirm = wrappedConfirm;
  }

  function refresh(){
    try { if (typeof window.aivoApplyI18n === "function") window.aivoApplyI18n(document.getElementById("mobileAdFilmSection") || document); } catch (_) {}
    installToastBindings();
    applyRuntimeI18n(document);
    try {
      if (window.AIVOMobileAdFilmCreditPricing && typeof window.AIVOMobileAdFilmCreditPricing.sync === "function") {
        window.AIVOMobileAdFilmCreditPricing.sync();
      }
      if (window.AIVOMobileRadioAdProjectSync && typeof window.AIVOMobileRadioAdProjectSync.syncDerived === "function") {
        window.AIVOMobileRadioAdProjectSync.syncDerived();
      }
      if (window.AIVOMobileRadioAdProduction && typeof window.AIVOMobileRadioAdProduction.syncButton === "function") {
        const sync = window.AIVOMobileRadioAdProjectSync;
        const project = sync && typeof sync.getProject === "function" ? sync.getProject() : window.AIVOMobileRadioAdProject;
        window.AIVOMobileRadioAdProduction.syncButton(project || null);
      }
    } catch (_) {}
    applyRuntimeI18n(document);
  }

  window.AIVOMobileAdFilmI18n = {
    refresh: refresh,
    translate: translateValue
  };

  document.addEventListener("aivo:language-change", function(){
    setTimeout(refresh, 0);
    setTimeout(refresh, 80);
  });
  document.addEventListener("aivo:adfilm-project-sync", function(){ setTimeout(refresh, 0); });
  document.addEventListener("aivo:mobile-radioad-project-sync", function(){ setTimeout(refresh, 0); });
  window.addEventListener("pageshow", function(){ setTimeout(refresh, 0); });

  if (document.body) {
    observer = new MutationObserver(function(records){
      records.forEach(function(record){
        if (record.type === "characterData") {
          if (inScope(record.target)) translateTextNode(record.target);
          return;
        }
        if (record.type === "attributes") {
          if (inScope(record.target)) translateAttribute(record.target, record.attributeName);
          return;
        }
        Array.from(record.addedNodes || []).forEach(function(node){
          if (node.nodeType === 3) {
            if (inScope(node)) translateTextNode(node);
            return;
          }
          if (node.nodeType !== 1) return;
          if (inScope(node) || (node.matches && node.matches(ROOT_SELECTOR + "," + REPORT_SELECTOR))) applyRuntimeI18n(node);
          else if (node.querySelector && node.querySelector(ROOT_SELECTOR + "," + REPORT_SELECTOR)) applyRuntimeI18n(node);
        });
      });
    });
    observer.observe(document.body, {
      subtree:true,
      childList:true,
      characterData:true,
      attributes:true,
      attributeFilter:ATTRIBUTES
    });
  }

  window.addEventListener("pagehide", function(){
    if (observer) observer.disconnect();
    observer = null;
  }, { once:true });

  refresh();
})();

(function AIVO_MOBILE_ADFILM_PROJECT_SYNC_BUNDLE(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_PROJECT_SYNC_BUNDLE_V1__) return;
  window.__AIVO_MOBILE_ADFILM_PROJECT_SYNC_BUNDLE_V1__ = true;

  function loadStyle(href, attr){
    const existing = document.querySelector('link[' + attr + ']');
    if (existing) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute(attr, "");
    document.head.appendChild(link);
  }

  function loadScript(src, attr, done){
    const existing = document.querySelector('script[' + attr + ']');
    if (existing){
      if (existing.dataset.loaded === "1") {
        if (typeof done === "function") done();
      } else if (typeof done === "function") {
        existing.addEventListener("load", done, { once: true });
      }
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.setAttribute(attr, "");
    script.addEventListener("load", function(){
      script.dataset.loaded = "1";
      if (typeof done === "function") done();
    }, { once: true });
    script.addEventListener("error", function(){
      console.error("[MOBILE ADFILM] script load failed", src);
    }, { once: true });
    document.body.appendChild(script);
  }

  loadStyle("/mobile/css/mobile.adfilm.reference.css?v=2", "data-mobile-adfilm-reference-v2");
  loadStyle("/mobile/css/mobile.adfilm.radio-tone-fix.css?v=2", "data-mobile-radio-tone-fix");
  loadStyle("/mobile/css/mobile.radio-ad.production.css?v=1", "data-mobile-radio-production-style");
  loadStyle("/mobile/css/mobile.adfilm.progress-readability.css?v=4", "data-mobile-adfilm-progress-readability");
  loadStyle("/mobile/css/mobile.radio-ad.player-state.css?v=1", "data-mobile-radio-player-state");

  loadScript("/mobile/js/mobile.radio-ad.click-guard.js?v=1", "data-mobile-radio-ad-click-guard", function(){
    loadScript("/mobile/js/mobile.adfilm.aspect-guard.js?v=5", "data-mobile-adfilm-aspect-guard");

    loadScript("/mobile/js/mobile.adfilm.project-sync.core.js?v=1", "data-mobile-adfilm-project-sync-core", function(){
      loadScript("/mobile/js/mobile.adfilm.poll-safety.js?v=1", "data-mobile-adfilm-poll-safety", function(){
        loadScript("/mobile/js/mobile.adfilm.production.js?v=1", "data-mobile-adfilm-production-controller");
      });
    });
  });

  loadScript("/mobile/js/mobile.radio-ad.project-sync.js?v=2", "data-mobile-radio-ad-project-sync", function(){
    loadScript("/mobile/js/mobile.radio-ad.narration.js?v=1", "data-mobile-radio-ad-narration");
    loadScript("/mobile/js/mobile.radio-ad.music.js?v=1", "data-mobile-radio-ad-music");
    loadScript("/mobile/js/mobile.radio-ad.production.js?v=1", "data-mobile-radio-ad-production", function(){
      loadScript("/mobile/js/mobile.radio-ad.archive.js?v=1", "data-mobile-radio-ad-archive");
    });
    loadScript("/mobile/js/mobile.radio-ad.credit-label.js?v=1", "data-mobile-radio-ad-credit-label");
    loadScript("/mobile/js/mobile.radio-ad.ui-state.js?v=4", "data-mobile-radio-ad-ui-state");
  });
})();