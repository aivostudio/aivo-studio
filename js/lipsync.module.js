(() => {
  if (window.__AIVO_LIPSYNC_MODULE_BIND__) return;
  window.__AIVO_LIPSYNC_MODULE_BIND__ = true;

  const CREDIT_BY_DURATION = {
    "10": 15,
    "20": 30,
    "30": 45,
    "40": 60,
    "50": 75,
    "60": 90
  };

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function getRoot() {
    return qs('.main-panel[data-module="lipsync"]');
  }

  function getSelectedDuration(root) {
    const durationSelect = qs("[data-lipsync-duration]", root);
    return String(durationSelect?.value || "10");
  }

  function getCreditCost(duration) {
    return CREDIT_BY_DURATION[String(duration || "10")] || 15;
  }

  function syncGenerateButton(root) {
    const btn = qs("[data-lipsync-generate]", root);
    if (!btn) return;

    const duration = getSelectedDuration(root);
    const credit = getCreditCost(duration);

    btn.dataset.creditCost = String(credit);
    btn.textContent = `Dudak Senkron Video Üret (${credit} Kredi)`;
  }

  function bindEvents() {
    document.addEventListener("change", (e) => {
      const root = getRoot();
      if (!root) return;

      const durationSelect = e.target.closest("[data-lipsync-duration]");
      if (!durationSelect || !root.contains(durationSelect)) return;

      syncGenerateButton(root);
    });
  }

  function init() {
    const root = getRoot();
    if (!root) return false;

    syncGenerateButton(root);
    return true;
  }

  bindEvents();

  if (!init()) {
    const observer = new MutationObserver(() => {
      if (init()) observer.disconnect();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
