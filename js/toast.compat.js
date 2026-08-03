(() => {
  if (window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V79__) return;
  window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V79__ = true;

  const overrideHref = "/css/ad-film.stage-width-override.css?v=1";
  if (!document.querySelector('link[href^="/css/ad-film.stage-width-override.css"]')) {
    const style = document.createElement("link");
    style.rel = "stylesheet";
    style.href = overrideHref;
    document.head.appendChild(style);
  }

  const load = (src) => new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = resolve;
    document.head.appendChild(script);
  });

  load("/js/ad-film.active-run-event-guard.js?v=3")
    .then(() => load("/toast.compat.js?v=79"));
})();
