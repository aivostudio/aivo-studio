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
  window.toastMsg    = (msg, type, opts) => emit(msg, type, opts);

  const origError = t.error?.bind(t);
  if (origError) {
    t.error = (msg, opts) => {
      if (CREDIT_FLOW_RE.test(String(msg || ""))) return t.warning?.(msg, opts);
      return origError(msg, opts);
    };
  }
})();

/* AI Reklam Filmi varlık yükleyicisi.
   Menü kabuğu Studio açılır açılmaz yüklenir; ağır modül dosyaları
   yalnız Reklam Filmi bölümü açıldığında yüklenir. */
(() => {
  if (window.__AIVO_AD_FILM_ASSETS_V2__) return;
  window.__AIVO_AD_FILM_ASSETS_V2__ = true;

  const styles = [
    "/css/mod.ad-film.css?v=6",
    "/css/ad-film.preview.css?v=2",
    "/css/ad-film.basic-polish.css?v=4",
    "/css/ad-film.basic-draft.css?v=1",
    "/css/ad-film.project-sync.css?v=2",
    "/css/ad-film.cloud-status-fix.css?v=1",
    "/css/ad-film.readability.css?v=1",
    "/css/ad-film.vibrant-actions.css?v=1",
    "/css/ad-film.storyboard.css?v=1",
    "/css/ad-film.simple-mode.css?v=3",
    "/css/ad-film.music-profile.css?v=5",
    "/css/ad-film.seedance-options.css?v=4",
    "/css/ad-film.creative-plan.css?v=1",
    "/css/ad-film.creative-plan-tune.css?v=2",
    "/css/ad-film.role-readability.css?v=3",
    "/css/ad-film.role-balance.css?v=1",
    "/css/ad-film.narration-guide.css?v=1",
    "/css/ad-film.seedance-engine.css?v=4",
    "/css/ad-film.result-controls.css?v=7",
    "/css/ad-film.output-workflow.css?v=1",
    "/css/ad-film.output-gallery.css?v=2"
  ];

  const shellScripts = [
    "/js/ad-film.route-fix.js?v=3",
    "/js/ad-film.skeleton.js?v=8",
    "/js/ad-film.reopen-fix.js?v=1"
  ];

  const moduleScripts = [
    "/js/ad-film.controls-fix.js?v=3",
    "/js/ad-film.basic-polish.js?v=3",
    "/js/ad-film.basic-draft.js?v=2",
    "/js/ad-film.basic-media-cache.js?v=2",
    "/js/ad-film.language-lock.js?v=1",
    "/js/ad-film.storyboard.js?v=1",
    "/js/ad-film.simple-mode.js?v=3",
    "/js/ad-film.music-profile.js?v=6",
    "/js/ad-film.project-sync.js?v=6",
    "/js/ad-film.seedance-upload-fix.js?v=1",
    "/js/ad-film.seedance-options.js?v=2",
    "/js/ad-film.creative-plan.js?v=1",
    "/js/ad-film.role-upload-fix.js?v=3",
    "/js/ad-film.reference-indexes.js?v=1",
    "/js/ad-film.reset-fix.js?v=2",
    "/js/ad-film.narration-guide.js?v=1",
    "/js/ad-film.seedance-engine.js?v=4",
    "/js/ad-film.logo-finalize.js?v=2",
    "/js/ad-film.result-controls.js?v=9",
    "/js/ad-film.live-preview-state.js?v=1",
    "/js/ad-film.output-workflow.js?v=2",
    "/js/ad-film.output-gallery.js?v=3",
    "/js/ad-film.project-history.js?v=6",
    "/js/ad-film.output-main-delete.js?v=2",
    "/js/ad-film.output-sync.js?v=1"
  ];

  let shellLoadPromise = null;
  let moduleLoadPromise = null;

  function ensureStyles() {
    styles.forEach((href) => {
      const path = href.split("?")[0];
      if (document.querySelector(`link[href^="${path}"]`)) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    });
  }

  function loadSequential(list, index = 0) {
    if (index >= list.length) return Promise.resolve();

    const src = list[index];
    const path = src.split("?")[0];
    const existing = document.querySelector(`script[src^="${path}"]`);

    if (existing) {
      if (existing.dataset.aivoLoaded === "1") {
        return loadSequential(list, index + 1);
      }

      return new Promise((resolve) => {
        const finish = () => resolve(loadSequential(list, index + 1));
        existing.addEventListener("load", finish, { once: true });
        existing.addEventListener("error", finish, { once: true });
        if (existing.readyState === "complete" || existing.readyState === "loaded") finish();
      });
    }

    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = () => {
        script.dataset.aivoLoaded = "1";
        resolve(loadSequential(list, index + 1));
      };
      script.onerror = () => resolve(loadSequential(list, index + 1));
      document.head.appendChild(script);
    });
  }

  function ensureAdFilmShell() {
    ensureStyles();
    if (!shellLoadPromise) shellLoadPromise = loadSequential(shellScripts);
    return shellLoadPromise;
  }

  function ensureAdFilmAssets() {
    ensureStyles();
    if (!moduleLoadPromise) {
      moduleLoadPromise = ensureAdFilmShell().then(() => loadSequential(moduleScripts));
    }
    return moduleLoadPromise;
  }

  window.AIVOEnsureAdFilmShell = ensureAdFilmShell;
  window.AIVOEnsureAdFilmAssets = ensureAdFilmAssets;

  document.addEventListener("click", (event) => {
    if (event.target.closest("[data-adfilm-open]")) ensureAdFilmAssets();
  }, true);

  document.addEventListener("aivo:module-mounted", (event) => {
    if (event?.detail?.key === "adfilm") ensureAdFilmAssets();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureAdFilmShell, { once: true });
  } else {
    ensureAdFilmShell();
  }
})();
