(() => {
  if (window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V91__) return;
  window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V91__ = true;

  const staleOverride = document.querySelector('link[href^="/css/ad-film.stage-width-override.css"]');
  if (staleOverride) staleOverride.remove();

  const existing = document.querySelector('script[src^="/toast.compat.js"]');
  if (existing) existing.remove();

  const script = document.createElement("script");
  script.src = "/toast.compat.js?v=91";
  script.async = false;
  document.head.appendChild(script);
})();
