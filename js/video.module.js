console.log("[video.module] loaded ✅", new Date().toISOString());

// video.module.js — FULL BLOCK (create + poll + PPE.apply)

(function () {
  if (window.__AIVO_VIDEO_MODULE__) return;
  window.__AIVO_VIDEO_MODULE__ = true;

  function qs(sel, root = document) {
    return root.querySelector(sel);
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

    const payload = {
      app: "video",
      mode: "text",
      prompt,
      duration: Number(qs("#videoDuration")?.value || 8),
      resolution: Number(qs("#videoResolution")?.value || 720),
      ratio: qs("#videoRatio")?.value || "16:9",
      audio: !!qs("#audioEnabled")?.checked,
    };

    const j = await postJSON("/api/providers/runway/video/create", payload);
    const job = j.job || j;
    job.app = "video";

    window.AIVO_JOBS?.upsert?.(job);
    console.log("[video] created(text)", job);

    pollJob(job.job_id || job.id).catch(console.error);
  }

  async function createImage() {
    const file = qs("#videoImageInput")?.files?.[0];
    if (!file) return alert("Lütfen bir resim seç.");

    const payload = {
      app: "video",
      mode: "image",
      prompt: (qs("#videoImagePrompt")?.value || "").trim(),
      duration: Number(qs("#videoDuration")?.value || 8),
      resolution: Number(qs("#videoResolution")?.value || 720),
      ratio: qs("#videoRatio")?.value || "16:9",
      audio: !!qs("#audioEnabled")?.checked,
    };
    console.log("[video] file selected:", file.name);


    const j = await postJSON("/api/providers/runway/video/create", payload);
    const job = j.job || j;
    job.app = "video";

    window.AIVO_JOBS?.upsert?.(job);
    console.log("[video] created(image)", job);

    pollJob(job.job_id || job.id).catch(console.error);
  }

  document.addEventListener(
    "click",
    (e) => {
      if (e.target.closest("#videoGenerateTextBtn")) {
        e.preventDefault();

        createText().catch((err) => {
          console.error(err);
          alert(String(err));
        });
        return;
      }

      if (e.target.closest("#videoGenerateImageBtn")) {
        e.preventDefault();

        createImage().catch((err) => {
          console.error(err);
          alert(String(err));
        });
      }
    },
    true
  );

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
