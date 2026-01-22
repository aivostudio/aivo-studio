// studio.modules/atmosphere.module.js
(() => {
  const ROOT_ID = 'atmEffects';
  const BTN_SEL = 'button.atm-pill';

  // Global state’i garanti et (hangi dosya kullanırsa kullansın)
  window.STATE = window.STATE || {};
  window.STATE.atmosphere = window.STATE.atmosphere || {};
  // Tek otorite liste: window.STATE.atmosphere.effects
  if (!Array.isArray(window.STATE.atmosphere.effects)) {
    window.STATE.atmosphere.effects = [];
  }

  function getKey(btn) {
    return btn.dataset.atmEff || btn.textContent.trim();
  }

  function setBtn(btn, on) {
    btn.classList.toggle('is-active', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function readFromDom(root) {
    return Array.from(root.querySelectorAll(`${BTN_SEL}[aria-pressed="true"], ${BTN_SEL}.is-active`))
      .map(getKey);
  }

  function syncStateFromDom(root) {
    const keys = readFromDom(root);
    window.STATE.atmosphere.effects = keys;
    // debug istersen:
    // console.log('[ATM] effects=', keys);
    return keys;
  }

  function applyDomFromState(root) {
    const wanted = new Set(window.STATE.atmosphere.effects || []);
    Array.from(root.querySelectorAll(BTN_SEL)).forEach(btn => {
      setBtn(btn, wanted.has(getKey(btn)));
    });
  }

  function bind() {
    let root = document.getElementById(ROOT_ID);
    if (!root) return;

    // Eski listener’ları temizle
    const fresh = root.cloneNode(true);
    root.parentNode.replaceChild(fresh, root);
    root = fresh;

    // İlk açılışta DOM -> STATE senkronla (mevcut seçim varsa kaybetme)
    syncStateFromDom(root);
    applyDomFromState(root);

    root.addEventListener('click', (e) => {
      const btn = e.target.closest(BTN_SEL);
      if (!btn) return;

      // Çakışan handler’ları kes
      e.stopImmediatePropagation();
      e.stopPropagation();

      const key = getKey(btn);

      // Toggle
      const isOn = btn.getAttribute('aria-pressed') === 'true' || btn.classList.contains('is-active');
      setBtn(btn, !isOn);

      // DOM -> STATE
      const keys = syncStateFromDom(root);

      // UI warn (opsiyonel) — artık “en az 1 seç” uyarısı burada değil, submit tarafında.
      const warn = document.getElementById('atmWarn');
      if (warn) warn.style.display = 'none';

      // Birileri geri yazarsa (legacy), bir frame sonra tekrar uygula
      requestAnimationFrame(() => {
        // STATE bozulduysa DOM’dan tekrar oku
        const keys2 = syncStateFromDom(root);
        window.STATE.atmosphere.effects = keys2;
        applyDomFromState(root);
      });

    }, true); // capture
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
  document.addEventListener('aivo:pagechange', bind);
})();
