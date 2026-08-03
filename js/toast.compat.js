(() => {
  if (window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V88__) return;
  window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V88__ = true;
  const script = document.createElement("script");
  script.src = "/toast.compat.js?v=88";
  script.async = false;
  document.head.appendChild(script);
})();
