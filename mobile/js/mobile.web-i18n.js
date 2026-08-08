(function(){
  "use strict";

  if (window.__AIVO_MOBILE_WEB_I18N_V1__) return;
  window.__AIVO_MOBILE_WEB_I18N_V1__ = true;

  if (!/\.mobile\.html$/i.test(String(location.pathname || ""))) return;

  var ATTRS = ["placeholder", "aria-label", "title"];
  var SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE", "TEXTAREA", "INPUT"]);
  var exact = new Map();
  var templates = [];
  var cache = new Map();
  var observer = null;

  var EXTRA = [
    ["AI Reklam Filmi Oluştur", "Create AI Commercial Film"],
    ["Reklam Filmi modülü yükleniyor...", "Loading commercial film module..."],
    ["Reklam Filmi modülü yüklenemedi.", "Commercial film module could not be loaded."],
    ["Google ile devam et", "Continue with Google"],
    ["Google ile Giriş Yap", "Sign in with Google"],
    ["Google ile Kayıt Ol", "Register with Google"],
    [" Apple ile Giriş Yap", " Sign in with Apple"],
    ["VEYA EMAIL İLE DEVAM ET", "OR CONTINUE WITH EMAIL"],
    ["Ana sayfaya dön", "Back to home"],
    ["🔊 Ses", "🔊 Sound"],
    ["🔇 Ses", "🔇 Sound"],
    ["AIVO Mobile Giriş", "AIVO Mobile Sign In"],
    ["AIVO Mobile — Şifremi Unuttum", "AIVO Mobile — Forgot Password"],
    ["AIVO Mobile — Şifre Sıfırla", "AIVO Mobile — Reset Password"],
    ["AIVO Studio - AI Müzik, Video ve Görsel Üretim Platformu", "AIVO Studio - AI Music, Video and Visual Creation Platform"],
    ["AIVO Studio ile web, iOS ve Android’de AI müzik, video klip, kapak, foto efekt, çizgifilm ve dudak senkron video üret. Fikrini dakikalar içinde içeriğe dönüştür.", "Create AI music, video clips, cover art, photo effects, cartoons and lip sync videos with AIVO Studio on web, iOS and Android. Turn your idea into content in minutes."],
    ["AIVO Studio ile AI müzik, kapak, video, foto efekt ve çizgifilm üretimini tek platformda başlat.", "Create AI music, cover art, video, photo effects and cartoons from one platform with AIVO Studio."],
    ["Oturum açılıyor...", "Opening session..."],
    ["Giriş başarılı ancak oturum doğrulanamadı. Lütfen bağlantını kontrol edip tekrar dene.", "Login succeeded, but the session could not be verified. Please check your connection and try again."],
    ["Export hazırlandı.", "Export prepared."],
    ["AIVO ile müzik, kapak, video ve çizgifilm üretimini mobilde dene:", "Try creating music, cover art, video and cartoons with AIVO on mobile:"],
    ["AIVO linki kopyalandı.", "AIVO link copied."],
    ["Paylaşım başlatılamadı.", "Sharing could not be started."],
    ["Çıkış yapıldı.", "Signed out."]
  ];

  function clean(value){ return String(value == null ? "" : value).trim(); }

  function lang(){
    var value = clean(window.AIVO_LANG || document.documentElement.lang || "tr").toLowerCase();
    return value.indexOf("en") === 0 ? "en" : "tr";
  }

  function escapeRegExp(value){
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function compile(source){
    var names = [];
    var pattern = "^";
    var last = 0;
    var token = /\{([a-zA-Z0-9_]+)\}/g;
    var match;
    while ((match = token.exec(source))) {
      pattern += escapeRegExp(source.slice(last, match.index)) + "(.+?)";
      names.push(match[1]);
      last = match.index + match[0].length;
    }
    pattern += escapeRegExp(source.slice(last)) + "$";
    return { regex:new RegExp(pattern), names:names };
  }

  function rebuild(){
    exact = new Map();
    templates = [];
    cache.clear();

    var all = window.AIVO_I18N || {};
    ["tr", "en"].forEach(function(code){
      var pack = all[code] || {};
      Object.keys(pack).forEach(function(key){
        var value = String(pack[key] == null ? "" : pack[key]);
        if (!value) return;
        if (value.indexOf("{") >= 0) templates.push({ key:key, compiled:compile(value) });
        else if (!exact.has(value)) exact.set(value, { key:key });
      });
    });

    EXTRA.forEach(function(pair){
      if (!exact.has(pair[0])) exact.set(pair[0], { pair:pair });
      if (!exact.has(pair[1])) exact.set(pair[1], { pair:pair });
    });
  }

  function fromKey(key, params, fallback){
    try {
      if (typeof window.t === "function") {
        var out = window.t(key, params);
        if (out && out !== key) return String(out);
      }
    } catch (_) {}
    return String(fallback == null ? key : fallback);
  }

  function translate(value, depth){
    depth = Number(depth || 0);
    if (depth > 6) return String(value == null ? "" : value);
    if (!exact.size && !templates.length) rebuild();

    var original = String(value == null ? "" : value);
    var leading = (original.match(/^\s*/) || [""])[0];
    var trailing = (original.match(/\s*$/) || [""])[0];
    var end = trailing.length ? original.length - trailing.length : original.length;
    var source = clean(original.slice(leading.length, end));
    if (!source) return original;

    var cacheKey = lang() + "\u0000" + source;
    if (cache.has(cacheKey)) return leading + cache.get(cacheKey) + trailing;

    var hit = exact.get(source);
    if (hit) {
      var exactOut = hit.pair ? (lang() === "en" ? hit.pair[1] : hit.pair[0]) : fromKey(hit.key, null, source);
      cache.set(cacheKey, exactOut);
      return leading + exactOut + trailing;
    }

    for (var i = 0; i < templates.length; i += 1) {
      var item = templates[i];
      var match = source.match(item.compiled.regex);
      if (!match) continue;
      var params = {};
      item.compiled.names.forEach(function(name, index){
        params[name] = translate(match[index + 1], depth + 1).trim();
      });
      var templateOut = fromKey(item.key, params, source);
      cache.set(cacheKey, templateOut);
      return leading + templateOut + trailing;
    }

    cache.set(cacheKey, source);
    return original;
  }

  function textNode(node){
    if (!node || node.nodeType !== 3 || !node.parentElement) return;
    if (SKIP.has(node.parentElement.tagName)) return;
    if (node.parentElement.closest("[data-mobile-i18n-skip]")) return;
    var before = node.nodeValue;
    var after = translate(before, 0);
    if (after !== before) node.nodeValue = after;
  }

  function element(el){
    if (!el || el.nodeType !== 1 || SKIP.has(el.tagName)) return;
    if (el.closest && el.closest("[data-mobile-i18n-skip]")) return;
    ATTRS.forEach(function(name){
      if (!el.hasAttribute(name)) return;
      var before = el.getAttribute(name);
      var after = translate(before, 0);
      if (after !== before) el.setAttribute(name, after);
    });
    Array.from(el.childNodes || []).forEach(function(node){ if (node.nodeType === 3) textNode(node); });
  }

  function meta(){
    document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"]').forEach(function(node){
      var before = node.getAttribute("content") || "";
      var after = translate(before, 0);
      if (after !== before) node.setAttribute("content", after);
    });
    var beforeTitle = document.title || "";
    var afterTitle = translate(beforeTitle, 0);
    if (afterTitle !== beforeTitle) document.title = afterTitle;
  }

  function apply(root){
    try {
      if (typeof window.aivoApplyI18n === "function") window.aivoApplyI18n(root && root.querySelectorAll ? root : document);
    } catch (_) {}
    var scope = root && root.querySelectorAll ? root : document;
    if (root && root.nodeType === 1) element(root);
    if (scope.querySelectorAll) scope.querySelectorAll("*").forEach(element);
    meta();
  }

  function wrapToastApi(api){
    if (!api || api.__aivoMobileWebI18nWrapped) return;

    ["success", "error", "warning", "info", "loading"].forEach(function(method){
      if (typeof api[method] !== "function") return;

      try {
        var original = api[method].bind(api);
        api[method] = function(message){
          var args = Array.prototype.slice.call(arguments);
          if (typeof args[0] === "string") args[0] = translate(args[0], 0);
          return original.apply(null, args);
        };
      } catch (_) {}
    });

    try { api.__aivoMobileWebI18nWrapped = true; } catch (_) {}
  }

  function wrapToasts(){
    wrapToastApi(window.mobileToast);
    if (window.toast && window.toast !== window.mobileToast) wrapToastApi(window.toast);
  }

  function wrapShare(){
    if (!navigator || typeof navigator.share !== "function") return;
    if (navigator.share.__aivoMobileWebI18nWrapped) return;

    try {
      var originalShare = navigator.share.bind(navigator);
      var wrappedShare = function(data){
        var next = data && typeof data === "object" ? Object.assign({}, data) : data;

        if (next && typeof next === "object") {
          if (typeof next.title === "string") next.title = translate(next.title, 0);
          if (typeof next.text === "string") next.text = translate(next.text, 0);
        }

        return originalShare(next);
      };

      wrappedShare.__aivoMobileWebI18nWrapped = true;
      navigator.share = wrappedShare;
    } catch (_) {}
  }

  function observe(){
    if (observer || !document.body) return;
    observer = new MutationObserver(function(records){
      records.forEach(function(record){
        if (record.type === "characterData") return textNode(record.target);
        if (record.type === "attributes") return element(record.target);
        Array.from(record.addedNodes || []).forEach(function(node){
          if (node.nodeType === 3) textNode(node);
          else if (node.nodeType === 1) apply(node);
        });
      });
    });
    observer.observe(document.body, { subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATTRS });
  }

  function refresh(){
    rebuild();
    apply(document);
    wrapToasts();
    wrapShare();
    observe();
  }

  function loadCore(){
    if (window.AIVO_I18N && typeof window.t === "function" && typeof window.aivoApplyI18n === "function") return refresh();

    var existing = document.querySelector('script[src^="/mobile/js/mobile.i18n.js"]');
    if (existing) {
      existing.addEventListener("load", function(){ setTimeout(refresh, 0); }, { once:true });
      var tries = 0;
      var timer = setInterval(function(){
        tries += 1;
        if (window.AIVO_I18N && typeof window.t === "function") {
          clearInterval(timer);
          refresh();
        } else if (tries > 80) clearInterval(timer);
      }, 50);
      return;
    }

    var script = document.createElement("script");
    script.src = "/mobile/js/mobile.i18n.js?v=mobile-web-1";
    script.defer = true;
    script.setAttribute("data-mobile-web-i18n-core", "");
    script.addEventListener("load", function(){ setTimeout(refresh, 0); }, { once:true });
    document.head.appendChild(script);
  }

  document.addEventListener("aivo:language-change", function(){
    setTimeout(refresh, 0);
    setTimeout(refresh, 80);
    setTimeout(refresh, 240);
  });
  window.addEventListener("pageshow", function(){ setTimeout(refresh, 0); });
  window.addEventListener("pagehide", function(){ if (observer) observer.disconnect(); observer = null; }, { once:true });

  window.AIVOMobileWebI18n = {
    refresh:refresh,
    translate:function(value){ return translate(value, 0); },
    language:lang
  };

  loadCore();
})();
