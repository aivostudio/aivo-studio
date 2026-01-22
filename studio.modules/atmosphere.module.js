(() => {
  function setActive(btn, on) {
    btn.classList.toggle('is-active', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function bind() {
    const root = document.getElementById('atmEffects');
    if (!root) return;

    if (root.dataset.atmBound === '1') return;
    root.dataset.atmBound = '1';

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button.atm-pill');
      if (!btn) return;

      // yalnızca çakışan handler’ları engelle
      e.stopImmediatePropagation();
      e.stopPropagation();

      const max = Number(root.dataset.atmMax || 2);
      const actives = Array.from(root.querySelectorAll('button.atm-pill.is-active'));
      const isOn = btn.classList.contains('is-active');

      if (isOn) return setActive(btn, false);

      if (actives.length >= max) return; // istersen warn basarsın
      setActive(btn, true);
    }, true); // ✅ capture
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
