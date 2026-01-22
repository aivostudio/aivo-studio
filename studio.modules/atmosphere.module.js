// ✅ ATMOSFER: checkbox ile sınırsız seçim + kredi hesabı (20 + seçili)
// Button click çakışmalarını tamamen bypass eder.

(() => {
  const root = document.getElementById("atmEffects");
  if (!root) return;

  const hidden = document.getElementById("atmEffectsValue");
  const btnGen = document.getElementById("atmGenerateBtn");
  const BASE = 20;
  const PER_EFFECT = 1;

  const sync = () => {
    const checks = [...root.querySelectorAll(".atm-check")];
    const selected = checks.filter(c => c.checked).map(c => c.value);

    // label UI
    checks.forEach(c => {
      const lab = c.closest(".atm-pill");
      if (!lab) return;
      lab.classList.toggle("is-active", c.checked);
      lab.setAttribute("aria-pressed", c.checked ? "true" : "false");
      // legacy data-effect uyumu istersen:
      lab.dataset.effect = c.value;
    });

    const val = selected.join(",");
    root.dataset.selected = val;
    if (hidden) hidden.value = val;

    window.__ATM__ = window.__ATM__ || {};
    window.__ATM__.selected = selected;

    const total = BASE + selected.length * PER_EFFECT;
    if (btnGen) btnGen.textContent = `Atmosfer Video Oluştur (${total} Kredi)`;
  };

  root.addEventListener("change", (e) => {
    if (!e.target.classList?.contains("atm-check")) return;
    sync();
  });

  sync();
})();
