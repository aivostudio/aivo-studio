(() => {
  if (window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V86__) return;
  window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V86__ = true;

  const staleOverride = document.querySelector('link[href^="/css/ad-film.stage-width-override.css"]');
  if (staleOverride) staleOverride.remove();

  const load = (src) => new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = resolve;
    document.head.appendChild(script);
  });

  load("/js/ad-film.active-run-event-guard.js?v=5")
    .then(() => load("/js/ad-film.quality-policy.js?v=4"))
    .then(() => load("/toast.compat.js?v=84"))
    .then(() => load("/js/ad-film.narration-targeted-ui-fix.js?v=1"));
})();