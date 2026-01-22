// studio.modules/atmosphere.module.js  (UNLIMITED + LEGACY SAFE)
// Amaç: Atmosfer pill'lerinde SINIRSIZ seçim.
// Not: 2 seçim limiti genelde eski bir handler (.smpack-pill) yüzünden oluyor.
// Bu modül: (1) root'a capture listener koyar, (2) click'i burada yakalar,
// (3) .is-active + aria-pressed toggle yapar, (4) global state'i yazar.

(() => {
  const ROOT_ID = 'atmEffects';
  const BTN_SEL = 'button.atm-pill, button.smpack-pill.atm-pill';

  // tek kaynak (hem yeni hem legacy okuyabilir)
  window.STATE = window.STATE || {};
  window.STATE.atmosphere = window.STATE.atmosphere || {};
  if (!Array.isArray(window.STATE.atmosphere.effects)) window.STATE.atmosphere.effects = [];

  function getKey(btn) {
    return btn.dataset.atmEff || btn.textContent.trim();
  }

  function setOn(btn, on) {
    btn.classList.toggle('is-active', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function syncState(root) {
    const keys = Array.from(root.querySelectorAll(`${BTN_SEL}.is-active, ${BTN_SEL}[aria-pressed="true"]`))
      .map(getKey)
      .filter(Boolean);

    // uniq
    const uniq = Array.from(new Set(keys));

    window.STATE.atmosphere.effects = uniq;
    // legacy fallbacks
    window.STATE.effects = uniq;
    window.STATE.atmEffects = uniq;

    return uniq;
  }

  function bind() {
    let root = document.getElementById(ROOT_ID);
    if (!root) return;

    // Çift bind engeli (root değişirse yeniden bağlanabilsin diye id bazlı değil, node bazlı)
    if (root.__ATM_BOUND__) return;
    root.__ATM_BOUND__ = true;

    // ilk senkron
    syncState(root);

    // ✅ KÖK NEDENİ ezmek için: capture'da yakala ve burada bitir
    root.addEventListener(
      'click',
      (e) => {
        const btn = e.target.closest(BTN_SEL);
        if (!btn || !root.contains(btn)) return;

        // diğer handler'ların 2-limit vb. logic'ini devre dışı bırak
        e.preventDefault();
        e.stopPropagation();
        if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

        const isOn = btn.classList.contains('is-active') || btn.getAttribute('aria-pressed') === 'true';
        setOn(btn, !isOn);

        // state
        syncState(root);

        // warn kapat
        const warn = document.getElementById('atmWarn');
        if (warn) warn.style.display = 'none';
      },
      true // capture = en önde biz
    );
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }

  // panel değişimlerinde tekrar bağlan
  document.addEventListener('aivo:pagechange', () => {
    // yeni DOM geldiyse tekrar bağlanır
    const r = document.getElementById(ROOT_ID);
    if (r) r.__ATM_BOUND__ = false;
    bind();
  });
})();
