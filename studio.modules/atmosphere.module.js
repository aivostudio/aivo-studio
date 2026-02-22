/* ============================================================================
   atmosphere.module.js — V2 (FULL, clean) + ASPECT + GENERATE LOADING (3–5s)
   + ✅ R2 UPLOAD (image/logo/audio) + preview + badge + generate-lock while uploading
   - Fix: Mode switch uses CAPTURE + stopPropagation to avoid global click blockers
   - Basic: scene select, effects multi-select, camera/duration, aspect, personalization (image/logo/audio)
   - Pro: prompt + refs, light/mood single-select, export + details + LUT + aspect
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

  const pickFirst = (...arr) => arr.find(Boolean) || null;

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  // ------------------------------------------------------------
  // ✅ 0.5) Generate loading helpers (3–5s “basılı” hissi)
  // ------------------------------------------------------------
  const GEN_MIN_MS = 3000;   // en az 3s
  const GEN_MAX_MS = 5000;   // en fazla 5s

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function waitForAtmoJobCreated(timeoutMs) {
    return new Promise((resolve) => {
      let done = false;

      const onEvt = (e) => {
        if (done) return;
        done = true;
        try { clearTimeout(t); } catch {}
        try { window.removeEventListener("aivo:atmo:job_created", onEvt); } catch {}
        resolve(e?.detail || null);
      };

      const t = setTimeout(() => {
        if (done) return;
        done = true;
        try { window.removeEventListener("aivo:atmo:job_created", onEvt); } catch {}
        resolve(null);
      }, Math.max(0, Number(timeoutMs) || 0));

      window.addEventListener("aivo:atmo:job_created", onEvt);
    });
  }

  async function withGenerateLoading(btn, run, root) {
    if (!btn) return;
    if (btn.__atmBusy) return;
    btn.__atmBusy = true;

    const r = root || getAtmoPanelRoot() || document.body;

    btn.disabled = true;
    btn.classList.add("is-loading");
    btn.setAttribute("aria-busy", "true");
    if (r) r.dataset.atmBusy = "1";
    btn.classList.add("is-pressed");

    const prevText = typeof btn.textContent === "string" ? btn.textContent : "";
    if (prevText) btn.textContent = "Üretiliyor…";

    const startedAt = Date.now();

    try {
      const res = await Promise.resolve().then(run);
      const remainingForEvent = Math.max(250, GEN_MAX_MS - (Date.now() - startedAt));
      const evt = await waitForAtmoJobCreated(remainingForEvent);

      const elapsed = Date.now() - startedAt;
      if (elapsed < GEN_MIN_MS) await sleep(GEN_MIN_MS - elapsed);

      return { ok: true, res, evt };
    } catch (err) {
      console.error("[ATM] generate error:", err);
      try { window.toast?.error?.(String(err?.message || err || "generate_error")); } catch {}
      return { ok: false, error: err };
    } finally {
      try {
        btn.disabled = false;
        btn.classList.remove("is-loading", "is-pressed");
        btn.removeAttribute("aria-busy");
        if (prevText) btn.textContent = prevText;
      } catch {}

      try { if (r && r.dataset) delete r.dataset.atmBusy; } catch {}
      btn.__atmBusy = false;
    }
  }

  // ------------------------------------------------------------
  // 1) Scope finder
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
    aspect: "16:9", // "16:9" | "1:1" | "9:16"

    // basic
    scene: "winter_cafe",
    effects: [],
    camera: "kenburns_soft",
    duration: "8",

    // personalization (basic)
    imageFile: null,
    logoFile: null,
    audioFile: null,

    logoPos: "br",
    logoSize: "sm",
    logoOpacity: 0.9,
    audioMode: "none",
    audioTrim: "loop_to_fit",
    silentCopy: true,

    // pro
    prompt: "",
    refImageFile: null,
    refAudioFile: null,
    light: null,
    mood: null,
    fps: "24",
    format: "mp4",
    seamFix: false,
    proDuration: "8",

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
  // ✅ 2.1) Upload state (R2) — IMAGE/LOGO/AUDIO
  // ------------------------------------------------------------
  state.uploads = state.uploads || {
    image: { status: "empty", url: "", name: "" }, // empty|uploading|ready|error
    logo:  { status: "empty", url: "", name: "" },
    audio: { status: "empty", url: "", name: "" }
  };

  function isUploadingAny() {
    const u = state.uploads || {};
    return Object.values(u).some((x) => x?.status === "uploading");
  }

  function ensureAtmUploadUI(root, kind) {
    const r = root || getAtmoPanelRoot() || document;
    const inputId =
      kind === "image" ? "#atmImageFile" :
      kind === "logo"  ? "#atmLogoFile"  :
      kind === "audio" ? "#atmAudioFile" :
      "";

    const col = inputId ? qs(inputId, r)?.closest?.(".atmPersCol") : null;
    if (!col) return;

    const prevId = `atm${kind[0].toUpperCase() + kind.slice(1)}Preview`;
    const badgeId = `atm${kind[0].toUpperCase() + kind.slice(1)}Badge`;

    // Preview (image/logo only)
    if ((kind === "image" || kind === "logo") && !qs(`#${prevId}`, col)) {
      const img = document.createElement("img");
      img.id = prevId;
      img.alt = kind + " preview";
      img.style.display = "none";
      img.style.width = "64px";
      img.style.height = "64px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "12px";
      img.style.marginTop = "10px";
      img.style.border = "1px solid rgba(255,255,255,0.12)";
      col.appendChild(img);
    }

    // Badge
    if (!qs(`#${badgeId}`, col)) {
      const b = document.createElement("div");
      b.id = badgeId;
      b.textContent = "Hazır ✓";
      b.style.display = "none";
      b.style.marginTop = "8px";
      b.style.fontSize = "12px";
      b.style.fontWeight = "800";
      b.style.padding = "6px 10px";
      b.style.borderRadius = "999px";
      b.style.width = "fit-content";
      b.style.border = "1px solid rgba(120,255,190,.22)";
      b.style.background = "rgba(120,255,190,.08)";
      col.appendChild(b);
    }
  }

  function setUploadUI(root, kind, patch) {
    const r = root || getAtmoPanelRoot() || document;
    ensureAtmUploadUI(r, kind);

    const st = state.uploads[kind] || { status: "empty", url: "", name: "" };
    const next = { ...st, ...(patch || {}) };
    state.uploads[kind] = next;

    const cap = kind[0].toUpperCase() + kind.slice(1);
    const badgeId = `atm${cap}Badge`;
    const prevId = `atm${cap}Preview`;

    const inputId =
      kind === "image" ? "atmImageFileName" :
      kind === "logo"  ? "atmLogoFileName" :
      kind === "audio" ? "atmAudioFileName" :
      "";

    const nameEl = inputId ? document.getElementById(inputId) : null;
    const badgeEl = qs(`#${badgeId}`, r);
    const prevEl = qs(`#${prevId}`, r);

    // Name label
    if (nameEl) {
      if (next.status === "uploading") nameEl.textContent = "Yükleniyor…";
      else if (next.status === "ready") nameEl.textContent = next.name || "Hazır ✓";
      else if (next.status === "error") nameEl.textContent = "Yükleme hatası";
      else nameEl.textContent = next.name || "Dosya seçilmedi";
    }

    // Badge
    if (badgeEl) {
      badgeEl.style.display = next.status === "ready" ? "" : "none";
      if (next.status === "uploading") badgeEl.style.display = "none";
      if (next.status === "error") {
        badgeEl.style.display = "";
        badgeEl.textContent = "Hata";
        badgeEl.style.border = "1px solid rgba(255,120,120,.25)";
        badgeEl.style.background = "rgba(255,120,120,.10)";
      } else {
        badgeEl.textContent = "Hazır ✓";
        badgeEl.style.border = "1px solid rgba(120,255,190,.22)";
        badgeEl.style.background = "rgba(120,255,190,.08)";
      }
    }

    // Preview (image/logo)
    if (prevEl && (kind === "image" || kind === "logo")) {
      if (next.status === "ready" && next.url) {
        prevEl.src = next.url;
        prevEl.style.display = "";
      } else {
        prevEl.style.display = "none";
      }
    }

    // Generate buttons lock while uploading
    const genBtns = qsa('[data-atm-generate]', r);
    const uploading = isUploadingAny();
    genBtns.forEach((b) => {
      if (!b) return;
      b.toggleAttribute?.("disabled", uploading);
      b.classList.toggle?.("is-uploading", uploading);
      if (uploading) b.setAttribute("title", "Dosyalar yükleniyor…");
      else b.removeAttribute("title");
    });
  }
// ---- R2 presign + upload (expects your backend)
// Backend contract (recommended):
// POST /api/r2/presign-put
// body: { app:"atmo", kind:"image|logo|audio", filename, contentType }
// resp: { ok:true, uploadUrl, publicUrl, key }   (publicUrl can be R2 public or your CDN)
async function presignR2({ app, kind, filename, contentType }) {
  const res = await fetch("/api/r2/presign-put", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app: app || "atmo",
      kind,
      filename,
      contentType
    })
  });

  if (!res.ok) throw new Error("presign_failed");
  const data = await res.json();
  if (!data || data.ok === false) throw new Error(data?.error || "presign_error");

  const uploadUrl = data.uploadUrl || data.upload_url;
  const publicUrl = data.publicUrl || data.public_url || data.url;

  if (!uploadUrl || !publicUrl) throw new Error("presign_missing_urls");
  return { uploadUrl, publicUrl, key: data.key || data.objectKey || "" };
}

async function uploadToR2(file, { app = "atmo", kind }) {
  if (!file) throw new Error("missing_file");
  const contentType = file.type || "application/octet-stream";
  const filename = file.name || `${kind || "file"}-${Date.now()}`;

  const { uploadUrl, publicUrl } = await presignR2({
    app,
    kind,
    filename,
    contentType
  });

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file
  });
  if (!put.ok) throw new Error("r2_put_failed");

  return { url: publicUrl, name: filename };
}

async function handleUpload(root, kind, file) {
  const r = root || getAtmoPanelRoot() || document;

  if (!file) {
    setUploadUI(r, kind, { status: "empty", url: "", name: "" });

    // ✅ LOGO global cleanup (logo kaldırıldıysa)
    if ((state?.uploads?.logo?.status || "") === "empty" || kind === "logo") {
      try { delete window.__ATMO_LOGO_PUBLIC_URL__; } catch {}
      try { window.__ATMO_LOGO_PUBLIC_URL__ = ""; } catch {}
    }

    return;
  }

  setUploadUI(r, kind, { status: "uploading", url: "", name: file.name || "" });

  try {
    const out = await uploadToR2(file, { app: "atmo", kind });

    setUploadUI(r, kind, {
      status: "ready",
      url: out.url,
      name: out.name || file.name || ""
    });

    // ✅ LOGO public_url -> global (kind mismatch olursa bile çalışsın)
    const logoUrl = state?.uploads?.logo?.url || out?.url || "";
    if (logoUrl) {
      window.__ATMO_LOGO_PUBLIC_URL__ = logoUrl;
    }

    return out;
  } catch (e) {
    console.error("[ATM][R2] upload error:", kind, e);
    setUploadUI(r, kind, { status: "error", url: "", name: file.name || "" });
    try { window.toast?.error?.("Yükleme hatası"); } catch {}
    return null;
  }
}
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
    const activeScene = qs("#atmScenes .smpack-choice.is-active", root);
    if (activeScene?.dataset?.atmScene) state.scene = activeScene.dataset.atmScene;

    const effBtns = qsa("#atmEffects [data-atm-eff].is-active", root);
    const eff = effBtns.map((b) => b.dataset.atmEff).filter(Boolean);
    if (eff.length) state.effects = eff;

    const cam = qs("#atmCamera", root)?.value;
    const dur = qs("#atmDuration", root)?.value;
    if (cam) state.camera = cam;
    if (dur) state.duration = dur;

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

    const p = qs("#atmSuperPrompt", root)?.value;
    if (typeof p === "string") state.prompt = p.trim();

    const fps = qs("#atmProFps", root)?.value;
    const fmt = qs("#atmProFormat", root)?.value;
    const seam = qs("#atmProSeamFix", root)?.checked;

    if (fps) state.fps = fps;
    if (fmt) state.format = fmt;
    if (typeof seam === "boolean") state.seamFix = seam;

    const pd = qs("#atmProDuration", root)?.value;
    if (pd) state.proDuration = pd;

    const light = qs('[data-atm-light].is-active', root)?.dataset?.atmLight;
    const mood = qs('[data-atm-mood].is-active', root)?.dataset?.atmMood;
    if (light) state.light = light;
    if (mood) state.mood = mood;

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

    // ensure upload UIs exist
    ensureAtmUploadUI(root, "image");
    ensureAtmUploadUI(root, "logo");
    ensureAtmUploadUI(root, "audio");
    // reflect any persisted state.uploads (if any)
    setUploadUI(root, "image", state.uploads.image);
    setUploadUI(root, "logo", state.uploads.logo);
    setUploadUI(root, "audio", state.uploads.audio);
  }

  // ------------------------------------------------------------
  // 4) Mode switch — CAPTURE
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

      syncAspectUI(root, shell);
      console.log("[ATM] mode switch ->", mode);
    },
    true
  );

  // ------------------------------------------------------------
  // 5) Basic: Scene select
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
  // 6) Basic: Effects multi-select
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
  // 6.5) Aspect ratio (Basic + Pro) — CAPTURE
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
  //    ✅ R2 upload for basic image/logo/audio
  // ------------------------------------------------------------
  document.addEventListener("change", async (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const file = e.target?.files?.[0] || null;

    // BASIC files (R2)
    if (closestWithin(e.target, "#atmImageFile", root)) {
      state.imageFile = file;

      const panel = e.target.closest('[data-mode-panel="basic"]');
      await handleUpload(panel || root, "image", file);

      return;
    }

    if (closestWithin(e.target, "#atmLogoFile", root)) {
      state.logoFile = file;

      const panel = e.target.closest('[data-mode-panel="basic"]');
      await handleUpload(panel || root, "logo", file);

      return;
    }

    if (closestWithin(e.target, "#atmAudioFile", root)) {
      state.audioFile = file;

      const panel = e.target.closest('[data-mode-panel="basic"]');
      await handleUpload(panel || root, "audio", file);

      return;
    }

    // ✅ PRO files (R2) — panel scope fix
    if (closestWithin(e.target, "#atmProLogoFile", root)) {
      state.logoFile = file;

      const panel = e.target.closest('[data-mode-panel="pro"]');
      await handleUpload(panel || root, "logo", file);

      return;
    }

    if (closestWithin(e.target, "#atmProAudioFile", root)) {
      state.audioFile = file;

      const panel = e.target.closest('[data-mode-panel="pro"]');
      await handleUpload(panel || root, "audio", file);

      return;
    }

    // PRO refs (şimdilik file olarak kalsın; istersen sonra R2’ye alırız)
    if (closestWithin(e.target, "#atmSceneImageInput", root)) {
      state.refImageFile = file;
      return;
    }

    if (closestWithin(e.target, "#atmSceneAudioInput", root)) {
      state.refAudioFile = file;
      return;
    }
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
  //    ✅ Basic payload: send R2 URL (NOT File)
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

      // ✅ R2 url (scene override)
      image_url: state.uploads?.image?.url || "",

      // ✅ R2 url
      logo_url: state.uploads?.logo?.url || "",
      logo_pos: state.logoPos || "br",
      logo_size: state.logoSize || "sm",
      logo_opacity: state.logoOpacity ?? 0.9,

      // ✅ R2 url
      audio_url: state.uploads?.audio?.url || "",
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

      // (opsiyonel) pro refs — şu an File (istersen sonra R2)
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

    if (isUploadingAny()) {
      try { window.toast?.info?.("Dosyalar yükleniyor…"); } catch {}
      return;
    }

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

      return withGenerateLoading(
        btn,
        async () => {
          // hook job create yapıp aivo:atmo:job_created emit etmeli
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

      if (root.dataset?.atmBusy === "1") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // upload sırasında tıklamayı yut
      if (isUploadingAny()) {
        e.preventDefault();
        e.stopPropagation();
        try { window.toast?.info?.("Dosyalar yükleniyor…"); } catch {}
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
   // ------------------------------------------------------------
// ATMOS — PPE bridge (FINAL)
// ------------------------------------------------------------
if (window.PPE) {
  window.PPE.onOutput = function(job) {
    if (!job) return;

    const logoUrl =
      job.logo_url ||
      job.logoUrl ||
      job.meta?.logo_url ||
      window.__ATMO_LOGO_PUBLIC_URL__ ||
      "";

    if (!logoUrl) return;

    const targets = document.querySelectorAll("[data-atmo-logo-target]");
    targets.forEach((el) => {
      el.src = logoUrl;
    });

    console.log("[ATMO] Logo applied via PPE:", logoUrl);
  };

  console.log("[ATMO] PPE.onOutput bound");
}
})();
