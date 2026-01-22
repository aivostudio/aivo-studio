// studio.modules/atmosphere.module.js (HARD LOCK)
(() => {
  if (window.__ATM_LOCKED__) return;
  window.__ATM_LOCKED__ = true;

  const STATE = (window.__ATM_STATE__ ||= {
    effects: [],
    maxEffects: 2,
  });

  const PAGE_SEL = '[data-page="atmosphere"]';
  const ROOT_SEL = '#atmRoot';
  const EFFECTS_SEL = '#atmEffects';
  const EFFECT_BTN_SEL = '[data-atm-eff]';
  const WARN_SEL = '#atmWarn';
  const GENERATE_SEL = '[data-atm-generate]';

  let page, root, effectsWrap, warn;

  const uniq = (arr) => Array.from(new Set(arr));

  function qs() {
    page = document.querySelector(PAGE_SEL);
    root = document.querySelector(ROOT_SEL);
    if (!page || !root) return false;

    effectsWrap = root.querySelector(EFFECTS_SEL);
    warn = root.querySelector(WARN_SEL);
    return !!effectsWrap;
  }

  function setWarn(msg) {
    if (!warn) return;
    if (!msg) {
      warn.style.display = 'none';
      warn.textContent = '';
      return;
    }
    warn.textContent = msg;
    warn.style.display = 'block';
  }

  function render() {
    if (!effectsWrap) return;

    const selected = new Set(STATE.effects);
    const full = selected.size >= STATE.maxEffects;

    effectsWrap.querySelectorAll(EFFECT_BTN_SEL).forEach(btn => {
      const key = btn.getAttribute('data-atm-eff');
      const on = selected.has(key);

      // zorla bas
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');

      const shouldDisable = full && !on;
      btn.disabled = shouldDisable;

      // Legacy pointer-events/style oynasa bile geri al
      btn.style.pointerEvents = 'auto';
      btn.style.cursor = 'pointer';
    });
  }

  function setEffects(next) {
    STATE.effects = uniq(next).slice(0, STATE.maxEffects);
    setWarn('');
    render();
  }

  function toggleEffect(key) {
    const has = STATE.effects.includes(key);
    if (has) {
      setEffects(STATE.effects.filter(x => x !== key));
      return;
    }
    if (STATE.effects.length >= STATE.maxEffects) {
      setWarn(`En fazla ${STATE.maxEffects} seçim. (Örn: Kar + Işık)`);
      return;
    }
    setEffects([...STATE.effects, key]);
  }

  function validateOrToast() {
    if (STATE.effects.length < 1) {
      if (window.toast?.error) window.toast.error('En az 1 atmosfer seçmelisin');
      else alert('En az 1 atmosfer seçmelisin');
      return false;
    }
    return true;
  }

  // ✅ ROOT içinde tüm clickleri kilitle (başka JS’e gitmesin)
  function onRootClickCapture(e) {
    // sadece root içi
    if (!root.contains(e.target)) return;

    // her durumda kilitle
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();

    const effBtn = e.target.closest?.(`${EFFECTS_SEL} ${EFFECT_BTN_SEL}`);
    if (effBtn && effectsWrap.contains(effBtn)) {
      toggleEffect(effBtn.getAttribute('data-atm-eff'));
      return;
    }

    const gen = e.target.closest?.(GENERATE_SEL);
    if (gen && root.contains(gen)) {
      if (!validateOrToast()) return;
      const mode = gen.getAttribute('data-atm-mode') || 'basic';
      const msg = (mode === 'pro')
        ? `SÜPER (30 kredi) → Efekt: ${STATE.effects.join(', ')}`
        : `BASİT (20 kredi) → Efekt: ${STATE.effects.join(', ')}`;
      window.toast?.success ? window.toast.success(msg) : console.log('[ATM]', msg);
      return;
    }
  }

  function mount() {
    if (!qs()) return;

    // ROOT click capture: en üst öncelik
    root.addEventListener('click', onRootClickCapture, true);

    // İlk render
    render();

    console.log('[ATM] LOCK mounted ✅');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
