// studio.modules/atmosphere.module.js  (SAFE)
(() => {
  try {
    // tek mount
    if (window.__ATM_MOUNTED__) return;
    window.__ATM_MOUNTED__ = true;

    const STATE = (window.__ATM_STATE__ ||= {
      mode: "basic",
      scene: "winter_cafe",
      effects: [],
      maxEffects: 2,
    });

    const PAGE_SEL = '[data-page="atmosphere"]';

    const MODE_SHELL_SEL = '[data-mode-shell="atmosphere"]';
    const MODE_TAB_SEL = '.mode-tab[data-mode]';
    const MODE_PANEL_SEL = '.mode-panel[data-mode-panel]';

    const SCENES_SEL = '#atmScenes';
    const SCENE_BTN_SEL = '[data-atm-scene]';

    const EFFECTS_SEL = '#atmEffects';
    const EFFECT_BTN_SEL = '[data-atm-eff]';
    const WARN_SEL = '#atmWarn';

    const GENERATE_SEL = '[data-atm-generate]';

    let page, shell, warn, scenesWrap, effectsWrap;
    let obs = null;
    let rafId = 0;

    const uniq = (arr) => Array.from(new Set(arr));

    function qs() {
      page = document.querySelector(PAGE_SEL);
      if (!page) return false;

      shell = page.querySelector(MODE_SHELL_SEL);
      warn = page.querySelector(WARN_SEL);
      scenesWrap = page.querySelector(SCENES_SEL);
      effectsWrap = page.querySelector(EFFECTS_SEL);

      return true;
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

    function setMode(mode) {
      STATE.mode = (mode === 'pro') ? 'pro' : 'basic';
      if (!shell) return;

      const tabs = Array.from(shell.querySelectorAll(MODE_TAB_SEL));
      const panels = Array.from(shell.querySelectorAll(MODE_PANEL_SEL));
      if (!tabs.length || !panels.length) return;

      tabs.forEach(t => {
        const on = t.dataset.mode === STATE.mode;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
      });

      // ⚠️ hidden attribute yerine sadece class ile yönet (daha az çakışır)
      panels.forEach(p => {
        const on = p.dataset.modePanel === STATE.mode;
        p.classList.toggle('is-active', on);
      });
    }

    function setScene(sceneKey) {
      STATE.scene = sceneKey || null;
      if (!scenesWrap) return;

      scenesWrap.querySelectorAll(SCENE_BTN_SEL).forEach(btn => {
        const key = btn.getAttribute('data-atm-scene');
        const on = key === STATE.scene;
        btn.classList.toggle('is-active', on);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

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
      });
    }

    function setEffects(next) {
      STATE.effects = uniq(next).slice(0, STATE.maxEffects);
      setWarn('');
      renderEffects();
    }

    function toggleEffect(key) {
      if (!key) return;
      if (STATE.effects.includes(key)) {
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
        window.toast?.error ? window.toast.error('Lütfen bir sahne seç') : alert('Lütfen bir sahne seç');
        return false;
      }
      if (STATE.effects.length < 1) {
        window.toast?.error ? window.toast.error('En az 1 atmosfer seçmelisin') : alert('En az 1 atmosfer seçmelisin');
        return false;
      }
      return true;
    }

    function renderAll() {
      // observer varsa render sırasında tetiklenmesin
      if (obs) obs.disconnect();

      setMode(STATE.mode);
      setScene(STATE.scene);
      renderEffects();

      startObserver(); // tekrar bağla
    }

    function scheduleRender() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        if (!qs()) return;
        renderAll();
      });
    }

    function onClickCapture(e) {
      const p = e.target?.closest?.(PAGE_SEL);
      if (!p) return;

      // MODE
      const tab = e.target?.closest?.(MODE_TAB_SEL);
      if (tab && shell && shell.contains(tab)) {
        e.preventDefault(); e.stopPropagation();
        setMode(tab.dataset.mode);
        return;
      }

      // SCENE
      const sceneBtn = e.target?.closest?.(`${SCENES_SEL} ${SCENE_BTN_SEL}`);
      if (sceneBtn && scenesWrap && scenesWrap.contains(sceneBtn)) {
        e.preventDefault(); e.stopPropagation();
        setScene(sceneBtn.getAttribute('data-atm-scene'));
        return;
      }

      // EFFECT
      const effBtn = e.target?.closest?.(`${EFFECTS_SEL} ${EFFECT_BTN_SEL}`);
      if (effBtn && effectsWrap && effectsWrap.contains(effBtn)) {
        e.preventDefault(); e.stopPropagation();
        toggleEffect(effBtn.getAttribute('data-atm-eff'));
        return;
      }

      // GENERATE
      const gen = e.target?.closest?.(GENERATE_SEL);
      if (gen && p.contains(gen)) {
        e.preventDefault(); e.stopPropagation();
        if (!validateOrToast()) return;

        const mode = gen.getAttribute('data-atm-mode') || STATE.mode;
        const msg = (mode === 'pro')
          ? `SÜPER (30 kredi) → Sahne: ${STATE.scene} | Efekt: ${STATE.effects.join(', ')}`
          : `BASİT (20 kredi) → Sahne: ${STATE.scene} | Efekt: ${STATE.effects.join(', ')}`;

        window.toast?.success ? window.toast.success(msg) : console.log('[ATM]', msg);
      }
    }

    function startObserver() {
      if (!page) return;
      if (obs) obs.disconnect();

      // ⚠️ SAFE: sadece childList (attributes yok) + throttle
      obs = new MutationObserver(() => scheduleRender());
      obs.observe(page, { subtree: true, childList: true });
    }

    function mount() {
      if (!qs()) return;

      // duplicate id check (debug)
      const dups = document.querySelectorAll(EFFECTS_SEL);
      if (dups.length > 1) console.warn('[ATM] #atmEffects duplicate:', dups.length);

      document.addEventListener('click', onClickCapture, true);

      renderAll();
      console.log('[ATM] module mounted ✅');
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mount, { once: true });
    } else {
      mount();
    }
  } catch (err) {
    console.error('[ATM] module fatal error:', err);
  }
})();
