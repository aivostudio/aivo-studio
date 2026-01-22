// studio.modules/atmosphere.module.js (V-LOCKFREE)
(() => {
  const ROOT = () => document.getElementById('atmEffects');
  const BTN = 'button.atm-pill';

  // Tek kaynak: window.STATE.atmosphere.effects
  window.STATE = window.STATE || {};
  window.STATE.atmosphere = window.STATE.atmosphere || {};
  if (!Array.isArray(window.STATE.atmosphere.effects)) window.STATE.atmosphere.effects = [];

  function key(btn) { return btn.dataset.atmEff || btn.textContent.trim(); }

  function setBtn(btn, on) {
    btn.classList.toggle('is-active', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function syncState(root) {
    const keys = Array.from(root.querySelectorAll(`${BTN}[aria-pressed="true"]`)).map(key);
    window.STATE.atmosphere.effects = keys;
    // legacy fallback:
    window.STATE.effects = keys;
    window.STATE.atmEffects = keys;
  }

  function init() {
    const root = ROOT();
    if (!root || root.dataset.bound === '1') return;
    root.dataset.bound = '1';

    // En başta state'i DOM'dan oku
    syncState(root);

    // ✅ Event delegation: sadece root dinler
    root.addEventListener('click', (e) => {
      const btn = e.target.closest(BTN);
      if (!btn) return;

      // sadece burada bubble'ı kes (capture yok!)
      e.stopPropagation();

      const on = btn.getAttribute('aria-pressed') === 'true';
      setBtn(btn, !on);

      syncState(root);
    }, false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  document.addEventListener('aivo:pagechange', init);
})();
