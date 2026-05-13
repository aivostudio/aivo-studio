(function(){
  const mount = document.getElementById("mobilePhotoFxMount");
  const root = mount
    ? mount.querySelector("#mobilePhotoFxSection")
    : document.getElementById("mobilePhotoFxSection");

  if (!root || root.__mobilePhotoFxBound) return;
  root.__mobilePhotoFxBound = true;

  const promptEl = root.querySelector("#mobilePhotoFxPrompt");
  const promptCountEl = root.querySelector("#mobilePhotoFxPromptCount");

  const imageFileEl = root.querySelector("#mobilePhotoFxImageFile");
  const logoFileEl = root.querySelector("#mobilePhotoFxLogoFile");
  const audioFileEl = root.querySelector("#mobilePhotoFxAudioFile");

  const durationEl = root.querySelector("#mobilePhotoFxDuration");
  const ratioEl = root.querySelector("#mobilePhotoFxRatio");
  const motionLevelEl = root.querySelector("#mobilePhotoFxMotionLevel");
  const effectPowerEl = root.querySelector("#mobilePhotoFxEffectPower");
  const colorMoodEl = root.querySelector("#mobilePhotoFxColorMood");
  const transitionSpeedEl = root.querySelector("#mobilePhotoFxTransitionSpeed");
  const logoPositionEl = root.querySelector("#mobilePhotoFxLogoPosition");

  const generateBtn = root.querySelector("#mobilePhotoFxGenerateBtn");
  const statusEl = root.querySelector("#mobilePhotoFxStatus");
  const resultsEl = root.querySelector("#mobilePhotoFxResults");

  const mobilePhotoFxJobs = [];
  const mobilePhotoFxDeletedIds = new Set();
  let mobilePhotoFxViewMode = "current";

  const state = {
    prompt: "",
    styles: [],
    duration: "6",
    ratio: "9:16",
    motionLevel: "balanced",
    effectStrength: "medium",
    colorMood: "original",
    transitionSpeed: "normal",
    logoPosition: "bottom-right",
    imageFile: null,
    logoFile: null,
    audioFile: null,
    imageUrl: "",
    logoUrl: "",
    audioUrl: ""
  };

  function esc(value){
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function safeText(value){
    return String(value || "").trim();
  }

  const MOBILE_PHOTOFX_TOAST = {
    loadingId: null
  };

  function getMobilePhotoFxToastApi(){
    return (
      window.mobileToast ||
      window.MobileToast ||
      window.AIVO_MOBILE_TOAST ||
      window.aivoMobileToast ||
      window.toast ||
      window.AIVO_TOAST ||
      null
    );
  }

  function mobilePhotoFxToast(type, message, options){
    const text = safeText(message);
    if (!text) return null;

    const normalizedType = type === "danger" ? "error" : type;
    const toastApi = getMobilePhotoFxToastApi();

    try {
      if (toastApi) {
        if (typeof toastApi[normalizedType] === "function") {
          return toastApi[normalizedType](text, options || {});
        }

        if (typeof toastApi.show === "function") {
          return toastApi.show({
            type: normalizedType,
            message: text,
            ...(options || {})
          });
        }

        if (typeof toastApi.push === "function") {
          return toastApi.push({
            type: normalizedType,
            message: text,
            ...(options || {})
          });
        }

        if (typeof toastApi === "function") {
          return toastApi(text, normalizedType, options || {});
        }
      }

      if (window.Toast && typeof window.Toast.show === "function") {
        window.Toast.show(text, { type: normalizedType });
      }
    } catch (err) {}

    return null;
  }

  function mobilePhotoFxLoading(message){
    clearMobilePhotoFxLoading({ keepButton: true });

    MOBILE_PHOTOFX_TOAST.loadingId = mobilePhotoFxToast("loading", message, {
      persist: true,
      autoClose: false,
      source: "mobile_photofx"
    });

    return MOBILE_PHOTOFX_TOAST.loadingId;
  }

  function clearMobilePhotoFxLoading(options){
    const keepButton = !!(options && options.keepButton);
    const toastApi = getMobilePhotoFxToastApi();

    try {
      if (MOBILE_PHOTOFX_TOAST.loadingId && toastApi) {
        if (typeof toastApi.dismiss === "function") {
          toastApi.dismiss(MOBILE_PHOTOFX_TOAST.loadingId);
        } else if (typeof toastApi.remove === "function") {
          toastApi.remove(MOBILE_PHOTOFX_TOAST.loadingId);
        }
      }
    } catch (err) {}

    MOBILE_PHOTOFX_TOAST.loadingId = null;

    if (!keepButton && generateBtn) {
      generateBtn.disabled = false;
      generateBtn.classList.remove("is-loading", "is-pressed");
      generateBtn.removeAttribute("aria-busy");
      syncCreditButton();
    }
  }

  function setStatus(message){
    if (statusEl) statusEl.textContent = safeText(message);
  }

  function computeCredit(){
    const duration = String(state.duration || "6");

    let total = 30;

    if (duration === "8") total = 35;
    else if (duration === "10") total = 40;
    else if (duration === "12") total = 45;
    else if (duration === "14") total = 50;
    else if (duration === "16") total = 55;
    else if (duration === "18") total = 60;
    else if (duration === "20") total = 65;

    total += state.styles.length * 5;
    if (state.logoUrl) total += 10;
    if (state.audioUrl) total += 10;

    return total;
  }

  const MOBILE_PHOTOFX_CREDIT_ACTION = "mobile_photofx_generate";

  async function refreshMobilePhotoFxCredits(){
    try {
      const res = await fetch("/api/credits/get", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "accept": "application/json"
        }
      });

      const data = await res.json().catch(function(){
        return {};
      });

      const nextCredits = data.credits ?? data.balance ?? data.credit;

      if (data && data.ok && typeof nextCredits === "number") {
        const topCreditCountEl = document.getElementById("topCreditCount");
        if (topCreditCountEl) {
          topCreditCountEl.textContent = String(nextCredits);
        }

        const mobileCreditEls = Array.from(document.querySelectorAll("[data-mobile-credit-balance]"));
        mobileCreditEls.forEach(function(el){
          el.textContent = "Kredi " + nextCredits;
        });

        if (
          window.AIVO_STORE_V1 &&
          typeof window.AIVO_STORE_V1.setCredits === "function"
        ) {
          window.AIVO_STORE_V1.setCredits(nextCredits);
        }
      }
    } catch (err) {}

    try {
      window.syncCreditsUI?.({ force: true });
    } catch (err) {}
  }

  async function consumeMobilePhotoFxCredits(creditCost, requestId){
    const res = await fetch("/api/credits/consume-ledger", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        app: "photofx",
        action: MOBILE_PHOTOFX_CREDIT_ACTION,
        cost: creditCost,
        request_id: requestId,
        reason: MOBILE_PHOTOFX_CREDIT_ACTION
      })
    });

    const data = await res.json().catch(function(){
      return {};
    });

    if (!res.ok || !data.ok) {
      const err = new Error(data.error || "insufficient_credit");
      err.data = data;
      err.status = res.status;
      throw err;
    }

    await refreshMobilePhotoFxCredits();

    return {
      transactionId: data.transaction_id || data.transaction?.id || "",
      raw: data
    };
  }

  async function refundMobilePhotoFxCredits(refundState, reason, meta){
    if (!refundState || refundState.refunded) return false;
    if (!refundState.consumed) return false;
    if (!refundState.transactionId) return false;
    if (!refundState.requestId) return false;
    if (!refundState.creditCost || refundState.creditCost <= 0) return false;

    refundState.refunded = true;

    try {
      const res = await fetch("/api/credits/refund", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          app: "photofx",
          action: MOBILE_PHOTOFX_CREDIT_ACTION,
          amount: refundState.creditCost,
          request_id: refundState.requestId,
          related_transaction_id: refundState.transactionId,
          reason: reason || "mobile_photofx_failed",
          meta: {
            source: "mobile.photofx",
            ...(meta || {})
          }
        })
      });

      const data = await res.json().catch(function(){
        return {};
      });

      if (
        res.ok &&
        data &&
        data.ok &&
        (data.refunded || data.deduped || data.skipped)
      ) {
        await refreshMobilePhotoFxCredits();
        mobilePhotoFxToast("error", "İşlem başarısız oldu, kredi iade edildi.");
        return true;
      }
    } catch (err) {
      console.error("[MOBILE PHOTOFX][REFUND ERROR]", err);
    }

    return false;
  }

  function syncCreditButton(){
    if (!generateBtn) return;
    generateBtn.textContent = "🎬 Klip Oluştur (" + computeCredit() + " Kredi)";
    generateBtn.setAttribute("data-credit-cost", String(computeCredit()));
  }

  function pickVideoUrl(data){
    return String(
      data.video_url ||
      data.final_url ||
      data.url ||
      data.video?.url ||
      data.output?.video?.url ||
      data.meta?.final_video_url ||
      data.meta?.preview_video_url ||
      data.outputs?.[0]?.url ||
      ""
    ).trim();
  }

  function renderMobilePhotoFxResults(){
    if (!resultsEl) return;

  const items = mobilePhotoFxJobs.filter(function(job){
  if (mobilePhotoFxDeletedIds.has(job.id)) return false;

  if (mobilePhotoFxViewMode === "current") {
    return job.scope === "current";
  }

  return job.scope === "library";
});

    if (!items.length) {
      resultsEl.className = "empty-card";
      resultsEl.innerHTML = "Henüz mobil PhotoFX klip başlatılmadı.";
      return;
    }

    resultsEl.className = "mobile-photofx-results";

    resultsEl.innerHTML = items.map(function(job){
      const ready = !!job.videoUrl;

      return `
        <article class="mobile-photofx-video-card" data-mobile-photofx-job="${esc(job.id)}">
          <div class="mobile-photofx-video-media">
            ${
              ready
                ? `<video class="mobile-photofx-video" src="${esc(job.videoUrl)}" playsinline webkit-playsinline preload="metadata"></video>`
                : `<div class="mobile-photofx-video-loading"><span>Hazırlanıyor…</span></div>`
            }

            <div class="mobile-photofx-video-actions">
              <button type="button" data-mobile-photofx-act="download" ${ready ? "" : "disabled"}>⬇</button>
              <button type="button" data-mobile-photofx-act="share" ${ready ? "" : "disabled"}>↗</button>
              <button type="button" data-mobile-photofx-act="sound" ${ready ? "" : "disabled"}>🔇</button>
              <button type="button" data-mobile-photofx-act="fullscreen" ${ready ? "" : "disabled"}>⛶</button>
              <button type="button" data-mobile-photofx-act="delete">🗑</button>
            </div>

            ${
              ready
                ? `<button class="mobile-photofx-video-play" type="button" data-mobile-photofx-act="play">▶</button>`
                : ``
            }
          </div>

          <div class="mobile-photofx-video-title">${esc(job.title || "PhotoFX klip")}</div>
        </article>
      `;
    }).join("");
  }

  function pollMobilePhotoFxJob(jobId){
    if (!jobId) return;

    fetch("/api/jobs/status?job_id=" + encodeURIComponent(jobId), {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    })
    .then(function(res){
      return res.json();
    })
    .then(async function(data){
      console.log("[MOBILE PHOTOFX][POLL]", data);

      const status = String(
        data.status ||
        data.db_status ||
        data.state ||
        ""
      ).toLowerCase();

      const videoUrl = pickVideoUrl(data);

      const job = mobilePhotoFxJobs.find(function(item){
        return item.id === jobId;
      });

      if (!job) return;

      if (videoUrl) {
        job.videoUrl = videoUrl;
        job.status = "ready";
        job.title = job.title || "PhotoFX klip hazır";
        renderMobilePhotoFxResults();
        setStatus("PhotoFX klip hazır.");
        clearMobilePhotoFxLoading();
        mobilePhotoFxToast("success", "Video hazır");
        return;
      }

      if (
        (status.includes("ready") ||
          status.includes("done") ||
          status.includes("complete") ||
          status.includes("success")) &&
        !videoUrl
      ) {
        job.status = "error";
        job.title = "Video çıktısı alınamadı";
        renderMobilePhotoFxResults();
        setStatus("Video çıktısı alınamadı.");
        clearMobilePhotoFxLoading();

        await refundMobilePhotoFxCredits(job.refundState, "mobile_photofx_ready_no_output", {
          error: "ready_no_output",
          status: status,
          response: data
        });

        return;
      }

      if (status.includes("fail") || status.includes("error")) {
        job.status = "error";
        job.title = "PhotoFX klip oluşturulamadı";
        renderMobilePhotoFxResults();
        setStatus("PhotoFX klip oluşturulamadı.");
        clearMobilePhotoFxLoading();

        await refundMobilePhotoFxCredits(job.refundState, "mobile_photofx_poll_failed", {
          error: "poll_failed",
          status: status,
          response: data
        });

        return;
      }

      setTimeout(function(){
        pollMobilePhotoFxJob(jobId);
      }, 3000);
    })
    .catch(async function(err){
      console.error("[MOBILE PHOTOFX][POLL ERROR]", err);

      const job = mobilePhotoFxJobs.find(function(item){
        return item.id === jobId;
      });

      if (job) {
        job.status = "error";
        job.title = "PhotoFX klip kontrol edilemedi";
        renderMobilePhotoFxResults();
        setStatus("PhotoFX klip kontrol edilemedi.");
        clearMobilePhotoFxLoading();

        await refundMobilePhotoFxCredits(job.refundState, "mobile_photofx_poll_exception", {
          error: String(err?.message || err || "poll_exception")
        });
      }
    });
  }

async function uploadMobilePhotoFxFile(file, kind){
  if (!file) return "";

  const presignRes = await fetch("/api/r2/scan-and-presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      app: "photofx",
      kind: kind || "mobile-upload",
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      prompt: state.prompt || "",
      title: file.name,
      description: state.prompt || file.name,
      source: "mobile_photofx_upload"
    })
  });

  const data = await presignRes.json().catch(function(){
    return {};
  });

  if (!presignRes.ok || !data.ok || !(data.uploadUrl || data.upload_url) || !(data.publicUrl || data.public_url || data.url)) {
    throw new Error(data.error || data.message || "presign_failed");
  }

  const uploadUrl = data.uploadUrl || data.upload_url;
  const publicUrl = data.publicUrl || data.public_url || data.url;
  const key = data.key || data.objectKey || "";

  if (!key) {
    throw new Error("missing_upload_key");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: data.required_headers || {
      "Content-Type": file.type || "application/octet-stream"
    },
    body: file
  });

  if (!uploadRes.ok) {
    throw new Error("r2_upload_failed");
  }

  const scanRes = await fetch("/api/r2/scan-upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      app: "photofx",
      key: key,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      public_url: publicUrl,
      prompt: state.prompt || "",
      title: file.name,
      description: state.prompt || file.name,
      source: "mobile_photofx_upload"
    })
  });

  const scanData = await scanRes.json().catch(function(){
    return {};
  });

  if (!scanRes.ok) {
    throw new Error(scanData.error || scanData.message || "media_policy_blocked");
  }

  if (!scanData.ok || scanData.decision && String(scanData.decision).toLowerCase() !== "allow") {
    throw new Error(scanData.error || scanData.message || "media_policy_blocked");
  }

  return scanData.public_url || publicUrl;
}

  function setFileLabel(input, file, statusText){
    const label = input && input.closest("label");
    if (!label) return;

    const labelMap = {
      mobilePhotoFxImageFile: "Referans",
      mobilePhotoFxLogoFile: "Logo",
      mobilePhotoFxAudioFile: "Audio"
    };

    const cleanText = labelMap[input.id] || "Dosya";
    const textEl = label.querySelector("b");

    const oldClear = label.querySelector(".mobile-photofx-file-clear");
    if (oldClear) oldClear.remove();

    if (textEl) {
      textEl.textContent = statusText || (file ? cleanText + " ✓" : cleanText);
    }

    label.classList.toggle("has-file", !!file);

    if (!file) return;

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "mobile-photofx-file-clear";
    clearBtn.setAttribute("data-mobile-photofx-clear-file", input.id);
    clearBtn.textContent = "×";
    label.appendChild(clearBtn);
  }

  function bindFileClearButtons(){
    root.addEventListener("click", function(e){
      const btn = e.target.closest("[data-mobile-photofx-clear-file]");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const inputId = btn.getAttribute("data-mobile-photofx-clear-file");
      const input = root.querySelector("#" + inputId);
      if (!input) return;

      input.value = "";

      if (inputId === "mobilePhotoFxImageFile") {
        const hadImage = !!state.imageFile || !!state.imageUrl;
        state.imageFile = null;
        state.imageUrl = "";
        setFileLabel(input, null);
        syncCreditButton();
        setStatus("Resim silindi.");
        if (hadImage) mobilePhotoFxToast("success", "Resim silindi");
        return;
      }

      if (inputId === "mobilePhotoFxLogoFile") {
        const hadLogo = !!state.logoFile || !!state.logoUrl;
        state.logoFile = null;
        state.logoUrl = "";
        setFileLabel(input, null);
        syncCreditButton();
        setStatus("Logo kaldırıldı.");
        if (hadLogo) mobilePhotoFxToast("success", "Logo kaldırıldı · -10 kredi");
        return;
      }

      if (inputId === "mobilePhotoFxAudioFile") {
        const hadAudio = !!state.audioFile || !!state.audioUrl;
        state.audioFile = null;
        state.audioUrl = "";
        setFileLabel(input, null);
        syncCreditButton();
        setStatus("Müzik kaldırıldı.");
        if (hadAudio) mobilePhotoFxToast("success", "Müzik kaldırıldı · -10 kredi");
        return;
      }
    });
  }

  function bindUploads(){
    const fileMap = [
      { input:imageFileEl, fileKey:"imageFile", urlKey:"imageUrl", kind:"image" },
      { input:logoFileEl, fileKey:"logoFile", urlKey:"logoUrl", kind:"logo" },
      { input:audioFileEl, fileKey:"audioFile", urlKey:"audioUrl", kind:"audio" }
    ];

    fileMap.forEach(function(item){
      const input = item.input;
      if (!input) return;

      input.addEventListener("change", async function(){
        const file = input.files && input.files[0] ? input.files[0] : null;

        state[item.fileKey] = file;
        state[item.urlKey] = "";

        setFileLabel(input, file, file ? "Yükleniyor..." : "");
        syncCreditButton();

        if (!file) return;

               setStatus("Dosya yükleniyor...");
        mobilePhotoFxLoading("Dosya güvenlik kontrolünden geçiriliyor...");

        try {
          const publicUrl = await uploadMobilePhotoFxFile(file, item.kind);
          clearMobilePhotoFxLoading();
          state[item.urlKey] = publicUrl;
          setFileLabel(input, file);
          syncCreditButton();

          if (item.urlKey === "imageUrl") {
            setStatus("Resim eklendi.");
            mobilePhotoFxToast("success", "Resim eklendi");
          } else if (item.urlKey === "logoUrl") {
            setStatus("Logo eklendi.");
            mobilePhotoFxToast("success", "Logo eklendi · +10 kredi");
          } else if (item.urlKey === "audioUrl") {
            setStatus("Müzik eklendi.");
            mobilePhotoFxToast("success", "Müzik eklendi · +10 kredi");
          }
        } catch (err) {
          console.error("[MOBILE PHOTOFX][UPLOAD ERROR]", err);
          clearMobilePhotoFxLoading();

          state[item.fileKey] = null;
          state[item.urlKey] = "";
          input.value = "";

          setFileLabel(input, null);
          syncCreditButton();
          setStatus("Dosya yüklenemedi.");

          const errText = String(err?.message || err || "").toLowerCase();
        const isPolicyBlocked =
  errText.includes("media_policy") ||
  errText.includes("public_figure") ||
  errText.includes("public figure") ||
  errText.includes("public_figure_image_blocked") ||
  errText.includes("figure_image_blocked") ||
  errText.includes("image_blocked") ||
  errText.includes("celebrity") ||
  errText.includes("protected_person") ||
  errText.includes("kamu figürü") ||
  errText.includes("kamu figuru") ||
  errText.includes("tanınmış kişi") ||
  errText.includes("taninmis kisi") ||
  errText.includes("gerçek kişi") ||
  errText.includes("gercek kisi") ||
  errText.includes("impersonation") ||
  errText.includes("blocked");

          mobilePhotoFxToast("error", isPolicyBlocked ? "Bu görsel kullanılamaz." : "Yükleme hatası");
        }
      });
    });
  }

  function bindPrompt(){
    if (!promptEl || !promptCountEl) return;

    function updatePrompt(){
      const value = String(promptEl.value || "");
      state.prompt = value.trim();
      promptCountEl.textContent = String(value.length);
    }

    promptEl.addEventListener("input", updatePrompt);
    promptEl.addEventListener("change", updatePrompt);
    updatePrompt();
  }

  function bindStyleButtons(){
    const buttons = Array.from(root.querySelectorAll("[data-photofx-style]"));

    buttons.forEach(function(btn){
      btn.addEventListener("click", function(){
        const value = safeText(btn.getAttribute("data-photofx-style"));
        if (!value) return;

        const exists = state.styles.includes(value);

        if (exists) {
          state.styles = state.styles.filter(function(item){
            return item !== value;
          });
          btn.classList.remove("is-active");
          btn.setAttribute("aria-pressed", "false");
          mobilePhotoFxToast("success", value + " kaldırıldı · -5 kredi");
        } else {
          state.styles.push(value);
          btn.classList.add("is-active");
          btn.setAttribute("aria-pressed", "true");
          mobilePhotoFxToast("success", value + " seçildi · +5 kredi");
        }

        syncCreditButton();
      });
    });
  }

  function bindControls(){
    if (durationEl) {
      durationEl.addEventListener("change", function(){
        state.duration = safeText(durationEl.value) || "6";
        syncCreditButton();
      });
      state.duration = safeText(durationEl.value) || "6";
    }

    if (ratioEl) {
      ratioEl.addEventListener("change", function(){
        state.ratio = safeText(ratioEl.value) || "9:16";
      });
      state.ratio = safeText(ratioEl.value) || "9:16";
    }

    if (motionLevelEl) {
      motionLevelEl.addEventListener("change", function(){
        state.motionLevel = safeText(motionLevelEl.value) || "balanced";
      });
      state.motionLevel = safeText(motionLevelEl.value) || "balanced";
    }

    if (effectPowerEl) {
      effectPowerEl.addEventListener("change", function(){
        state.effectStrength = safeText(effectPowerEl.value) || "medium";
      });
      state.effectStrength = safeText(effectPowerEl.value) || "medium";
    }

    if (colorMoodEl) {
      colorMoodEl.addEventListener("change", function(){
        state.colorMood = safeText(colorMoodEl.value) || "original";
      });
      state.colorMood = safeText(colorMoodEl.value) || "original";
    }

    if (transitionSpeedEl) {
      transitionSpeedEl.addEventListener("change", function(){
        state.transitionSpeed = safeText(transitionSpeedEl.value) || "normal";
      });
      state.transitionSpeed = safeText(transitionSpeedEl.value) || "normal";
    }

    if (logoPositionEl) {
      logoPositionEl.addEventListener("change", function(){
        state.logoPosition = safeText(logoPositionEl.value) || "bottom-right";
      });
      state.logoPosition = safeText(logoPositionEl.value) || "bottom-right";
    }
  }

  function buildPayload(){
    return {
      app: "photofx",
      prompt: state.prompt,
      preset: state.styles[0] || "neon-pulse",
      styles: state.styles.slice(),
      image_url: state.imageUrl,
      imageUrl: state.imageUrl,
      logo_url: state.logoUrl,
      logoUrl: state.logoUrl,
      logo_enabled: !!state.logoUrl,
      logo_pos:
        state.logoPosition === "top-left"
          ? "tl"
          : state.logoPosition === "top-right"
            ? "tr"
            : state.logoPosition === "bottom-left"
              ? "bl"
              : "br",
      audio_url: state.audioUrl,
      audioUrl: state.audioUrl,
      duration: state.duration,
      aspect_ratio: state.ratio,
      aspectRatio: state.ratio,
      motion_level: state.motionLevel,
      motionLevel: state.motionLevel,
      effect_strength: state.effectStrength,
      effectStrength: state.effectStrength,
      color_mood: state.colorMood,
      colorMood: state.colorMood,
      transition_speed: state.transitionSpeed,
      transitionSpeed: state.transitionSpeed,
      meta: {
        app: "photofx",
        source: "mobile",
        image_url: state.imageUrl,
        logo_url: state.logoUrl,
        logo_enabled: !!state.logoUrl,
        logo_pos:
          state.logoPosition === "top-left"
            ? "tl"
            : state.logoPosition === "top-right"
              ? "tr"
              : state.logoPosition === "bottom-left"
                ? "bl"
                : "br",
        audio_url: state.audioUrl,
        aspect_ratio: state.ratio,
        duration: state.duration,
        styles: state.styles.slice()
      }
    };
  }

  function bindGenerate(){
    if (!generateBtn) return;

    generateBtn.addEventListener("click", async function(){
      const payload = buildPayload();

      if (!payload.image_url) {
        setStatus("Lütfen referans görsel yükle.");
        mobilePhotoFxToast("warning", "Lütfen bir ana görsel seç.");
        return;
      }

      if (!payload.prompt) {
        setStatus("Lütfen prompt yaz.");
        mobilePhotoFxToast("info", "Prompt yazmalısın");
        if (promptEl) promptEl.focus();
        return;
      }

      if (!Array.isArray(payload.styles) || !payload.styles.length) {
        setStatus("Lütfen en az 1 efekt stili seç.");
        mobilePhotoFxToast("warning", "Lütfen en az 1 efekt stili seç.");
        return;
      }

      const creditCost = computeCredit();
      const consumeRequestId = "mobile-photofx:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);

        const refundState = {
        consumed: false,
        refunded: false,
        creditCost: creditCost,
        requestId: consumeRequestId,
        transactionId: ""
      };

      generateBtn.disabled = true;
      generateBtn.textContent = "Üretiliyor...";
      generateBtn.classList.add("is-loading", "is-pressed");
      generateBtn.setAttribute("aria-busy", "true");

      try {
        const consumeResult = await consumeMobilePhotoFxCredits(creditCost, consumeRequestId);

        refundState.consumed = true;
        refundState.transactionId = consumeResult.transactionId || "";

        mobilePhotoFxToast("success", creditCost + " kredi kullanıldı.");
 
           } catch (creditErr) {
        console.warn("[MOBILE PHOTOFX][CREDIT ERROR]", creditErr);
        setStatus("Yetersiz kredi.");
        mobilePhotoFxToast("warning", "Yetersiz kredi.");

        location.hash = "#credits";

        const creditsNav =
          document.querySelector('.bottom-nav a[href="#credits"]') ||
          document.querySelector('[data-mobile-nav="credits"]') ||
          document.querySelector('[data-mobile-tab="credits"]');

        if (creditsNav) {
          creditsNav.click();
        }

        return;
      }

        

      const tempJobId = "mobile-photofx-" + Date.now();

      mobilePhotoFxJobs.unshift({
        id: tempJobId,
        scope: "current",
        status: "processing",
        title: state.prompt.split(/\s+/).slice(0, 4).join(" ") || "PhotoFX klip",
        videoUrl: "",
        payload: payload,
        refundState: refundState
      });

      mobilePhotoFxViewMode = "current";

      if (resultsEl) {
        resultsEl.hidden = false;
      }

      renderMobilePhotoFxResults();
      setStatus("PhotoFX klip hazırlanıyor...");
      mobilePhotoFxLoading("PhotoFX klip hazırlanıyor...");

      try {
        const res = await fetch("/api/providers/fal/photofx/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(function(){
          return {};
        });

        console.log("[MOBILE PHOTOFX][CREATE RESPONSE]", data);

        if (!res.ok || !data.ok || !data.job_id) {
          const job = mobilePhotoFxJobs.find(function(item){
            return item.id === tempJobId;
          });

          if (job) {
            job.status = "error";
            job.title = "PhotoFX klip başlatılamadı";
          }

          renderMobilePhotoFxResults();
          setStatus("PhotoFX klip başlatılamadı.");
          clearMobilePhotoFxLoading();

          await refundMobilePhotoFxCredits(refundState, "mobile_photofx_create_failed", {
            error: data.error || "create_failed",
            response: data
          });

          return;
        }

        const realJobId = String(data.job_id || "").trim();

        const job = mobilePhotoFxJobs.find(function(item){
          return item.id === tempJobId;
        });

        if (job) {
          job.id = realJobId;
          job.status = "processing";
          job.refundState = refundState;
        }

        renderMobilePhotoFxResults();
        mobilePhotoFxLoading("Video hazırlanıyor...");
        pollMobilePhotoFxJob(realJobId);
      } catch (err) {
        console.error("[MOBILE PHOTOFX][CREATE ERROR]", err);

        const job = mobilePhotoFxJobs.find(function(item){
          return item.id === tempJobId;
        });

        if (job) {
          job.status = "error";
          job.title = "PhotoFX klip başlatılamadı";
        }

        renderMobilePhotoFxResults();
        setStatus("PhotoFX klip başlatılamadı.");
        clearMobilePhotoFxLoading();

        await refundMobilePhotoFxCredits(refundState, "mobile_photofx_create_exception", {
          error: String(err?.message || err || "create_exception")
        });
          } finally {
      }
    });
  }

  async function hydrateMobilePhotoFxLibrary(){
    if (!resultsEl) return;

    resultsEl.className = "empty-card";
    resultsEl.innerHTML = "PhotoFX klipleri yükleniyor...";

    try {
      const res = await fetch("/api/jobs/list?app=photofx", {
        method: "GET",
        credentials: "include",
        headers: {
          "accept": "application/json"
        },
        cache: "no-store"
      });

      const data = await res.json().catch(function(){
        return {};
      });

      const rows = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.jobs)
          ? data.jobs
          : Array.isArray(data)
            ? data
            : [];

      mobilePhotoFxJobs.length = 0;

        rows.forEach(function(row){
        const outputs = Array.isArray(row.outputs) ? row.outputs : [];

        const firstVideoOutput = outputs.find(function(output){
          return output && (
            output.url ||
            output.video_url ||
            output.videoUrl ||
            output.src
          );
        });

        const videoUrl = String(
          row.video_url ||
          row.videoUrl ||
          row.final_url ||
          row.finalVideoUrl ||
          row.output_url ||
          row.outputUrl ||
          row.url ||
          row.result_url ||
          row.resultUrl ||
          row.preview_url ||
          row.previewUrl ||
          row.meta?.video_url ||
          row.meta?.videoUrl ||
          row.meta?.final_video_url ||
          row.meta?.finalVideoUrl ||
          row.meta?.final_url ||
          row.meta?.output_url ||
          row.meta?.outputUrl ||
          row.meta?.result_url ||
          row.meta?.resultUrl ||
          row.meta?.preview_video_url ||
          row.meta?.previewVideoUrl ||
          row.data?.video_url ||
          row.data?.videoUrl ||
          row.data?.final_url ||
          row.data?.output_url ||
          row.data?.result_url ||
          row.outputs?.video_url ||
          row.outputs?.videoUrl ||
          row.outputs?.final_video_url ||
          row.outputs?.finalVideoUrl ||
          row.outputs?.final_url ||
          row.outputs?.output_url ||
          row.outputs?.result_url ||
          firstVideoOutput?.url ||
          firstVideoOutput?.video_url ||
          firstVideoOutput?.videoUrl ||
          firstVideoOutput?.final_video_url ||
          firstVideoOutput?.finalVideoUrl ||
          firstVideoOutput?.src ||
          ""
        ).trim();

        const jobId = String(row.id || row.job_id || row.jobId || "").trim();

        if (!jobId || !videoUrl) return;

       mobilePhotoFxJobs.push({
  id: jobId,
  scope: "library",
  title: row.title || row.prompt || row.meta?.prompt || "PhotoFX klip",
  videoUrl: videoUrl,
  status: "ready",
  payload: row
});
      });

      renderMobilePhotoFxResults();
    } catch (err) {
      console.error("[MOBILE PHOTOFX][HYDRATE ERROR]", err);
      resultsEl.className = "empty-card";
      resultsEl.innerHTML = "PhotoFX klipleri yüklenemedi.";
    }
  }

  function bindResultActions(){
    if (!resultsEl || resultsEl.__mobilePhotoFxActionsBound) return;
    resultsEl.__mobilePhotoFxActionsBound = true;

    resultsEl.addEventListener("click", function(e){
      const btn = e.target.closest("[data-mobile-photofx-act]");
      if (!btn) return;

      const card = btn.closest("[data-mobile-photofx-job]");
      if (!card) return;

      const act = btn.getAttribute("data-mobile-photofx-act");
      const id = card.getAttribute("data-mobile-photofx-job");

      const job = mobilePhotoFxJobs.find(function(item){
        return item.id === id;
      });

      if (!job) return;

      if (act === "play") {
        const video = card.querySelector("video");
        if (!video) return;

        video.muted = false;
        video.volume = 1;

        if (video.paused) {
          video.play().catch(function(){});
        } else {
          video.pause();
        }

        return;
      }

      if (act === "sound") {
        const video = card.querySelector("video");
        if (!video) return;

        video.muted = !video.muted;
        btn.textContent = video.muted ? "🔇" : "🔊";

        if (!video.paused) {
          video.play().catch(function(){});
        }

        return;
      }

      if (act === "fullscreen") {
        const video = card.querySelector("video");
        if (!video) return;

        if (video.requestFullscreen) {
          video.requestFullscreen().catch(function(){});
        }

        return;
      }

      if (act === "download") {
        if (!job.videoUrl) return;

        const directUrl = String(job.videoUrl || "").split("#")[0];

        const downloadUrl =
          "/api/media/proxy?url=" +
          encodeURIComponent(directUrl) +
          "&filename=" +
          encodeURIComponent("aivo-photofx-klip.mp4");

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.setAttribute("aria-hidden", "true");
        iframe.src = downloadUrl;

        document.body.appendChild(iframe);
        mobilePhotoFxToast("success", "İndirme başlatıldı.");

        setTimeout(function(){
          try {
            iframe.remove();
          } catch (err) {}
        }, 15000);

        return;
      }

      if (act === "share") {
        if (!job.videoUrl) return;

        if (navigator.share) {
          navigator.share({
            title: "AIVO PhotoFX Klip",
            url: job.videoUrl
          }).catch(function(){});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(job.videoUrl).then(function(){
            mobilePhotoFxToast("success", "Link kopyalandı.");
          }).catch(function(){});
        }

        return;
      }

      if (act === "delete") {
        mobilePhotoFxDeletedIds.add(id);
        renderMobilePhotoFxResults();
        mobilePhotoFxToast("success", "Video silindi.");
        return;
      }
    });
  }

  bindPrompt();
  bindStyleButtons();
  bindControls();
  bindUploads();
  bindFileClearButtons();
  bindGenerate();
  bindResultActions();
  syncCreditButton();

window.mobilePhotoFxShowCurrent = function(){
  mobilePhotoFxViewMode = "current";
  renderMobilePhotoFxResults();
};

window.mobilePhotoFxHydrate = async function(){
  mobilePhotoFxViewMode = "library";
  await hydrateMobilePhotoFxLibrary();
  renderMobilePhotoFxResults();
};
  window.mobilePhotoFxState = state;
})();
