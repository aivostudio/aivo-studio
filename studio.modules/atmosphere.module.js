/* studio.modules/atmosphere.module.js */
(() => {
  const log = (...a) => console.log("[ATM]", ...a);

  const state = {
    effects: [],
    max: 2,
  };

  function $(sel, root = document) {
    return root.querySelector(sel);
  }
  function $all(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function showWarn(msg) {
    const w = $("#atmWarn");
    if (!w) return;
    if (!msg) {
      w.style.display = "none";
      w.textContent = "";
      return;
    }
    w.style.display = "block";
    w.textContent = msg;
  }

  function syncUI() {
    const wrap = $("#atmEffects");
    if (!wrap) return;

    const pills = $all("#atmEffects [data-atm-eff]");
    pills.forEach((btn) => {
      const eff = btn.getAttribute("data-atm-eff");
      const on = state.effects.includes(eff);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

    // istersen buradan payload preview vs güncellersin
    // log("effects:", state.effects);
  }

  function toggleEffect(eff) {
    showWarn("");

    const idx = state.effects.indexOf(eff);
    const on = idx !== -1;

    if (on) {
      state.effects.splice(idx, 1);
      syncUI();
      return;
    }

    if (state.effects.length >= state.max) {
      showWarn(`En fazla ${state.max} atmosfer seçebilirsin.`);
      return;
    }

    state.effects.push(eff);
    syncUI();
  }

  function boot() {
    const wrap = $("#atmEffects");
    if (!wrap) return;

    const maxAttr = parseInt(wrap.getAttribute("data-atm-max") || "2", 10);
    state.max = Number.isFinite(maxAttr) ? maxAttr : 2;

    // ilk UI senk
    syncUI();

    log("module mounted ✅ (max:", state.max + ")");
  }

  // ✅ KRİTİK: Safari / legacy studio.js click’i öldürse bile,
  // window capture pointerdown her şeyden önce çalışır.
  function installGlobalCapture() {
    window.addEventListener(
      "pointerdown",
      (e) => {
        const btn = e.target && e.target.closest
          ? e.target.closest("#atmEffects [data-atm-eff]")
          : null;

        if (!btn) return;

        // click oluşmasını beklemiyoruz, pointerdown’da işi bitiriyoruz.
        e.preventDefault();
        e.stopImmediatePropagation();

        const eff = btn.getAttribute("data-atm-eff");
        if (!eff) return;

        toggleEffect(eff);
      },
      true // capture
    );
  }

  installGlobalCapture();

  // DOM hazır olunca bağlan
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
