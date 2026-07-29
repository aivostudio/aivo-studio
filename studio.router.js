// ===============================
// MODULE CSS LOADER (GLOBAL)
// ===============================
window.ensureModuleCSS = function () {
  return Promise.resolve();
};
// ===============================
// ROUTER
// ===============================
(function () {
  if (window.__AIVO_ROUTER_BOOTED__) {
    console.warn("[AIVO] router already booted, skipping");
    return;
  }
  window.__AIVO_ROUTER_BOOTED__ = true;

  const RIGHT_PANEL_KEY = {
    music: