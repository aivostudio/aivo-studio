(function () {
  function tryInit() {
    const module = document.querySelector("#moduleHost section[data-module='music']");
    if (!module) return false;

    // ----------------------------
    // MODE (basic / pro)
    // ----------------------------
    const MODE_KEY = "aivo_music_mode";
    const switchEl = module.querySelector("[data-mode-switch]");
    if (!switchEl) return false;

    const modeButtons = Array.from(switchEl.querySelectorAll("[data-mode]"));
    const proFields = Array.from(module.querySelectorAll('[data-visible-in="pro"]'));

    function applyMode(mode) {
      const m = (mode === "pro") ? "pro" : "basic";
      module.setAttribute("data-mode", m);
      try { sessionStorage.setItem(MODE_KEY, m); } catch(e) {}

      // button active + aria
      modeButtons.forEach((btn) => {
        const on = btn.dataset.mode === m;
        btn.classList.toggle("is-active", on);
        btn.setAttribute("aria-pressed", on ? "true" : "false");
      });

      // pro alanları göster/gizle
      const showPro = (m === "pro");
      proFields.forEach((el) => {
        el.style.display = showPro ? "" : "none";
      });
    }

    // default
    let saved = "basic";
    try { saved = sessionStorage.getItem(MODE_KEY) || "basic"; } catch(e) {}
    applyMode(saved);

    // click bind (idempotent)
    if (!module.__aivo_mode_bound) {
      module.__aivo_mode_bound = true;
      module.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-mode-switch] [data-mode]");
        if (!btn) return;
        applyMode(btn.dataset.mode);
      });
    }

    // ----------------------------
    // BACKWARD COMPAT:
    // eski kod çağırırsa kırılmasın
    // ----------------------------
    window.switchMusicView = function () { return true; };

    console.log("[AIVO] music.module READY (mode toggle ok)");
    return true;
  }

  // 1) Hemen dene
  if (tryInit()) return;

  // 2) module inject edilene kadar bekle
  const host = document.getElementById("moduleHost");
  if (!host) return;

  const obs = new MutationObserver(() => {
    if (tryInit()) obs.disconnect();
  });

  obs.observe(host, { childList: true, subtree: true });
})();
