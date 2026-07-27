// toast.compat.js
(() => {
  const t = window.toast;
  if (!t) return;

  // "kredi/yönlendirme" = warning (kırmızı değil)
  const CREDIT_FLOW_RE =
    /(kredi|yetersiz|satın al|satın\s*alma|kredi\s*al|paket|fiyatlandirma|fiyatlandırma|yönlendir|redirect)/i;

  function classify(type, msg) {
    const s = String(msg || "");
    if (type === "error" && CREDIT_FLOW_RE.test(s)) return "warning";
    return type || "info";
  }

  function emit(msg, type = "info", opts) {
    const finalType = classify(type, msg);
    const fn =
      finalType === "success" ? t.success :
      finalType === "warning" ? t.warning :
      finalType === "error"   ? t.error   :
      t.info;

    return fn?.(msg, opts);
  }

  // Global forwarders (legacy isimler)
  window.toastSafe   = (msg, type, opts) => emit(msg, type, opts);
  window.legacyToast = (msg, type, opts) => emit(msg, type, opts);
  window.showToast   = (msg, type, opts) => emit(msg, type, opts);

  // Eğer projede `toast(msg, type)` gibi bir wrapper varsa:
  window.toastMsg = (msg, type, opts) => emit(msg, type, opts);

  // Bazı dosyalarda direkt window.toast.error(...) ile kredi mesajı basılıyorsa,
  // bunu da “kredi metni ise warning”e çevirerek yakalayalım:
  const origError = t.error?.bind(t);
  if (origError) {
    t.error = (msg, opts) => {
      if (CREDIT_FLOW_RE.test(String(msg || ""))) return t.warning?.(msg, opts);
      return origError(msg, opts);
    };
  }
})();

/* AI Reklam Filmi — geçici masaüstü iskelet varlıkları.
   Gerçek modül router'a bağlandığında bu yükleyici kaldırılacak. */
(() => {
  if (window.__AIVO_AD_FILM_ASSETS__) return;
  window.__AIVO_AD_FILM_ASSETS__ = true;

  const cssHref = "/css/mod.ad-film.css?v=1";
  if (!document.querySelector('link[href^="/css/mod.ad-film.css"]')) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    document.head.appendChild(link);
  }

  if (!document.querySelector('script[src^="/js/ad-film.skeleton.js"]')) {
    const script = document.createElement("script");
    script.src = "/js/ad-film.skeleton.js?v=1";
    script.defer = true;
    document.head.appendChild(script);
  }
})();
