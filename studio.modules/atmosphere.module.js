(() => {
  function setActive(btn, on) {
    btn.classList.toggle('is-active', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) btn.dataset.atmTs = String(Date.now());
    else delete btn.dataset.atmTs;
  }

  function bind() {
    const root = document.getElementById('atmEffects');
    if (!root) return;
    if (root.dataset.atmBound === '1') return;
    root.dataset.atmBound = '1';

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button.atm-pill');
      if (!btn) return;

      // çakışan handler’ları kes
      e.stopImmediatePropagation();
      e.stopPropagation();

      const max = Number(root.dataset.atmMax || 2);
      const actives = Array.from(root.querySelectorAll('button.atm-pill.is-active'));

      // 1) tekrar tıklarsa kapat
      if (btn.classList.contains('is-active')) {
        setActive(btn, false);
        return;
      }

      // 2) max doluysa en eskiyi kapat, bunu aç
      if (actives.length >= max) {
        const oldest = actives
          .slice()
          .sort((a, b) => Number(a.dataset.atmTs || 0) - Number(b.dataset.atmTs || 0))[0];
        if (oldest) setActive(oldest, false);
      }

      // 3) bunu aç (inat eden başka kod varsa, bir mikro gecikmeyle tekrar uygula)
      setActive(btn, true);
      requestAnimationFrame(() => setActive(btn, true));
      setTimeout(() => setActive(btn, true), 0);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }
})();
