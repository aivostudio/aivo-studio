/* ============================================================================
   atmosphere.module.js — V2 (FULL, clean)
   - Fix: Mode switch uses CAPTURE + stopPropagation to avoid global click blockers
   - Basic: scene select, effects multi-select, camera/duration, personalization (image/logo/audio)
   - Pro: prompt + refs, light/mood single-select, export + details + LUT
   - Generate: builds payload and calls your hook if present (ATM_CREATE / atmoGenerate / ATMOSPHERE_CREATE)
   ============================================================================ */

(() => {
  // ------------------------------------------------------------
  // 0) Guard + tiny helpers
  // ------------------------------------------------------------
  if (window.__ATM_V2_BIND__) return;
  window.__ATM_V2_BIND__ = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const closestWithin = (el, sel, root) => {
    const found = el?.closest?.(sel);
    return found && root && root.contains(found) ? found : null;
  };

  const setActive = (btn, on) => {
    if (!btn) return;
    btn.classList.toggle("is-active", !!on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  };

  const singleSelectIn = (root, selector, keepBtn) => {
    qsa(selector, root).forEach((b) => {
      if (b !== keepBtn) setActive(b, false);
    });
    setActive(keepBtn, true);
  };

  // ------------------------------------------------------------
  // 1) Scope finder (works inside studio module host)
  // ------------------------------------------------------------
  function getAtmoPanelRoot() {
    return (
      qs('.main-panel[data-module="atmosphere"]') ||
      qs('.mode-shell[data-mode-shell="atmosphere"]') ||
      qs("#atmRoot") ||
      null
    );
  }

  // ------------------------------------------------------------
  // 2) State (single source of truth)
  // ------------------------------------------------------------
  const state = (window.__ATM_V2__ = window.__ATM_V2__ || {
    mode: "basic",

    // basic
    scene: "winter_cafe",
    effects: [],
    camera: "kenburns_soft",
    duration: "8",
    imageFile: null,

    // personalization (basic)
    logoFile: null,
    logoPos: "br",
    logoSize: "sm",
    logoOpacity: 0.9,
    audioFile: null,
    audioMode: "none",
    audioTrim: "loop_to_fit",
    silentCopy: true,

    // pro
    prompt: "",
    refImageFile: null,
    refAudioFile: null,
    light: null, // warm/cool/golden/neon/moon
    mood: null,  // romantic/cinematic/cozy/mysterious/lofi
    fps: "24",
    format: "mp4",
    seamFix: false,

    // pro details
    details: {
      grain: false,
      glow: false,
      vignette: false,
      sharpen: false,
      motionBlur: false,
      dust: false,
      lut: ""
    }
  });

  // ------------------------------------------------------------
  // 3) Sync helpers (hidden legacy inputs etc.)
  // ------------------------------------------------------------
  function syncLegacyEffectsInput(root) {
    const wrap = qs("#atmEffects", root);
    if (!wrap) return;

    const hidden = qs("#atmEffectsValue", root);
    if (hidden) hidden.value = (state.effects || []).join(",");

    wrap.dataset.selected = (state.effects || []).join(",");
  }

  function readInitialFromDOM(root) {
    // Basic scene
    const activeScene = qs("#atmScenes .smpack-choice.is-active", root);
    if (activeScene?.dataset?.atmScene) state.scene = activeScene.dataset.atmScene;

    // Basic effects
    const effBtns = qsa("#atmEffects [data-atm-eff].is-active", root);
    const eff = effBtns.map((b) => b.dataset.atmEff).filter(Boolean);
    if (eff.length) state.effects = eff;

    // Basic selects
    const cam = qs("#atmCamera", root)?.value;
    const dur = qs("#atmDuration", root)?.value;
    if (cam) state.camera = cam;
    if (dur) state.duration = dur;

    // Personalization
    const pos = qs("#atmLogoPos", root)?.value;
    const size = qs("#atmLogoSize", root)?.value;
    const op = qs("#atmLogoOpacity", root)?.value;
    const am = qs("#atmAudioMode", root)?.value;
    const at = qs("#atmAudioTrim", root)?.value;
    const sc = qs("#atmSilentCopy", root)?.checked;

    if (pos) state.logoPos = pos;
    if (size) state.logoSize = size;
    if (op) state.logoOpacity = parseFloat(op) || state.logoOpacity;
    if (am) state.audioMode = am;
    if (at) state.audioTrim = at;
    if (typeof sc === "boolean") state.silentCopy = sc;

    // Pro prompt
    const p = qs("#atmSuperPrompt", root)?.value;
    if (typeof p === "string") state.prompt = p.trim();

    // Pro export
    const fps = qs("#atmProFps", root)?.value;
    const fmt = qs("#atmProFormat", root)?.value;
    const seam = qs("#atmProSeamFix", root)?.checked;

    if (fps) state.fps = fps;
    if (fmt) state.format = fmt;
    if (typeof seam === "boolean") state.seamFix = seam;

    // Pro duration (optional)
    const pd = qs("#atmProDuration", root)?.value;
    if (pd) state.proDuration = pd;

    // Pro light/mood pills
    const light = qs('[data-atm-light].is-active', root)?.dataset?.atmLight;
    const mood = qs('[data-atm-mood].is-active', root)?.dataset?.atmMood;
    if (light) state.light = light;
    if (mood) state.mood = mood;

    // Pro details
    const d = state.details || (state.details = {});
    const bool = (id) => !!qs(id, root)?.checked;
    d.grain = bool("#atmProGrain");
    d.glow = bool("#atmProGlow");
    d.vignette = bool("#atmProVignette");
    d.sharpen = bool("#atmProSharpen");
    d.motionBlur = bool("#atmProMotionBlur");
    d.dust = bool("#atmProDust");
    d.lut = qs("#atmProLut", root)?.value || d.lut || "";

    syncLegacyEffectsInput(root);
  }

  // ------------------------------------------------------------
  // 4) Mode switch — CAPTURE (prevents other handlers from blocking)
  // ------------------------------------------------------------
  document.addEventListener(
    "click",
    (e) => {
      const root = getAtmoPanelRoot();
      if (!root) return;

      const tab = closestWithin(e.target, '.mode-tab[data-mode]', root);
      if (!tab) return;

      const shell = tab.closest('.mode-shell[data-mode-shell="atmosphere"]');
      if (!shell) return;

      // critical: avoid global click blockers
      e.preventDefault();
      e.stopPropagation();

      const mode = tab.dataset.mode || "basic";
      state.mode = mode;

      qsa('.mode-tab[data-mode]', shell).forEach((t) => {
        const on = t.dataset.mode === mode;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });

      qsa('.mode-panel[data-mode-panel]', shell).forEach((p) => {
        const on = p.dataset.modePanel === mode;
        p.classList.toggle("is-active", on);
        // extra guarantee in case CSS relies on display
        p.style.display = on ? "" : "none";
      });

      console.log("[ATM] mode switch ->", mode);
    },
    true
  );

  // ------------------------------------------------------------
  // 5) Basic: Scene select (delegated)
  // ------------------------------------------------------------
  document.addEventListener("click", (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const btn = closestWithin(e.target, "#atmScenes .smpack-choice[data-atm-scene]", root);
    if (!btn) return;

    e.preventDefault();

    const scenes = qs("#atmScenes", root);
    qsa(".smpack-choice[data-atm-scene]", scenes).forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    state.scene = btn.dataset.atmScene || state.scene;
  });

  // ------------------------------------------------------------
  // 6) Basic: Effects multi-select (delegated) + hidden input sync
  // ------------------------------------------------------------
  document.addEventListener("click", (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const btn = closestWithin(e.target, '#atmEffects [data-atm-eff]', root);
    if (!btn) return;

    e.preventDefault();

    const eff = btn.dataset.atmEff;
    if (!eff) return;

    const on = !btn.classList.contains("is-active");
    setActive(btn, on);

    const set = new Set(state.effects || []);
    if (on) set.add(eff);
    else set.delete(eff);

    state.effects = Array.from(set);
    syncLegacyEffectsInput(root);
  });

  // ------------------------------------------------------------
  // 7) Basic: Camera / Duration change
  // ------------------------------------------------------------
  document.addEventListener("change", (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const cam = closestWithin(e.target, "#atmCamera", root);
    if (cam) state.camera = cam.value || state.camera;

    const dur = closestWithin(e.target, "#atmDuration", root);
    if (dur) state.duration = dur.value || state.duration;
  });

  // ------------------------------------------------------------
  // 8) Files: Basic image / logo / audio + Pro refs
  // ------------------------------------------------------------
  document.addEventListener("change", (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const file = e.target?.files?.[0] || null;

    if (closestWithin(e.target, "#atmImageFile", root)) state.imageFile = file;
    if (closestWithin(e.target, "#atmLogoFile", root)) state.logoFile = file;
    if (closestWithin(e.target, "#atmAudioFile", root)) state.audioFile = file;

    if (closestWithin(e.target, "#atmSceneImageInput", root)) state.refImageFile = file;
    if (closestWithin(e.target, "#atmSceneAudioInput", root)) state.refAudioFile = file;
  });

  // ------------------------------------------------------------
  // 9) Basic personalization controls
  // ------------------------------------------------------------
  document.addEventListener("change", (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const pos = closestWithin(e.target, "#atmLogoPos", root);
    if (pos) state.logoPos = pos.value || state.logoPos;

    const size = closestWithin(e.target, "#atmLogoSize", root);
    if (size) state.logoSize = size.value || state.logoSize;

    const opacity = closestWithin(e.target, "#atmLogoOpacity", root);
    if (opacity) state.logoOpacity = parseFloat(opacity.value) || state.logoOpacity;

    const am = closestWithin(e.target, "#atmAudioMode", root);
    if (am) state.audioMode = am.value || state.audioMode;

    const at = closestWithin(e.target, "#atmAudioTrim", root);
    if (at) state.audioTrim = at.value || state.audioTrim;

    const sc = closestWithin(e.target, "#atmSilentCopy", root);
    if (sc) state.silentCopy = !!sc.checked;
  });

  // ------------------------------------------------------------
  // 10) Pro: Prompt input + character counter
  // (supports both ids: atmSuperPromptCount (your HTML) and atmSuperCount (older))
  // ------------------------------------------------------------
  document.addEventListener("input", (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const ta = closestWithin(e.target, "#atmSuperPrompt", root);
    if (!ta) return;

    state.prompt = (ta.value || "").trim();

    const counter =
      qs("#atmSuperPromptCount", root) ||
      qs("#atmSuperCount", root);

    if (counter) counter.textContent = String(state.prompt.length);
  });

  // ------------------------------------------------------------
  // 11) Pro: Light + Mood (single select) — CAPTURE
  // ------------------------------------------------------------
  document.addEventListener(
    "click",
    (e) => {
      const root = getAtmoPanelRoot();
      if (!root) return;

      const lightBtn = closestWithin(e.target, 'button.smpack-pill[data-atm-light]', root);
      if (lightBtn) {
        e.preventDefault();
        e.stopPropagation();
        const panel = lightBtn.closest('[data-mode-panel="pro"]') || root;
        singleSelectIn(panel, 'button.smpack-pill[data-atm-light]', lightBtn);
        state.light = lightBtn.dataset.atmLight || state.light;
        return;
      }

      const moodBtn = closestWithin(e.target, 'button.smpack-pill[data-atm-mood]', root);
      if (moodBtn) {
        e.preventDefault();
        e.stopPropagation();
        const panel = moodBtn.closest('[data-mode-panel="pro"]') || root;
        singleSelectIn(panel, 'button.smpack-pill[data-atm-mood]', moodBtn);
        state.mood = moodBtn.dataset.atmMood || state.mood;
        return;
      }
    },
    true
  );

  // ------------------------------------------------------------
  // 12) Pro: Export + Details + LUT (+ Pro Duration if exists)
  // ------------------------------------------------------------
  document.addEventListener("change", (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const fps = closestWithin(e.target, "#atmProFps", root);
    if (fps) state.fps = fps.value || state.fps;

    const fmt = closestWithin(e.target, "#atmProFormat", root);
    if (fmt) state.format = fmt.value || state.format;

    const seam = closestWithin(e.target, "#atmProSeamFix", root);
    if (seam) state.seamFix = !!seam.checked;

    const pd = closestWithin(e.target, "#atmProDuration", root);
    if (pd) state.proDuration = pd.value;

    state.details = state.details || {};
    const d = state.details;

    const map = [
      ["#atmProGrain", "grain"],
      ["#atmProGlow", "glow"],
      ["#atmProVignette", "vignette"],
      ["#atmProSharpen", "sharpen"],
      ["#atmProMotionBlur", "motionBlur"],
      ["#atmProDust", "dust"]
    ];

    for (const [id, key] of map) {
      const el = closestWithin(e.target, id, root);
      if (el) d[key] = !!el.checked;
    }

    const lut = closestWithin(e.target, "#atmProLut", root);
    if (lut) d.lut = lut.value || "";
  });

  // ------------------------------------------------------------
  // 13) Payload builders
  // ------------------------------------------------------------
  function buildBasicPayload() {
    return {
      app: "atmo",
      mode: "basic",
      scene: state.scene || null,
      effects: (state.effects || []).slice(),
      camera: state.camera || "kenburns_soft",
      duration: state.duration || "8",

      image_file: state.imageFile || null,

      logo_file: state.logoFile || null,
      logo_pos: state.logoPos || "br",
      logo_size: state.logoSize || "sm",
      logo_opacity: state.logoOpacity ?? 0.9,

      audio_file: state.audioFile || null,
      audio_mode: state.audioMode || "none",
      audio_trim: state.audioTrim || "loop_to_fit",
      silent_copy: !!state.silentCopy
    };
  }

  function buildProPayload() {
    return {
      app: "atmo",
      mode: "pro",
      prompt: state.prompt || "",
      light: state.light || null,
      mood: state.mood || null,

      ref_image_file: state.refImageFile || null,
      ref_audio_file: state.refAudioFile || null,

      fps: state.fps || "24",
      format: state.format || "mp4",
      duration: state.proDuration || undefined,
      seam_fix: !!state.seamFix,

      details: { ...(state.details || {}) }
    };
  }

  // ------------------------------------------------------------
  // 14) Generate (delegated) — CAPTURE
  // ------------------------------------------------------------
  async function onGenerate(btn) {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const mode = btn.dataset.atmMode || btn.getAttribute("data-atm-mode") || "basic";
    state.mode = mode;

    const payload = mode === "pro" ? buildProPayload() : buildBasicPayload();

    const hook =
      window.ATM_CREATE ||
      window.atmoGenerate ||
      window.ATMOSPHERE_CREATE ||
      null;

    if (typeof hook === "function") {
      console.log("[ATM] generate -> hook()", { mode, payload });
      return hook(payload);
    }

    console.log("[ATM] generate payload =", payload);
  }

  document.addEventListener(
    "click",
    (e) => {
      const root = getAtmoPanelRoot();
      if (!root) return;

      const btn = closestWithin(e.target, "[data-atm-generate]", root);
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();
      onGenerate(btn);
    },
    true
  );

  // ------------------------------------------------------------
  // 15) Init sync (best effort)
  // ------------------------------------------------------------
  const init = () => {
    const root = getAtmoPanelRoot();
    if (!root) return;
    readInitialFromDOM(root);
    syncLegacyEffectsInput(root);

    // ensure panels display matches current state.mode
    const shell = qs('.mode-shell[data-mode-shell="atmosphere"]', root);
    if (shell) {
      const mode = state.mode || "basic";
      qsa('.mode-panel[data-mode-panel]', shell).forEach((p) => {
        const on = p.dataset.modePanel === mode;
        p.classList.toggle("is-active", on);
        p.style.display = on ? "" : "none";
      });
      qsa('.mode-tab[data-mode]', shell).forEach((t) => {
        const on = t.dataset.mode === mode;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
      });
    }
  };

  init();
  setTimeout(init, 300);
  setTimeout(init, 1200);
})();
