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

  function getState(root) {
    if (!root) return null;

    if (!root.__photofxState) {
      root.__photofxState = {
        quality: "standard",
        presets: [],
        imageFile: null,
        audioFile: null,
      };
    }

    return root.__photofxState;
  }

 function ensureHiddenInput(root, id, accept) {
  let input = qs(`#${id}`, root);
  if (input) return input;

  input = document.createElement("input");
  input.type = "file";
  input.id = id;
  input.accept = accept || "";

  input.style.position = "absolute";
  input.style.left = "-9999px";
  input.style.top = "0";
  input.style.width = "1px";
  input.style.height = "1px";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";

  root.appendChild(input);
  return input;
}

  function ensureFileNameNode(root, btnId, infoId, emptyText) {
    const btn = qs(`#${btnId}`, root);
    if (!btn) return null;

    let info = qs(`#${infoId}`, root);
    if (info) return info;

    const wrap = btn.closest(".pfxUploadTool") || btn.parentElement || root;

    info = document.createElement("div");
    info.id = infoId;
    info.className = "pfxUploadFileName";
    info.textContent = emptyText;

    wrap.appendChild(info);
    return info;
  }

  function getSelectedPresets(root) {
    const state = getState(root);
    return Array.isArray(state?.presets) ? state.presets : [];
  }

  function setPromptCounter(root) {
    const ta = qs("#pfxPrompt", root);
    const count = qs("#pfxPromptCount", root);
    if (!ta || !count) return;

    count.textContent = String((ta.value || "").length);
  }

  function renderQuality(root) {
    const state = getState(root);
    const quality = state?.quality === "premium" ? "premium" : "standard";
    const credit = QUALITY_CREDITS[quality] || QUALITY_CREDITS.standard;

    qsa(".pfxChoiceCard[data-quality]", root).forEach((btn) => {
      const on = String(btn.getAttribute("data-quality") || "") === quality;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });

    const creditValue = qs(".pfxEngineCreditValue", root);
    if (creditValue) {
      creditValue.textContent = String(credit);
    }

    const createBtn = qs(".pfxCreateBtn", root);
    if (createBtn) {
      createBtn.setAttribute("data-credit-cost", String(credit));
      createBtn.textContent = `🎬 Klip Oluştur (${credit} Kredi)`;
    }
  }

  function renderPresets(root) {
    const selected = getSelectedPresets(root);

    qsa(".pfxPresetCard[data-preset]", root).forEach((btn) => {
      const preset = String(btn.getAttribute("data-preset") || "").trim();
      const on = selected.includes(preset);
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function renderUploads(root) {
    const state = getState(root);
    const imageName = ensureFileNameNode(root, "pfxInlineUploadBtn", "pfxImageName", "Dosya seçilmedi");
    const audioName = ensureFileNameNode(root, "pfxAudioUploadBtn", "pfxAudioName", "Dosya seçilmedi");

    if (imageName) {
      imageName.textContent = state.imageFile ? state.imageFile.name : "Dosya seçilmedi";
    }

    if (audioName) {
      audioName.textContent = state.audioFile ? state.audioFile.name : "Dosya seçilmedi";
    }
  }

  function syncIncludeMusic(root) {
    const state = getState(root);
    const includeMusic = qs("#pfxIncludeMusic", root);
    const audioBtn = qs("#pfxAudioUploadBtn", root);
    const audioInput = qs("#pfxAudioInput", root);
    const audioName = qs("#pfxAudioName", root);

    if (!includeMusic || !audioBtn || !audioInput) return;

    const enabled = String(includeMusic.value || "no") === "yes";

    audioBtn.disabled = !enabled;
    audioInput.disabled = !enabled;
    audioBtn.classList.toggle("is-disabled", !enabled);

    if (!enabled) {
      audioInput.value = "";
      state.audioFile = null;
      if (audioName) audioName.textContent = "Dosya seçilmedi";
    }
  }

  async function postJSON(url, payload) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);

    if (!r.ok || !j) {
      throw j?.error || `photofx_failed_${r.status}`;
    }

    if (j.ok === false) {
      throw j.error || "photofx_failed";
    }

    return j;
  }

  async function uploadViaPresign(file) {
    const sign = await postJSON("/api/r2/presign-put", {
      app: "photofx",
      kind: "asset",
      filename: file?.name || `photofx-${Date.now()}`,
      contentType: file?.type || "application/octet-stream",
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

      if (!r.ok || !j) {
        throw j?.error || `upload_failed_${r.status}`;
      }

      if (j.ok === false) {
        throw j.error || "upload_failed";
      }

      return String(j.url || j.fileUrl || j.publicUrl || "");
    }
  }

  function collectForm(root) {
    const state = getState(root);
    const selectedPresets = getSelectedPresets(root);

    return {
      prompt: String(qs("#pfxPrompt", root)?.value || "").trim(),
      quality: state.quality || "standard",
      styles: selectedPresets,
      style: selectedPresets[0] || "",
      duration: qs("#pfxDuration", root)?.value || "10",
      ratio: qs("#pfxAspect", root)?.value || "9:16",
      motionLevel: qs("#pfxMotionLevel", root)?.value || "balanced",
      effectStrength: qs("#pfxEffectPower", root)?.value || "medium",
      colorMood: qs("#pfxColorMood", root)?.value || "original",
      transitionSpeed: qs("#pfxTransitionSpeed", root)?.value || "normal",
      includeAudio: String(qs("#pfxIncludeMusic", root)?.value || "no") === "yes",
      imageFile: state.imageFile || null,
      audioFile: state.audioFile || null,
    };
  }

  async function createPhotoFx(root) {
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

    if (form.includeAudio && !form.audioFile) {
      alert("Müziği videoya dahil etmek için bir audio dosyası seç.");
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

  function initStateFromDOM(root) {
    const state = getState(root);
    if (!state) return;

    const activeQuality = qs(".pfxChoiceCard.is-active[data-quality]", root);
    state.quality = activeQuality?.getAttribute("data-quality") === "premium"
      ? "premium"
      : "standard";

    const activePresets = qsa(".pfxPresetCard.is-active[data-preset]", root)
      .map((btn) => String(btn.getAttribute("data-preset") || "").trim())
      .filter(Boolean);

    state.presets = Array.from(new Set(activePresets));
  }

  function boot() {
    const root = getRoot();
    if (!root) return;

    initStateFromDOM(root);

    ensureHiddenInput(root, "pfxImageInput", "image/*");
    ensureHiddenInput(root, "pfxAudioInput", "audio/*");

    ensureFileNameNode(root, "pfxInlineUploadBtn", "pfxImageName", "Dosya seçilmedi");
    ensureFileNameNode(root, "pfxAudioUploadBtn", "pfxAudioName", "Dosya seçilmedi");

    setPromptCounter(root);
    renderQuality(root);
    renderPresets(root);
    renderUploads(root);
    syncIncludeMusic(root);
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
    "change",
    (e) => {
      const root = getRoot();
      if (!root || !root.contains(e.target)) return;

      const state = getState(root);

      if (e.target.matches("#pfxIncludeMusic")) {
        syncIncludeMusic(root);
        return;
      }

      if (e.target.matches("#pfxImageInput")) {
        const file = e.target.files?.[0] || null;
        state.imageFile = file;
        renderUploads(root);
        console.log("[photofx] image selected =", file?.name || null);
        return;
      }

      if (e.target.matches("#pfxAudioInput")) {
        const file = e.target.files?.[0] || null;
        state.audioFile = file;
        renderUploads(root);
        console.log("[photofx] audio selected =", file?.name || null);
        return;
      }
    },
    true
  );

function bindEvents(root) {
  if (!root || root.__photofxEventsBound) return;
  root.__photofxEventsBound = true;

  const state = getState(root);

  const includeMusic = qs("#pfxIncludeMusic", root);
  const imageInput = qs("#pfxImageInput", root);
  const audioInput = qs("#pfxAudioInput", root);
  const imageBtn = qs("#pfxInlineUploadBtn", root);
  const audioBtn = qs("#pfxAudioUploadBtn", root);
  const createBtn = qs(".pfxCreateBtn", root);

  if (includeMusic && !includeMusic.__bound) {
    includeMusic.__bound = true;
    includeMusic.addEventListener("change", () => {
      syncIncludeMusic(root);
    });
  }

  if (imageBtn && imageInput && !imageBtn.__bound) {
    imageBtn.__bound = true;
    imageBtn.addEventListener("click", (e) => {
      e.preventDefault();
      imageInput.click();
    });
  }

  if (audioBtn && audioInput && !audioBtn.__bound) {
    audioBtn.__bound = true;
    audioBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (audioBtn.disabled) return;
      audioInput.click();
    });
  }

  if (imageInput && !imageInput.__bound) {
    imageInput.__bound = true;
    imageInput.addEventListener("change", () => {
      const file = imageInput.files?.[0] || null;
      state.imageFile = file;
      renderUploads(root);
      console.log("[photofx] image selected =", file?.name || null);
    });
  }

  if (audioInput && !audioInput.__bound) {
    audioInput.__bound = true;
    audioInput.addEventListener("change", () => {
      const file = audioInput.files?.[0] || null;
      state.audioFile = file;
      renderUploads(root);
      console.log("[photofx] audio selected =", file?.name || null);
    });
  }

  qsa(".pfxChoiceCard[data-quality]", root).forEach((btn) => {
    if (btn.__bound) return;
    btn.__bound = true;

    btn.addEventListener("click", (e) => {
      e.preventDefault();

      state.quality =
        btn.getAttribute("data-quality") === "premium"
          ? "premium"
          : "standard";

      renderQuality(root);
    });
  });

  qsa(".pfxPresetCard[data-preset]", root).forEach((btn) => {
    if (btn.__bound) return;
    btn.__bound = true;

    btn.addEventListener("click", (e) => {
      e.preventDefault();

      const preset = String(btn.getAttribute("data-preset") || "").trim();
      if (!preset) return;

      if (state.presets.includes(preset)) {
        state.presets = state.presets.filter((x) => x !== preset);
      } else {
        state.presets = [...state.presets, preset];
      }

      renderPresets(root);
    });
  });

  if (createBtn && !createBtn.__bound) {
    createBtn.__bound = true;
    createBtn.addEventListener("click", (e) => {
      e.preventDefault();

      const credit = createBtn.getAttribute("data-credit-cost") || "8";

      createBtn.disabled = true;
      createBtn.classList.add("is-loading");
      createBtn.textContent = "Üretiliyor...";

      createPhotoFx(root)
        .catch((err) => {
          console.error("[photofx] create error:", err);
          alert(String(err?.message || err || "photofx_create_failed"));
        })
        .finally(() => {
          createBtn.disabled = false;
          createBtn.classList.remove("is-loading");
          createBtn.textContent = `🎬 Klip Oluştur (${credit} Kredi)`;
        });
    });
  }
}

  boot();

  console.log("[PHOTOFX] module READY ✅");
})();
