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

    pollJob(job_id).catch(console.error);
  }

  async function createImage() {
    const root = getRoot();

    const file = qs("#videoImageInput", root)?.files?.[0];
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
      prefix: "files/tmp/",
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
  // Prompt char count (bind once)
  // ===============================
  function bindPromptCounter(root) {
    const promptEl = qs("#videoPrompt", root);
    if (!promptEl || promptEl.__countBound) return;

    const counterEl =
      qs("#videoPromptCount", root) ||
      qs('[data-role="videoPromptCount"]', root) ||
      Array.from(root.querySelectorAll("*")).find((el) =>
        (el.textContent || "").trim() === "0 / 1000"
      );

    if (!counterEl) return;

    promptEl.__countBound = true;

    function update() {
      const n = (promptEl.value || "").length;
      counterEl.textContent = `${n} / 1000`;
    }

    promptEl.addEventListener("input", update);
    promptEl.addEventListener("change", update);
    update();
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
      const bar = root.querySelector("#videoImageBar");
      const pct = root.querySelector("#videoImagePct");
      if (!input || input.__uxBound) return;

      input.__uxBound = true;

      input.addEventListener("change", () => {
        const f = input.files?.[0];
        if (!f) return;

        if (fb) fb.style.display = "block";
        if (name) name.textContent = `Seçildi: ${f.name} (${(f.size / 1024 / 1024).toFixed(2)}MB)`;

        // Fake progress (sadece UI)
        let p = 0;
        if (bar) bar.style.width = "0%";
        if (pct) pct.textContent = "0%";

        const t = setInterval(() => {
          p += 10;
          if (p >= 100) { p = 100; clearInterval(t); }
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

      // CSS bozulsa bile garanti
      viewText.style.display = isText ? "" : "none";
      viewImage.style.display = !isText ? "" : "none";

      if (mode === "image") bindImageUploadUX();

      root.dataset.videoMode = mode;
      console.log("[video.tabs] mode =", mode);
    }

    tabText.addEventListener("click", (e) => { e.preventDefault(); setMode("text"); });
    tabImage.addEventListener("click", (e) => { e.preventDefault(); setMode("image"); });

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
