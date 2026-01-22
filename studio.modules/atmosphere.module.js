// ✅ ATMOSFER: sınırsız seçim (legacy max=2'yi ez) + seçimi legacy kaynaklara yazar
(() => {
  const root = document.getElementById("atmEffects");
  if (!root) return;

  // tek bind
  if (root.dataset.atmModuleBound === "1") return;
  root.dataset.atmModuleBound = "1";

  const hidden = document.getElementById("atmEffectsValue");

  const keyOf = (btn) =>
    btn.getAttribute("data-effect") ||
    btn.getAttribute("data-atm-eff") ||
    btn.getAttribute("data-eff") ||
    btn.dataset.effect ||
    btn.dataset.atmEff ||
    btn.dataset.eff ||
    btn.textContent.trim();

  const sync = () => {
    const actives = [...root.querySelectorAll(".atm-pill.is-active")];
    const keys = actives.map(keyOf).filter(Boolean);
    const val = keys.join(",");

    root.dataset.selected = val;
    if (hidden) hidden.value = val;

    // debug istersen sonra sil
    // console.log("[ATM SYNC]", keys, val);
  };

  const toggle = (btn) => {
    const on = btn.classList.contains("is-active");
    btn.classList.toggle("is-active", !on);
    btn.setAttribute("aria-pressed", (!on) ? "true" : "false");
  };

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".atm-pill");
    if (!btn) return;

    // önce toggle yap
    toggle(btn);

    // legacy hemen geri alırsa diye:
    // 1) anında sync
    sync();
    // 2) event döngüsü bitince tekrar sync (legacy'nin max=2 müdahalesini ezer)
    setTimeout(sync, 0);
  });

  // başlangıç
  sync();
})();
