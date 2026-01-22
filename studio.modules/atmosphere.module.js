// ✅ SAFE Atmosphere Pills: DOM max + legacy state sync (no stopImmediatePropagation)
(() => {
  const root = document.getElementById("atmEffects");
  if (!root) return;

  // bind guard
  if (root.dataset.atmBound === "1") return;
  root.dataset.atmBound = "1";

  const hidden = document.getElementById("atmEffectsValue");

  const getKey = (btn) =>
    btn.getAttribute("data-effect")
    || btn.getAttribute("data-atm-eff")
    || btn.getAttribute("data-eff")
    || btn.dataset.effect
    || btn.dataset.atmEff
    || btn.dataset.eff
    || "";

  const getMax = () => {
    const n = parseInt(root.dataset.atmMax || "999", 10);
    if (!Number.isFinite(n)) return Infinity;
    return (n >= 99) ? Infinity : Math.max(1, n);
  };

  const sync = () => {
    const actives = [...root.querySelectorAll(".atm-pill.is-active")];
    const keys = actives.map(getKey).filter(Boolean);
    const val = keys.join(",");

    root.dataset.selected = val;
    if (hidden) hidden.value = val;

    window.__ATM__ = window.__ATM__ || {};
    window.__ATM__.selected = keys;
  };

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".atm-pill");
    if (!btn) return;

    // data-effect garanti
    const k = getKey(btn);
    if (k && !btn.hasAttribute("data-effect")) btn.setAttribute("data-effect", k);

    const isOn = btn.classList.contains("is-active");
    const MAX = getMax();

    // açma denemesinde max kontrol
    if (!isOn && Number.isFinite(MAX)) {
      const activeCount = root.querySelectorAll(".atm-pill.is-active").length;
      if (activeCount >= MAX) {
        window.toast?.error?.(`En fazla ${MAX} seçim yapabilirsin`);
        return;
      }
    }

    // toggle
    btn.classList.toggle("is-active", !isOn);
    btn.setAttribute("aria-pressed", (!isOn) ? "true" : "false");

    sync();
  });

  sync();
})();
