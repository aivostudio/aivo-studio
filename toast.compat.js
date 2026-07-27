// toast.compat.js
(() => {
  const t = window.toast;
  if (!t) return;

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

  window.toastSafe   = (msg, type, opts) => emit(msg, type, opts);
  window.legacyToast = (msg, type, opts) => emit(msg, type, opts);
  window.showToast   = (msg, type, opts) => emit(msg, type, opts);
  window.toastMsg = (msg, type, opts) => emit(msg, type, opts);

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

  const styles = [
    "/css/mod.ad-film.css?v=6",
    "/css/ad-film.preview.css?v=1",
    "/css/ad-film.basic-polish.css?v=2",
    "/css/ad-film.basic-draft.css?v=1",
    "/css/ad-film.project-sync.css?v=1",
    "/css/ad-film.readability.css?v=1"
  ];

  styles.forEach((href) => {
    const path = href.split("?")[0];
    if (document.querySelector(`link[href^="${path}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  });

  const scripts = [
    "/js/ad-film.skeleton.js?v=6",
    "/js/ad-film.basic-polish.js?v=2",
    "/js/ad-film.basic-draft.js?v=2",
    "/js/ad-film.basic-media-cache.js?v=1",
    "/js/ad-film.language-lock.js?v=1",
    "/js/ad-film.project-sync.js?v=1"
  ];

  function loadSequential(index = 0) {
    if (index >= scripts.length) return;
    const src = scripts[index];
    const path = src.split("?")[0];
    if (document.querySelector(`script[src^="${path}"]`)) {
      loadSequential(index + 1);
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.onload = () => loadSequential(index + 1);
    script.onerror = () => loadSequential(index + 1);
    document.head.appendChild(script);
  }

  loadSequential();
})();
