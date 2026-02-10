// DEV: kredi yemeden UI kanıtı
window.__AIVO_DEV_STUB_VIDEO__ = true;

async function onCreateVideoClick() {
  if (window.__AIVO_DEV_STUB_VIDEO__) {
    const url = "/media/hero-video.mp4"; // repoda var (media/hero-video.mp4)
    const out = {
      type: "video",
      url,
      meta: { app: "video", stub: true },
    };

    // RightPanel video PPE bridge bunu yakalayacak
    if (window.PPE?.apply) {
      window.PPE.apply({
        state: "COMPLETED",
        outputs: [out],
      });
    } else {
      console.warn("PPE yok: window.PPE.apply bulunamadı");
    }

    // İstersen toast/log
    console.log("[DEV_STUB] video output basıldı:", out);
    return;
  }

  // ... mevcut gerçek create akışın burada kalsın (şimdilik dokunma)
}

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
      await new Promise(r => setTimeout(r, 2000));

      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}`);
      const j = await r.json().catch(() => null);
      if (!j || !j.ok) continue;

      if (j.status === "ready" && Array.isArray(j.outputs) && j.outputs.length) {
        window.PPE?.apply({
          state: "COMPLETED",
          outputs: j.outputs
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

    const j = await postJSON("/api/providers/runway/video/create", payload);
    const job = j.job || j;
    job.app = "video";

    window.AIVO_JOBS?.upsert?.(job);
    console.log("[video] created(image)", job);

    pollJob(job.job_id || job.id).catch(console.error);
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#videoGenerateTextBtn")) {
      e.preventDefault();
      createText().catch(err => {
        console.error(err);
        alert(String(err));
      });
      return;
    }

    if (e.target.closest("#videoGenerateImageBtn")) {
      e.preventDefault();
      createImage().catch(err => {
        console.error(err);
        alert(String(err));
      });
    }
  }, true);

  console.log("[VIDEO] module READY (create + poll + PPE)");
})();
