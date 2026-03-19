// FILE: js/photofx.module.js
console.log("[photofx.module] loaded ✅", new Date().toISOString());

(function () {
  if (window.__AIVO_PHOTOFX_MODULE__) return;
  window.__AIVO_PHOTOFX_MODULE__ = true;

  const QUALITY_CREDITS = {
    standard: 8,
    premium: 12,
  };

  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function qsa(sel, root = document) {
    return Array.from(root.querySelectorAll(sel));
  }

  function getRoot() {
    return document.querySelector('section.pfxPage[data-module="photofx"]');
  }

  function ensureHiddenInput(root, id, accept) {
    let input = qs(`#${id}`, root);
    if (input) return input;

    input = document.createElement("input");
    input.type = "file";
    input.id = id;
    input.accept = accept || "";
    input.hidden = true;
    root.appendChild(input);
    return input;
  }

  function ensureInfoNode(btn, id, emptyText) {
    let el = qs(`#${id}`);
    if (el) return el;

    el = document.createElement("div");
    el.id = id;
    el.className = "pfxUploadFileName";
    el.textContent = emptyText;
    btn.insertAdjacentElement("afterend", el);
    return el;
  }

  async function postJSON(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);
    if (!r.ok || !j) throw j?.error || `photofx_failed_${r.status}`;
    if (j.ok === false) throw j.error || "photofx_failed";
    return j;
  }

  async function uploadViaPresign(file) {
    const sign = await postJSON("/api/r2/presign-put", {
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      folder: "photofx",
    });

    const uploadUrl =
      sign.uploadUrl ||
      sign.presignedUrl ||
      sign.url ||
      sign.putUrl ||
      "";

    const publicUrl =
      sign.publicUrl ||
      sign.fileUrl ||
      sign.assetUrl ||
      sign.cdnUrl ||
      sign.finalUrl ||
      "";

    if (!uploadUrl || !publicUrl) {
      throw "photofx_upload_presign_invalid";
    }

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!put.ok) {
      throw `photofx_upload_put_failed_${put.status}`;
    }

    return publicUrl;
  }

  async function uploadFile(file) {
    if (!file) return "";

    try {
      return await uploadViaPresign(file);
    } catch (e) {
      console.warn("[photofx] presign upload fallback:", e);

      const form = new FormData();
      form.append("file", file);

      const r = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });

      const j = await r.json().catch(() => null);
      if (!r.ok || !j) throw j?.error || `upload_failed_${r.status}`;
      if (j.ok === false) throw j.error || "upload_failed";

      return String(j.url || j.fileUrl || j.publicUrl || "");
    }
  }

  function setPromptCounter(root) {
    const ta = qs("#pfxPrompt", root);
    const count = qs("#pfxPromptCount", root);
    if (!ta || !count) return;

    count.textContent = String((ta.value || "").length);
  }

  function setActiveQuality(root, quality) {
    const q =
      String(quality || "standard").toLowerCase() === "premium"
        ? "premium"
        : "standard";

    qsa(".pfxChoiceCard", root).forEach((btn) => {
      const on = (btn.getAttribute("data-quality") || "") === q;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

    root.dataset.photofxQuality = q;

    const credit = QUALITY_CREDITS[q] || QUALITY_CREDITS.standard;

    const creditBox = qs(".pfxEngineCreditValue", root);
    if (creditBox) {
      creditBox.textContent = String(credit);
    }

    const createBtn = qs(".pfxCreateBtn", root);
    if (createBtn) {
      createBtn.setAttribute("data-credit-cost", String(credit));
      createBtn.textContent = `🎬 Klip Oluştur (${credit} Kredi)`;
    }

    console.log("[photofx] quality =", q, "credit =", credit);
  }

  function getSelectedPresets(root) {
    const raw = String(root.dataset.photofxPresets || "").trim();
    if (!raw) return [];
    return raw
      .split(",")
      .map((x) => String(x || "").trim())
      .filter(Boolean);
  }

  function setSelectedPresets(root, presets) {
    const clean = Array.from(
      new Set(
        (Array.isArray(presets) ? presets : [])
          .map((x) => String(x || "").trim())
          .filter(Boolean)
      )
    );

    root.dataset.photofxPresets = clean.join(",");

    qsa(".pfxPresetCard", root).forEach((btn) => {
      const value = String(btn.getAttribute("data-preset") || "").trim();
      const on = clean.includes(value);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

    console.log("[photofx] presets =", clean);
  }

  function togglePreset(root, preset) {
    const value = String(preset || "").trim();
    if (!value) return;

    const current = getSelectedPresets(root);
    const exists = current.includes(value);

    const next = exists
      ? current.filter((x) => x !== value)
      : [...current, value];

    setSelectedPresets(root, next);
  }

  function syncIncludeMusic(root) {
    const select = qs("#pfxIncludeMusic", root);
    const audioBtn = qs("#pfxAudioUploadBtn", root);
    const audioInput = qs("#pfxAudioInput", root);
    const audioName = qs("#pfxAudioName", root);

    if (!select || !audioBtn || !audioInput) return;

    const enabled = String(select.value || "no") === "yes";

    audioBtn.disabled = !enabled;
    audioBtn.classList.toggle("is-disabled", !enabled);
    audioInput.disabled = !enabled;

    if (!enabled) {
      audioInput.value = "";
      root.__photofxAudioFile = null;
      if (audioName) audioName.textContent = "Dosya seçilmedi";
    }
  }

  function bindUploadButtons(root) {
    const imageBtn = qs("#pfxInlineUploadBtn", root);
    const audioBtn = qs("#pfxAudioUploadBtn", root);
    const includeMusic = qs("#pfxIncludeMusic", root);

    const imageInput = ensureHiddenInput(root, "pfxImageInput", "image/*");
    const audioInput = ensureHiddenInput(root, "pfxAudioInput", "audio/*");

    const imageName = imageBtn
      ? ensureInfoNode(imageBtn, "pfxImageName", "Dosya seçilmedi")
      : null;

    const audioName = audioBtn
      ? ensureInfoNode(audioBtn, "pfxAudioName", "Dosya seçilmedi")
      : null;

    if (imageBtn && !imageBtn.__bound) {
      imageBtn.__bound = true;
      imageBtn.addEventListener("click", () => imageInput.click());
    }

    if (audioBtn && !audioBtn.__bound) {
      audioBtn.__bound = true;
      audioBtn.addEventListener("click", () => {
        if (audioBtn.disabled) return;
        audioInput.click();
      });
    }

    if (!imageInput.__bound) {
      imageInput.__bound = true;
      imageInput.addEventListener("change", () => {
        const file = imageInput.files?.[0] || null;
        root.__photofxImageFile = file;
        if (imageName) imageName.textContent = file ? file.name : "Dosya seçilmedi";
      });
    }

    if (!audioInput.__bound) {
      audioInput.__bound = true;
      audioInput.addEventListener("change", () => {
        const file = audioInput.files?.[0] || null;
        root.__photofxAudioFile = file;
        if (audioName) audioName.textContent = file ? file.name : "Dosya seçilmedi";
      });
    }

    if (includeMusic && !includeMusic.__bound) {
      includeMusic.__bound = true;
      includeMusic.addEventListener("change", () => syncIncludeMusic(root));
    }

    syncIncludeMusic(root);
  }

  function collectForm(root) {
    const selectedPresets = getSelectedPresets(root);

    return {
      prompt: (qs("#pfxPrompt", root)?.value || "").trim(),
      quality: root.dataset.photofxQuality || "standard",
      styles: selectedPresets,
      style: selectedPresets[0] || "neon-pulse",
      duration: qs("#pfxDuration", root)?.value || "10",
      ratio: qs("#pfxAspect", root)?.value || "9:16",
      motionLevel: qs("#pfxMotionLevel", root)?.value || "balanced",
      effectStrength: qs("#pfxEffectPower", root)?.value || "medium",
      colorMood: qs("#pfxColorMood", root)?.value || "original",
      transitionSpeed: qs("#pfxTransitionSpeed", root)?.value || "normal",
      includeAudio: (qs("#pfxIncludeMusic", root)?.value || "no") === "yes",
      imageFile: root.__photofxImageFile || null,
      audioFile: root.__photofxAudioFile || null,
    };
  }

  async function createPhotoFx() {
    const root = getRoot();
    if (!root) return;

    const form = collectForm(root);

    if (!form.prompt) {
      alert("Lütfen klip açıklamasını yaz.");
      return;
    }

    if (!form.imageFile) {
      alert("Lütfen bir ana görsel seç.");
      return;
    }

    if (!form.styles.length) {
      alert("Lütfen en az 1 efekt stili seç.");
      return;
    }

    const imageUrl = await uploadFile(form.imageFile);
    const audioUrl =
      form.includeAudio && form.audioFile ? await uploadFile(form.audioFile) : "";

    const providerVariant = form.quality === "premium" ? "pro" : "fast";

    const provider = await postJSON("/api/providers/fal/predictions/create?app=photofx", {
      input: {
        prompt: form.prompt,
        quality: providerVariant,
        style: form.style,
        styles: form.styles,
        image_url: imageUrl,
        start_image_url: imageUrl,
        audio_url: audioUrl || undefined,
        aspect_ratio: form.ratio,
        ratio: form.ratio,
        duration: form.duration,
        motion_level: form.motionLevel,
        effect_strength: form.effectStrength,
        color_mood: form.colorMood,
        transition_speed: form.transitionSpeed,
        include_audio: form.includeAudio,
      },
    });

    const videoUrl =
      provider.output ||
      provider.videoUrl ||
      provider.video_url ||
      provider.url ||
      provider.data?.video?.url ||
      provider.fal?.video?.url ||
      "";

    if (!videoUrl) {
      console.error("[photofx] provider response missing video url", provider);
      throw "photofx_generate_no_video";
    }

    const db = await postJSON("/api/photofx/generate", {
      prompt: form.prompt,
      styles: form.styles,
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

    if (db?.job_id) {
      window.dispatchEvent(
        new CustomEvent("aivo:photofx:job_created", {
          detail: {
            app: "photofx",
            job_id: db.job_id,
            prompt: form.prompt,
            styles: form.styles,
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
            createdAt: Date.now(),
          },
        })
      );
    }

    console.log("[photofx] create done ✅", {
      job_id: db?.job_id,
      styles: form.styles,
      videoUrl,
    });
  }

  function ensureDefaults(root) {
    if (!root.dataset.photofxQuality) {
      setActiveQuality(root, "standard");
    }

    if (!root.dataset.photofxPresets) {
      root.dataset.photofxPresets = "";
    }

    setPromptCounter(root);
    bindUploadButtons(root);
    setSelectedPresets(root, getSelectedPresets(root));
  }

  document.addEventListener(
    "input",
    (e) => {
      const root = getRoot();
      if (!root || !root.contains(e.target)) return;

      if (e.target.matches("#pfxPrompt")) {
        setPromptCounter(root);
      }
    },
    true
  );

  document.addEventListener(
    "click",
    (e) => {
      const root = getRoot();
      if (!root) return;

      const qualityBtn = e.target.closest(".pfxChoiceCard[data-quality]");
      if (qualityBtn && root.contains(qualityBtn)) {
        e.preventDefault();
        setActiveQuality(root, qualityBtn.getAttribute("data-quality"));
        return;
      }

      const presetBtn = e.target.closest(".pfxPresetCard[data-preset]");
      if (presetBtn && root.contains(presetBtn)) {
        e.preventDefault();
        togglePreset(root, presetBtn.getAttribute("data-preset"));
        return;
      }

      const createBtn = e.target.closest(".pfxCreateBtn");
      if (createBtn && root.contains(createBtn)) {
        e.preventDefault();

        const prev = createBtn.textContent;
        createBtn.disabled = true;
        createBtn.classList.add("is-loading");
        createBtn.textContent = "Üretiliyor...";

        createPhotoFx()
          .catch((err) => {
            console.error("[photofx] create error:", err);
            alert(String(err));
          })
          .finally(() => {
            createBtn.disabled = false;
            createBtn.classList.remove("is-loading");
            const credit = createBtn.getAttribute("data-credit-cost") || "8";
            createBtn.textContent = `🎬 Klip Oluştur (${credit} Kredi)`;
          });

        return;
      }
    },
    true
  );

  function boot() {
    const root = getRoot();
    if (!root) return;
    ensureDefaults(root);
  }

  boot();

  console.log("[PHOTOFX] module READY ✅");
})();
