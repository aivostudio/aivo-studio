// /studio.modules/atmosphere.module.js
(() => {
  const ROOT_ID = "atmEffects";
  const HIDDEN_ID = "atmEffectsValue";

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  function getKey(btn) {
    return (btn?.dataset?.atmEff || btn?.getAttribute?.("data-atm-eff") || btn?.textContent || "")
      .trim();
  }

  function ensureHiddenInput(root) {
    const card = root.closest("#atmCard") || root.parentElement || document.body;
    let input = document.getElementById(HIDDEN_ID);
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.id = HIDDEN_ID;
      input.name = "atmEffects";
      card.appendChild(input);
    }
    return input;
  }

  function setBtnActive(btn, on) {
    btn.classList.toggle("is-active", !!on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function getSelectedKeys(root) {
    const actives = Array.from(root.querySelectorAll("button.atm-pill.is-active, button.smpack-pill.atm-pill.is-active"));
    return uniq(actives.map(getKey).filter(Boolean));
  }

  function writeState(root) {
    const keys = getSelectedKeys(root);

    // 1) hidden input
    const input = ensureHiddenInput(root);
    input.value = keys.join(",");

    // 2) dataset snapshot
    root.dataset.atmSelected = JSON.stringify(keys);

    // 3) legacy/global + store
    try {
      window.__ATM_EFFECTS__ = keys;
      window.atmEffects = keys;

      if (window.store && typeof window.store.set === "function") {
        window.store.set("atm.effects", keys);
        window.store.set("atmEffects", keys);
      }
      // bazı legacy kodlar localStorage okuyabiliyor
      try {
        localStorage.setItem("atm.effects", JSON.stringify(keys));
        localStorage.setItem("atmEffects", JSON.stringify(keys));
      } catch (_) {}
    } catch (_) {}

    // başka modüller dinliyorsa
    try {
      document.dispatchEvent(new CustomEvent("atm:change", { detail: { effects: keys } }));
    } catch (_) {}
  }

  function bindOnce(root) {
    if (!root || root.dataset.atmBound === "1") return;
    root.dataset.atmBound = "1";

    // İlk state yaz
    writeState(root);

    // CAPTURE + stopImmediatePropagation:
    // Çünkü senin sayfada başka kodlar click'i kilitleyip/override ediyordu.
    root.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest("button.atm-pill, button.smpack-pill.atm-pill");
        if (!btn || !root.contains(btn)) return;

        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

        const on = !btn.classList.contains("is-active");
        setBtnActive(btn, on);

        // ÖNCE hemen yaz
        writeState(root);

        // SONRA microtask + rAF ile tekrar yaz (başka kod geri alırsa ezsin)
        queueMicrotask(() => writeState(root));
        requestAnimationFrame(() => writeState(root));
      },
      true
    );
  }

  function bind() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    // atm-pill class'ı yoksa (HTML'de unutulursa) otomatik ekle
    root.querySelectorAll("button").forEach((b) => {
      if (!b.classList.contains("atm-pill")) b.classList.add("atm-pill");
      // smpack-pill yoksa da eklemek iyi olur (CSS/legacy)
      if (!b.classList.contains("smpack-pill")) b.classList.add("smpack-pill");
    });
    bindOnce(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }

  // Studio sayfa geçişlerinde yeniden bağlan
  document.addEventListener("aivo:pagechange", bind);
})();
