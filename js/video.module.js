/* =========================================================
   AIVO Studio v2 — Video Module (create + poll + PPE + tabs)
   File: /js/video.module.js
   ========================================================= */

(function AIVO_VIDEO_MODULE_FULL(){
  if (window.__AIVO_VIDEO_MODULE__) return;
  window.__AIVO_VIDEO_MODULE__ = true;

  console.log("[video.module] loaded ✅", new Date().toISOString());

  // ✅ DEV: kredi yemeden UI kanıtı
  // canlıya çıkınca false yap veya tamamen kaldır
  window.__AIVO_DEV_STUB_VIDEO__ = true;

  /* ---------------- utils ---------------- */
  const ROOT_SEL = 'section[data-module="video"]';
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const qs = (sel, root=document) => root.querySelector(sel);

  async function safeJson(res){
    try { return await res.json(); } catch { return null; }
  }

  async function postJSON(url, payload){
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const j = await safeJson(r);
    if (!r.ok) throw (j?.error || j || `create_failed_${r.status}`);
    if (!j) throw "create_failed_no_json";
    return j;
  }

  function applyOutputs(outputs){
    if (!Array.isArray(outputs) || !outputs.length) return false;
    if (!window.PPE?.apply) return false;

    window.PPE.apply({
      state: "COMPLETED",
      outputs
    });
    return true;
  }

  async function pollJob(job_id){
    // 120 * 2s = 240s
    for (let i = 0; i < 120; i++){
      await sleep(2000);

      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(job_id)}`, { cache:"no-store" });
      const j = await safeJson(r);
      if (!j || !j.ok) continue;

      // bazı backend'lerde outputs j.outputs veya j.job.outputs olabilir:
      const outputs = j.outputs || j?.job?.outputs || null;

      if ((j.status === "ready" || j.status === "completed" || j.status === "done") && Array.isArray(outputs) && outputs.length){
        // outputs meta.app yoksa burada set edelim (panel filtresi varsa kaçırmasın)
        const patched = outputs.map(o => ({
          ...o,
          meta: { ...(o.meta || {}), app: (o?.meta?.app || "video") }
        }));
        applyOutputs(patched);
        console.log("[video] poll ready ✅", { job_id, outputs: patched.length });
        return true;
      }
    }
    throw "video_poll_timeout";
  }

  /* ---------------- DEV STUB ---------------- */
  function devStubOutput(){
    const url = "/media/hero-video.mp4"; // repoda var: media/hero-video.mp4
    const out = {
      type: "video",
      url,
      meta: { app: "video", stub: true, title: "TEST Placeholder Video" },
    };

    // sağ panel video PPE bridge bunu yakalayacak
    if (window.PPE?.apply){
      window.PPE.apply({ state:"COMPLETED", outputs:[out] });
      console.log("[DEV_STUB] PPE.apply video ✅", out);
      return true;
    }

    // fallback: bazı kurulumlarda onOutput var
    if (window.PPE?.onOutput){
      window.PPE.onOutput({ app:"video" }, out);
      console.log("[DEV_STUB] PPE.onOutput video ✅", out);
      return true;
    }

    console.warn("[DEV_STUB] PPE yok: window.PPE.apply/onOutput bulunamadı");
    return false;
  }

  /* ---------------- create handlers ---------------- */
  async function createText(){
    if (window.__AIVO_DEV_STUB_VIDEO__) {
      devStubOutput();
      return;
    }

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
    console.log("[video] created(text) ✅", job);

    pollJob(job.job_id || job.id).catch((err)=>{
      console.error("[video] poll fail", err);
      window.toast?.error?.("Video status timeout");
    });
  }

  async function createImage(){
    if (window.__AIVO_DEV_STUB_VIDEO__) {
      devStubOutput();
      return;
    }

    const file = qs("#videoImageInput")?.files?.[0];
    if (!file) return alert("Lütfen bir resim seç.");

    // NOTE: image mode endpoint'iniz FormData istiyorsa bunu değiştirmek gerekir.
    // Şimdilik JSON ile deniyoruz (senin mevcut akışına uygun).
    const payload = {
      app: "video",
      mode: "image",
      // backend image upload bekliyorsa burada patlar; o durumda FormData’ya geçeceğiz
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
    console.log("[video] created(image) ✅", job);

    pollJob(job.job_id || job.id).catch((err)=>{
      console.error("[video] poll fail", err);
      window.toast?.error?.("Video status timeout");
    });
  }

  // ✅ Butonlar
  document.addEventListener("click", (e)=>{
    const btnText = e.target.closest("#videoGenerateTextBtn");
    if (btnText) {
      e.preventDefault();
      createText().catch(err => {
        console.error(err);
        alert(String(err));
      });
      return;
    }

    const btnImg = e.target.closest("#videoGenerateImageBtn");
    if (btnImg) {
      e.preventDefault();
      createImage().catch(err => {
        console.error(err);
        alert(String(err));
      });
      return;
    }
  }, true);

  console.log("[VIDEO] module READY (create + poll + PPE)");

  /* ---------------- Tabs Fix (text/image) ---------------- */
  (function VIDEO_TABS_FIX(){
    function bind(){
      const root = document.querySelector(ROOT_SEL);
      if (!root || root.__videoTabsBound) return;

      const tabText  = root.querySelector('[data-video-tab="text"]');
      const tabImage = root.querySelector('[data-video-tab="image"]');
      const viewText  = root.querySelector('[data-video-subview="text"]');
      const viewImage = root.querySelector('[data-video-subview="image"]');

      if (!tabText || !tabImage || !viewText || !viewImage) return;

      root.__videoTabsBound = true;

      function setMode(mode){
        const isText = mode === "text";

        tabText.classList.toggle("is-active", isText);
        tabImage.classList.toggle("is-active", !isText);

        viewText.classList.toggle("is-active", isText);
        viewImage.classList.toggle("is-active", !isText);

        // display garantisi (CSS bozulsa bile)
        viewText.style.display  = isText ? "" : "none";
        viewImage.style.display = !isText ? "" : "none";

        root.dataset.videoMode = mode;
        console.log("[video.tabs] mode =", mode);
      }

      tabText.addEventListener("click", (e)=>{ e.preventDefault(); setMode("text"); });
      tabImage.addEventListener("click", (e)=>{ e.preventDefault(); setMode("image"); });

      setMode(root.dataset.videoMode || "text");
      console.log("[video.tabs] bound ✅");
    }

    let tries = 0;
    const t = setInterval(()=>{ tries++; bind(); if (tries>30) clearInterval(t); }, 200);
    new MutationObserver(()=>bind()).observe(document.documentElement, {childList:true, subtree:true});
  })();

  /* ---------------- Force RightPanel(video) ---------------- */
  (function FORCE_VIDEO_RIGHT_PANEL(){
    function force(){
      if (window.RightPanel?.force) {
        window.RightPanel.force("video");
        console.log("[video] RightPanel.force(video) ✅");
        return true;
      }
      return false;
    }

    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (force() || tries > 20) clearInterval(t);
    }, 300);

    const root = document.querySelector(ROOT_SEL);
    if (root) {
      const obs = new MutationObserver(() => force());
      obs.observe(root, { attributes: true, attributeFilter: ["class", "style"] });
    }
  })();

})();
