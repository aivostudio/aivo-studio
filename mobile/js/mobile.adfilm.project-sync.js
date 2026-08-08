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

  loadScript("/mobile/js/mobile.adfilm.aspect-guard.js?v=5", "data-mobile-adfilm-aspect-guard");

  loadScript("/mobile/js/mobile.adfilm.project-sync.core.js?v=1", "data-mobile-adfilm-project-sync-core", function(){
    loadScript("/mobile/js/mobile.adfilm.poll-safety.js?v=1", "data-mobile-adfilm-poll-safety", function(){
      loadScript("/mobile/js/mobile.adfilm.production.js?v=1", "data-mobile-adfilm-production-controller");
    });
  });

  loadScript("/mobile/js/mobile.radio-ad.project-sync.js?v=2", "data-mobile-radio-ad-project-sync", function(){
    loadScript("/mobile/js/mobile.radio-ad.narration.js?v=1", "data-mobile-radio-ad-narration");
    loadScript("/mobile/js/mobile.radio-ad.music.js?v=1", "data-mobile-radio-ad-music");
    loadScript("/mobile/js/mobile.radio-ad.production.js?v=1", "data-mobile-radio-ad-production");
    loadScript("/mobile/js/mobile.radio-ad.credit-label.js?v=1", "data-mobile-radio-ad-credit-label");
    loadScript("/mobile/js/mobile.radio-ad.ui-state.js?v=2", "data-mobile-radio-ad-ui-state");
  });
})();