// studio.modules/atmosphere.module.js  ✅ LIMITSİZ SEÇİM FIX
// Eski “max=2”/kuyruk/shift mantığını tamamen bypass eder.
// data-atm-max >= 99 ise sınırsız; değilse dataset kadar limit uygular.
// Bu bloğu dosyanın EN ALTINA koy (en son söz bunun olsun).

(() => {
  const root = document.getElementById("atmEffects");
  if (!root) return;

  // ✅ yeniden bind: eski handler’ları override etmek için CAPTURE ile dinle
  // (legacy/önceki module handler’ları çalışsa bile biz önce yakalayıp yönetiyoruz)
  const hidden = document.getElementById("atmEffectsValue");

  const getKey = (btn) =>
    btn.getAttribute("data-effect")
    || btn.getAttribute("data-atm-eff")
    || btn.getAttribute("data-eff")
    || btn.dataset.effect
    || btn.dataset.atmEff
    || btn.dataset.eff
    || "";

  const maxFromDom = () => {
    const n = parseInt(root.dataset.atmMax || "999", 10);
    // 99+ => limitsiz
    return (Number.isFinite(n) && n >= 99) ? Infinity : (Number.isFinite(n) ? n : Infinity);
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

    // ✅ diğer handler’lar limit koymasın / basılmıyor hissi olmasın
    e.preventDefault();
    e.stopImmediatePropagation();

    // ✅ legacy okuyucular için data-effect garanti
    const k = getKey(btn);
    if (k && !btn.hasAttribute("data-effect")) btn.setAttribute("data-effect", k);

    const MAX = maxFromDom();
    const isOn = btn.classList.contains("is-active");

    if (!isOn) {
      const activeCount = root.querySelectorAll(".atm-pill.is-active").length;
      if (activeCount >= MAX) {
        // limitli mod (MAX finite) için uyarı
        if (Number.isFinite(MAX)) window.toast?.error?.(`En fazla ${MAX} seçim yapabilirsin`);
        return;
      }
    }

    // toggle
    btn.classList.toggle("is-active", !isOn);
    btn.setAttribute("aria-pressed", (!isOn) ? "true" : "false");

    sync();
  }, true); // capture=true

  // ilk sync
  sync();
})();
