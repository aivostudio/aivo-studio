(function () {
  function tryInit() {
    const host = document.getElementById("moduleHost");
    if (!host) return false;

    // video module bazen host içinde section[data-module="video"], bazen direkt host üstünde duruyor.
    const module =
      host.querySelector("section[data-module='video']") ||
      host.querySelector("[data-module='video']") ||
      (host.getAttribute("data-active-module") === "video" ? host : null);

    if (!module) return false;

    const tabs = Array.from(module.querySelectorAll("[data-video-tab]"));
    const subviews = Array.from(module.querySelectorAll("[data-video-subview]"));

    if (!tabs.length || !subviews.length) return false;

    function setTab(key) {
      tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.videoTab === key));
      subviews.forEach((sv) => {
        const on = sv.dataset.videoSubview === key;
        sv.classList.toggle("is-active", on);
        // CSS yoksa bile çalışsın diye:
        sv.style.display = on ? "" : "none";
      });
      try { sessionStorage.setItem("aivo_video_tab", key); } catch(e) {}
    }

    // default
    let saved = "text";
    try { saved = sessionStorage.getItem("aivo_video_tab") || "text"; } catch(e) {}
    setTab(saved);

    // idempotent bind
    if (!module.__aivo_video_bound) {
      module.__aivo_video_bound = true;
      module.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-video-tab]");
        if (!btn) return;
        setTab(btn.dataset.videoTab);
      });
      console.log("[AIVO] video.module READY", { tabs: tabs.length, subviews: subviews.length });
    }

    return true;
  }

  if (tryInit()) return;

  const host = document.getElementById("moduleHost");
  if (!host) return;

  const obs = new MutationObserver(() => {
    if (tryInit()) obs.disconnect();
  });

  obs.observe(host, { childList: true, subtree: true });
})();
setInterval(() => {
  const module = document.querySelector("#moduleHost section[data-module='video']");
  if (!module) return;

  if (module.__videoBound) return;
  module.__videoBound = true;

  const tabs = [...module.querySelectorAll("[data-video-tab]")];
  const subviews = [...module.querySelectorAll("[data-video-subview]")];

  function setTab(key) {
    tabs.forEach(t => t.classList.toggle("is-active", t.dataset.videoTab === key));
    subviews.forEach(sv => {
      const on = sv.dataset.videoSubview === key;
      sv.classList.toggle("is-active", on);
      sv.style.display = on ? "" : "none";
    });
  }

  module.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-video-tab]");
    if (!btn) return;
    setTab(btn.dataset.videoTab);
  });

  setTab("text");
  console.log("[VIDEO] module bound OK");
}, 500);
// --- PATCH: Video Generate Buttons -> Runway create (Text + Image) ---
// video.module.js dosyasının EN ALTINA EKLE

(function () {
  if (window.__AIVO_VIDEO_CREATE_PATCH__) return;
  window.__AIVO_VIDEO_CREATE_PATCH__ = true;

  function qs(sel, root = document) { return root.querySelector(sel); }

  async function postJSON(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw j?.error || `create_failed (${r.status})`;
    return j;
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

    if (window.AIVO_JOBS?.upsert) window.AIVO_JOBS.upsert(job);
    console.log("[video] created(text)", job);
  }

  async function createImage() {
    const file = qs("#videoImageInput")?.files?.[0];
    if (!file) return alert("Lütfen bir resim seç.");

    // Eğer backend JSON bekliyorsa, önce sadece “file name + prompt” ile test edelim.
    // Şimdilik multipart göndermiyoruz; “hiçbir şey olmuyor” sorununu önce bitirelim.
    const payload = {
      app: "video",
      mode: "image",
      prompt: (qs("#videoImagePrompt")?.value || "").trim(),
      duration: Number(qs("#videoDuration")?.value || 8),
      resolution: Number(qs("#videoResolution")?.value || 720),
      ratio: qs("#videoRatio")?.value || "16:9",
      audio: !!qs("#audioEnabled")?.checked,
      // image: ???  (bunu bir sonraki adımda backend’e göre netleştiririz)
    };

    const j = await postJSON("/api/providers/runway/video/create", payload);
    const job = j.job || j;

    if (window.AIVO_JOBS?.upsert) window.AIVO_JOBS.upsert(job);
    console.log("[video] created(image)", job);
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("#videoGenerateTextBtn");
    if (t) {
      e.preventDefault();
      createText().catch(err => {
        console.error("[video] text create failed:", err);
        alert(String(err || "create_failed"));
      });
      return;
    }

    const i = e.target.closest("#videoGenerateImageBtn");
    if (i) {
      e.preventDefault();
      createImage().catch(err => {
        console.error("[video] image create failed:", err);
        alert(String(err || "create_failed"));
      });
    }
  }, true);

  console.log("[video] create patch active");
})();
