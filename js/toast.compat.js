(() => {
  if (window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V77__) return;
  window.__AIVO_ROOT_TOAST_COMPAT_LOADING_V77__ = true;
  const script = document.createElement("script");
  script.src = "/toast.compat.js?v=77";
  script.async = false;
  document.head.appendChild(script);
})();
