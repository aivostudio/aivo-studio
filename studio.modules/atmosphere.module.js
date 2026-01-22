// /studio.modules/atmosphere.module.js
(() => {
  const ROOT_ID = "atmEffects";
  const HIDDEN_ID = "atmEffectsValue";

  function uniq(arr) { return Array.from(new Set(arr)); }
  function getKey(btn) {
    return (btn?.dataset?.atmEff || btn?.getAttribute?.("data-atm-eff") || btn?.textContent || "").trim();
  }

  function setBtn(btn, on) {
    btn.classList.toggle("is-active", !!on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    // bazı legacy kodlar dataset flag bakabiliyor:
    if (on) btn.dataset.atmOn = "1"; else delete btn.dataset.atmOn;
  }

  function getSelected(root) {
    const act = Array.from(root.querySelectorAll("button.atm-pill.is-active, button.smpack-pill.atm-pill.is-active"));
    return uniq(act.map(getKey).filter(Boolean));
  }

  function ensureHiddenIn(container) {
    let input = document.getElementById(HIDDEN_ID);
    if (!input) {
      input = document.createElement("input");
      input.type = "hidden";
      input.id = HIDDEN_ID;
      input.name = "atmEffects"; // form validation genelde buna bakar
    }
    if (container && input.parentNode !== container) container.appendChild(input);
    return input;
  }

  function writeEverywhere(root, effects) {
    // 1) dataset snapshot
    root.dataset.atmSelected = JSON.stringify(effects);

    // 2) global değişkenler
    window.__ATM_EFFECTS__ = effects;
    window.atmEffects = effects;
    window.__AIVO_ATM_EFFECTS__ = effects;

    // 3) store (hangi anahtar okunuyorsa yakala diye çoklu yazıyoruz)
    try {
      if (window.store && typeof window.store.set === "function") {
        window.store.set("atm.effects", effects);
        window.store.set("atmEffects", effects);
        window.store.set("atmEffectsValue", effects.join(","));
        window.store.set("atmosphere.effects", effects);
        window.store.set("atmosphereEffects", effects);
      }
    } catch (_) {}

    // 4) localStorage fallback
    try {
      localStorage.setItem("atm.effects", JSON.stringify(effects));
      localStorage.setItem("atmEffects", JSON.stringify(effects));
      localStorage.setItem("atmosphere.effects", JSON.stringify(effects));
    } catch (_) {}

    // 5) event (başka modül dinliyorsa)
    try {
      document.dispatchEvent(new CustomEvent("atm:change", { detail: { effects } }));
    } catch (_) {}
  }

  function bindPills(root) {
    if (!root || root.dataset.atmBound === "1") return;
    root.dataset.atmBound = "1";

    // HTML’de class unutulduysa ekle
    root.querySelectorAll("button").forEach((b) => {
      if (!b.classList.contains("atm-pill")) b.classList.add("atm-pill");
      if (!b.classList.contains("smpack-pill")) b.classList.add("smpack-pill");
      if (!b.hasAttribute("aria-pressed")) b.setAttribute("aria-pressed", "false");
    });

    // ilk yaz
    writeEverywhere(root, getSelected(root));

    // PILL toggle — capture + stopImmediatePropagation (başka kod override ediyordu)
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("button.atm-pill, button.smpack-pill.atm-pill");
      if (!btn || !root.contains(btn)) return;

      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();

      const on = !btn.classList.contains("is-active");
      setBtn(btn, on);

      const effects = getSelected(root);
      writeEverywhere(root, effects);

      // başka kod geri çekerse tekrar bas
      queueMicrotask(() => writeEverywhere(root, getSelected(root)));
      requestAnimationFrame(() => writeEverywhere(root, getSelected(root)));
    }, true);
  }

  function hookCreateButton(root) {
    if (document.documentElement.dataset.atmCreateHook === "1") return;
    document.documentElement.dataset.atmCreateHook = "1";

    // “Oluştur” tıklanınca: hidden input’u butonun formunun içine taşı + value yaz
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("button, a");
      if (!btn) return;

      const txt = (btn.textContent || "").trim().toLowerCase();
      const isCreate =
        txt.includes("atmosfer video oluştur") ||
        btn.id === "atmCreateBtn" ||
        btn.getAttribute("data-atm-create") === "1";

      if (!isCreate) return;

      // Seçimleri son kez topla
      const effects = getSelected(root);
      writeEverywhere(root, effects);

      // En kritik: input formun içinde olmalı (FormData)
      const form = btn.closest("form") || document.querySelector("form");
      const container = form || (document.getElementById("atmCard") || document.body);
      const input = ensureHiddenIn(container);
      input.value = effects.join(",");

      // Bazı validasyonlar direkt input.value bakıyor
      window.atmEffectsValue = input.value;

      // yine de biri ezmeye çalışırsa
      queueMicrotask(() => { input.value = getSelected(root).join(","); });
    }, true);
  }

  function bind() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    bindPills(root);
    hookCreateButton(root);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind, { once: true });
  } else {
    bind();
  }
  document.addEventListener("aivo:pagechange", bind);
})();
