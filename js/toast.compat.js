(() => {
  if (window.__AIVO_ROOT_TOAST_COMPAT_LOADING__) return;
  window.__AIVO_ROOT_TOAST_COMPAT_LOADING__ = true;
  const script = document.createElement("script");
  script.src = "/toast.compat.js?v=75";
  script.async = false;
  document.head.appendChild(script);
})();
