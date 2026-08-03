(() => {
  const t = window.toast;
  if (!t) return;

  const CREDIT_FLOW_RE = /(kredi|yetersiz|satın al|satın\s*alma|kredi\s*al|paket|fiyatlandirma|fiyatlandırma|yönlendir|redirect)/i;

  function messageText(msg) {
    if (typeof msg === "string") return msg;
    if (msg && typeof msg === "object") return String(msg.message || msg.error || "");
    return String(msg || "");
  }
  function emit(msg, type = "info", opts) {
    const finalType = type === "error" && CREDIT_FLOW_RE.test(messageText(msg)) ? "warning" : type;
    const fn = finalType === "success" ? t.success : finalType === "warning" ? t.warning : finalType === "error" ? t.error : t.info;
    return fn?.(msg, opts);
  }
  window.toastSafe = (msg, type, opts) => emit(msg, type, opts);
  window.legacyToast = (msg, type, opts) => emit(msg, type, opts);
  window.showToast = (msg, type, opts) => emit(msg, type, opts);
  window.toastMsg = (msg, type, opts) => emit(msg, type, opts);

  const origError = t.error?.bind(t);
  if (origError) {
    t.error = (msg, opts) => {
      if (CREDIT_FLOW_RE.test(messageText(msg))) return t.warning?.(msg, opts);
      return origError(msg, opts);
    };
  }
})();

(() => {
  if (window.__AIVO_AD_FILM_ASSETS_V99__) return;
  window.__AIVO_AD_FILM_ASSETS_V99__ = true;
  window.__AIVO_AD_FILM_ASSETS_READY__ = false;

  const styles = [
    "/css/mod.ad-film.css?v=6",
    "/css/ad-film.preview.css?v=2",
    "/css/ad-film.basic-polish.css?v=4",
    "/css/ad-film.basic-draft.css?v=1",
    "/css/ad-film.project-sync.css?v=2",
    "/css/ad-film.cloud-status-fix.css?v=1",
    "/css/ad-film.readability.css?v=1",
    "/css/ad-film.vibrant-actions.css?v=4",
    "/css/ad-film.production-state.css?v=1",
    "/css/ad-film.storyboard.css?v=1",
    "/css/ad-film.simple-mode.css?v=3",
    "/css/ad-film.music-profile.css?v=5",
    "/css/ad-film.seedance-options.css?v=5",
    "/css/ad-film.advanced-alignment.css?v=3",
    "/css/ad-film.creative-plan.css?v=1",
    "/css/ad-film.plan-simple.css?v=2",
    "/css/ad-film.creative-plan-tune.css?v=2",
    "/css/ad-film.role-readability.css?v=3",
    "/css/ad-film.role-balance.css?v=1",
    "/css/ad-film.narration-guide.css?v=1",
    "/css/ad-film.narration-manual.css?v=3",
    "/css/ad-film.narration-engine.css?v=2",
    "/css/ad-film.narration-player.css?v=2",
    "/css/ad-film.seedance-engine.css?v=5",
    "/css/ad-film.result-controls.css?v=7",
    "/css/ad-film.output-workflow.css?v=1",
    "/css/ad-film.output-gallery.css?v=3",
    "/css/ad-film.video-modal.css?v=1",
    "/css/ad-film.premium-production.css?v=3",
    "/css/ad-film.production-status-center.css?v=7",
    "/css/ad-film.unified-flow.css?v=4",
    "/css/ad-film.render-stability.css?v=1"
  ];

  const shellScripts = [
    "/js/ad-film.route-fix.js?v=7",
    "/js/ad-film.skeleton.js?v=8",
    "/js/ad-film.reopen-fix.js?v=1"
  ];

  const moduleScripts = [
    "/js/ad-film.i18n.js?v=1",
    "/js/ad-film.controls-fix.js?v=3",
    "/js/ad-film.basic-polish.js?v=3",
    "/js/ad-film.basic-draft.js?v=2",
    "/js/ad-film.basic-media-cache.js?v=2",
    "/js/ad-film.language-lock.js?v=3",
    "/js/ad-film.storyboard.js?v=1",
    "/js/ad-film.simple-mode.js?v=3",
    "/js/ad-film.music-profile.js?v=8",
    "/js/ad-film.project-sync.js?v=7",
    "/js/ad-film.media-normalization.js?v=3",
    "/js/ad-film.seedance-upload-fix.js?v=1",
    "/js/ad-film.seedance-options.js?v=5",
    "/js/ad-film.creative-plan.js?v=1",
    "/js/ad-film.plan-simple.js?v=1",
    "/js/ad-film.role-upload-fix.js?v=3",
    "/js/ad-film.reference-indexes.js?v=1",
    "/js/ad-film.reset-fix.js?v=2",
    "/js/ad-film.reset-safety.js?v=1",
    "/js/ad-film.narration-guide.js?v=1",
    "/js/ad-film.narration-manual.js?v=1",
    "/js/ad-film.narration-engine.js?v=3",
    "/js/ad-film.narration-approval-sync.js?v=11",
    "/js/ad-film.narration-player-host-fix.js?v=1",
    "/js/ad-film.narration-player.js?v=2",
    "/js/ad-film.narration-master.js?v=3",
    "/js/ad-film.narration-build-guard.js?v=4",
    "/js/ad-film.voice-toggle-fix.js?v=2",
    "/js/ad-film.production-id-adapter.js?v=1",
    "/js/ad-film.production-save-guard.js?v=1",
    "/js/ad-film.active-run-event-guard.js?v=5",
    "/js/ad-film.music-preflight.js?v=7",
    "/js/ad-film.seedance-engine.js?v=10",
    "/js/ad-film.logo-finalize.js?v=4",
    "/js/ad-film.mix-upgrade.js?v=3",
    "/js/ad-film.result-controls.js?v=11",
    "/js/ad-film.draft-preview-owner.js?v=1",
    "/js/ad-film.final-ui-and-playback.js?v=2",
    "/js/ad-film.stale-success-guard.js?v=1",
    "/js/ad-film.output-workflow.js?v=2",
    "/js/ad-film.video-modal.js?v=1",
    "/js/ad-film.output-gallery.js?v=10",
    "/js/ad-film.project-history-stable.js?v=2",
    "/js/ad-film.output-main-delete.js?v=2",
    "/js/ad-film.output-sync.js?v=2",
    "/js/ad-film.quality-policy.js?v=4",
    "/js/ad-film.elapsed-continuity.js?v=1"
  ];

  let shellLoadPromise = null;
  let moduleLoadPromise = null;
  let moduleReady = false;
  let pendingBuildButton = null;

  function ensureStyles() {
    styles.forEach((href) => {
      const path = href.split("?")[0];
      const existing = document.querySelector(`link[href^="${path}"]`);
      if (existing) {
        if (existing.getAttribute("href") !== href) existing.setAttribute("href", href);
        return;
      }
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
      if (existing.getAttribute("src") !== src) existing.setAttribute("src", src);
      if (existing.dataset.aivoLoaded === "1") return loadSequential(list, index + 1);
      return new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          existing.dataset.aivoLoaded = "1";
          resolve(loadSequential(list, index + 1));
        };
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

  function replayPendingBuild() {
    const button = pendingBuildButton;
    pendingBuildButton = null;
    if (!button || !button.isConnected) return;
    button.removeAttribute("data-adfilm-loader-pending");
    if (button.dataset.narrationGuard !== "blocked" && !button.classList.contains("is-loading") && !button.classList.contains("is-generating") && !button.classList.contains("is-music-preparing")) {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
    setTimeout(() => button.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window })), 0);
  }

  function startAdFilmAssets() {
    ensureStyles();
    if (!moduleLoadPromise) {
      moduleLoadPromise = ensureAdFilmShell().then(() => loadSequential(moduleScripts)).then(() => {
        moduleReady = true;
        window.__AIVO_AD_FILM_ASSETS_READY__ = true;
        document.dispatchEvent(new CustomEvent("aivo:adfilm-assets-ready"));
        replayPendingBuild();
      });
    }
    return moduleLoadPromise;
  }

  function ensureAdFilmAssets() {
    return ensureAdFilmShell().then(() => { startAdFilmAssets(); });
  }

  window.AIVOEnsureAdFilmShell = ensureAdFilmShell;
  window.AIVOEnsureAdFilmAssets = ensureAdFilmAssets;
  window.AIVOAwaitAdFilmAssets = startAdFilmAssets;

  document.addEventListener("click", (event) => {
    const build = event.target.closest?.('[data-module-root][data-module="adfilm"] [data-adfilm-build]');
    if (build && !moduleReady) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      pendingBuildButton = build;
      build.setAttribute("data-adfilm-loader-pending", "1");
      build.setAttribute("aria-busy", "true");
      startAdFilmAssets().catch((error) => {
        console.error("[ADFILM] asset loading failed", error);
        pendingBuildButton = null;
        build.removeAttribute("data-adfilm-loader-pending");
        build.removeAttribute("aria-busy");
      });
      return;
    }
    if (event.target.closest?.("[data-adfilm-open]")) ensureAdFilmAssets();
  }, true);

  document.addEventListener("aivo:module-mounted", (event) => {
    if (event?.detail?.key === "adfilm") startAdFilmAssets();
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureAdFilmShell, { once: true });
  } else {
    ensureAdFilmShell();
  }
})();
