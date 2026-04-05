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
  const GEN_MIN_MS = 3000;
  const GEN_MAX_MS = 5000;

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
  // 1.1) Policy helpers (PRO only)
  // ------------------------------------------------------------
  const HARD_BLOCK_TERMS = [
    "deepfake",
    "face swap",
    "replace face",
    "swap face",
    "yuzunu koy",
    "yüzünü koy",
    "yuzunu ekle",
    "yüzünü ekle",
    "yuzunu kullan",
    "yüzünü kullan",
    "suratini kullan"
  ];

  const HARD_BLOCK_PATTERNS = [
    /\bgibi\b/i,
    /\btarzında\b/i,
    /\btarzinda\b/i,
    /\bstilinde\b/i,
    /\bin the style of\b/i,
    /\blike\b/i,
    /\bbirebir\b/i,
    /\baynısı\b/i,
    /\baynisi\b/i,
    /\bface of\b/i,
    /\bwith the face of\b/i,
    /\bimpersonat(e|ion)\b/i
  ];

  const PUBLIC_FIGURE_TERMS = [
    "recep tayyip erdogan",
    "recep tayyip erdoğan",
    "erdogan",
    "erdoğan",
    "kemal kilicdaroglu",
    "kemal kılıçdaroğlu",
    "ekrem imamoglu",
    "ekrem imamoğlu",
    "mansur yavas",
    "mansur yavaş",
    "devlet bahceli",
    "devlet bahçeli",
    "meral aksener",
    "meral akşener",
    "ozgur ozel",
    "özgür özel",
    "selahattin demirtas",
    "selahattin demirtaş",
    "umit ozdag",
    "ümit özdağ",
    "muharrem ince",
    "sinan ogan",
    "sinan oğan",
    "ali babacan",
    "ahmet davutoglu",
    "ahmet davutoğlu",
    "hulusi akar",
    "hakan fidan",
    "mehmet simsek",
    "mehmet şimşek",
    "suleyman soylu",
    "süleyman soylu",
    "mustafa kemal ataturk",
    "mustafa kemal atatürk",
    "ataturk",
    "atatürk",
    "cumhurbaskani",
    "cumhurbaşkanı",
    "bakan",
    "milletvekili",
    "belediye baskani",
    "belediye başkanı",
    "vali",
    "kaymakam",
    "siyasetci",
    "siyasetçi",
    "politikaci",
    "politikacı",
    "kamu figuru",
    "kamu figürü"
  ];

  const ARTIST_NAME_TERMS = [
    "tarkan",
    "sezen aksu",
    "ajda pekkan",
    "sertab erener",
    "mustafa sandal",
    "kenan dogulu",
    "kenan doğulu",
    "handa yener",
    "demet akalin",
    "demet akalın",
    "gulsen",
    "gülşen",
    "hadise",
    "aleyna tilki",
    "edis",
    "murat boz",
    "simge",
    "simge sagin",
    "simge sağın",
    "sila",
    "sıla",
    "mabel matiz",
    "yildiz tilbe",
    "yıldız tilbe",
    "sibel can",
    "linet",
    "duman",
    "mor ve otesi",
    "mor ve ötesi",
    "teoman",
    "oguzhan koc",
    "oğuzhan koç",
    "cem adrian",
    "haluk levent",
    "baris manco",
    "barış manço",
    "athena",
    "manga",
    "sagopa kajmer",
    "ceza",
    "ezhel",
    "ben fero",
    "gazapizm",
    "uzi",
    "cakal",
    "çakal",
    "semicenk",
    "motive",
    "khontkar",
    "norm ender",
    "selda bagcan",
    "selda bağcan",
    "muslum gurses",
    "müslüm gürses",
    "ibrahim tatlises",
    "ibrahim tatlıses",
    "orhan gencebay",
    "ferdi tayfur",
    "volkan konak",
    "candan ercetin",
    "nazan oncel",
    "nazan öncel",
    "buray",
    "irem derici",
    "melek mosso",
    "madrigal",
    "dedubluman",
    "yalin",
    "yalın",
    "emre aydin",
    "emre aydın",
    "sefo",
    "sertab"
  ];

function normalizeAtmoPolicyText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildAtmoPolicyPhraseRegex(term) {
  const normalized = normalizeAtmoPolicyText(term);
  if (!normalized) return null;

  const pattern = normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");

  return new RegExp(`(^|\\s)${pattern}(?=\\s|$)`, "i");
}

  function getAtmoProPanel(root) {
    const r = root || getAtmoPanelRoot();
    if (!r) return null;

    return (
      qs('[data-mode-panel="pro"]', r) ||
      r.closest?.('[data-mode-panel="pro"]') ||
      r
    );
  }

  function ensureAtmoPolicyNote(root, generateBtn) {
    const panel = getAtmoProPanel(root);
    if (!panel || !generateBtn || !generateBtn.parentElement) return null;

    let policyNote = panel.querySelector("#atmPolicyNote");
    if (!policyNote) {
      policyNote = document.createElement("div");
      policyNote.id = "atmPolicyNote";
      policyNote.style.display = "none";
      policyNote.style.marginTop = "12px";
      policyNote.style.padding = "14px 16px";
      policyNote.style.borderRadius = "18px";
      policyNote.style.background = "rgba(255,90,120,.10)";
      policyNote.style.border = "1px solid rgba(255,120,150,.24)";
      policyNote.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.04)";
      policyNote.style.backdropFilter = "blur(10px)";
      policyNote.style.webkitBackdropFilter = "blur(10px)";
      policyNote.style.textAlign = "center";
      policyNote.style.fontSize = "14px";
      policyNote.style.fontWeight = "800";
      policyNote.style.lineHeight = "1.65";
      policyNote.style.letterSpacing = ".01em";
      policyNote.style.color = "rgba(255,245,248,.96)";
      generateBtn.parentElement.appendChild(policyNote);
    }

    return policyNote;
  }

  function resetAtmoPolicyUI(root, promptEl, generateBtn) {
    const panel = getAtmoProPanel(root);
    const policyNote = panel?.querySelector("#atmPolicyNote");

    if (promptEl) {
      promptEl.style.borderColor = "";
      promptEl.style.boxShadow = "";
      promptEl.style.animation = "";
    }

    if (generateBtn) {
      generateBtn.style.background = "";
      generateBtn.style.borderColor = "";
      generateBtn.style.boxShadow = "";
      generateBtn.style.cursor = "";
      generateBtn.style.filter = "";
      generateBtn.style.animation = "";
    }

    if (policyNote) {
      policyNote.style.display = "none";
      policyNote.textContent = "";
      policyNote.innerHTML = "";
    }
  }

function isAtmoPolicyBlocked(raw) {
  const text = normalizeAtmoPolicyText(raw);

  const hasBlockedTerm =
    HARD_BLOCK_TERMS.some((term) => {
      const rx = buildAtmoPolicyPhraseRegex(term);
      return rx ? rx.test(text) : false;
    }) ||
    PUBLIC_FIGURE_TERMS.some((term) => {
      const rx = buildAtmoPolicyPhraseRegex(term);
      return rx ? rx.test(text) : false;
    }) ||
    ARTIST_NAME_TERMS.some((term) => {
      const rx = buildAtmoPolicyPhraseRegex(term);
      return rx ? rx.test(text) : false;
    });

  const hasBlockedPattern = HARD_BLOCK_PATTERNS.some((rx) => rx.test(raw));
  return !!raw && (hasBlockedTerm || hasBlockedPattern);
}
  if (!document.getElementById("aivoPolicyPulseStyle")) {
    const style = document.createElement("style");
    style.id = "aivoPolicyPulseStyle";
    style.textContent = `
      @keyframes aivoPolicyPulse {
        0% {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.04),
            0 0 0 1px rgba(255,120,150,.18),
            0 8px 24px rgba(255,70,110,.10);
        }
        50% {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.05),
            0 0 0 1px rgba(255,120,150,.30),
            0 12px 34px rgba(255,70,110,.18);
        }
        100% {
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,.04),
            0 0 0 1px rgba(255,120,150,.18),
            0 8px 24px rgba(255,70,110,.10);
        }
      }

      @keyframes aivoPolicyTextGlow {
        0% {
          opacity: .88;
          text-shadow: 0 0 8px rgba(255,255,255,.08), 0 0 18px rgba(255,120,150,.12);
        }
        50% {
          opacity: 1;
          text-shadow: 0 0 14px rgba(255,255,255,.16), 0 0 28px rgba(255,120,150,.24);
        }
        100% {
          opacity: .88;
          text-shadow: 0 0 8px rgba(255,255,255,.08), 0 0 18px rgba(255,120,150,.12);
        }
      }
    `;
    document.head.appendChild(style);
  }

  function bindAtmoPolicyReset() {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const promptEl = qs("#atmSuperPrompt", root);
    if (!promptEl || promptEl.__aivoAtmoPolicyResetBound) return;

    promptEl.__aivoAtmoPolicyResetBound = true;

    const getProGenerateBtn = () =>
      qs('[data-atm-generate][data-atm-mode="pro"]', root) ||
      qs('[data-atm-mode="pro"][data-atm-generate]', root);

    const reset = () => {
      resetAtmoPolicyUI(root, promptEl, getProGenerateBtn());
    };

    promptEl.addEventListener("input", reset);
    promptEl.addEventListener("change", reset);
  }

  // ------------------------------------------------------------
  // 2) State (single source of truth)
  // ------------------------------------------------------------
  const state = (window.__ATM_V2__ = window.__ATM_V2__ || {
    mode: "basic",
    aspect: "16:9",

    // basic
    scene: "",
    effects: [],
    camera: "kenburns_soft",
    duration: "4",

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
    proDuration: "4",

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
    basicImage: { status: "empty", url: "", name: "" },
    proImage: { status: "empty", url: "", name: "" },
    logo: { status: "empty", url: "", name: "" },
    audio: { status: "empty", url: "", name: "" }
  };

  function isUploadingAny() {
    const u = state.uploads || {};
    return Object.values(u).some((x) => x?.status === "uploading");
  }

  const ATMO_DURATION_STEP_COST = {
    "4": 0,
    "6": 5,
    "8": 10,
    "10": 15,
    "12": 20,
    "15": 25
  };

  function getAtmoSelectedDuration(mode) {
    if (mode === "pro") {
      return String(state.proDuration || "4");
    }
    return String(state.duration || "4");
  }

  function hasAtmoLogoSelected() {
    return !!String(state?.uploads?.logo?.url || "").trim();
  }

  function hasAtmoAudioSelected(mode) {
    const m = String(mode || state.mode || "basic").toLowerCase();

    if (!String(state?.uploads?.audio?.url || "").trim()) return false;

    if (m === "pro") {
      return String(state.audioMode || "none") !== "none";
    }

    return String(state.audioMode || "none") !== "none";
  }

  function computeAtmoCredit(mode) {
    const m = String(mode || state.mode || "basic").toLowerCase();
    const duration = getAtmoSelectedDuration(m);

    const baseCredit = m === "pro" ? 45 : 30;
    const durationExtra = Number(ATMO_DURATION_STEP_COST[duration] || 0);

    const effectsExtra =
      m === "basic"
        ? Number((state.effects || []).length || 0)
        : 0;

    const logoExtra = hasAtmoLogoSelected() ? 10 : 0;
    const audioExtra = hasAtmoAudioSelected(m) ? 10 : 0;

    const total = baseCredit + durationExtra + effectsExtra + logoExtra + audioExtra;

    const reason =
      m === "pro"
        ? "studio_atmo_generate_pro"
        : "studio_atmo_generate_basic";

    return {
      mode: m,
      duration,
      baseCredit,
      durationExtra,
      effectsExtra,
      logoExtra,
      audioExtra,
      total,
      reason
    };
  }

  function syncAtmoGenerateCredits(root) {
    const r = root || getAtmoPanelRoot();
    if (!r) return;

    const basicBtn =
      qs('[data-atm-generate][data-atm-mode="basic"]', r) ||
      qs('[data-atm-mode="basic"][data-atm-generate]', r);

    const proBtn =
      qs('[data-atm-generate][data-atm-mode="pro"]', r) ||
      qs('[data-atm-mode="pro"][data-atm-generate]', r);

    const basicCalc = computeAtmoCredit("basic");
    const proCalc = computeAtmoCredit("pro");

    if (basicBtn) {
      basicBtn.setAttribute("data-credit-cost", String(basicCalc.total));
      basicBtn.textContent = `🎬 Atmosfer Video Oluştur (${basicCalc.total} Kredi)`;
    }

    if (proBtn) {
      proBtn.setAttribute("data-credit-cost", String(proCalc.total));
      proBtn.textContent = `✨ Süper Atmosfer Video Oluştur (${proCalc.total} Kredi)`;
    }
  }

  function ensureAtmUploadUI(root, kind) {
    const r = root || getAtmoPanelRoot() || document;
    const inputId =
      kind === "image" ? "#atmImageFile" :
      kind === "logo" ? "#atmLogoFile" :
      kind === "audio" ? "#atmAudioFile" :
      "";

    const col = inputId ? qs(inputId, r)?.closest?.(".atmPersCol") : null;
    if (!col) return;

    const prevId = `atm${kind[0].toUpperCase() + kind.slice(1)}Preview`;
    const badgeId = `atm${kind[0].toUpperCase() + kind.slice(1)}Badge`;

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

    const isPro =
      (r?.dataset?.modePanel === "pro") ||
      !!(r?.closest?.('[data-mode-panel="pro"]'));

    if (!isPro) ensureAtmUploadUI(r, kind);

    const uploadKey =
      kind === "image"
        ? (isPro ? "proImage" : "basicImage")
        : kind;

    const st = state.uploads[uploadKey] || { status: "empty", url: "", name: "" };
    const next = { ...st, ...(patch || {}) };
    state.uploads[uploadKey] = next;

    if (isPro) {
      const proNameId =
        kind === "logo" ? "atmProLogoFileName" :
        kind === "image" ? "atmProRefImageFileName" :
        kind === "audio" ? "atmProAudioFileName" :
        "";

      const proStatusId =
        kind === "logo" ? "atmProLogoStatus" :
        kind === "image" ? "atmProRefImageStatus" :
        kind === "audio" ? "atmProAudioStatus" :
        "";

      const nameEl = proNameId ? document.getElementById(proNameId) : null;
      const statusEl = proStatusId ? document.getElementById(proStatusId) : null;
      const proLogoClearBtn = kind === "logo" ? document.getElementById("atmProLogoClear") : null;
      const proImageClearBtn = kind === "image" ? document.getElementById("atmProRefImageClear") : null;
      const proAudioClearBtn = kind === "audio" ? document.getElementById("atmProAudioClear") : null;

      if (nameEl) {
        if (next.status === "uploading") nameEl.textContent = "Yükleniyor…";
        else if (next.status === "ready") nameEl.textContent = next.name || "Hazır ✓";
        else if (next.status === "error") nameEl.textContent = "Yükleme hatası";
        else nameEl.textContent = next.name || "Dosya seçilmedi";
      }

      if (statusEl) {
        if (next.status === "ready") statusEl.style.display = "";
        else statusEl.style.display = "none";
      }

      if (proLogoClearBtn) {
        proLogoClearBtn.style.display = next.status === "ready" ? "inline-flex" : "none";
      }
      if (proImageClearBtn) {
        proImageClearBtn.style.display = next.status === "ready" ? "inline-flex" : "none";
      }
      if (proAudioClearBtn) {
        proAudioClearBtn.style.display = next.status === "ready" ? "inline-flex" : "none";
      }

      const genBtns = qsa('[data-atm-generate]', r);
      const uploading = isUploadingAny();
      genBtns.forEach((b) => {
        if (!b) return;
        b.toggleAttribute?.("disabled", uploading);
        b.classList.toggle?.("is-uploading", uploading);
        if (uploading) b.setAttribute("title", "Dosyalar yükleniyor…");
        else b.removeAttribute("title");
      });

      return;
    }

    const cap = kind[0].toUpperCase() + kind.slice(1);
    const badgeId = `atm${cap}Badge`;
    const prevId = `atm${cap}Preview`;

    const inputId =
      kind === "image" ? "atmImageFileName" :
      kind === "logo" ? "atmLogoFileName" :
      kind === "audio" ? "atmAudioFileName" :
      "";

    const nameEl = inputId ? document.getElementById(inputId) : null;
    const badgeEl = qs(`#${badgeId}`, r);
    const prevEl = qs(`#${prevId}`, r);

    if (nameEl) {
      if (next.status === "uploading") nameEl.textContent = "Yükleniyor…";
      else if (next.status === "ready") nameEl.textContent = next.name || "Hazır ✓";
      else if (next.status === "error") nameEl.textContent = "Yükleme hatası";
      else nameEl.textContent = next.name || "Dosya seçilmedi";
    }

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

    if (prevEl && (kind === "image" || kind === "logo")) {
      if (next.status === "ready" && next.url) {
        prevEl.src = next.url;
        prevEl.style.display = "";
      } else {
        prevEl.style.display = "none";
      }
    }

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

    ensureAtmUploadUI(root, "image");
    ensureAtmUploadUI(root, "logo");
    ensureAtmUploadUI(root, "audio");

    const basicPanelRef = shell ? qs('.mode-panel[data-mode-panel="basic"]', shell) : null;
    const proPanelRef = shell ? qs('.mode-panel[data-mode-panel="pro"]', shell) : null;

    if (basicPanelRef) setUploadUI(basicPanelRef, "image", state.uploads.basicImage);
    if (proPanelRef) setUploadUI(proPanelRef, "image", state.uploads.proImage);

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
      syncAtmoGenerateCredits(root);
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
    syncAtmoGenerateCredits(root);
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
    if (dur) {
      state.duration = dur.value || state.duration;
      syncAtmoGenerateCredits(root);
    }
  });

  // ------------------------------------------------------------
  // 8) Files: Basic image / logo / audio + Pro refs
  // ------------------------------------------------------------
  document.addEventListener("change", async (e) => {
    const root = getAtmoPanelRoot();
    if (!root) return;

    const file = e.target?.files?.[0] || null;

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

    if (closestWithin(e.target, "#atmProLogoFile", root)) {
      state.logoFile = file;
      const panel = e.target.closest('[data-mode-panel="pro"]');
      await handleUpload(panel || root, "logo", file);
      return;
    }

    if (closestWithin(e.target, "#atmProRefImageFile", root)) {
      state.refImageFile = file;
      const panel = e.target.closest('[data-mode-panel="pro"]');
      await handleUpload(panel || root, "image", file);
      return;
    }

    if (closestWithin(e.target, "#atmProAudioFile", root)) {
      state.audioFile = file;
      const panel = e.target.closest('[data-mode-panel="pro"]');
      await handleUpload(panel || root, "audio", file);
      return;
    }

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

    const proPos = closestWithin(e.target, "#atmProLogoPos", root);
    if (proPos) state.logoPos = proPos.value || state.logoPos;

    const proAudioMode = closestWithin(e.target, "#atmProAudioMode", root);
    if (proAudioMode) state.audioMode = proAudioMode.value || state.audioMode;
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
    if (pd) {
      state.proDuration = pd.value;
      syncAtmoGenerateCredits(root);
    }

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
    const root = getAtmoPanelRoot();
    const activeSceneBtn = root ? qs('#atmScenes .smpack-choice.is-active', root) : null;
    const sceneTitle = activeSceneBtn ? (qs('.smpack-choice__title', activeSceneBtn)?.textContent || '').trim() : '';
    const sceneDesc = activeSceneBtn ? (qs('.smpack-choice__desc', activeSceneBtn)?.textContent || '').trim() : '';
    const basicPrompt = [sceneTitle, sceneDesc].filter(Boolean).join(' — ');

    return {
      app: "atmo",
      mode: "basic",
      aspect: state.aspect || "16:9",

      scene: state.scene || null,
      prompt: basicPrompt,
      scene_label: sceneTitle,
      scene_desc: sceneDesc,
      effects: (state.effects || []).slice(),
      camera: state.camera || "kenburns_soft",
      duration: state.duration || "8",

      image_url: state.uploads?.basicImage?.url || "",

      logo_url: state.uploads?.logo?.url || "",
      logo_pos: state.logoPos || "br",
      logo_size: state.logoSize || "sm",
      logo_opacity: state.logoOpacity ?? 0.9,

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

      image_url: state.uploads?.proImage?.url || "",

      fps: state.fps || "24",
      format: state.format || "mp4",
      duration: state.proDuration || undefined,
      seam_fix: !!state.seamFix,

      logo_url: state.uploads?.logo?.url || "",
      logo_pos: state.logoPos || "br",
      logo_size: state.logoSize || "sm",
      logo_opacity: state.logoOpacity ?? 0.9,

      audio_url: state.uploads?.audio?.url || "",
      audio_mode: state.audioMode || "none",
      audio_trim: state.audioTrim || "loop_to_fit",
      silent_copy: (state.audioMode === "embed") ? false : !!state.silentCopy,

      details: { ...(state.details || {}) }
    };
  }

  // ------------------------------------------------------------
  // 14) Generate (delegated) — CAPTURE
  // ------------------------------------------------------------
  async function onGenerate(btn) {
    const root = getAtmoPanelRoot();
    if (!root) return;

    bindAtmoPolicyReset();

    if (isUploadingAny()) {
      try { window.toast?.info?.("Dosyalar yükleniyor…"); } catch {}
      return;
    }

    const mode = btn.dataset.atmMode || btn.getAttribute("data-atm-mode") || "basic";
    state.mode = mode;

    if (mode === "pro") {
      const promptEl = qs("#atmSuperPrompt", root) || document.getElementById("atmSuperPrompt");
      const raw = String(promptEl?.value || state.prompt || "").trim();
      state.prompt = raw;

      resetAtmoPolicyUI(root, promptEl, btn);

      if (!raw) {
        try { window.toast?.info?.("Süper Mod için önce prompt yazmalısın."); } catch {}
        if (promptEl) promptEl.focus();
        return;
      }

      if (isAtmoPolicyBlocked(raw)) {
        const policyNote = ensureAtmoPolicyNote(root, btn);

        if (promptEl) {
          promptEl.style.borderColor = "rgba(255,110,140,.92)";
          promptEl.style.boxShadow = "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
          promptEl.style.animation = "aivoPolicyPulse 1.8s ease-in-out infinite";
          promptEl.focus();
        }

        btn.style.background = "linear-gradient(135deg, rgba(255,93,143,.92), rgba(255,62,62,.92))";
        btn.style.borderColor = "rgba(255,110,140,.95)";
        btn.style.boxShadow = "0 10px 30px rgba(255,80,120,.22), inset 0 1px 0 rgba(255,255,255,.18)";
        btn.style.cursor = "not-allowed";
        btn.style.filter = "saturate(1.05)";
        btn.style.animation = "aivoPolicyPulse 1.8s ease-in-out infinite";

        if (policyNote) {
          policyNote.style.display = "block";
          policyNote.innerHTML = `
          <span style="
            display:inline-block;
            width:100%;
            margin:0;
            padding:0;
            border:none;
            outline:none;
            box-shadow:none;
            background:none;
            text-align:center;
            font-size:14px;
            font-weight:800;
            line-height:1.65;
            letter-spacing:.01em;
            color:rgba(255,245,248,.96);
            text-shadow:0 0 10px rgba(255,255,255,.10), 0 0 22px rgba(255,120,150,.18);
            animation:aivoPolicyTextGlow 1.8s ease-in-out infinite;
          ">Bu istek bu haliyle üretilemez. Sanatçı adı, kişi adı veya taklit çağrışımı yerine sahneyi ve video hissini tarif et.</span>
        `;
        }

        return;
      }
    }

    if (mode === "basic") {
      const activeSceneBtn = root ? qs('#atmScenes .smpack-choice.is-active', root) : null;
      const sceneKey = String(state.scene || "").trim();

      if (!activeSceneBtn || !sceneKey) {
        try { window.toast?.info?.("Basit Mod için önce bir arka mekan seçmelisin."); } catch {}
        const firstScene = document.querySelector('#atmScenes .smpack-choice[data-atm-scene]');
        if (firstScene) firstScene.focus();
        return;
      }
    }

    const creditCalc = computeAtmoCredit(mode);

    const creditCost =
      Number(btn?.getAttribute("data-credit-cost") || creditCalc.total) ||
      creditCalc.total;

    const creditReason = creditCalc.reason;

    const creditRes = await fetch("/api/credits/consume", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        cost: creditCost,
        reason: creditReason
      })
    });

    let creditData = null;
    try {
      creditData = await creditRes.json();
    } catch {
      creditData = { ok: false, error: "non_json_response", status: creditRes.status };
    }

    if (!creditRes.ok || !creditData?.ok) {
      const msg =
        creditData?.error ||
        creditData?.message ||
        "Kredi düşülemedi. Lütfen bakiyeni kontrol et.";

      try { window.toast?.error?.(String(msg)); } catch {}
      return;
    }

    try {
      const creditGetRes = await fetch("/api/credits/get", {
        credentials: "include",
        cache: "no-store",
        headers: { "accept": "application/json" }
      });

      const creditGetData = await creditGetRes.json().catch(() => null);

      if (creditGetData?.ok && typeof creditGetData.credits === "number") {
        const topCreditCountEl = document.getElementById("topCreditCount");
        if (topCreditCountEl) {
          topCreditCountEl.textContent = String(creditGetData.credits);
        }

        if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
          window.AIVO_STORE_V1.setCredits(creditGetData.credits);
        }
      }
    } catch {}

    const payload = mode === "pro" ? buildProPayload() : buildBasicPayload();

    const hook =
      window.ATM_CREATE ||
      window.atmoGenerate ||
      window.ATMOSPHERE_CREATE ||
      null;

    if (typeof hook === "function") {
      console.log("[ATM] generate -> hook()", {
        mode,
        payload,
        credit: creditCalc
      });

      return withGenerateLoading(
        btn,
        async () => {
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

      const logoClearBtn = closestWithin(e.target, "#atmProLogoClear", root);
      if (logoClearBtn) {
        e.preventDefault();
        e.stopPropagation();

        const logoInput = document.getElementById("atmProLogoFile");
        if (logoInput) logoInput.value = "";

        state.logoFile = null;

        const panel =
          logoClearBtn.closest('[data-mode-panel="pro"]') ||
          qs('[data-mode-panel="pro"]', root) ||
          root;

        setUploadUI(panel, "logo", { status: "empty", url: "", name: "" });
        try { window.__ATMO_LOGO_PUBLIC_URL__ = ""; } catch {}
        return;
      }

      const imageClearBtn = closestWithin(e.target, "#atmProRefImageClear", root);
      if (imageClearBtn) {
        e.preventDefault();
        e.stopPropagation();

        const imageInput = document.getElementById("atmProRefImageFile");
        if (imageInput) imageInput.value = "";

        state.refImageFile = null;

        const panel =
          imageClearBtn.closest('[data-mode-panel="pro"]') ||
          qs('[data-mode-panel="pro"]', root) ||
          root;

        setUploadUI(panel, "image", { status: "empty", url: "", name: "" });
        return;
      }

      const audioClearBtn = closestWithin(e.target, "#atmProAudioClear", root);
      if (audioClearBtn) {
        e.preventDefault();
        e.stopPropagation();

        const audioInput = document.getElementById("atmProAudioFile");
        if (audioInput) audioInput.value = "";

        state.audioFile = null;

        const panel =
          audioClearBtn.closest('[data-mode-panel="pro"]') ||
          qs('[data-mode-panel="pro"]', root) ||
          root;

        setUploadUI(panel, "audio", { status: "empty", url: "", name: "" });
        return;
      }

      const btn = closestWithin(e.target, "[data-atm-generate]", root);
      if (!btn) return;

      if (root.dataset?.atmBusy === "1") {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

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
    syncAtmoGenerateCredits(root);

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
