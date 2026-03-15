(() => {
  if (window.__CARTOON_BASIC_BIND__) return;
  window.__CARTOON_BASIC_BIND__ = true;

  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function getCartoonRoot() {
    return qs('.main-panel[data-module="cartoon"]');
  }

  async function presignCartoonReference(file) {
    const res = await fetch("/api/r2/presign-put", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: "cartoon",
        kind: "reference",
        filename: file?.name || `reference-${Date.now()}.png`,
        contentType: file?.type || "application/octet-stream"
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data || data.ok === false) {
      throw new Error(data?.error || "cartoon_reference_presign_failed");
    }

    return {
      uploadUrl: data.uploadUrl || data.upload_url,
      publicUrl: data.publicUrl || data.public_url || data.url || "",
    };
  }

  async function uploadCartoonReferenceToR2(file) {
    if (!file) throw new Error("missing_reference_file");

    const { uploadUrl, publicUrl } = await presignCartoonReference(file);

    if (!uploadUrl || !publicUrl) {
      throw new Error("cartoon_reference_missing_upload_urls");
    }

    const put = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream"
      },
      body: file
    });

    if (!put.ok) {
      throw new Error("cartoon_reference_r2_put_failed");
    }

    return publicUrl;
  }
async function presignCartoonAudio(file) {
  const res = await fetch("/api/r2/presign-put", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      app: "cartoon",
      kind: "audio",
      filename: file?.name || `audio-${Date.now()}.mp3`,
      contentType: file?.type || "application/octet-stream"
    })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data || data.ok === false) {
    throw new Error(data?.error || "cartoon_audio_presign_failed");
  }

  return {
    uploadUrl: data.uploadUrl || data.upload_url,
    publicUrl: data.publicUrl || data.public_url || data.url || "",
  };
}

async function uploadCartoonAudioToR2(file) {
  if (!file) throw new Error("missing_audio_file");

  const { uploadUrl, publicUrl } = await presignCartoonAudio(file);

  if (!uploadUrl || !publicUrl) {
    throw new Error("cartoon_audio_missing_upload_urls");
  }

  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });

  if (!put.ok) {
    throw new Error("cartoon_audio_r2_put_failed");
  }

  return publicUrl;
}
  const state = (window.__CARTOON_BASIC_STATE__ = window.__CARTOON_BASIC_STATE__ || {
    mode: "basic",
    extraPrompt: "",
    mainCharacter: "red-fish",
    helpers: [],
    scene: "underwater",
    action: "swimming",
    duration: "5",
    ratio: "16:9",
    audioEnabled: false,
    audioFile: null,
audioFileName: "",
audioFileUrl: "",
audioFileUploadPromise: null,
audioFileUploadStatus: "idle",
audioFileUploadError: "",
    characterImage: null,
    characterImageName: "",
    characterImageUrl: "",
    characterImageUploadPromise: null,
    characterImageUploadStatus: "idle",
    characterImageUploadError: "",
    isGenerating: false,
    activeBasicJobId: "",
    activeBasicPollToken: 0,
  });

  function getEstimatedCredits() {
    const durationNum = Number(state.duration || 5);
    if (durationNum <= 5) return 10;
    if (durationNum <= 10) return 20;
    return 30;
  }

  function updatePromptCount(root) {
    const input = qs("[data-cartoon-prompt-input]", root);
    const out = qs("[data-cartoon-prompt-count]", root);
    if (!input || !out) return;

    const len = String(input.value || "").length;
    out.textContent = `${len} / 1000`;
  }

  function updateHelperCount(root) {
    const el = qs("[data-helper-count]", root);
    if (!el) return;
    el.textContent = `${state.helpers.length}/3`;
  }

  function clearBasicCharacterImage(root) {
    const input = qs("[data-character-upload]", root);

    state.characterImage = null;
    state.characterImageName = "";
    state.characterImageUrl = "";
    state.characterImageUploadPromise = null;
    state.characterImageUploadStatus = "idle";
    state.characterImageUploadError = "";

    if (input) input.value = "";

    updateBasicUploadStatusUI(root);
    updateSummary(root);
  }

  function ensureBasicUploadClearButton(root) {
    const textEl =
      qs("[data-basic-upload-text]", root) ||
      qs(".cartoon-upload-text", root);

    if (!textEl) return;

    const host = textEl.parentElement || textEl;
    let clearBtn = qs("[data-basic-upload-clear]", host);

    if (!clearBtn) {
      clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.setAttribute("data-basic-upload-clear", "");
      clearBtn.setAttribute("aria-label", "Yüklenen resmi temizle");
      clearBtn.title = "Resmi kaldır";
      clearBtn.textContent = "×";
      clearBtn.style.marginLeft = "8px";
      clearBtn.style.width = "22px";
      clearBtn.style.height = "22px";
      clearBtn.style.borderRadius = "999px";
      clearBtn.style.border = "1px solid rgba(255,255,255,.18)";
      clearBtn.style.background = "rgba(255,255,255,.08)";
      clearBtn.style.color = "#fff";
      clearBtn.style.cursor = "pointer";
      clearBtn.style.display = "none";
      clearBtn.style.verticalAlign = "middle";
      host.appendChild(clearBtn);

      clearBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nextRoot = getCartoonRoot();
        if (!nextRoot) return;
        clearBasicCharacterImage(nextRoot);
      });
    }

    clearBtn.style.display = state.characterImage ? "inline-grid" : "none";
    clearBtn.style.placeItems = "center";
  }

  function updateBasicUploadStatusUI(root) {
    const textEl =
      qs("[data-basic-upload-text]", root) ||
      qs(".cartoon-upload-text", root);

    const generateBtn = qs("[data-cartoon-generate]", root);
    ensureBasicUploadClearButton(root);

    if (!textEl) return;

    if (!state.characterImage) {
      textEl.textContent = "Dosya seçilmedi";
      if (generateBtn) generateBtn.disabled = !!state.isGenerating;
      return;
    }

    if (state.characterImageUploadStatus === "uploading") {
      textEl.textContent = `${state.characterImageName} · Yükleniyor...`;
      if (generateBtn) generateBtn.disabled = true;
      return;
    }

    if (state.characterImageUploadStatus === "ready") {
      textEl.textContent = `${state.characterImageName} · Hazır ✓`;
      if (generateBtn) generateBtn.disabled = !!state.isGenerating;
      return;
    }

    if (state.characterImageUploadStatus === "error") {
      textEl.textContent = `${state.characterImageName} · Yükleme hatası`;
      if (generateBtn) generateBtn.disabled = true;
      return;
    }

    textEl.textContent = state.characterImageName || "Dosya seçilmedi";
    if (generateBtn) generateBtn.disabled = !!state.isGenerating;
  }

  function updateSummary(root) {
    const el = qs("[data-cartoon-summary]", root);
    if (!el) return;

    const durationText = `${state.duration} sn`;
    const mainCountText = state.mainCharacter ? "1 ana karakter" : "0 ana karakter";
    const helperCountText = `${state.helpers.length} yardımcı`;
    const creditText = `${getEstimatedCredits()} kredi`;

    el.textContent = `${durationText} • ${mainCountText} • ${helperCountText} • ${creditText}`;
  }

  function syncMainSelection(root) {
    qsa('[data-role="main"]', root).forEach((btn) => {
      const on = btn.dataset.character === state.mainCharacter;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncHelperSelection(root) {
    qsa('[data-role="helper"]', root).forEach((btn) => {
      const on = state.helpers.includes(btn.dataset.character);
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncSceneSelection(root) {
    qsa("[data-scene]", root).forEach((btn) => {
      const on = btn.dataset.scene === state.scene;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncActionSelection(root) {
    qsa("[data-action]", root).forEach((btn) => {
      const on = btn.dataset.action === state.action;
      btn.classList.toggle("is-selected", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function syncModeTabs(root) {
    qsa("[data-cartoon-mode]", root).forEach((btn) => {
      const on = btn.dataset.cartoonMode === state.mode;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function syncModeViews(root) {
    qsa(".cartoon-mode-view[data-cartoon-view]", root).forEach((el) => {
      const view = el.dataset.cartoonView || "";
      const on = view === state.mode;
      el.hidden = !on;
      el.classList.toggle("is-active", on);
    });
  }

  function syncFormValues(root) {
    const prompt = qs("[data-cartoon-prompt-input]", root);
    const duration = qs("#cartoon-duration", root);
    const ratio = qs("#cartoon-ratio", root);
    const audio = qs("[data-audio-enabled]", root);

    if (prompt && prompt.value !== state.extraPrompt) prompt.value = state.extraPrompt;
    if (duration && duration.value !== state.duration) duration.value = state.duration;
    if (ratio && ratio.value !== state.ratio) ratio.value = state.ratio;
    if (audio) audio.checked = !!state.audioEnabled;
  }

  function render(root) {
    if (!root) return;

    syncModeTabs(root);
    syncModeViews(root);
    syncMainSelection(root);
    syncHelperSelection(root);
    syncSceneSelection(root);
    syncActionSelection(root);
    syncFormValues(root);
    updatePromptCount(root);
    updateHelperCount(root);
    updateBasicUploadStatusUI(root);
    updateSummary(root);
  }

  function buildBasicPayload() {
    return {
      app: "cartoon",
      mode: "basic",
      extraPrompt: state.extraPrompt,
      mainCharacter: state.mainCharacter,
      helperCharacters: [...state.helpers],
      scene: state.scene,
      action: state.action,
      duration: state.duration,
      aspectRatio: state.ratio,
      audioEnabled: !!state.audioEnabled,
      audioFileName: state.audioFileName,
      audioFileUrl: state.audioFileUrl || "",
      characterImage: state.characterImage,
      characterImageName: state.characterImageName,
      characterImageUrl: state.characterImageUrl || "",
      estimatedCredits: getEstimatedCredits()
    };
  }

  async function pollCartoonJob(jobId, tries = 0, pollToken = 0) {
    try {
      const activeJobId = String(state.activeBasicJobId || "").trim();
      const activePollToken = Number(state.activeBasicPollToken || 0);
      const currentJobId = String(jobId || "").trim();

      if (activeJobId && activeJobId !== currentJobId) return;
      if (pollToken && activePollToken && pollToken !== activePollToken) return;

      const r = await fetch(`/api/jobs/status?job_id=${encodeURIComponent(jobId)}&debug=1`);
      const j2 = await r.json().catch(() => null);

      console.log("[CARTOON][BASIC] poll =", j2);

      if (!j2 || j2.ok === false) {
        if (tries < 60) {
          setTimeout(() => pollCartoonJob(jobId, tries + 1, pollToken), 3000);
        }
        return;
      }

      const normalizedStatus = String(
        j2?.status ||
        j2?.db_status ||
        j2?.state ||
        ""
      ).trim().toLowerCase();

      const readyVideoUrl = String(
        j2?.video?.url ||
        j2?.video_url ||
        ""
      ).trim();

      const readyImageUrl = String(
        j2?.image?.url ||
        j2?.image_url ||
        ""
      ).trim();

      const readyMode = String(
        j2?.mode ||
        j2?.meta?.mode ||
        j2?.job?.mode ||
        ""
      ).trim().toLowerCase();

      const hasReadyOutput =
        Array.isArray(j2?.outputs) &&
        j2.outputs.some((o) => {
          const t = String(o?.type || o?.kind || o?.meta?.type || "").trim().toLowerCase();
          const u = String(o?.url || o?.image_url || o?.video_url || "").trim();
          return !!u && (t === "video" || t === "image");
        });

      if (
        ["ready", "completed", "complete", "succeeded", "done"].includes(normalizedStatus) &&
        (readyVideoUrl || readyImageUrl || hasReadyOutput)
      ) {
        window.__LAST_CARTOON_STATUS__ = j2;

        if (String(state.activeBasicJobId || "").trim() === currentJobId) {
          state.activeBasicJobId = "";
          state.activeBasicPollToken = 0;
        }

        window.dispatchEvent(
          new CustomEvent("aivo:cartoon:job_ready", {
            detail: {
              job_id: jobId,
              status: normalizedStatus,
              mode: readyMode,
              video: readyVideoUrl ? { url: readyVideoUrl } : null,
              image: readyImageUrl ? { url: readyImageUrl } : null,
              outputs: j2.outputs || [],
              raw: j2
            }
          })
        );
        return;
      }

      if (normalizedStatus === "error") {
        console.error("[CARTOON][BASIC] job error =", j2);

        if (String(state.activeBasicJobId || "").trim() === currentJobId) {
          state.activeBasicJobId = "";
          state.activeBasicPollToken = 0;
          state.isGenerating = false;

          const root = getCartoonRoot();
          const basicGenerateBtn = root?.querySelector("[data-cartoon-generate]");
          if (basicGenerateBtn) {
            basicGenerateBtn.disabled = false;
            basicGenerateBtn.textContent = "🎬 Sahneyi Oluştur (50 Kredi)";
            basicGenerateBtn.classList.remove("is-loading");
          }
        }

        return;
      }

      if (tries < 60) {
        setTimeout(() => pollCartoonJob(jobId, tries + 1, pollToken), 3000);
        return;
      }

      if (String(state.activeBasicJobId || "").trim() === currentJobId) {
        state.activeBasicJobId = "";
        state.activeBasicPollToken = 0;
        state.isGenerating = false;

        const root = getCartoonRoot();
        const basicGenerateBtn = root?.querySelector("[data-cartoon-generate]");
        if (basicGenerateBtn) {
          basicGenerateBtn.disabled = false;
          basicGenerateBtn.textContent = "🎬 Sahneyi Oluştur (50 Kredi)";
          basicGenerateBtn.classList.remove("is-loading");
        }
      }
    } catch (err) {
      console.error("[CARTOON][BASIC] poll error =", err);

      if (tries < 60) {
        setTimeout(() => pollCartoonJob(jobId, tries + 1, pollToken), 3000);
        return;
      }

      const currentJobId = String(jobId || "").trim();
      if (String(state.activeBasicJobId || "").trim() === currentJobId) {
        state.activeBasicJobId = "";
        state.activeBasicPollToken = 0;
        state.isGenerating = false;

        const root = getCartoonRoot();
        const basicGenerateBtn = root?.querySelector("[data-cartoon-generate]");
        if (basicGenerateBtn) {
          basicGenerateBtn.disabled = false;
          basicGenerateBtn.textContent = "🎬 Sahneyi Oluştur (50 Kredi)";
          basicGenerateBtn.classList.remove("is-loading");
        }
      }
    }
  }

  function bindEvents() {
    document.addEventListener("click", async (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const modeBtn = e.target.closest("[data-cartoon-mode]");
      if (modeBtn && root.contains(modeBtn)) {
        e.preventDefault();
        state.mode = modeBtn.dataset.cartoonMode || "basic";
        render(root);
        return;
      }

      const mainBtn = e.target.closest('[data-role="main"]');
      if (mainBtn && root.contains(mainBtn)) {
        e.preventDefault();
        const value = mainBtn.dataset.character || "";
        state.mainCharacter = state.mainCharacter === value ? "" : value;
        render(root);
        return;
      }

      const helperBtn = e.target.closest('[data-role="helper"]');
      if (helperBtn && root.contains(helperBtn)) {
        e.preventDefault();
        const value = helperBtn.dataset.character;
        if (!value) return;

        const exists = state.helpers.includes(value);

        if (exists) {
          state.helpers = state.helpers.filter((x) => x !== value);
        } else {
          if (state.helpers.length >= 3) return;
          state.helpers = [...state.helpers, value];
        }

        render(root);
        return;
      }

      const sceneBtn = e.target.closest("[data-scene]");
      if (sceneBtn && root.contains(sceneBtn)) {
        e.preventDefault();
        const value = sceneBtn.dataset.scene || "";
        state.scene = state.scene === value ? "" : value;
        render(root);
        return;
      }

      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn && root.contains(actionBtn)) {
        e.preventDefault();
        const value = actionBtn.dataset.action || "";
        state.action = state.action === value ? "" : value;
        render(root);
        return;
      }

      const generateBtn = e.target.closest("[data-cartoon-generate]");
      if (generateBtn && root.contains(generateBtn)) {
        e.preventDefault();

        if (state.mode !== "basic") return;
        if (state.isGenerating) return;

        if (state.characterImage) {
          if (
            state.characterImageUploadStatus === "uploading" &&
            state.characterImageUploadPromise
          ) {
            try {
              await state.characterImageUploadPromise;
            } catch {
              return;
            }
          }

          if (!state.characterImageUrl || state.characterImageUploadStatus !== "ready") {
            alert("Karakter görseli henüz yüklenmedi. Lütfen 'Hazır ✓' görünmesini bekleyin.");
            return;
          }
        }
        if (state.audioFile) {
  if (
    state.audioFileUploadStatus === "uploading" &&
    state.audioFileUploadPromise
  ) {
    try {
      await state.audioFileUploadPromise;
    } catch {
      return;
    }
  }

  if (!state.audioFileUrl || state.audioFileUploadStatus !== "ready") {
    alert("Ses dosyası henüz yüklenmedi. Lütfen yükleme tamamlanınca tekrar deneyin.");
    return;
  }
}
        const payload = buildBasicPayload();
        console.log("[CARTOON][BASIC_PAYLOAD_BEFORE_CREATE]", payload);

        state.isGenerating = true;
        generateBtn.disabled = true;
        generateBtn.textContent = "Üretiliyor...";
        generateBtn.classList.add("is-loading");

        try {
          const r = await fetch("/api/providers/fal/cartoon/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const j = await r.json().catch(() => null);
          if (!r.ok || !j || j.ok === false) {
            throw new Error(j?.error || `cartoon_create_failed_${r.status}`);
          }

          console.log("[CARTOON][BASIC] create ok =", j);

          if (j?.job_id) {
            state.activeBasicJobId = String(j.job_id || "");
            state.activeBasicPollToken = Date.now();

            window.dispatchEvent(
              new CustomEvent("aivo:cartoon:job_created", {
                detail: {
                  app: "cartoon",
                  mode: "basic",
                  job_id: j.job_id,
                  prompt: payload.extraPrompt || "",
                  createdAt: Date.now(),
                  meta: {
                    app: "cartoon",
                    mode: "basic",
                    provider: "fal",
                    prompt: [
                      payload.mainCharacter,
                      ...(payload.helperCharacters || []),
                      payload.scene,
                      payload.action,
                      payload.extraPrompt
                    ].filter(Boolean).join(" • "),
                    duration: payload.duration,
                    aspect_ratio: payload.aspectRatio
                  }
                }
              })
            );

            pollCartoonJob(j.job_id, 0, state.activeBasicPollToken);
          }
        } catch (err) {
          state.isGenerating = false;
          generateBtn.disabled = false;
          generateBtn.textContent = "🎬 Sahneyi Oluştur (50 Kredi)";
          generateBtn.classList.remove("is-loading");

          console.error("[CARTOON][BASIC] create error:", err);
          alert(String(err?.message || err || "cartoon_create_failed"));
        }

        return;
      }
    });

    window.addEventListener("aivo:cartoon:job_ready", (e) => {
      const d = e?.detail || {};
      const root = getCartoonRoot();

      const mode = String(
        d?.mode ||
        d?.raw?.mode ||
        d?.raw?.meta?.mode ||
        ""
      ).trim().toLowerCase();

      if (mode && mode !== "basic") return;

      const basicGenerateBtn = root?.querySelector("[data-cartoon-generate]");
      if (basicGenerateBtn) {
        state.isGenerating = false;
        basicGenerateBtn.disabled = false;
        basicGenerateBtn.textContent = "🎬 Sahneyi Oluştur (50 Kredi)";
        basicGenerateBtn.classList.remove("is-loading");
      }

      if (root) {
        updateBasicUploadStatusUI(root);
        render(root);
      }
    });

    document.addEventListener("input", (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const prompt = e.target.closest("[data-cartoon-prompt-input]");
      if (prompt && root.contains(prompt)) {
        state.extraPrompt = String(prompt.value || "");
        updatePromptCount(root);
        updateSummary(root);
      }
    });

    document.addEventListener("change", async (e) => {
      const root = getCartoonRoot();
      if (!root) return;

      const duration = e.target.closest("#cartoon-duration");
      if (duration && root.contains(duration)) {
        state.duration = duration.value || "5";
        updateSummary(root);
        return;
      }

      const ratio = e.target.closest("#cartoon-ratio");
      if (ratio && root.contains(ratio)) {
        state.ratio = ratio.value || "16:9";
        updateSummary(root);
        return;
      }

      const audio = e.target.closest("[data-audio-enabled]");
      if (audio && root.contains(audio)) {
        state.audioEnabled = !!audio.checked;
        updateSummary(root);
        return;
      }
     const audioUpload = e.target.closest("[data-audio-upload]");
if (audioUpload && root.contains(audioUpload)) {
  const file = audioUpload.files && audioUpload.files[0] ? audioUpload.files[0] : null;

  state.audioFile = file;
  state.audioFileName = file ? file.name : "";
  state.audioFileUrl = "";
  state.audioFileUploadPromise = null;
  state.audioFileUploadError = "";
  state.audioFileUploadStatus = file ? "uploading" : "idle";

  updateSummary(root);

  if (!file) return;

  state.audioFileUploadPromise = uploadCartoonAudioToR2(file)
    .then((publicUrl) => {
      state.audioFileUrl = String(publicUrl || "").trim();
      state.audioFileUploadStatus = "ready";
      state.audioFileUploadError = "";
      console.log("[CARTOON][BASIC_AUDIO_UPLOAD_OK]", state.audioFileUrl);
      return state.audioFileUrl;
    })
    .catch((err) => {
      state.audioFileUrl = "";
      state.audioFileUploadStatus = "error";
      state.audioFileUploadError = String(err?.message || err || "basic_audio_upload_failed");
      console.error("[CARTOON][BASIC_AUDIO_UPLOAD_ERROR]", err);
      alert(state.audioFileUploadError);
      throw err;
    });

  return;
}
      const upload = e.target.closest("[data-character-upload]");
      if (upload && root.contains(upload)) {
        const file = upload.files && upload.files[0] ? upload.files[0] : null;

        state.characterImage = file;
        state.characterImageName = file ? file.name : "";
        state.characterImageUrl = "";
        state.characterImageUploadPromise = null;
        state.characterImageUploadError = "";
        state.characterImageUploadStatus = file ? "uploading" : "idle";

        updateBasicUploadStatusUI(root);
        updateSummary(root);

        if (!file) return;

        state.characterImageUploadPromise = uploadCartoonReferenceToR2(file)
          .then((publicUrl) => {
            state.characterImageUrl = String(publicUrl || "").trim();
            state.characterImageUploadStatus = "ready";
            state.characterImageUploadError = "";
            console.log("[CARTOON][BASIC_UPLOAD_OK]", state.characterImageUrl);

            const nextRoot = getCartoonRoot();
            if (nextRoot) updateBasicUploadStatusUI(nextRoot);

            return state.characterImageUrl;
          })
          .catch((err) => {
            state.characterImageUrl = "";
            state.characterImageUploadStatus = "error";
            state.characterImageUploadError = String(err?.message || err || "basic_reference_upload_failed");
            console.error("[CARTOON][BASIC_UPLOAD_ERROR]", err);

            const nextRoot = getCartoonRoot();
            if (nextRoot) updateBasicUploadStatusUI(nextRoot);

            alert(state.characterImageUploadError);
            throw err;
          });

        return;
      }
    });
  }

  function initFromDOM(root) {
    if (!root) return;

    const selectedMode = qs('[data-cartoon-mode].is-active', root);
    const selectedMain = qs('[data-role="main"].is-selected', root);
    const selectedScene = qs('[data-scene].is-selected', root);
    const selectedAction = qs('[data-action].is-selected', root);
    const selectedHelpers = qsa('[data-role="helper"].is-selected', root);

    const prompt = qs("[data-cartoon-prompt-input]", root);
    const duration = qs("#cartoon-duration", root);
    const ratio = qs("#cartoon-ratio", root);
    const audio = qs("[data-audio-enabled]", root);

    if (selectedMode?.dataset.cartoonMode) state.mode = selectedMode.dataset.cartoonMode;
    if (selectedMain?.dataset.character) state.mainCharacter = selectedMain.dataset.character;
    if (selectedScene?.dataset.scene) state.scene = selectedScene.dataset.scene;
    if (selectedAction?.dataset.action) state.action = selectedAction.dataset.action;

    state.helpers = selectedHelpers
      .map((btn) => btn.dataset.character)
      .filter(Boolean)
      .slice(0, 3);

    if (prompt) state.extraPrompt = String(prompt.value || "");
    if (duration?.value) state.duration = duration.value;
    if (ratio?.value) state.ratio = ratio.value;
    if (audio) state.audioEnabled = !!audio.checked;

    render(root);
  }

  function tryInit() {
    const root = getCartoonRoot();
    if (!root) return false;
    initFromDOM(root);
    return true;
  }

  bindEvents();

  if (!tryInit()) {
    const observer = new MutationObserver(() => {
      if (tryInit()) observer.disconnect();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }
})();
