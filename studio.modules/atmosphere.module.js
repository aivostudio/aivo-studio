// /studio.modules/atmosphere.module.js
(() => {
  const STATE = (window.__ATM_STATE__ ||= {
    effects: [],
    maxEffects: 2,
    mode: "basic",
    scene: "winter_cafe",
    creditsBasic: 20,
    creditsPro: 30
  });

  const SEL = {
    page: '[data-page="atmosphere"]',
    shell: '[data-mode-shell="atmosphere"]',
    tabs: '.mode-tab[data-mode]',
    panels: '.mode-panel[data-mode-panel]',
    scenes: '#atmScenes [data-atm-scene]',
    effectsWrap: '#atmEffects',
    effectsBtn: '#atmEffects [data-atm-eff]',
    warn: '#atmWarn',
    generate: '#atmGenerateBtn'
  };

  let page, shell, warnEl, effectsWrap;

  function q(sel, root = document) { return root.querySelector(sel); }
  function qa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

  function setWarn(msg = "") {
    if (!warnEl) return;
    if (!msg) { warnEl.style.display = "none"; warnEl.textContent = ""; return; }
    warnEl.textContent = msg;
    warnEl.style.display = "block";
  }

  function uniq(arr) { return Array.from(new Set(arr)); }

  function renderEffects() {
    if (!effectsWrap) return;
    const selected = new Set(STATE.effects);
    const full = selected.size >= STATE.maxEffects;

    qa(SEL.effectsBtn, page).forEach(btn => {
      const key = btn.getAttribute("data-atm-eff");
      const on = selected.has(key);
      const disable = full && !on;

      btn.classList.toggle("is-active", on);
      btn.classList.toggle("is-disabled", disable);
      btn.setAttribute("aria-pressed", on ? "true" : "false");

      // kritik: disable gerçek tıkı kesmesin (biz capture ile yöneteceğiz)
      btn.disabled = false;
      btn.style.pointerEvents = "auto";
      btn.style.cursor = "pointer";
      if (disable) btn.setAttribute("data-atm-disabled", "1");
      else btn.removeAttribute("data-atm-disabled");
    });
  }

  function toggleEffect(key) {
    const s = new Set(STATE.effects);

    if (s.has(key)) {
      s.delete(key);
      STATE.effects = [...s];
      setWarn("");
      renderEffects();
      return;
    }

    if (s.size >= STATE.maxEffects) {
      setWarn(`En fazla ${STATE.maxEffects} seçim. (Örn: Kar + Işık)`);
      return;
    }

    s.add(key);
    STATE.effects = [...s];
    setWarn("");
    renderEffects();
  }

  function setMode(mode) {
    STATE.mode = mode;

    const tabs = qa(SEL.tabs, shell);
    const panels = qa(SEL.panels, shell);

    tabs.forEach(t => {
      const on = t.dataset.mode === mode;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });

    panels.forEach(p => {
      const on = p.dataset.modePanel === mode;
      p.classList.toggle("is-active", on);
      p.toggleAttribute("hidden", !on);
    });

    // CTA metni krediye göre
    const btn = q(SEL.generate, page);
    if (btn) {
      const credit = (mode === "pro") ? STATE.creditsPro : STATE.creditsBasic;
      btn.textContent = `Atmosfer Video Oluştur (${credit} Kredi)`;
      btn.setAttribute("data-atm-credit", String(credit));
    }
  }

  function setScene(sceneKey) {
    STATE.scene = sceneKey;
    qa(SEL.scenes, page).forEach(b => {
      b.classList.toggle("is-active", b.getAttribute("data-atm-scene") === sceneKey);
    });
  }

  function onCaptureClick(e) {
    // sadece atmosphere sayfası aktifken
    if (!page || !page.classList.contains("is-active")) return;

    // 1) Effects
    const effBtn = e.target.closest(SEL.effectsBtn);
    if (effBtn) {
      // başka tüm handler'ları öldür
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      // max doluysa ve bu buton disable işaretliyse, sadece warn göster
      const key = effBtn.getAttribute("data-atm-eff");
      if (effBtn.getAttribute("data-atm-disabled") === "1") {
        setWarn(`En fazla ${STATE.maxEffects} seçim. (Örn: Kar + Işık)`);
        renderEffects();
        return;
      }
      toggleEffect(key);
      return;
    }

    // 2) Scenes
    const sceneBtn = e.target.closest('#atmScenes [data-atm-scene]');
    if (sceneBtn) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      setScene(sceneBtn.getAttribute("data-atm-scene"));
      return;
    }

    // 3) Mode tabs
    const tab = e.target.closest(SEL.tabs);
    if (tab) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      setMode(tab.dataset.mode || "basic");
      return;
    }

    // 4) Generate
    const gen = e.target.closest(SEL.generate);
    if (gen) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (!STATE.effects.length) {
        // senin toast sistemin varsa
        window.toast?.error?.("En az 1 atmosfer seçmelisin");
        setWarn("En az 1 atmosfer seçmelisin");
        return;
      }

      // Şimdilik sadece debug (backend sonra)
      console.log("[ATM] generate", {
        mode: STATE.mode,
        scene: STATE.scene,
        effects: STATE.effects
      });

      window.toast?.success?.("Atmosfer isteği alındı (mock)");
      return;
    }
  }

  function mount() {
    page = q(SEL.page);
    if (!page) return;

    shell = q(SEL.shell, page);
    warnEl = q(SEL.warn, page);
    effectsWrap = q(SEL.effectsWrap, page);

    // capture listener: KÖK ÇÖZÜM
    document.addEventListener("click", onCaptureClick, true);

    // default state
    if (!STATE.scene) STATE.scene = "winter_cafe";
    if (!STATE.mode) STATE.mode = "basic";

    setScene(STATE.scene);
    setMode(STATE.mode);
    renderEffects();

    console.log("[ATM] module mounted ✅", STATE);
  }

  function unmount() {
    document.removeEventListener("click", onCaptureClick, true);
  }

  window.atmosphere = { mount, unmount, state: STATE };
})();
