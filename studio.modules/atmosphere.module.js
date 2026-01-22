// studio.modules/atmosphere.module.js

(function initAtmospherePills(){
  const root = document.getElementById("atmEffects");
  if (!root) return;

  // ✅ duplicate bind koruması (iki beyin sorununu azaltır)
  if (root.dataset.atmBound === "1") return;
  root.dataset.atmBound = "1";

  const hidden = document.getElementById("atmEffectsValue");

  const getKey = (btn) =>
    btn.getAttribute("data-atm-eff")
    || btn.getAttribute("data-eff")
    || btn.getAttribute("data-effect")
    || btn.dataset.atmEff
    || btn.dataset.eff
    || btn.dataset.effect
    || "";

  const syncSelected = () => {
    const active = [...root.querySelectorAll(".atm-pill.is-active")];
    const keys = active.map(getKey).filter(Boolean);

    // ✅ legacy uyumu: hidden + dataset
    const val = keys.join(",");
    if (hidden) {
      hidden.value = val;
      hidden.dispatchEvent(new Event("change", { bubbles: true }));
    }
    root.dataset.selected = val;

    // ✅ opsiyonel global (legacy bir yerden bunu okuyorsa)
    window.__ATM__ = window.__ATM__ || {};
    window.__ATM__.selected = keys;
  };

  // ✅ Event delegation (pill “basılmıyor” sorununu da azaltır)
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".atm-pill");
    if (!btn) return;

    // ✅ data-effect yoksa ekle (okuyucular için)
    if (!btn.hasAttribute("data-effect")) {
      const k = getKey(btn);
      if (k) btn.setAttribute("data-effect", k);
    }

    // toggle
    const on = btn.classList.toggle("is-active");
    btn.setAttribute("aria-pressed", on ? "true" : "false");

    syncSelected();
  }, { passive: true });

  // ilk sync (sayfa default state varsa)
  syncSelected();
})();
