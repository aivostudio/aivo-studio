// ✅ SAFE: Pill tıklamasını bozmaz. Legacy state’i her değişimde günceller.
(() => {
  const root = document.getElementById("atmEffects");
  if (!root) return;

  const writeLegacy = () => {
    const hidden = document.getElementById("atmEffectsValue");

    const selected = [...root.querySelectorAll(".atm-check")]
      .filter(c => c.checked)
      .map(c => c.value);

    const val = selected.join(",");

    root.dataset.selected = val;
    if (hidden) hidden.value = val;

    window.__ATM__ = window.__ATM__ || {};
    window.__ATM__.selected = selected;
  };

  // ✅ checkbox change → legacy’ye yaz
  root.addEventListener("change", (e) => {
    if (!e.target.classList?.contains("atm-check")) return;

    // label UI (is-active/aria-pressed)
    const lab = e.target.closest(".atm-pill");
    if (lab) {
      lab.classList.toggle("is-active", e.target.checked);
      lab.setAttribute("aria-pressed", e.target.checked ? "true" : "false");
    }

    writeLegacy();
  });

  // ilk sync
  writeLegacy();
})();
