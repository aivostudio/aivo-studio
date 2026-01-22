// studio.modules/atmosphere.module.js
// ✅ UNLIMITED selection + legacy-compatible state
// - UI: .is-active + aria-pressed
// - State: window.STATE.atmosphere.effects + legacy fallbacks
// - Blocks legacy "max=2" by capturing click first and writing "legacy arrays"

(() => {
  const ROOT_ID = 'atmEffects';
  const BTN_SEL = 'button.atm-pill, button.smpack-pill.atm-pill';

  // single source of truth
  window.STATE = window.STATE || {};
  window.STATE.atmosphere = window.STATE.atmosphere || {};
  if (!Array.isArray(window.STATE.atmosphere.effects)) window.STATE.atmosphere.effects = [];

  function rootEl() {
    return document.getElementById(ROOT_ID);
  }

  function keyOf(btn) {
    return btn?.dataset?.atmEff || btn?.getAttribute?.('data-atm-eff') || btn?.textContent?.trim() || '';
  }

  function isOn(btn) {
    return btn.classList.contains('is-active') || btn.getAttribute('aria-pressed') === 'true';
  }

  function setOn(btn, on) {
    btn.classList.toggle('is-active', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function readActiveKeys(root) {
    return Array.from(root.querySelectorAll(BTN_SEL))
      .filter(isOn)
      .map(keyOf)
      .filter(Boolean);
  }

  function writeState(keys) {
    const uniq = Array.from(new Set(keys));

    // ✅ new
    window.STATE.atmosphere.effects = uniq;

    // ✅ legacy fallbacks (çok kritik: farklı yerler buradan okuyabilir)
    window.STATE.effects = uniq;
    window.STATE.atmEffects = uniq;
    window.STATE.atm_effects = uniq;

    // Bazı legacy kodlar string bekleyebilir:
    window.STATE.effectsCsv = uniq.join(',');
    window.STATE.atmEffectsCsv = uniq.join(',');

    // Bazı kodlar DOM üzerinden okur: root.dataset
    const root = rootEl();
    if (root) {
      root.dataset.selected = uniq.join(',');
      root.dataset.atmSelected = uniq.join(',');
      // max'ı tamamen kaldır (legacy limit okumasın diye)
      delete root.dataset.atmMax;
      root.removeAttribute('data-atm-max');
    }

    return uniq;
  }

  function syncFromDom() {
    const root = rootEl();
    if (!root) return [];
    const keys = readActiveKeys(root);
    return writeState(keys);
  }

  function bind() {
    const root = rootEl();
    if (!root) return;

    // double bind guard
    if (root.__ATM_BOUND__) return;
    root.__ATM_BOUND__ = true;

    // ilk sync
    syncFromDom();

    // ✅ capture: biz önce yakalayacağız, legacy 2-limit'e gidemeyecek
    root.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest(BTN_SEL);
        if (!btn || !root.contains(btn)) return;

        // legacy davranışını kes
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

        // toggle
        setOn(btn, !isOn(btn));

        // state yaz
        syncFromDom();

        // uyarı kapat
        const warn = document.getElementById('atmWarn');
        if (warn) warn.style.display = 'none';
      },
      true
    );
  }

  // ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }

  // page change (studio.js bazen DOM'u yeniden kuruyor)
  document.addEventListener('aivo:pagechange', () => {
    const r = rootEl();
    if (r) r.__ATM_BOUND__ = false;
    bind();
    syncFromDom();
  });

  // ayrıca ilk 1 sn içinde birkaç kez sync (legacy script sonradan state sıfırlayabiliyor)
  setTimeout(syncFromDom, 0);
  setTimeout(syncFromDom, 50);
  setTimeout(syncFromDom, 250);
})();
