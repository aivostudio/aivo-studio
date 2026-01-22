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

      // 2) max doluysa BLOKLA (en eskiyi kapatma yok)
if (actives.length >= max) {
  // (opsiyonel) uyarı göster
  const warn = document.getElementById('atmWarn');
  if (warn) {
    warn.style.display = 'block';
    warn.textContent = `En fazla ${max} seçim yapabilirsin.`;
    clearTimeout(warn._t);
    warn._t = setTimeout(() => (warn.style.display = 'none'), 1200);
  }
  return; // ❌ yeni seçimi engelle
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
