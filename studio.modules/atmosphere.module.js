(() => {
  function setActive(btn, on) {
    btn.classList.toggle('is-active', !!on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (on) btn.dataset.atmTs = String(Date.now());
    else delete btn.dataset.atmTs;
  }

  function applySnapshot(root, wantedKeys) {
    const all = Array.from(root.querySelectorAll('button.atm-pill'));
    all.forEach(b => {
      const key = b.dataset.atmEff || b.textContent.trim();
      setActive(b, wantedKeys.includes(key));
    });
  }

  function getActiveKeys(root) {
    return Array.from(root.querySelectorAll('button.atm-pill.is-active'))
      .map(b => b.dataset.atmEff || b.textContent.trim());
  }

  function bind() {
    let root = document.getElementById('atmEffects');
    if (!root) return;

    // ✅ Eski listener’ları temizle: node’u clone’la değiştir
    const fresh = root.cloneNode(true);
    root.parentNode.replaceChild(fresh, root);
    root = fresh;

    // çift bind engeli
    if (root.dataset.atmBound === '1') return;
    root.dataset.atmBound = '1';

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button.atm-pill');
      if (!btn) return;

      // Bizden sonra kimse dokunamasın (bubble)
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

      const max = Number(root.dataset.atmMax || 2);

      // ✅ click öncesi state snapshot
      const before = getActiveKeys(root);

      // toggle off
      if (btn.classList.contains('is-active')) {
        setActive(btn, false);
        return;
      }

      // ✅ MAX doluysa BLOKLA + state’i kilitle
      if (before.length >= max) {
        const warn = document.getElementById('atmWarn');
        if (warn) {
          warn.style.display = 'block';
          warn.textContent = `En fazla ${max} seçim yapabilirsin.`;
          clearTimeout(warn._t);
          warn._t = setTimeout(() => (warn.style.display = 'none'), 1200);
        }

        // başka kod state’i değiştirirse geri al
        requestAnimationFrame(() => applySnapshot(root, before));
        setTimeout(() => applySnapshot(root, before), 0);
        return;
      }

      // max dolu değilse aç
      setActive(btn, true);

      // yine de başka kod geri alırsa tekrar uygula
      requestAnimationFrame(() => setActive(btn, true));
      setTimeout(() => setActive(btn, true), 0);

    }, true); // capture
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind, { once: true });
  } else {
    bind();
  }

  // Panel değişiminde tekrar bağla (node değişebilir)
  document.addEventListener('aivo:pagechange', bind);
})();
