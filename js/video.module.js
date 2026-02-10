console.log("[video.module] loaded ✅", new Date().toISOString());

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
(function videoTabSwitch_Resilient(){
  const ROOT_SEL = 'section[data-module="video"]';

  function findByText(root, text) {
    const all = root.querySelectorAll('button, a, div, span');
    const t = String(text).trim().toLowerCase();
    for (const el of all) {
      const s = (el.textContent || "").trim().toLowerCase();
      if (s === t) return el;
    }
    return null;
  }

  function pickViews(root){
    // Text view: içinde "Video açıklaması" textarea'sı olur
    let textView = null;
    const tas = Array.from(root.querySelectorAll("textarea"));
    for (const ta of tas) {
      const ph = (ta.getAttribute("placeholder") || "").toLowerCase();
      const lbl = (ta.closest("label")?.textContent || "").toLowerCase();
      if (ph.includes("video") || ph.includes("açıklama") || lbl.includes("video açıklaması")) {
        textView = ta.closest("section, .card, .panel, .subview, div") || ta.parentElement;
        break;
      }
    }

    // Image view: içinde file input (resim seç) veya dropzone olur
    let imageView = null;
    const file = root.querySelector('input[type="file"]');
    if (file) imageView = file.closest("section, .card, .panel, .subview, div") || file.parentElement;

    // Fallback: iki büyük blok bul (form benzeri)
    if (!textView || !imageView) {
      const candidates = Array.from(root.querySelectorAll("section, .card, .panel, .subview, div"))
        .filter(el => el.querySelector("textarea") || el.querySelector('input[type="file"]'));
      // en iyi tahmin: textarea olan = text, file olan = image
      if (!textView) textView = candidates.find(el => el.querySelector("textarea")) || null;
      if (!imageView) imageView = candidates.find(el => el.querySelector('input[type="file"]')) || null;
    }

    return { textView, imageView };
  }

  function bindOnce(){
    const root = document.querySelector(ROOT_SEL);
    if (!root) return false;

    // tab elementleri: "Yazıdan Video" / "Resimden Video"
    const tabText = findByText(root, "Yazıdan Video");
    const tabImage = findByText(root, "Resimden Video");
    if (!tabText || !tabImage) return false;

    const { textView, imageView } = pickViews(root);
    if (!textView || !imageView) return false;

    if (root.__videoSwitchBound) return true;
    root.__videoSwitchBound = true;

    function setMode(mode){
      const isText = mode === "text";
      tabText.classList.toggle("is-active", isText);
      tabImage.classList.toggle("is-active", !isText);

      textView.style.display = isText ? "" : "none";
      imageView.style.display = !isText ? "" : "none";

      root.dataset.videoMode = mode;
    }

    tabText.addEventListener("click", (e)=>{ e.preventDefault(); setMode("text"); });
    tabImage.addEventListener("click", (e)=>{ e.preventDefault(); setMode("image"); });

    // default (önceki seçimi hatırla)
    setMode(root.dataset.videoMode || "text");
    console.log("[video.switch] bound ✅", { tabText, tabImage, textView, imageView });
    return true;
  }

  // router render sonrası da yakalamak için: birkaç kez dene + DOM observer
  let tries = 0;
  const timer = setInterval(() => {
    tries++;
    if (bindOnce() || tries > 20) clearInterval(timer);
  }, 250);

  const obs = new MutationObserver(() => bindOnce());
  obs.observe(document.documentElement, { childList: true, subtree: true });
})();
function setVideoMode(mode) {
  const root = document.querySelector('section[data-module="video"]');
  if (!root) return;

  const btnText  = root.querySelector(".videoTabText, .tabText, [data-tab='text']");
  const btnImage = root.querySelector(".videoTabImage, .tabImage, [data-tab='image']");

  // kritik: subview'lar
  const viewText  = root.querySelector(".videoViewText, .viewText, [data-view='text']");
  const viewImage = root.querySelector(".videoViewImage, .viewImage, [data-view='image']");

  console.log("[video] setMode", mode, { viewText: !!viewText, viewImage: !!viewImage });

  const isText = mode === "text";

  btnText?.classList.toggle("is-active", isText);
  btnImage?.classList.toggle("is-active", !isText);

  // asıl iş: içerik görünürlüğü
  if (viewText)  viewText.style.display  = isText ? "" : "none";
  if (viewImage) viewImage.style.display = !isText ? "" : "none";
}
