(() => {
  if (window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V82__) return;
  window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V82__ = true;

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

  load("/js/ad-film.active-run-event-guard.js?v=3")
    .then(() => load("/js/ad-film.quality-policy.js?v=2"))
    .then(() => load("/toast.compat.js?v=81"));
})();
