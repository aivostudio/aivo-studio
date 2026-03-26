// FILE: js/photofx.module.js
console.log("[photofx.module] loaded ✅", new Date().toISOString());

(function () {
  if (window.__AIVO_PHOTOFX_MODULE__) return;
  window.__AIVO_PHOTOFX_MODULE__ = true;

  const QUALITY_CREDITS = {
    standard: 8,
    premium: 12,
  };

  const LONG_DURATION_VALUES = new Set(["12", "14", "16", "18", "20"]);

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
        endImageFile: null,
        logoFile: null,
        audioFile: null,
        audioFileName: "",
        audioFileUrl: "",
        audioFileUploadPromise: null,
        audioFileUploadStatus: "idle",
        audioFileUploadError: "",
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

  function ensureUploadMetaNode(root, btnId, infoId) {
    const btn = qs(`#${btnId}`, root);
    if (!btn) return null;

    let info = qs(`#${infoId}`, root);
    if (info) return info;

    const wrap = btn.closest(".pfxUploadTool") || btn.parentElement || root;

    info = document.createElement("div");
    info.id = infoId;
    info.className = "pfxUploadMeta";

    wrap.appendChild(info);
    return info;
  }

  function truncateName(name, max = 28) {
    const safe = String(name || "").trim();
    if (!safe) return "";
    if (safe.length <= max) return safe;
    return `${safe.slice(0, max - 1)}…`;
  }

  function renderUploadBadge(node, file, emptyText, clearKey) {
    if (!node) return;

    node.innerHTML = "";

    if (!file) {
      const empty = document.createElement("div");
      empty.className = "pfxUploadEmpty";
      empty.textContent = emptyText || "Dosya seçilmedi";
      node.appendChild(empty);
      return;
    }

    const chip = document.createElement("div");
    chip.className = "pfxUploadChip";

    const name = document.createElement("div");
    name.className = "pfxUploadChipName";
    name.title = file.name || "";
    name.textContent = truncateName(file.name || "");

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "pfxUploadChipClear";
    clearBtn.setAttribute("data-clear-upload", clearKey);
    clearBtn.setAttribute("aria-label", "Seçili dosyayı kaldır");
    clearBtn.textContent = "×";

    chip.appendChild(name);
    chip.appendChild(clearBtn);
    node.appendChild(chip);
  }

  function clearFileSelection(root, key) {
    const state = getState(root);
    if (!state) return;

    if (key === "image") {
      state.imageFile = null;
      const input = qs("#pfxImageInput", root);
      if (input) input.value = "";
    }

    if (key === "end-image") {
      state.endImageFile = null;
      const input = qs("#pfxEndImageInput", root);
      if (input) input.value = "";
    }

    if (key === "logo") {
      state.logoFile = null;
      const input = qs("#pfxLogoInput", root);
      if (input) input.value = "";
    }

    if (key === "audio") {
      state.audioFile = null;
      const input = qs("#pfxAudioInput", root);
      if (input) input.value = "";
    }

    renderUploads(root);
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

    const imageMeta = ensureUploadMetaNode(
      root,
      "pfxInlineUploadBtn",
      "pfxImageMeta"
    );

    const endImageMeta = ensureUploadMetaNode(
      root,
      "pfxEndImageUploadBtn",
      "pfxEndImageMeta"
    );

    const logoMeta = ensureUploadMetaNode(
      root,
      "pfxLogoUploadBtn",
      "pfxLogoMeta"
    );

    const audioMeta = ensureUploadMetaNode(
      root,
      "pfxAudioUploadBtn",
      "pfxAudioMeta"
    );

    renderUploadBadge(
      imageMeta,
      state.imageFile,
      "Dosya seçilmedi",
      "image"
    );

    renderUploadBadge(
      endImageMeta,
      state.endImageFile,
      "Dosya seçilmedi",
      "end-image"
    );

    renderUploadBadge(
      logoMeta,
      state.logoFile,
      "Dosya seçilmedi",
      "logo"
    );

    renderUploadBadge(
      audioMeta,
      state.audioFile,
      "Dosya seçilmedi",
      "audio"
    );
  }

  function syncIncludeMusic(root) {
    const includeMusic = qs("#pfxIncludeMusic", root);
    const audioBtn = qs("#pfxAudioUploadBtn", root);
    const audioInput = qs("#pfxAudioInput", root);

    if (!includeMusic || !audioBtn || !audioInput) return;

    const enabled = String(includeMusic.value || "no") === "yes";

    audioBtn.disabled = false;
    audioInput.disabled = false;
    audioBtn.classList.remove("is-disabled");

    audioBtn.dataset.includeMusicEnabled = enabled ? "yes" : "no";
    audioInput.dataset.includeMusicEnabled = enabled ? "yes" : "no";
  }

  function syncDurationRules(root) {
    const durationEl = qs("#pfxDuration", root);
    const resolutionEl = qs("#pfxResolution", root);
    const fpsEl = qs("#pfxFps", root);

    if (!durationEl || !resolutionEl || !fpsEl) return;

    const duration = String(durationEl.value || "6");

    if (LONG_DURATION_VALUES.has(duration)) {
      resolutionEl.value = "1080p";
      fpsEl.value = "25";
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
      throw new Error(j?.error || `photofx_failed_${r.status}`);
    }

    if (j.ok === false) {
      throw new Error(j.error || "photofx_failed");
    }

    return j;
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function isReadyStatus(s) {
    const v = String(s || "").toLowerCase();
    return (
      v === "ready" ||
      v === "done" ||
      v === "completed" ||
      v === "complete" ||
      v === "success" ||
      v === "succeeded"
    );
  }

  function pickPhotoFxVideoOutputs(outputs) {
    if (!Array.isArray(outputs)) return [];

    return outputs.filter((o) => {
      if (!o) return false;

      const type = String(
        o.type || o.kind || o?.meta?.type || ""
      ).toLowerCase();

      if (type && type !== "video") return false;

      const app = String(
        o?.meta?.app || o?.app || o?.module || ""
      ).toLowerCase();

      return !app || app === "photofx";
    });
  }

async function pollPhotoFxJob(job_id, opts = {}) {
  const POLL_MS = 2000;
  const POLL_MAX = 120;

  for (let i = 0; i < POLL_MAX; i++) {
    await sleep(POLL_MS);

    const r = await fetch(
      `/api/jobs/status?job_id=${encodeURIComponent(job_id)}&t=${Date.now()}`
    );
    const text = await r.text().catch(() => "");
    let j = null;

    try {
      j = text ? JSON.parse(text) : null;
    } catch (_) {
      j = null;
    }

    console.log("[photofx] poll =", j);

    if (!j || !j.ok) continue;

    const ready = isReadyStatus(j.status);
    const outs = pickPhotoFxVideoOutputs(j.outputs);
    const directVideoUrl = String(j?.video?.url || j?.video_url || "").trim();

    if (ready && (outs.length || directVideoUrl)) {
      const finalOutputs = outs.length
        ? outs.map((o) => ({
            ...o,
            meta: { ...(o.meta || {}), app: "photofx" },
          }))
        : [
            {
              type: "video",
              url: directVideoUrl,
              meta: { app: "photofx", variant: "provider", is_final: true },
            },
          ];

      const rawMeta = j?.raw?.meta || j?.meta || {};
      const wantsLogo =
        opts.wantsLogo === true ||
        !!(rawMeta?.logo_enabled && String(rawMeta?.logo_url || "").trim());

      const hasLogoOverlay = finalOutputs.some((o) => {
        const variant = String(o?.meta?.variant || "").toLowerCase().trim();
        return variant === "logo_overlay";
      });

 if (wantsLogo && !hasLogoOverlay) {
  const overlaySource =
    finalOutputs.find((o) => {
      const variant = String(o?.meta?.variant || "").toLowerCase().trim();
      return variant === "mux" || variant === "provider";
    })?.url || directVideoUrl;

  const logoUrl = String(rawMeta?.logo_url || "").trim();

  if (overlaySource && logoUrl) {
    const overlayRes = await fetch("/api/photofx/overlay-logo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_id,
        video_url: overlaySource,
        logo_url: logoUrl,
        logo_pos: String(rawMeta?.logo_pos || "br").trim(),
        logo_size: String(rawMeta?.logo_size || "sm").trim(),
        logo_opacity: Number(rawMeta?.logo_opacity ?? 0.85),
      }),
    });

    const overlayJson = await overlayRes.json().catch(() => null);
    console.log("[photofx] overlay logo =", overlayJson);

    if (overlayRes.ok && overlayJson?.ok) {
      const rr = await fetch(
        `/api/jobs/status?job_id=${encodeURIComponent(job_id)}&t=${Date.now()}`
      );
      const rtext = await rr.text().catch(() => "");
      let refreshed = null;

      try {
        refreshed = rtext ? JSON.parse(rtext) : null;
      } catch (_) {
        refreshed = null;
      }

      console.log("[photofx] refreshed after overlay =", refreshed);

      if (refreshed?.ok) {
        const refreshedOuts = pickPhotoFxVideoOutputs(refreshed.outputs);
        const refreshedDirectVideoUrl = String(
          refreshed?.video?.url || refreshed?.video_url || overlayJson.url || ""
        ).trim();

        const refreshedFinalOutputs = refreshedOuts.length
          ? refreshedOuts.map((o) => ({
              ...o,
              meta: { ...(o.meta || {}), app: "photofx" },
            }))
          : [
              {
                type: "video",
                url: refreshedDirectVideoUrl,
                meta: { app: "photofx", variant: "logo_overlay", is_final: false },
              },
            ];

        window.dispatchEvent(
          new CustomEvent("aivo:photofx:job_ready", {
            detail: {
              app: "photofx",
              job_id,
              status: String(refreshed.status || "ready").toLowerCase(),
              video: refreshedDirectVideoUrl ? { url: refreshedDirectVideoUrl } : null,
              outputs: refreshedFinalOutputs,
              raw: refreshed,
            },
          })
        );
        return;
      }
    }
  }
}
      window.dispatchEvent(
        new CustomEvent("aivo:photofx:job_ready", {
          detail: {
            app: "photofx",
            job_id,
            status: String(j.status || "").toLowerCase(),
            video: directVideoUrl ? { url: directVideoUrl } : null,
            outputs: finalOutputs,
            raw: j,
          },
        })
      );

      return;
    }

    if (String(j.status || "").toLowerCase() === "error") {
      throw new Error(j.error || "photofx_job_error");
    }
  }

  throw new Error("photofx_poll_timeout");
}

  async function uploadViaPresign(file, kind = "asset") {
    if (!file) {
      throw new Error("photofx_missing_file");
    }

    const res = await fetch("/api/r2/presign-put", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: "photofx",
        kind,
        filename: file?.name || `photofx-${Date.now()}`,
        contentType: file?.type || "application/octet-stream",
        folder: "photofx",
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.error || "photofx_presign_failed");
    }

    const uploadUrl =
      data.uploadUrl ||
      data.upload_url ||
      data.presignedUrl ||
      data.presigned_url ||
      data.putUrl ||
      data.put_url ||
      "";

    const publicUrl =
      data.publicUrl ||
      data.public_url ||
      data.fileUrl ||
      data.file_url ||
      data.url ||
      "";

    if (!uploadUrl || !publicUrl) {
      throw new Error("photofx_upload_presign_invalid");
    }

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!put.ok) {
      throw new Error(`photofx_upload_put_failed_${put.status}`);
    }

    return String(publicUrl).trim();
  }

  async function uploadFile(file, kind = "asset") {
    if (!file) return "";
    return await uploadViaPresign(file, kind);
  }

  function collectForm(root) {
    const state = getState(root);
    const selectedPresets = getSelectedPresets(root);

    return {
      prompt: String(qs("#pfxPrompt", root)?.value || "").trim(),
      quality: state.quality || "standard",
      styles: selectedPresets,
      style: selectedPresets[0] || "",
      duration: qs("#pfxDuration", root)?.value || "6",
      ratio: qs("#pfxAspect", root)?.value || "9:16",
      resolution: qs("#pfxResolution", root)?.value || "1080p",
      fps: qs("#pfxFps", root)?.value || "25",
      motionLevel: qs("#pfxMotionLevel", root)?.value || "balanced",
      effectStrength: qs("#pfxEffectPower", root)?.value || "medium",
      colorMood: qs("#pfxColorMood", root)?.value || "original",
      transitionSpeed: qs("#pfxTransitionSpeed", root)?.value || "normal",
      includeAudio:
        String(qs("#pfxIncludeMusic", root)?.value || "no") === "yes",
      imageFile: state.imageFile || null,
      endImageFile: state.endImageFile || null,
      logoFile: state.logoFile || null,
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

    if (LONG_DURATION_VALUES.has(String(form.duration || ""))) {
      form.resolution = "1080p";
      form.fps = "25";
    }

    const imageUrl = await uploadFile(form.imageFile, "image");
    const endImageUrl = form.endImageFile
      ? await uploadFile(form.endImageFile, "end-image")
      : "";
    const logoUrl = form.logoFile
      ? await uploadFile(form.logoFile, "logo")
      : "";
    const audioUrl =
      form.includeAudio && form.audioFile
        ? await uploadFile(form.audioFile, "audio")
        : "";

    const providerVariant = form.quality === "premium" ? "pro" : "fast";
    const providerModel =
      providerVariant === "pro"
        ? "fal-ai/ltx-2.3/image-to-video"
        : "fal-ai/ltx-2.3/image-to-video/fast";

    const providerPayload = {
      prompt: form.prompt,
      quality: form.quality,
      preset: form.style,
      styles: form.styles,
      image_url: imageUrl,
      end_image_url: endImageUrl || undefined,
      audio_url: audioUrl || undefined,
      aspect_ratio: form.ratio,
      duration: Number(form.duration || 6),
      resolution: form.resolution,
      fps: Number(form.fps || 25),
      motion_level: form.motionLevel,
      effect_strength: form.effectStrength,
      color_mood: form.colorMood,
      transition_speed: form.transitionSpeed,
      include_audio: form.includeAudio,
      meta: {
        app: "photofx",
        provider_variant: providerVariant,
        provider_model: providerModel,
        styles: form.styles,
        include_audio: form.includeAudio,
        duration: Number(form.duration || 6),
        resolution: form.resolution,
        fps: Number(form.fps || 25),
        aspect_ratio: form.ratio,
        end_image_url: endImageUrl || "",
        logo_enabled: !!logoUrl,
        logo_name: form.logoFile?.name || "",
        logo_url: logoUrl || "",
        audio_url: audioUrl || "",
        music_url: audioUrl || "",
      },
    };

    const provider = await postJSON(
      "/api/providers/fal/photofx/create",
      providerPayload
    );

    const finalJobId = String(provider?.job_id || "").trim();
    const statusUrl = String(provider?.status_url || "").trim();
    const requestId = String(provider?.request_id || "").trim();

    if (!finalJobId) {
      console.error("[photofx] provider response missing job id", provider);
      throw new Error("photofx_generate_no_job_id");
    }

    window.dispatchEvent(
      new CustomEvent("aivo:photofx:job_created", {
        detail: {
          app: "photofx",
          job_id: finalJobId,
          createdAt: Date.now(),
          meta: {
            app: "photofx",
            prompt: form.prompt,
            styles: form.styles,
            style: form.style,
            quality: form.quality,
            ratio: form.ratio,
            duration: form.duration,
            resolution: form.resolution,
            fps: form.fps,
            motionLevel: form.motionLevel,
            effectStrength: form.effectStrength,
            colorMood: form.colorMood,
            transitionSpeed: form.transitionSpeed,
            includeAudio: form.includeAudio,
            imageUrl,
            endImageUrl,
            logoUrl,
            audioUrl,
            provider: "fal",
            provider_variant: providerVariant,
            provider_model: providerModel,
            request_id: requestId,
            status_url: statusUrl,
            logo_enabled: !!logoUrl,
            logo_name: form.logoFile?.name || "",
          },
        },
      })
    );

    console.log("[photofx] create queued ✅", {
      finalJobId,
      requestId,
      statusUrl,
      styles: form.styles,
      duration: form.duration,
      resolution: form.resolution,
      fps: form.fps,
      ratio: form.ratio,
      endImageUrl,
      logoUrl,
    });

pollPhotoFxJob(finalJobId, {
  wantsLogo: !!logoUrl,
}).catch((err) => {
      console.error("[photofx] poll error:", err);
    });
  }

  function initStateFromDOM(root) {
    const state = getState(root);
    if (!state) return;

    const activeQuality = qs(".pfxChoiceCard.is-active[data-quality]", root);
    state.quality =
      activeQuality?.getAttribute("data-quality") === "premium"
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
    ensureHiddenInput(root, "pfxEndImageInput", "image/*");
    ensureHiddenInput(root, "pfxLogoInput", "image/*");
    ensureHiddenInput(root, "pfxAudioInput", "audio/*");

    ensureUploadMetaNode(root, "pfxInlineUploadBtn", "pfxImageMeta");
    ensureUploadMetaNode(root, "pfxEndImageUploadBtn", "pfxEndImageMeta");
    ensureUploadMetaNode(root, "pfxLogoUploadBtn", "pfxLogoMeta");
    ensureUploadMetaNode(root, "pfxAudioUploadBtn", "pfxAudioMeta");

    setPromptCounter(root);
    renderQuality(root);
    renderPresets(root);
    renderUploads(root);
    syncIncludeMusic(root);
    syncDurationRules(root);
    bindEvents(root);
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

      if (e.target.matches("#pfxDuration")) {
        syncDurationRules(root);
        return;
      }

      if (e.target.matches("#pfxImageInput")) {
        const file = e.target.files?.[0] || null;
        state.imageFile = file;
        renderUploads(root);
        console.log("[photofx] image selected =", file?.name || null);
        return;
      }

      if (e.target.matches("#pfxEndImageInput")) {
        const file = e.target.files?.[0] || null;
        state.endImageFile = file;
        renderUploads(root);
        console.log("[photofx] end image selected =", file?.name || null);
        return;
      }

      if (e.target.matches("#pfxLogoInput")) {
        const file = e.target.files?.[0] || null;
        state.logoFile = file;
        renderUploads(root);
        console.log("[photofx] logo selected =", file?.name || null);
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
    const durationEl = qs("#pfxDuration", root);
    const imageInput = qs("#pfxImageInput", root);
    const endImageInput = qs("#pfxEndImageInput", root);
    const logoInput = qs("#pfxLogoInput", root);
    const audioInput = qs("#pfxAudioInput", root);

    const imageBtn = qs("#pfxInlineUploadBtn", root);
    const endImageBtn = qs("#pfxEndImageUploadBtn", root);
    const logoBtn = qs("#pfxLogoUploadBtn", root);
    const audioBtn = qs("#pfxAudioUploadBtn", root);

    const createBtn = qs(".pfxCreateBtn", root);

    if (includeMusic && !includeMusic.__bound) {
      includeMusic.__bound = true;
      includeMusic.addEventListener("change", () => {
        syncIncludeMusic(root);
      });
    }

    if (durationEl && !durationEl.__bound) {
      durationEl.__bound = true;
      durationEl.addEventListener("change", () => {
        syncDurationRules(root);
      });
    }

    if (imageBtn && imageInput && !imageBtn.__bound) {
      imageBtn.__bound = true;
      imageBtn.addEventListener("click", (e) => {
        e.preventDefault();
        imageInput.click();
      });
    }

    if (endImageBtn && endImageInput && !endImageBtn.__bound) {
      endImageBtn.__bound = true;
      endImageBtn.addEventListener("click", (e) => {
        e.preventDefault();
        endImageInput.click();
      });
    }

    if (logoBtn && logoInput && !logoBtn.__bound) {
      logoBtn.__bound = true;
      logoBtn.addEventListener("click", (e) => {
        e.preventDefault();
        logoInput.click();
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

    if (endImageInput && !endImageInput.__bound) {
      endImageInput.__bound = true;
      endImageInput.addEventListener("change", () => {
        const file = endImageInput.files?.[0] || null;
        state.endImageFile = file;
        renderUploads(root);
        console.log("[photofx] end image selected =", file?.name || null);
      });
    }

    if (logoInput && !logoInput.__bound) {
      logoInput.__bound = true;
      logoInput.addEventListener("change", () => {
        const file = logoInput.files?.[0] || null;
        state.logoFile = file;
        renderUploads(root);
        console.log("[photofx] logo selected =", file?.name || null);
      });
    }
if (audioInput && !audioInput.__bound) {
  audioInput.__bound = true;
  audioInput.addEventListener("change", async () => {
    const file = audioInput.files?.[0] || null;
    const audioMeta = ensureUploadMetaNode(root, "pfxAudioUploadBtn", "pfxAudioMeta");

    state.audioFile = null;
    state.audioFileName = file ? file.name : "";
    state.audioFileUrl = "";
    state.audioFileUploadPromise = null;
    state.audioFileUploadStatus = file ? "uploading" : "idle";
    state.audioFileUploadError = "";

    if (!file) {
      renderUploads(root);
      console.log("[photofx] audio selected =", null);
      return;
    }

    if (audioMeta) {
      audioMeta.innerHTML = "";
      const chip = document.createElement("div");
      chip.className = "pfxUploadChip";

      const name = document.createElement("div");
      name.className = "pfxUploadChipName";
      name.title = file.name || "";
      name.textContent = `${truncateName(file.name || "", 22)} · Yükleniyor...`;

      chip.appendChild(name);
      audioMeta.appendChild(chip);
    }

    console.log("[photofx] audio uploading =", file?.name || null);

    state.audioFileUploadPromise = uploadFile(file, "audio")
      .then((publicUrl) => {
        state.audioFile = file;
        state.audioFileUrl = String(publicUrl || "").trim();
        state.audioFileUploadStatus = "ready";
        state.audioFileUploadError = "";
        renderUploads(root);
        console.log("[photofx] audio ready =", state.audioFileUrl);
        return state.audioFileUrl;
      })
      .catch((err) => {
        state.audioFile = null;
        state.audioFileUrl = "";
        state.audioFileUploadStatus = "error";
        state.audioFileUploadError = String(
          err?.message || err || "photofx_audio_upload_failed"
        );

        if (audioMeta) {
          audioMeta.innerHTML = "";
          const chip = document.createElement("div");
          chip.className = "pfxUploadChip";

          const name = document.createElement("div");
          name.className = "pfxUploadChipName";
          name.title = file.name || "";
          name.textContent = `${truncateName(file.name || "", 20)} · Yükleme hatası`;

          chip.appendChild(name);
          audioMeta.appendChild(chip);
        }

        console.error("[photofx] audio upload error =", err);
        alert(state.audioFileUploadError);
        throw err;
      });
  });
}

    document.addEventListener(
      "click",
      (e) => {
        const nextRoot = getRoot();
        if (!nextRoot) return;

       const clearBtn = e.target.closest("[data-clear-upload]");
if (clearBtn && nextRoot.contains(clearBtn)) {
  e.preventDefault();
  e.stopPropagation();
  const clearKey = String(
    clearBtn.getAttribute("data-clear-upload") || ""
  ).trim();
  if (clearKey) {
    clearFileSelection(nextRoot, clearKey);
  }
  return;
}

        const qualityCard = e.target.closest(".pfxChoiceCard[data-quality]");
        if (qualityCard && nextRoot.contains(qualityCard)) {
          e.preventDefault();
          const nextState = getState(nextRoot);
          nextState.quality =
            qualityCard.getAttribute("data-quality") === "premium"
              ? "premium"
              : "standard";
          renderQuality(nextRoot);
          return;
        }

        const presetCard = e.target.closest(".pfxPresetCard[data-preset]");
        if (presetCard && nextRoot.contains(presetCard)) {
          e.preventDefault();
          const nextState = getState(nextRoot);
          const preset = String(
            presetCard.getAttribute("data-preset") || ""
          ).trim();

          if (!preset) return;

          if (nextState.presets.includes(preset)) {
            nextState.presets = nextState.presets.filter((x) => x !== preset);
          } else {
            nextState.presets = [...nextState.presets, preset];
          }

          renderPresets(nextRoot);
        }
      },
      true
    );

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

  function retryBoot(attempt = 0) {
    const root = getRoot();
    const qualityCards = root ? qsa(".pfxChoiceCard[data-quality]", root) : [];
    const presetCards = root ? qsa(".pfxPresetCard[data-preset]", root) : [];
    const createBtn = root ? qs(".pfxCreateBtn", root) : null;

    const domReady =
      !!root &&
      qualityCards.length > 0 &&
      presetCards.length > 0 &&
      !!createBtn;

    if (domReady) {
      boot();
      console.log("[PHOTOFX] module READY ✅");
      return;
    }

    if (attempt >= 40) {
      console.warn("[PHOTOFX] root/children not ready after retry limit", {
        hasRoot: !!root,
        qualityCards: qualityCards.length,
        presetCards: presetCards.length,
        hasCreateBtn: !!createBtn,
      });
      return;
    }

    setTimeout(() => retryBoot(attempt + 1), 250);
  }

  retryBoot();
})();
