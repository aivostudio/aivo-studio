// FILE: studio.modules/photofx.module.js
console.log("[photofx.module] loaded ✅", new Date().toISOString());

(function () {
  if (window.__AIVO_PHOTOFX_MODULE__) return;
  window.__AIVO_PHOTOFX_MODULE__ = true;

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function getRoot() {
    return document.querySelector('section.main-panel[data-module="photofx"]');
  }

  function postJSON(url, payload) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then(async (r) => {
      const j = await r.json().catch(() => null);
      if (!r.ok || !j) throw j?.error || `photofx_failed_${r.status}`;
      if (j.ok === false) throw j.error || "photofx_failed";
      return j;
    });
  }

  function setActiveStyle(root, style) {
    if (!root || !style) return;

    qsa(".photofx-style-card", root).forEach((el) => {
      const on = (el.getAttribute("data-style") || "") === style;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });

    qsa(".photofx-style-pill", root).forEach((el) => {
      const on = (el.getAttribute("data-style") || "") === style;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });

    root.dataset.photofxStyle = style;
    console.log("[photofx] style =", style);
  }

  function setActiveQuality(root, quality) {
    if (!root) return;

    const q = String(quality || "standard").toLowerCase() === "premium"
      ? "premium"
      : "standard";

    qsa(".photofx-quality-card", root).forEach((el) => {
      const on = (el.getAttribute("data-quality") || "") === q;
      el.classList.toggle("is-active", on);
      el.setAttribute("aria-pressed", on ? "true" : "false");
    });

    root.dataset.photofxQuality = q;

    const activeBtn = root.querySelector(`.photofx-quality-card[data-quality="${CSS.escape(q)}"]`);
    const credit =
      Number(activeBtn?.getAttribute("data-credit-cost") || (q === "premium" ? 12 : 8)) ||
      (q === "premium" ? 12 : 8);

    const gen = qs("#photofxGenerateBtn", root);
    if (gen) {
      gen.setAttribute("data-credit-cost", String(credit));
      gen.textContent = `🎬 Klip Üret (${credit} Kredi)`;
    }

    const creditStrong = qs(".photofx-credit strong", root);
    if (creditStrong) {
      creditStrong.textContent = String(credit);
    }

    console.log("[photofx] quality =", q, "credit =", credit);
  }

  function bindPromptCounter() {
    const root = getRoot();
    if (!root) return;

    const promptEl = qs("#photofxPrompt", root);
    if (!promptEl || promptEl.__countBound) return;

    const counterEl =
      qs("#photofxPromptCount", root) ||
      qs('[data-role="photofxPromptCount"]', root);

    if (!counterEl) return;

    promptEl.__countBound = true;

    function update() {
      const n = (promptEl.value || "").length;
      counterEl.textContent = `${n} / 5000`;
    }

    promptEl.addEventListener("input", update);
    promptEl.addEventListener("change", update);
    update();
  }

  function bindImagePicker() {
    const root = getRoot();
    if (!root) return;

    const input = qs("#photofxImageInput", root);
    if (!input || input.__bound) return;
    input.__bound = true;

    input.addEventListener("change", () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      root.__photofxImageFile = file;

      const nameEl =
        qs("#photofxImageName", root) ||
        qs('[data-role="photofxImageName"]', root);

      if (nameEl) {
        nameEl.textContent = file ? file.name : "Dosya seçilmedi";
      }

      const preview = qs("#photofxImagePreview", root);
      if (preview && file) {
        const url = URL.createObjectURL(file);
        preview.src = url;
        preview.style.display = "";
      }

      console.log("[photofx] image selected =", file?.name || null);
    });
  }

  function bindAudioPicker() {
    const root = getRoot();
    if (!root) return;

    const input = qs("#photofxAudioInput", root);
    if (!input || input.__bound) return;
    input.__bound = true;

    input.addEventListener("change", () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      root.__photofxAudioFile = file;

      const nameEl =
        qs("#photofxAudioName", root) ||
        qs('[data-role="photofxAudioName"]', root);

      if (nameEl) {
        nameEl.textContent = file ? file.name : "Dosya seçilmedi";
      }

      console.log("[photofx] audio selected =", file?.name || null);
    });
  }

  function bindAudioToggle() {
    const root = getRoot();
    if (!root) return;

    const yes = qs('input[name="photofxIncludeAudio"][value="yes"]', root);
    const no = qs('input[name="photofxIncludeAudio"][value="no"]', root);
    const audioInput = qs("#photofxAudioInput", root);
    const audioWrap =
      qs(".photofx-audio-upload", root) ||
      qs('[data-role="photofxAudioUpload"]', root);

    function sync() {
      const includeAudio = !!yes?.checked;

      if (audioInput) {
        audioInput.disabled = !includeAudio;
      }

      if (audioWrap) {
        audioWrap.classList.toggle("is-disabled", !includeAudio);
      }

      if (!includeAudio) {
        root.__photofxAudioFile = null;

        if (audioInput) audioInput.value = "";

        const nameEl =
          qs("#photofxAudioName", root) ||
          qs('[data-role="photofxAudioName"]', root);

        if (nameEl) {
          nameEl.textContent = "Dosya seçilmedi";
        }
      }

      console.log("[photofx] includeAudio =", includeAudio);
    }

    if (yes && !yes.__bound) {
      yes.__bound = true;
      yes.addEventListener("change", sync);
    }

    if (no && !no.__bound) {
      no.__bound = true;
      no.addEventListener("change", sync);
    }

    sync();
  }

  function collectPhotoFxForm(root) {
    const prompt = (qs("#photofxPrompt", root)?.value || "").trim();
    const style = root.dataset.photofxStyle || "";
    const quality = root.dataset.photofxQuality || "standard";
    const duration = qs("#photofxDuration", root)?.value || "10";
    const ratio = qs("#photofxRatio", root)?.value || "9:16";
    const motionLevel = qs("#photofxMotionLevel", root)?.value || "medium";
    const effectStrength = qs("#photofxEffectStrength", root)?.value || "medium";
    const colorMood = qs("#photofxColorMood", root)?.value || "neutral";
    const transitionSpeed = qs("#photofxTransitionSpeed", root)?.value || "normal";

    const includeAudio =
      !!qs('input[name="photofxIncludeAudio"][value="yes"]', root)?.checked;

    const imageFile = root.__photofxImageFile || null;
    const audioFile = root.__photofxAudioFile || null;

    return {
      prompt,
      style,
      quality,
      duration,
      ratio,
      motionLevel,
      effectStrength,
      colorMood,
      transitionSpeed,
      includeAudio,
      imageFile,
      audioFile,
    };
  }

  async function uploadFile(file) {
    if (!file) return "";

    const form = new FormData();
    form.append("file", file);

    const r = await fetch("/api/upload", {
      method: "POST",
      body: form,
    });

    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw j?.error || `upload_failed_${r.status}`;
    if (j.ok === false) throw j.error || "upload_failed";

    return String(j.url || j.fileUrl || "");
  }

  async function createPhotoFx() {
    const root = getRoot();
    if (!root) return;

    const form = collectPhotoFxForm(root);

    if (!form.prompt) {
      alert("Lütfen efekt açıklaması yaz.");
      return;
    }

    if (!form.imageFile) {
      alert("Lütfen bir görsel seç.");
      return;
    }

    const imageUrl = await uploadFile(form.imageFile);
    const audioUrl = form.includeAudio && form.audioFile
      ? await uploadFile(form.audioFile)
      : "";

    const providerQuality = form.quality === "premium" ? "pro" : "fast";

    console.log("[photofx] generate request", {
      ...form,
      imageUrl,
      audioUrl,
      providerQuality,
    });

    const provider = await postJSON("/api/providers/fal/predictions/create?app=photofx", {
      input: {
        prompt: form.prompt,
        image_url: imageUrl,
        audio_url: audioUrl || undefined,
        quality: providerQuality,
        ratio: form.ratio,
        duration: form.duration,
        motion_level: form.motionLevel,
        effect_strength: form.effectStrength,
        color_mood: form.colorMood,
        transition_speed: form.transitionSpeed,
        include_audio: form.includeAudio,
        style: form.style,
      },
    });

    const videoUrl =
      provider.output ||
      provider.videoUrl ||
      provider.video_url ||
      provider.url ||
      provider.fal?.video?.url ||
      provider.data?.video?.url ||
      "";

    if (!videoUrl) {
      console.error("[photofx] no video url from provider", provider);
      throw "photofx_generate_no_video";
    }

    const db = await postJSON("/api/photofx/generate", {
      prompt: form.prompt,
      style: form.style,
      quality: form.quality,
      ratio: form.ratio,
      duration: form.duration,
      motionLevel: form.motionLevel,
      effectStrength: form.effectStrength,
      colorMood: form.colorMood,
      transitionSpeed: form.transitionSpeed,
      includeAudio: form.includeAudio,
      imageUrl,
      audioUrl,
      videoUrl,
    });

    console.log("[photofx] db saved ✅", db);

    if (db?.job_id) {
      window.dispatchEvent(
        new CustomEvent("aivo:photofx:job_created", {
          detail: {
            app: "photofx",
            job_id: db.job_id,
            prompt: form.prompt,
            quality: form.quality,
            style: form.style,
            ratio: form.ratio,
            duration: form.duration,
            motionLevel: form.motionLevel,
            effectStrength: form.effectStrength,
            colorMood: form.colorMood,
            transitionSpeed: form.transitionSpeed,
            includeAudio: form.includeAudio,
            imageUrl,
            audioUrl,
            videoUrl,
            createdAt: Date.now(),
            meta: {
              app: "photofx",
              provider: "fal",
              providerQuality,
            },
          },
        })
      );
    }
  }

  document.addEventListener(
    "click",
    (e) => {
      const root = getRoot();
      if (!root) return;

      const qualityCard = e.target.closest(".photofx-quality-card");
      if (qualityCard && root.contains(qualityCard)) {
        e.preventDefault();
        const quality = qualityCard.getAttribute("data-quality") || "standard";
        setActiveQuality(root, quality);
        return;
      }

      const styleCard = e.target.closest(".photofx-style-card");
      if (styleCard && root.contains(styleCard)) {
        e.preventDefault();
        const style = styleCard.getAttribute("data-style");
        setActiveStyle(root, style);
        return;
      }

      const stylePill = e.target.closest(".photofx-style-pill");
      if (stylePill && root.contains(stylePill)) {
        e.preventDefault();
        const style = stylePill.getAttribute("data-style");
        setActiveStyle(root, style);
        return;
      }

      const gen = e.target.closest("#photofxGenerateBtn");
      if (gen && root.contains(gen)) {
        e.preventDefault();

        gen.disabled = true;
        const prev = gen.textContent;
        gen.textContent = "Üretiliyor...";
        gen.classList.add("is-loading");

        createPhotoFx()
          .catch((err) => {
            console.error("[photofx] createPhotoFx error:", err);
            alert(String(err));
          })
          .finally(() => {
            gen.disabled = false;
            gen.textContent = prev;
            gen.classList.remove("is-loading");
          });

        return;
      }
    },
    true
  );

  function ensureDefaults() {
    const root = getRoot();
    if (!root) return;

    const firstStyle = qs(".photofx-style-card[data-style]", root);
    if (firstStyle && !root.dataset.photofxStyle) {
      setActiveStyle(root, firstStyle.getAttribute("data-style"));
    }

    if (!root.dataset.photofxQuality) {
      setActiveQuality(root, "standard");
    }
  }

  function bindAll() {
    bindPromptCounter();
    bindImagePicker();
    bindAudioPicker();
    bindAudioToggle();
    ensureDefaults();
  }

  bindAll();

  new MutationObserver(() => {
    bindAll();
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  console.log("[PHOTOFX] module READY (style + quality + upload + create + DB)");
})();
