console.log("[video.module] loaded ✅", new Date().toISOString());

// video.module.js — FULL BLOCK (create + poll + PPE.apply)

(function () {
  if (window.__AIVO_VIDEO_MODULE__) return;
  window.__AIVO_VIDEO_MODULE__ = true;

  function qs(sel, root = document) {
    return root.querySelector(sel);
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

    // En yakın değeri seç
    return allowed.reduce((prev, curr) =>
      Math.abs(curr - num) < Math.abs(prev - num) ? curr : prev
    );
  }

  async function postJSON(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j) throw j?.error || `create_failed_${r.status}`;
    return j;
  }

  async function pollJob(job_id) {
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 2000));

      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}`);
      const j = await r.json().catch(() => null);

      if (!j || !j.ok) continue;

      if (j.status === "ready" && Array.isArray(j.outputs) && j.outputs.length) {
        window.PPE?.apply({
          state: "COMPLETED",
          outputs: j.outputs,
        });
        return;
      }
    }

    throw "video_poll_timeout";
  }

  async function createText() {
    const prompt = (qs("#videoPrompt")?.value || "").trim();
    if (!prompt) return alert("Lütfen video açıklaması yaz.");

    const durationRaw = Number(qs("#videoDuration")?.value || 8);
    const duration = clampDuration(durationRaw);

    const payload = {
      app: "video",
      mode: "text",
      prompt,

      // ✅ clamp edilmiş duration
      duration,

      resolution: Number(qs("#videoResolution")?.value || 720),
      ratio: qs("#videoRatio")?.value || "16:9",
      audio: !!qs("#audioEnabled")?.checked,
    };

    const j = await postJSON("/api/providers/runway/video/create", payload);
    const job = j.job || j;
    job.app = "video";

    window.AIVO_JOBS?.upsert?.(job);
    console.log("[video] created(text)", job);

    const job_id = job.job_id || job.id;

    emitVideoJobCreated({
      app: "video",
      job_id,
      createdAt: Date.now(),
      mode: "text",
      prompt,
      ratio: payload.ratio,
      duration: payload.duration,
      resolution: payload.resolution,
      audio: payload.audio,
    });

    pollJob(job_id).catch(console.error);
  }

  async function createImage() {
    const file = qs("#videoImageInput")?.files?.[0];
    if (!file) return alert("Lütfen bir resim seç.");

    const durationRaw = Number(qs("#videoDuration")?.value || 8);
    const duration = clampDuration(durationRaw);

    const payload = {
      app: "video",
      mode: "image",
      prompt: (qs("#videoImagePrompt")?.value || "").trim(),

      // ✅ clamp edilmiş duration
      duration,

      resolution: Number(qs("#videoResolution")?.value || 720),
      ratio: qs("#videoRatio")?.value || "16:9",
      audio: !!qs("#audioEnabled")?.checked,
    };

    console.log("[video] file selected:", file.name);

    // --- R2 PRESIGN + UPLOAD ---
    const presign = await postJSON("/api/r2/presign-put", {
      filename: file.name,
      contentType: file.type || "image/jpeg",
      prefix: "files/tmp/",
    });

    console.log("[video] presign ok:", presign);

    const up = await fetch(presign.upload_url, {
      method: "PUT",
      headers: presign.required_headers || { "Content-Type": file.type || "image/jpeg" },
      body: file,
    });

    if (!up.ok) {
      throw "r2_upload_failed_" + up.status;
    }

    console.log("[video] uploaded to R2:", presign.public_url);

    // payload'a image_url ekle
    payload.image_url = presign.public_url;

    const j = await postJSON("/api/providers/runway/video/create", payload);
    const job = j.job || j;
    job.app = "video";

    window.AIVO_JOBS?.upsert?.(job);
    console.log("[video] created(image)", job);

    const job_id = job.job_id || job.id;

    emitVideoJobCreated({
      app: "video",
      job_id,
      createdAt: Date.now(),
      mode: "image",
      prompt: payload.prompt || "",
      image_url: payload.image_url,
      ratio: payload.ratio,
      duration: payload.duration,
      resolution: payload.resolution,
      audio: payload.audio,
    });

    pollJob(job_id).catch(console.error);
  }

  document.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("#videoGenerateTextBtn")) {
        e.preventDefault();

        const btn = e.target.closest("#videoGenerateTextBtn");
        btn.disabled = true;
        const prev = btn.textContent;
        btn.textContent = "Üretiliyor...";
        btn.classList.add("is-loading");

        createText()
          .catch((err) => {
            console.error(err);
            alert(String(err));
          })
          .finally(() => {
            btn.disabled = false;
            btn.textContent = prev;
            btn.classList.remove("is-loading");
          });

        return;
      }

      if (e.target.closest("#videoGenerateImageBtn")) {
        e.preventDefault();

        const btn = e.target.closest("#videoGenerateImageBtn");
        btn.disabled = true;
        const prev = btn.textContent;
        btn.textContent = "Üretiliyor...";
        btn.classList.add("is-loading");

        createImage()
          .catch((err) => {
            console.error(err);
            alert(String(err));
          })
          .finally(() => {
            btn.disabled = false;
            btn.textContent = prev;
            btn.classList.remove("is-loading");
          });

        return;
      }
    },
    true
  );

  // --- PROMPT CHAR COUNT (0/1000) ---
  function bindPromptCounter() {
    const promptEl = qs("#videoPrompt");
    if (!promptEl || promptEl.__countBound) return;

    // Sayacı bul: önce data/ID varsa onu kullan, yoksa "0 / 1000" yazan elemanı yakala
    const counterEl =
      qs("#videoPromptCount") ||
      qs('[data-role="videoPromptCount"]') ||
      Array.from(document.querySelectorAll("*")).find((el) =>
        (el.textContent || "").trim() === "0 / 1000"
      );

    if (!counterEl) {
      console.warn("[video.prompt] counter not found (0/1000). Add #videoPromptCount id.");
      return;
    }

    promptEl.__countBound = true;

    function update() {
      const n = (promptEl.value || "").length;
      counterEl.textContent = `${n} / 1000`;
    }

    promptEl.addEventListener("input", update);
    promptEl.addEventListener("change", update);
    update();
  }

  // İlk yüklemede + router/mount sonrası kaçırmamak için
  bindPromptCounter();
  new MutationObserver(() => bindPromptCounter()).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  console.log("[VIDEO] module READY (create + poll + PPE)");
})();

(function VIDEO_TABS_FIX() {
  const ROOT_SEL = 'section[data-module="video"]';

  function bind() {
    const root = document.querySelector(ROOT_SEL);
    if (!root || root.__videoTabsBound) return;

    const tabText = root.querySelector('[data-video-tab="text"]');
    const tabImage = root.querySelector('[data-video-tab="image"]');

    const viewText = root.querySelector('[data-video-subview="text"]');
    const viewImage = root.querySelector('[data-video-subview="image"]');

    if (!tabText || !tabImage || !viewText || !viewImage) {
      console.warn("[video.tabs] missing", {
        tabText: !!tabText,
        tabImage: !!tabImage,
        viewText: !!viewText,
        viewImage: !!viewImage,
      });
      return;
    }

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
        if (name) name.textContent = `Seçildi: ${f.name} (${(f.size/1024/1024).toFixed(2)}MB)`;

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

      // display garantisi (CSS bozulsa bile)
      viewText.style.display = isText ? "" : "none";
      viewImage.style.display = !isText ? "" : "none";

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
    console.log("[video.tabs] bound ✅");
  }

  // router geç basarsa diye
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    bind();
    if (tries > 30) clearInterval(t);
  }, 200);

  new MutationObserver(() => bind()).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
})();
