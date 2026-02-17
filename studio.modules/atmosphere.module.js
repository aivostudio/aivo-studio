/* ============================================================================
   atmosphere.module.js — PATCH (selectors + delegated bind, router-safe)
   - Basic: scene select, effects multi-select (incl. leaf/fire), camera/duration,
            image upload, logo/audio personalization, silent copy
   - Pro: prompt, ref image/audio, light (single), mood (single),
          export (fps/format/seamfix), details (grain/glow/vignette/sharpen/mblur/dust),
          LUT
   - Generate: reads state -> builds payload -> calls your existing create hook if present
     (falls back to console.log)
   ============================================================================ */

(() => {
  // ------------------------------------------------------------
  // 0) Guard + tiny helpers
  // ------------------------------------------------------------
  if (window.__ATM_V2_BIND__) return;
  window.__ATM_V2_BIND__ = true;

  const qs  = (sel, root = document) => root.querySelector(sel);
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
  // 1) Scope finder (important: works inside studio module host)
  // ------------------------------------------------------------
  function getAtmoPanelRoot() {
    // new v2 module host
    return (
      qs('.main-panel[data-module="atmosphere"]') ||
      qs('.mode-shell[data-mode-shell="atmosphere"]') ||
      qs("#atmRoot") || // legacy
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

    // hidden legacy input (if exists)
    const hidden = qs("#atmEffectsValue", root);
    if (hidden) hidden.value = (state.effects || []).join(",");

    // dataset mirror (useful for debug)
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

    // Pro light/mood pills
    const light = qs('[data-atm-light].is-active', root)?.dataset?.atmLight;
    const mood  = qs('[data-atm-mood].is-active', root)?.dataset?.atmMood;
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
  // 4) Mode switch (delegated)
  // ------------------------------------------------------------
  document.addEventListener("click", (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const tab = closestWithin(e.target, '.mode-tab[data-mode]', root);
    if (!tab) return;

    const shell = tab.closest('.mode-shell[data-mode-shell="atmosphere"]');
    if (!shell) return;

    const mode = tab.dataset.mode || "basic";
    state.mode = mode;

    // Tabs UI
    qsa('.mode-tab[data-mode]', shell).forEach((t) => {
      t.classList.toggle("is-active", t.dataset.mode === mode);
      t.setAttribute("aria-selected", t.dataset.mode === mode ? "true" : "false");
    });

    // Panels UI
    qsa('.mode-panel[data-mode-panel]', shell).forEach((p) => {
      p.classList.toggle("is-active", p.dataset.modePanel === mode);
    });
  });

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
  // 6) Basic: Effects multi-select (delegated) + legacy hidden input sync
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
  // 9) Basic personalization controls (pos/size/opacity/audioMode/audioTrim/silentCopy)
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
  // 10) Pro: Prompt input + character counter (if present)
  // ------------------------------------------------------------
  document.addEventListener("input", (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const ta = closestWithin(e.target, "#atmSuperPrompt", root);
    if (!ta) return;

    state.prompt = (ta.value || "").trim();

    const counter = qs("#atmSuperCount", root);
    if (counter) counter.textContent = String(state.prompt.length);
  });

  // ------------------------------------------------------------
  // 11) Pro: Light (single select) + Mood (single select)
  // ------------------------------------------------------------
  document.addEventListener(
    "click",
    (e) => {
      const root = getAtmoPanelRoot();
      if (!root) return;

      const lightBtn = closestWithin(e.target, "button.smpack-pill[data-atm-light]", root);
      if (lightBtn) {
        e.preventDefault();
        const panel = lightBtn.closest('[data-mode-panel="pro"]') || root;
        singleSelectIn(panel, 'button.smpack-pill[data-atm-light]', lightBtn);
        state.light = lightBtn.dataset.atmLight || state.light;
        return;
      }

      const moodBtn = closestWithin(e.target, "button.smpack-pill[data-atm-mood]", root);
      if (moodBtn) {
        e.preventDefault();
        const panel = moodBtn.closest('[data-mode-panel="pro"]') || root;
        singleSelectIn(panel, 'button.smpack-pill[data-atm-mood]', moodBtn);
        state.mood = moodBtn.dataset.atmMood || state.mood;
        return;
      }
    },
    true // capture helps override any legacy stopPropagation issues
  );

  // ------------------------------------------------------------
  // 12) Pro: Export (fps/format/seamfix) + Details + LUT
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

    // details
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

      // files
      image_file: state.imageFile || null,

      // personalization
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

      // refs
      ref_image_file: state.refImageFile || null,
      ref_audio_file: state.refAudioFile || null,

      // export
      fps: state.fps || "24",
      format: state.format || "mp4",
      seam_fix: !!state.seamFix,

      // details
      details: { ...(state.details || {}) }
    };
  }

  // ------------------------------------------------------------
  // 14) Generate (delegated) — calls your hook if exists
  // ------------------------------------------------------------
  async function onGenerate(btn) {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const mode = btn.dataset.atmMode || btn.getAttribute("data-atm-mode") || "basic";
    state.mode = mode;

    const payload = mode === "pro" ? buildProPayload() : buildBasicPayload();

    // Prefer a real hook if you have one:
    // - window.ATM_CREATE(payload)
    // - window.Studio?.services?.jobsCreate(payload)
    // - window.atmoGenerate(payload) ...
    const hook =
      window.ATM_CREATE ||
      window.atmoGenerate ||
      window.ATMOSPHERE_CREATE ||
      null;

    if (typeof hook === "function") {
      return hook(payload);
    }

    // fallback: log
    console.log("[ATM] generate payload =", payload);
  }

  document.addEventListener("click", (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const btn = closestWithin(e.target, "[data-atm-generate]", root);
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();
    onGenerate(btn);
  });

  // ------------------------------------------------------------
  // 15) Init sync (best effort)
  // ------------------------------------------------------------
  const init = () => {
    const root = getAtmoPanelRoot();
    if (!root) return;
    readInitialFromDOM(root);
    syncLegacyEffectsInput(root);
  };

  init();
  setTimeout(init, 300);
  setTimeout(init, 1200);

})();
