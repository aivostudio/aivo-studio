(() => {
  if (window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V78__) return;
  window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V78__ = true;

  const load = (src) => new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = resolve;
    script.onerror = resolve;
    document.head.appendChild(script);
  });

  load("/js/ad-film.active-run-event-guard.js?v=3")
    .then(() => load("/toast.compat.js?v=78"));
})();
