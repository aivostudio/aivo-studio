// ✅ ATMOSFER: sınırsız seçim + kredi hesabı (20 + seçilen atmosfer sayısı)
// atmosphere.module.js içinde eski max=2 / queue / shift bloklarını KALDIR ve bunu kullan.

(() => {
  const root = document.getElementById("atmEffects");
  if (!root) return;

  // tek bind
  if (root.dataset.atmModuleBound === "1") return;
root.dataset.atmModuleBound = "1";


  const hidden = document.getElementById("atmEffectsValue");
  const btnGen = document.getElementById("atmGenerateBtn"); // CTA
  const BASE = 20; // taban kredi
  const PER_EFFECT = 1; // her atmosfer +1

  const getKey = (btn) =>
    btn.getAttribute("data-effect")
    || btn.getAttribute("data-atm-eff")
    || btn.getAttribute("data-eff")
    || btn.dataset.effect
    || btn.dataset.atmEff
    || btn.dataset.eff
    || "";

  const getSelected = () => {
    const actives = [...root.querySelectorAll(".atm-pill.is-active")];
    return actives.map(getKey).filter(Boolean);
  };

  const sync = () => {
    const keys = getSelected();
    const val = keys.join(",");

    // legacy/form uyumu
    root.dataset.selected = val;
    if (hidden) hidden.value = val;

    // global (okuyan varsa)
    window.__ATM__ = window.__ATM__ || {};
    window.__ATM__.selected = keys;

    // kredi etiketi güncelle
    const total = BASE + (keys.length * PER_EFFECT);
    if (btnGen) {
      btnGen.textContent = `Atmosfer Video Oluştur (${total} Kredi)`;
      btnGen.dataset.atmCost = String(total);
      btnGen.dataset.atmEffectsCount = String(keys.length);
    }
  };

  // ✅ event delegation — LIMIT YOK
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".atm-pill");
    if (!btn) return;

    // data-effect garanti
    const k = getKey(btn);
    if (k && !btn.hasAttribute("data-effect")) btn.setAttribute("data-effect", k);

    const isOn = btn.classList.contains("is-active");
    btn.classList.toggle("is-active", !isOn);
    btn.setAttribute("aria-pressed", (!isOn) ? "true" : "false");

    sync();
  });

  sync();
})();
