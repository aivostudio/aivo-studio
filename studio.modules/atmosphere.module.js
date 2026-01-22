// studio.modules/atmosphere.module.js
(() => {
  function setActive(btn, on) {
    btn.classList.toggle('is-active', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) btn.dataset.atmTs = String(Date.now());
    else delete btn.dataset.atmTs;
  }

  function bind() {
    let root = document.getElementById('atmEffects');
    if (!root) return;

    // Eski listener’ları temizle
    const fresh = root.cloneNode(true);
    root.parentNode.replaceChild(fresh, root);
    root = fresh;

    if (root.dataset.atmBound === '1') return;
    root.dataset.atmBound = '1';

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button.atm-pill');
      if (!btn) return;

      // Başka handler’lara gitmesin
      e.stopImmediatePropagation();
      e.stopPropagation();

      const max = Number(root.dataset.atmMax || 2);
      const actives = Array.from(root.querySelectorAll('button.atm-pill.is-active'));

      // Aynı butona tekrar basıldıysa kapat
      if (btn.classList.contains('is-active')) {
        setActive(btn, false);
        return;
      }

      // MAX doluysa: SWAP (en eskiyi düşür, yeniyi aç)
      if (actives.length >= max) {
        const oldest = actives
          .slice()
          .sort((a, b) => Number(a.dataset.atmTs || 0) - Number(b.dataset.atmTs || 0))[0];
        if (oldest) setActive(oldest, false);
      }

      // Yeniyi aç (inat eden başka kod varsa tekrar uygula)
      setActive(btn, true);
      requestAnimationFrame(() => setActive(btn, true));
      setTimeout(() => setActive(btn, true), 0);

    }, true); // capture
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }

  document.addEventListener('aivo:pagechange', bind);
})();
