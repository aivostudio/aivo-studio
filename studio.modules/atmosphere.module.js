/* ============================================================================
   atmosphere.module.js — V2 (FULL, clean) + ASPECT + GENERATE LOADING (3–5s)
   - Fix: Mode switch uses CAPTURE + stopPropagation to avoid global click blockers
   - Basic: scene select, effects multi-select, camera/duration, aspect, personalization (image/logo/audio)
   - Pro: prompt + refs, light/mood single-select, export + details + LUT + aspect
   - Generate: builds payload and calls your hook if present (ATM_CREATE / atmoGenerate / ATMOSPHERE_CREATE)
   - ✅ NEW: “Video Üret” butonuna 3–5sn basılı/aktif hissi + loading state
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
    // some pills use aria-pressed, some use aria-selected — keep both safe
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  };

  const singleSelectIn = (root, selector, keepBtn) => {
    qsa(selector, root).forEach((b) => {
      if (b !== keepBtn) setActive(b, false);
    });
    setActive(keepBtn, true);
  };

  const pickFirst = (...arr) => arr.find(Boolean) || null;

  // ------------------------------------------------------------
  // ✅ 0.5) Generate loading helpers (3–5s “basılı” hissi)
  // ------------------------------------------------------------
  const GEN_MIN_MS = 3000;   // en az 3s
  const GEN_MAX_MS = 5000;   // en fazla 5s (hissettir, ama kitlenme yok)

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function waitForAtmoJobCreated(timeoutMs) {
    return new Promise((resolve) => {
      let done = false;

      const t = setTimeout(() => {
        if (done) return;
        done = true;
        try { window.removeEventListener("aivo:atmo:job_created", onEvt); } catch {}
        resolve(null);
      }, Math.max(0, Number(timeoutMs) || 0));

      const onEvt = (e) => {
        if (done) return;
        done = true;
        try { clearTimeout(t); } catch {}
        try { window.removeEventListener("aivo:atmo:job_created", onEvt); } catch {}
        resolve(e?.detail || null);
      };

      window.addEventListener("aivo:atmo:job_created", onEvt);
    });
  }

  async function withGenerateLoading(btn, run, root) {
    if (!btn) return;
    if (btn.__atmBusy) return; // double click guard
    btn.__atmBusy = true;

    const r = root || getAtmoPanelRoot() || document.body;

    // UI state
    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.setAttribute("aria-busy", "true");
    if (r) r.dataset.atmBusy = "1";

    // “basılı” hissi için (varsa CSS’in kullanacağı class)
    btn.classList.add("is-pressed");

    // Text swap (güvenli: textContent yoksa dokunma)
    const prevText = typeof btn.textContent === "string" ? btn.textContent : "";
    if (prevText) btn.textContent = "Üretiliyor…";

    const startedAt = Date.now();

    try {
      // hook çağrısı (create)
      const res = await Promise.resolve().then(run);

      // event’i bekle (panelin “optimistic kart” basması için)
      // ama sonsuza kadar değil — GEN_MAX_MS içinde kapatacağız
      const remainingForEvent = Math.max(250, GEN_MAX_MS - (Date.now() - startedAt));
      const evt = await waitForAtmoJobCreated(remainingForEvent);

      // min süreyi garanti et
      const elapsed = Date.now() - startedAt;
      if (elapsed < GEN_MIN_MS) await sleep(GEN_MIN_MS - elapsed);

      return { ok: true, res, evt };
    } catch (err) {
      console.error("[ATM] generate error:", err);
      try { window.toast?.error?.(String(err?.message || err || "generate_error")); } catch {}
      return { ok: false, error: err };
    } finally {
      // max süreyi aşmadan kapanış: eğer işlem GEN_MAX_MS’den uzun sürdüyse burada zaten kapanır.
      try {
        btn.disabled = false;
        btn.classList.remove("is-loading");
        btn.classList.remove("is-pressed");
        btn.removeAttribute("aria-busy");
        if (prevText) btn.textContent = prevText;
      } catch {}

      try {
        if (r && r.dataset) delete r.dataset.atmBusy;
      } catch {}

      btn.__atmBusy = false;
    }
  }

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

    // ✅ new: aspect ratio
    aspect: "16:9", // "16:9" | "1:1" | "9:16"

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

  function syncAspectUI(root, scopeEl) {
    const scope = scopeEl || root;
    const wraps = qsa("[data-atm-aspect-wrap]", scope);
    if (!wraps.length) return;

    wraps.forEach((wrap) => {
      const btns = qsa("[data-atm-aspect]", wrap);
      if (!btns.length) return;

      const want = state.aspect || "16:9";
      let keep = btns.find((b) => (b.dataset.atmAspect || b.getAttribute("data-atm-aspect")) === want);
      if (!keep) keep = btns[0];

      btns.forEach((b) => {
        const on = b === keep;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    });
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

    // ✅ Aspect (prefer active inside currently visible panel)
    const shell = qs('.mode-shell[data-mode-shell="atmosphere"]', root);
    const basicPanel = shell ? qs('.mode-panel[data-mode-panel="basic"]', shell) : null;
    const proPanel = shell ? qs('.mode-panel[data-mode-panel="pro"]', shell) : null;
    const activePanel = shell
      ? (qs('.mode-panel[data-mode-panel].is-active', shell) || basicPanel || proPanel)
      : root;

    const aspectActive =
      qs('[data-atm-aspect-wrap] [data-atm-aspect].is-active', activePanel) ||
      qs('[data-atm-aspect-wrap] [data-atm-aspect].is-active', root);

    const aspectVal = aspectActive?.dataset?.atmAspect || aspectActive?.getAttribute?.("data-atm-aspect");
    if (aspectVal) state.aspect = aspectVal;

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
    syncAspectUI(root, root);
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
        p.style.display = on ? "" : "none";
      });

      // ✅ keep aspect selection consistent across panels
      syncAspectUI(root, shell);

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
  // ✅ 6.5) Aspect ratio (Basic + Pro) — CAPTURE
  // ------------------------------------------------------------
  document.addEventListener(
    "click",
    (e) => {
      const root = getAtmoPanelRoot();
      if (!root) return;

      const btn = closestWithin(e.target, "[data-atm-aspect]", root);
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const wrap = btn.closest("[data-atm-aspect-wrap]") || root;

      qsa("[data-atm-aspect]", wrap).forEach((b) => {
        const on = b === btn;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });

      const val = btn.dataset.atmAspect || btn.getAttribute("data-atm-aspect");
      if (val) state.aspect = val;

      const shell = qs('.mode-shell[data-mode-shell="atmosphere"]', root);
      if (shell) syncAspectUI(root, shell);

      console.log("[ATM] aspect ->", state.aspect);
    },
    true
  );

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
  // ------------------------------------------------------------
  document.addEventListener("input", (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const ta = closestWithin(e.target, "#atmSuperPrompt", root);
    if (!ta) return;

    state.prompt = (ta.value || "").trim();

    const counter = pickFirst(
      qs("#atmSuperPromptCount", root),
      qs("#atmSuperCount", root)
    );

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
      aspect: state.aspect || "16:9",

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
      aspect: state.aspect || "16:9",

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
  // 14) Generate (delegated) — CAPTURE  ✅ loading burada
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

      // ✅ 3–5s basılı/aktif hissi + event bekleme
      return withGenerateLoading(
        btn,
        async () => {
          // hook job create yapıp aivo:atmo:job_created emit etmeli
          // (panel optimistic kartı bununla basıyor)
          return await hook(payload);
        },
        root
      );
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

      // root busy ise ikinci kez tetikleme
      if (root.dataset?.atmBusy === "1") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

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

      syncAspectUI(root, shell);
    }
  };

  init();
  setTimeout(init, 200);
  setTimeout(init, 800);
  setTimeout(init, 1600);
})();
