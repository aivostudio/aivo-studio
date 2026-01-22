// studio.modules/atmosphere.module.js
(() => {
  const MAX_DEFAULT = 2;

  function setActive(btn, on) {
    btn.classList.toggle('is-active', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function getActiveButtons(root) {
    return Array.from(root.querySelectorAll('button.atm-pill.is-active'));
  }

  function onAtmPress(e) {
    const btn = e.target.closest('button.atm-pill');
    if (!btn) return;

    // ✅ En kritik kısım: başka handler'lara gitmesin
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

    const root = document.getElementById('atmEffects');
    if (!root) return;

    const max = Number(root.dataset.atmMax || MAX_DEFAULT);
    const actives = getActiveButtons(root);
    const isOn = btn.classList.contains('is-active');

    // toggle off
    if (isOn) {
      setActive(btn, false);
      return;
    }

    // toggle on (max kontrol)
    if (actives.length >= max) {
      // istersen burada warn gösterirsin
      // (mevcut atmWarn varsa)
      const warn = document.getElementById('atmWarn');
      if (warn) {
        warn.style.display = 'block';
        warn.textContent = `En fazla ${max} seçim yapabilirsin.`;
        clearTimeout(warn._t);
        warn._t = setTimeout(() => (warn.style.display = 'none'), 1200);
      }
      return;
    }

    setActive(btn, true);
  }

  function bind() {
    const root = document.getElementById('atmEffects');
    if (!root) return;

    // Çift bind engeli
    if (root.dataset.atmBound === '1') return;
    root.dataset.atmBound = '1';

    // ✅ CAPTURE + pointerdown: en önde biz yakalayalım
    root.addEventListener('pointerdown', onAtmPress, true);
    root.addEventListener('click', onAtmPress, true);
  }

  // ilk yük
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }

  // panel/page change varsa tekrar dene (zararsız)
  document.addEventListener('aivo:pagechange', bind);
})();
