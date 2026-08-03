(() => {
  if (window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V76__) return;
  window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V76__ = true;
  const script = document.createElement("script");
  script.src = "/toast.compat.js?v=76";
  script.async = false;
  document.head.appendChild(script);
})();
