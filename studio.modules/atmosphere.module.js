/* /studio.modules/atmosphere.module.js
   Amaç:
   - Pill seçimini gerçekten “state”e yaz (legacy create/validate bunu görsün)
   - #atmEffectsValue (hidden input) + root.dataset + event ile senkronla
   - Kilitlenme/çakışma yapmasın (stopImmediatePropagation yok)
*/

(() => {
  const ROOT_ID = 'atmEffects';
  const HIDDEN_ID = 'atmEffectsValue'; // legacy/validate buradan okuyor olabilir

  function qs(id) { return document.getElementById(id); }

  function ensureHidden(root) {
    let inp = qs(HIDDEN_ID);
    if (!inp) {
      inp = document.createElement('input');
      inp.type = 'hidden';
      inp.id = HIDDEN_ID;
      inp.name = 'atmEffects';              // bazı validator’lar name ile arar
      root.insertAdjacentElement('afterend', inp);
    }
    return inp;
  }

  function getKey(btn) {
    return (btn?.dataset?.atmEff || btn?.getAttribute?.('data-atm-eff') || btn?.textContent || '')
      .trim();
  }

  function getButtons(root) {
    return Array.from(root.querySelectorAll('button.atm-pill, button.smpack-pill'));
  }

  function getActiveKeys(root) {
    return getButtons(root)
      .filter(b => b.classList.contains('is-active') || b.getAttribute('aria-pressed') === 'true')
      .map(getKey)
      .filter(Boolean);
  }

  function setActive(btn, on) {
    // ✅ görsel state (senin CSS’in bunları boyuyor)
    btn.classList.toggle('is-active', !!on);
    // bazı yerlerde smpack-pill selector’ı var; garanti olsun:
    if (!btn.classList.contains('smpack-pill')) btn.classList.add('smpack-pill');
    if (!btn.classList.contains('atm-pill')) btn.classList.add('atm-pill');

    // ✅ erişilebilir state (bazı validator’lar buradan okur)
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');

    // ✅ legacy için “seçili” izi (gerekirse buradan da okunabilir)
    if (on) btn.dataset.atmSelected = '1';
    else delete btn.dataset.atmSelected;
  }

  function syncState(root) {
    const keys = getActiveKeys(root);
    const inp = ensureHidden(root);

    // ✅ EN ÖNEMLİ: validator muhtemelen bunu okuyor
    // Tek seçim bekleyen eski kodlar için de ilkini yazalım.
    inp.value = keys.join(',');          // çoklu: "rain,leaf,fog"
    inp.dataset.first = keys[0] || '';   // tekli okuyan kodlar için emniyet

    // ✅ root üstüne de yaz
    root.dataset.atmSelected = inp.value;

    // ✅ change event (başka kod dinliyorsa tetiklensin)
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    root.dispatchEvent(new CustomEvent('atm:change', { detail: { keys, value: inp.value }, bubbles: true }));
  }

  function bindOnce(root) {
    if (root.dataset.atmBound === '1') return;
    root.dataset.atmBound = '1';

    // İlk yükte aria-pressed true olan varsa yakala
    getButtons(root).forEach(btn => {
      const pressed = btn.getAttribute('aria-pressed') === 'true';
      const active = btn.classList.contains('is-active');
      if (pressed || active) setActive(btn, true);
    });
    syncState(root);

    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button.atm-pill, button.smpack-pill');
      if (!btn || !root.contains(btn)) return;

      e.preventDefault();

      const key = getKey(btn);
      if (!key) return;

      // max kuralı: data-atm-max varsa uygula, yoksa sınırsız
      const maxRaw = root.getAttribute('data-atm-max');
      const max = maxRaw ? Number(maxRaw) : 0; // 0 => sınırsız

      const wasOn = btn.classList.contains('is-active') || btn.getAttribute('aria-pressed') === 'true';

      if (wasOn) {
        setActive(btn, false);
        syncState(root);
        return;
      }

      // max varsa ve doluysa: en eskisini kapat (soft)
      if (max > 0) {
        const actives = getButtons(root).filter(b => b.classList.contains('is-active'));
        if (actives.length >= max) {
          // “en eski” mantığı için timestamp
          const oldest = actives
            .slice()
            .sort((a, b) => Number(a.dataset.atmTs || 0) - Number(b.dataset.atmTs || 0))[0];
          if (oldest) setActive(oldest, false);
        }
      }

      setActive(btn, true);
      btn.dataset.atmTs = String(Date.now());
      syncState(root);
    }, false);
  }

  function init() {
    const root = qs(ROOT_ID);
    if (!root) return;
    bindOnce(root);
  }

  // DOM hazır
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // Studio içinde panel değişince DOM tekrar üretilebiliyor
  document.addEventListener('aivo:pagechange', init);
})();
