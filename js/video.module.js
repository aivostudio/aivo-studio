console.log("[video.module] loaded ✅", new Date().toISOString());

(function () {
  // ===============================
  // Global guard (tek kez)
  // ===============================
  if (window.__AIVO_VIDEO_MODULE_V2__) return;
  window.__AIVO_VIDEO_MODULE_V2__ = true;

  const ROOT_SEL = 'section[data-module="video"]';
  const POLL_MS = 2000;
  const POLL_MAX = 120; // 4 dk
    // ===============================
  // Policy helpers (Video)
  // ===============================
  const VIDEO_HARD_BLOCK_TERMS = [
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

  const VIDEO_HARD_BLOCK_PATTERNS = [
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

  const VIDEO_PUBLIC_FIGURE_TERMS = [
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

  const VIDEO_ARTIST_NAME_TERMS = [
    "tarkan",
    "sezen aksu",
    "ajda pekkan",
    "sertab erener",
    "mustafa sandal",
    "kenan dogulu",
    "kenan doğulu",
    "hande yener",
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

  function normalizeVideoPolicyText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isVideoPolicyBlocked(raw) {
    const text = normalizeVideoPolicyText(raw);

    const hasBlockedTerm =
      VIDEO_HARD_BLOCK_TERMS.some((term) =>
        text.includes(normalizeVideoPolicyText(term))
      ) ||
      VIDEO_PUBLIC_FIGURE_TERMS.some((term) =>
        text.includes(normalizeVideoPolicyText(term))
      ) ||
      VIDEO_ARTIST_NAME_TERMS.some((term) =>
        text.includes(normalizeVideoPolicyText(term))
      );

    const hasBlockedPattern = VIDEO_HARD_BLOCK_PATTERNS.some((rx) => rx.test(raw));
    return !!raw && (hasBlockedTerm || hasBlockedPattern);
  }

  function getVideoCreateButton(root) {
    return (
      qs("#videoGenerateTextBtn", root) ||
      qs("#videoGenerateImageBtn", root) ||
      null
    );
  }

  function ensureVideoPolicyNote(root, btn) {
    if (!root || !btn) return null;

    let note = qs("#videoPolicyNote", root);
    if (note) return note;

    note = document.createElement("div");
    note.id = "videoPolicyNote";
    note.style.display = "none";
    note.style.marginTop = "14px";
    note.style.padding = "14px 16px";
    note.style.borderRadius = "18px";
    note.style.background = "rgba(255,90,120,.10)";
    note.style.border = "1px solid rgba(255,120,150,.24)";
    note.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.04)";
    note.style.textAlign = "center";
    note.style.fontSize = "14px";
    note.style.fontWeight = "800";
    note.style.lineHeight = "1.65";
    note.style.color = "rgba(255,245,248,.96)";

    const mountPoint = btn.parentElement || root;
    mountPoint.appendChild(note);
    return note;
  }

  function resetVideoPolicyUI(root) {
    if (!root) return;

    const promptEls = [
      qs("#videoPrompt", root),
      qs("#videoImagePrompt", root)
    ].filter(Boolean);

    const buttons = [
      qs("#videoGenerateTextBtn", root),
      qs("#videoGenerateImageBtn", root)
    ].filter(Boolean);

    const note = qs("#videoPolicyNote", root);

    promptEls.forEach((el) => {
      el.style.borderColor = "";
      el.style.boxShadow = "";
    });

    buttons.forEach((btn) => {
      btn.style.background = "";
      btn.style.borderColor = "";
      btn.style.boxShadow = "";
      btn.style.cursor = "";
      btn.style.filter = "";
    });

    if (note) {
      note.style.display = "none";
      note.textContent = "";
    }
  }

  function buildVideoPolicyText(root, mode = "text") {
    const common = buildCommonPayload(root);

    const textPrompt = String(qs("#videoPrompt", root)?.value || "").trim();
    const imagePrompt = String(qs("#videoImagePrompt", root)?.value || "").trim();

    return [
      mode === "image" ? imagePrompt : textPrompt,
      common?.model,
      common?.ratio,
      common?.duration,
      common?.resolution
    ]
      .filter(Boolean)
      .join(" ");
  }

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function emitVideoJobCreated(meta) {
    try {
      window.dispatchEvent(new CustomEvent("aivo:video:job_created", { detail: meta }));
    } catch (e) {
      console.warn("[video] emit failed", e);
    }
  }

  // ===============================
  // Duration clamp helper (Runway UI: 5 / 8 / 10)
  // ===============================
  function clampDuration(n) {
    const allowed = [5, 8, 10];
    const num = Number(n);

    if (!Number.isFinite(num)) return 8;
    if (allowed.includes(num)) return num;

    return allowed.reduce((prev, curr) =>
      Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
    );
  }

  // ===============================
  // Robust JSON POST (500'lerde text dönebilir)
  // ===============================
  async function postJSON(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await r.text().catch(() => "");
    let j = null;
    try {
      j = text ? JSON.parse(text) : null;
    } catch (_) {
      j = null;
    }

    if (!r.ok) {
      const err =
        (j && (j.error || j.message)) ||
        (text ? text.slice(0, 180) : "") ||
        `request_failed_${r.status}`;
      throw err;
    }

    if (!j) throw "bad_json_response";
    return j;
  }

  // ===============================
  // Poll job -> PPE.apply (video only)
  // ===============================
  function isReadyStatus(s) {
    const v = String(s || "").toLowerCase();
    return v === "ready" || v === "done" || v === "completed" || v === "success";
  }

  function pickVideoOutputs(outputs) {
    if (!Array.isArray(outputs)) return [];
    return outputs.filter((o) => {
      if (!o) return false;
      if (o.type && o.type !== "video") return false;
      const app = o.meta?.app || o.app || o.module;
      return !app || app === "video"; // app yoksa da kabul (geriye uyumluluk)
    });
  }

  async function pollJob(job_id) {
    for (let i = 0; i < POLL_MAX; i++) {
      await sleep(POLL_MS);

      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}`);
      const text = await r.text().catch(() => "");
      let j = null;
      try { j = text ? JSON.parse(text) : null; } catch (_) { j = null; }

      if (!j || !j.ok) continue;

      const ready = isReadyStatus(j.status);
      const outs = pickVideoOutputs(j.outputs);

      if (ready && outs.length) {
        window.PPE?.apply?.({
          state: "COMPLETED",
          outputs: outs.map((o) => ({
            ...o,
            meta: { ...(o.meta || {}), app: "video" },
          })),
        });
        return;
      }

      // backend error ise erken kır
      if (String(j.status || "").toLowerCase() === "error") {
        throw j.error || "video_job_error";
      }
    }

    throw "video_poll_timeout";
  }

  // ===============================
  // Collect UI values safely (root-aware)
  // ===============================
  function getRoot() {
    return document.querySelector(ROOT_SEL) || document;
  }

  function buildCommonPayload(root) {
    const durationRaw = Number(qs("#videoDuration", root)?.value || 8);
    const duration = clampDuration(durationRaw);

    return {
      app: "video",
      model: "gen4.5",
      duration,
      ratio: qs("#videoRatio", root)?.value || "16:9",
      resolution: Number(qs("#videoResolution", root)?.value || 720),
      audio: !!qs("#audioEnabled", root)?.checked,
    };
  }

async function createText() {
  const root = getRoot();

  const prompt = (qs("#videoPrompt", root)?.value || "").trim();
    const policyText = buildVideoPolicyText(root, "text");
  const createBtn = qs("#videoGenerateTextBtn", root);
  const policyNote = ensureVideoPolicyNote(root, createBtn);

  if (isVideoPolicyBlocked(policyText)) {
    const promptEl = qs("#videoPrompt", root);

    if (promptEl) {
      promptEl.style.borderColor = "rgba(255,110,140,.92)";
      promptEl.style.boxShadow =
        "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
      promptEl.focus();
    }

    if (createBtn) {
      createBtn.style.background =
        "linear-gradient(135deg, rgba(255,93,143,.92), rgba(255,62,62,.92))";
      createBtn.style.borderColor = "rgba(255,110,140,.95)";
      createBtn.style.boxShadow =
        "0 10px 30px rgba(255,80,120,.22), inset 0 1px 0 rgba(255,255,255,.18)";
      createBtn.style.cursor = "not-allowed";
      createBtn.style.filter = "saturate(1.05)";
    }

    if (policyNote) {
      policyNote.textContent =
        "Bu istek bu haliyle üretilemez. Sanatçı adı, kişi adı veya taklit çağrışımı yerine video sahnesini ve aksiyonu tarif et.";
      policyNote.style.display = "block";
    }

    return;
  }
  if (!prompt) {
    alert("Lütfen video açıklaması yaz.");
    return;
  }

  const payload = {
    ...buildCommonPayload(root),
    mode: "text",
    prompt,
  };

  const j = await postJSON("/api/providers/runway/video/create", payload);
  const job = j.job || j;

  // jobs store
  job.app = "video";
  window.AIVO_JOBS?.upsert?.(job);

  const job_id = job.job_id || job.id;
  console.log("[video] created(text)", { job_id, job });

  emitVideoJobCreated({
    app: "video",
    job_id,
    createdAt: Date.now(),
    mode: "text",
    prompt,
    model: payload.model,
    ratio: payload.ratio,
    duration: payload.duration,
    resolution: payload.resolution,
    audio: payload.audio,
  });

  await pollJob(job_id);
}


  async function createImage() {
    const root = getRoot();

    const file = qs("#videoImageInput", root)?.files?.[0];
      const policyText = buildVideoPolicyText(root, "image");
  const createBtn = qs("#videoGenerateImageBtn", root);
  const policyNote = ensureVideoPolicyNote(root, createBtn);

  if (isVideoPolicyBlocked(policyText)) {
    const promptEl = qs("#videoImagePrompt", root);

    if (promptEl) {
      promptEl.style.borderColor = "rgba(255,110,140,.92)";
      promptEl.style.boxShadow =
        "0 0 0 1px rgba(255,110,140,.28), 0 10px 28px rgba(255,70,110,.10)";
      promptEl.focus();
    }

    if (createBtn) {
      createBtn.style.background =
        "linear-gradient(135deg, rgba(255,93,143,.92), rgba(255,62,62,.92))";
      createBtn.style.borderColor = "rgba(255,110,140,.95)";
      createBtn.style.boxShadow =
        "0 10px 30px rgba(255,80,120,.22), inset 0 1px 0 rgba(255,255,255,.18)";
      createBtn.style.cursor = "not-allowed";
      createBtn.style.filter = "saturate(1.05)";
    }

    if (policyNote) {
      policyNote.textContent =
        "Bu istek bu haliyle üretilemez. Sanatçı adı, kişi adı veya taklit çağrışımı yerine video sahnesini ve aksiyonu tarif et.";
      policyNote.style.display = "block";
    }

    return;
  }
    if (!file) {
      alert("Lütfen bir resim seç.");
      return;
    }

    const prompt = (qs("#videoImagePrompt", root)?.value || "").trim();

    const payload = {
      ...buildCommonPayload(root),
      mode: "image",
      prompt,
    };

    console.log("[video] file selected:", file.name);

    // --- R2 PRESIGN + UPLOAD ---
   const presign = await postJSON("/api/r2/presign-put", {
  filename: file.name,
  contentType: file.type || "image/jpeg",
  prefix: "files/runway/input-images/",
  app: "video",
  kind: "runway-input-image",
});

    const up = await fetch(presign.upload_url, {
      method: "PUT",
      headers: presign.required_headers || { "Content-Type": file.type || "image/jpeg" },
      body: file,
    });

    if (!up.ok) throw "r2_upload_failed_" + up.status;

    payload.image_url = presign.public_url;
    console.log("[video] uploaded to R2:", payload.image_url);

    const j = await postJSON("/api/providers/runway/video/create", payload);
    const job = j.job || j;

    job.app = "video";
    window.AIVO_JOBS?.upsert?.(job);

    const job_id = job.job_id || job.id;
    console.log("[video] created(image)", { job_id, job });

    emitVideoJobCreated({
      app: "video",
      job_id,
      createdAt: Date.now(),
      mode: "image",
      model: payload.model,
      prompt: payload.prompt || "",
      image_url: payload.image_url,
      ratio: payload.ratio,
      duration: payload.duration,
      resolution: payload.resolution,
      audio: payload.audio,
    });

    pollJob(job_id).catch(console.error);
  }

  // ===============================
  // Buttons (event delegation)
  // ===============================
  function withLoading(btn, fn) {
    if (!btn) return;
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = "Üretiliyor...";
    btn.classList.add("is-loading");

    return Promise.resolve()
      .then(fn)
      .catch((err) => {
        console.error(err);
        alert(String(err));
      })
      .finally(() => {
        btn.disabled = false;
        btn.textContent = prev;
        btn.classList.remove("is-loading");
      });
  }

  document.addEventListener(
    "click",
    (e) => {
      const tBtn = e.target.closest("#videoGenerateTextBtn");
      if (tBtn) {
        e.preventDefault();
        return withLoading(tBtn, createText);
      }

      const iBtn = e.target.closest("#videoGenerateImageBtn");
      if (iBtn) {
        e.preventDefault();
        return withLoading(iBtn, createImage);
      }
    },
    true
  );

  // ===============================
  // Prompt counters + policy reset (bind once)
  // ===============================
  function bindPromptCounter(root) {
    const textPromptEl = qs("#videoPrompt", root);
    const imagePromptEl = qs("#videoImagePrompt", root);

    const textCounterEl =
      qs("#videoPromptCount", root) ||
      qs('[data-role="videoPromptCount"]', root) ||
      Array.from(root.querySelectorAll("*")).find((el) =>
        (el.textContent || "").trim() === "0 / 1000"
      );

    if (textPromptEl && textCounterEl && !textPromptEl.__countBound) {
      textPromptEl.__countBound = true;

      function updateText() {
        const n = (textPromptEl.value || "").length;
        textCounterEl.textContent = `${n} / 1000`;
      }

      textPromptEl.addEventListener("input", () => {
        resetVideoPolicyUI(root);
        updateText();
      });

      textPromptEl.addEventListener("change", () => {
        resetVideoPolicyUI(root);
        updateText();
      });

      updateText();
    }

    if (imagePromptEl && !imagePromptEl.__countBound) {
      imagePromptEl.__countBound = true;

      imagePromptEl.addEventListener("input", () => {
        resetVideoPolicyUI(root);
      });

      imagePromptEl.addEventListener("change", () => {
        resetVideoPolicyUI(root);
      });
    }
  }

  // ===============================
  // Tabs + Image upload UX (bind once per root)
  // ===============================
  function bindTabs(root) {
    if (!root || root.__videoTabsBound) return;

    const tabText = root.querySelector('[data-video-tab="text"]');
    const tabImage = root.querySelector('[data-video-tab="image"]');
    const viewText = root.querySelector('[data-video-subview="text"]');
    const viewImage = root.querySelector('[data-video-subview="image"]');

    if (!tabText || !tabImage || !viewText || !viewImage) return;

    root.__videoTabsBound = true;

    function bindImageUploadUX() {
      const input = root.querySelector("#videoImageInput");
      const fb = root.querySelector("#videoImageFeedback");
      const name = root.querySelector("#videoImageName");
      const clearBtn = root.querySelector("#videoImageClearBtn");
      const bar = root.querySelector("#videoImageBar");
      const pct = root.querySelector("#videoImagePct");
      if (!input || input.__uxBound) return;

      input.__uxBound = true;

      if (clearBtn && !clearBtn.__bound) {
        clearBtn.__bound = true;

        clearBtn.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation?.();

          input.value = "";
          input.style.pointerEvents = "auto";

          resetVideoPolicyUI(root);

          if (fb) fb.style.display = "none";
          if (name) name.textContent = "";
          if (bar) bar.style.width = "0%";
          if (pct) pct.textContent = "0%";
          clearBtn.style.display = "none";
        });
      }

      input.addEventListener("change", () => {
        const f = input.files?.[0];

        resetVideoPolicyUI(root);

        if (!f) {
          input.style.pointerEvents = "auto";
          if (fb) fb.style.display = "none";
          if (name) name.textContent = "";
          if (bar) bar.style.width = "0%";
          if (pct) pct.textContent = "0%";
          if (clearBtn) clearBtn.style.display = "none";
          return;
        }

        input.style.pointerEvents = "none";

        if (fb) fb.style.display = "block";
        if (name) {
          name.textContent = `Seçildi: ${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB) · Yükleniyor...`;
        }
        if (bar) bar.style.width = "0%";
        if (pct) pct.textContent = "0%";
        if (clearBtn) clearBtn.style.display = "none";

        let p = 0;

        const t = setInterval(() => {
          p += 10;

          if (p >= 100) {
            p = 100;
            clearInterval(t);

            if (name) {
              name.textContent = `Seçildi: ${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB) · Hazır ✓`;
            }

            if (clearBtn) {
              clearBtn.style.display = "inline-grid";
              clearBtn.style.placeItems = "center";
            }
          }

          if (bar) bar.style.width = p + "%";
          if (pct) pct.textContent = p + "%";
        }, 80);
      });
    }

    function setMode(mode) {
      const isText = mode === "text";
      tabText.classList.toggle("is-active", isText);
      tabImage.classList.toggle("is-active", !isText);

      viewText.classList.toggle("is-active", isText);
      viewImage.classList.toggle("is-active", !isText);

      viewText.style.display = isText ? "" : "none";
      viewImage.style.display = !isText ? "" : "none";

      resetVideoPolicyUI(root);

      if (mode === "image") bindImageUploadUX();

      root.dataset.videoMode = mode;
      console.log("[video.tabs] mode =", mode);
    }

    tabText.addEventListener("click", (e) => {
      e.preventDefault();
      setMode("text");
    });

    tabImage.addEventListener("click", (e) => {
      e.preventDefault();
      setMode("image");
    });

    setMode(root.dataset.videoMode || "text");
    bindImageUploadUX();
    console.log("[video.tabs] bound ✅");
  }
  // ===============================
  // Single observer: root geldiğinde bind et, sonra hafif çalışsın
  // ===============================
  function tryBindAll() {
    const root = document.querySelector(ROOT_SEL);
    if (!root) return;

    bindTabs(root);
    bindPromptCounter(root);
  }

  // İlk çalıştır
  tryBindAll();

  // Router/mount sonrası için tek observer
const obs = new MutationObserver(() => tryBindAll());
obs.observe(document.documentElement, { childList: true, subtree: true });

  console.log("[VIDEO] module READY (create + poll + PPE) ✅");
})();
