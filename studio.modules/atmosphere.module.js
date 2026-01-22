// studio.modules/atmosphere.module.js
(() => {
  const STATE = (window.__ATM_STATE__ ||= {
    mode: "basic",          // basic | pro
    scene: "winter_cafe",   // default
    effects: [],
    maxEffects: 2,
  });

  // Scope
  const PAGE_SEL = '[data-page="atmosphere"]';

  // Mode switch
  const MODE_SHELL_SEL = '[data-mode-shell="atmosphere"]';
  const MODE_TAB_SEL = '.mode-tab[data-mode]';
  const MODE_PANEL_SEL = '.mode-panel[data-mode-panel]';

  // Scene
  const SCENES_SEL = '#atmScenes';
  const SCENE_BTN_SEL = '[data-atm-scene]';

  // Effects
  const EFFECTS_SEL = '#atmEffects';
  const EFFECT_BTN_SEL = '[data-atm-eff]';
  const WARN_SEL = '#atmWarn';

  // Generate
  const GENERATE_SEL = '[data-atm-generate]';

  let page, shell, warn, scenesWrap, effectsWrap;

  const uniq = (arr) => Array.from(new Set(arr));

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

  /* ===================== MODE SWITCH ===================== */
  function setMode(mode) {
    STATE.mode = (mode === 'pro') ? 'pro' : 'basic';

    if (!shell) return;

    const tabs = Array.from(shell.querySelectorAll(MODE_TAB_SEL));
    const panels = Array.from(shell.querySelectorAll(MODE_PANEL_SEL));

    tabs.forEach(t => {
      const on = t.dataset.mode === STATE.mode;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) t.setAttribute('tabindex', '0');
      else t.setAttribute('tabindex', '-1');
    });

    panels.forEach(p => {
      const on = p.dataset.modePanel === STATE.mode;
      p.classList.toggle('is-active', on);
      p.toggleAttribute('hidden', !on);
    });
  }

  /* ===================== SCENES ===================== */
  function setScene(sceneKey) {
    STATE.scene = sceneKey || null;

    if (!scenesWrap) return;
    scenesWrap.querySelectorAll(SCENE_BTN_SEL).forEach(btn => {
      const key = btn.getAttribute('data-atm-scene');
      btn.classList.toggle('is-active', key === STATE.scene);
      btn.setAttribute('aria-pressed', (key === STATE.scene) ? 'true' : 'false');
    });
  }

  /* ===================== EFFECTS ===================== */
  function renderEffects() {
    if (!effectsWrap) return;

    const selected = new Set(STATE.effects);
    const full = selected.size >= STATE.maxEffects;

    effectsWrap.querySelectorAll(EFFECT_BTN_SEL).forEach(btn => {
      const key = btn.getAttribute('data-atm-eff');
      const on = selected.has(key);

      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');

      const shouldDisable = full && !on;
      btn.disabled = shouldDisable;
      if (shouldDisable) btn.setAttribute('disabled', '');
      else btn.removeAttribute('disabled');

      // başka yer pointer-events oynasa bile geri al
      btn.style.pointerEvents = 'auto';
      btn.style.cursor = 'pointer';
    });
  }

  function setEffects(next) {
    STATE.effects = uniq(next).slice(0, STATE.maxEffects);
    setWarn('');
    renderEffects();
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
    if (!STATE.scene) {
      if (window.toast?.error) window.toast.error('Lütfen bir sahne seç');
      else alert('Lütfen bir sahne seç');
      return false;
    }
    if (STATE.effects.length < 1) {
      if (window.toast?.error) window.toast.error('En az 1 atmosfer seçmelisin');
      else alert('En az 1 atmosfer seçmelisin');
      return false;
    }
    return true;
  }

  /* ===================== GLOBAL RENDER ===================== */
  function renderAll() {
    // Mode
    setMode(STATE.mode);

    // Scenes
    if (scenesWrap) setScene(STATE.scene);

    // Effects
    renderEffects();
  }

  /* ===================== CAPTURE HANDLERS ===================== */
  function onClickCapture(e) {
    const p = e.target?.closest?.(PAGE_SEL);
    if (!p) return;

    // 1) MODE TAB
    const tab = e.target?.closest?.(MODE_TAB_SEL);
    if (tab && shell && shell.contains(tab)) {
      e.preventDefault();
      e.stopPropagation();
      setMode(tab.dataset.mode);
      return;
    }

    // 2) SCENE
    const sceneBtn = e.target?.closest?.(`${SCENES_SEL} ${SCENE_BTN_SEL}`);
    if (sceneBtn && scenesWrap && scenesWrap.contains(sceneBtn)) {
      e.preventDefault();
      e.stopPropagation();
      setScene(sceneBtn.getAttribute('data-atm-scene'));
      return;
    }

    // 3) EFFECT
    const effBtn = e.target?.closest?.(`${EFFECTS_SEL} ${EFFECT_BTN_SEL}`);
    if (effBtn && effectsWrap && effectsWrap.contains(effBtn)) {
      e.preventDefault();
      e.stopPropagation();
      toggleEffect(effBtn.getAttribute('data-atm-eff'));
      return;
    }

    // 4) GENERATE
    const gen = e.target?.closest?.(GENERATE_SEL);
    if (gen && p.contains(gen)) {
      e.preventDefault();
      e.stopPropagation();

      if (!validateOrToast()) return;

      const mode = gen.getAttribute('data-atm-mode') || STATE.mode;

      // Şimdilik log + toast; job bağlamayı sonra yaparız
      const msg = (mode === 'pro')
        ? `SÜPER (30 kredi) → Sahne: ${STATE.scene} | Efekt: ${STATE.effects.join(', ')}`
        : `BASİT (20 kredi) → Sahne: ${STATE.scene} | Efekt: ${STATE.effects.join(', ')}`;

      if (window.toast?.success) window.toast.success(msg);
      else console.log('[ATM]', msg);

      return;
    }
  }

  /* ===================== OBSERVER (reset olursa geri bas) ===================== */
  let obs;
  function startObserver() {
    if (!page) return;
    if (obs) obs.disconnect();

    obs = new MutationObserver(() => {
      // DOM değiştiyse referansları tazele
      warn = page.querySelector(WARN_SEL);
      shell = page.querySelector(MODE_SHELL_SEL);
      scenesWrap = page.querySelector(SCENES_SEL);
      effectsWrap = page.querySelector(EFFECTS_SEL);

      // tekrar render bas
      renderAll();
    });

    obs.observe(page, { subtree: true, childList: true, attributes: true });
  }

  /* ===================== MOUNT ===================== */
  function mount() {
    page = document.querySelector(PAGE_SEL);
    if (!page) return;

    warn = page.querySelector(WARN_SEL);
    shell = page.querySelector(MODE_SHELL_SEL);
    scenesWrap = page.querySelector(SCENES_SEL);
    effectsWrap = page.querySelector(EFFECTS_SEL);

    // ID çakışması tespiti
    const dups = document.querySelectorAll(EFFECTS_SEL);
    if (dups.length > 1) console.warn('[ATM] #atmEffects duplicate:', dups.length);

    // Capture: her zaman önce biz
    document.addEventListener('click', onClickCapture, true);

    // Default state render
    renderAll();

    // Resetlere karşı
    startObserver();

    console.log('[ATM] module mounted ✅');
  }

  window.atmosphere = {
    mount,
    getState: () => ({ ...STATE, effects: [...STATE.effects] }),
    setMode,
    setScene,
    setEffects,
    clear: () => setEffects([]),
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
