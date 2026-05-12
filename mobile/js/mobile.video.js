(function(){
  const mount = document.getElementById("mobileVideoMount");
  const root = mount
    ? mount.querySelector("#mobileVideoSection")
    : document.getElementById("mobileVideoSection");

  if (!root || root.__mobileVideoBound) return;
  root.__mobileVideoBound = true;

  const promptEl = root.querySelector("#mobileVideoPrompt");
  const promptCountEl = root.querySelector("#mobileVideoPromptCount");
  const imageFileEl = root.querySelector("#mobileVideoImageFile");

  const durationEl = root.querySelector("#mobileVideoDuration");
  const ratioEl = root.querySelector("#mobileVideoRatio");
  const motionEl = root.querySelector("#mobileVideoMotion");
  const qualityEl = root.querySelector("#mobileVideoQuality");

  const generateBtn = root.querySelector("#mobileVideoGenerateBtn");
  const statusEl = root.querySelector("#mobileVideoStatus");
  const resultsEl = root.querySelector("#mobileVideoResults");

 const mobileVideoCurrentJobs = [];
const mobileVideoLibraryJobs = [];
const mobileVideoDeletedIds = new Set();
let mobileVideoViewMode = "current";
const state = {
  mode: "text",
  prompt: "",
  imageFile: null,
  imageUrl: "",
  duration: "5",
  ratio: "16:9",
  motion: "balanced",
  quality: "standard"
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

const MOBILE_VIDEO_TOAST = {
  loadingId: null
};

function mobileVideoToast(type, message, options){
  const text = safeText(message);
  if (!text) return null;

  try {
    const api = window.mobileToast || window.toast || window.AIVO_TOAST;
    const fn = api && typeof api[type] === "function" ? api[type] : null;

    if (fn) {
      return fn.call(api, text, options || {});
    }

    if (api && typeof api.show === "function") {
      return api.show({
        type: type || "info",
        message: text,
        ...(options || {})
      });
    }

    if (window.Toast && typeof window.Toast.show === "function") {
      return window.Toast.show(text, type || "info");
    }
  } catch (err) {}

  return null;
}

function mobileVideoLoading(message){
  MOBILE_VIDEO_TOAST.loadingId = mobileVideoToast("loading", message, {
    persist: true,
    autoClose: false,
    source: "mobile_video"
  });

  return MOBILE_VIDEO_TOAST.loadingId;
}

function clearMobileVideoLoading(){
  const api = window.mobileToast || window.toast || window.AIVO_TOAST;

  try {
    if (MOBILE_VIDEO_TOAST.loadingId && api) {
      if (typeof api.dismiss === "function") {
        api.dismiss(MOBILE_VIDEO_TOAST.loadingId);
      } else if (typeof api.remove === "function") {
        api.remove(MOBILE_VIDEO_TOAST.loadingId);
      }
    }
  } catch (err) {}

  MOBILE_VIDEO_TOAST.loadingId = null;
}
  function setStatus(message){
    if (statusEl) statusEl.textContent = safeText(message);
  }

  function computeCredit(){
    const duration = String(state.duration || "5");
    let total = 20;

    if (duration === "8") total = 25;
    if (duration === "10") total = 30;

    if (state.quality === "high") total += 5;

    return total;
  }

  function syncCreditButton(){
    if (!generateBtn) return;
    const credit = computeCredit();
    generateBtn.textContent = "🎬 Video Oluştur (" + credit + " Kredi)";
    generateBtn.setAttribute("data-credit-cost", String(credit));
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
      data.outputs?.[0]?.video_url ||
      ""
    ).trim();
  }

  async function refreshMobileVideoCreditsUI(){
    try {
      const creditGetRes = await fetch("/api/credits/get", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          "accept": "application/json"
        }
      });

      const creditGetData = await creditGetRes.json().catch(function(){
        return null;
      });

      if (creditGetData && creditGetData.ok && typeof creditGetData.credits === "number") {
        const topCreditCountEl = document.getElementById("topCreditCount");
        if (topCreditCountEl) {
          topCreditCountEl.textContent = String(creditGetData.credits);
        }

        if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
          window.AIVO_STORE_V1.setCredits(creditGetData.credits);
        }
      }
    } catch (err) {}

    try {
      if (typeof window.syncCreditsUI === "function") {
        window.syncCreditsUI({ force: true });
      }
    } catch (err) {}
  }

  async function consumeMobileVideoCredits(creditCost){
    const requestId = "mobile-video:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);

    const res = await fetch("/api/credits/consume-ledger", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        app: "video",
        action: "mobile_video_generate",
        cost: creditCost,
        request_id: requestId,
        reason: "mobile_video_generate"
      })
    });

    const data = await res.json().catch(function(){
      return {
        ok: false,
        error: "non_json_response"
      };
    });

    if (!res.ok || !data || !data.ok) {
      const to = encodeURIComponent(location.pathname + location.search + location.hash);
      mobileVideoToast("warning", "Yetersiz kredi. Paket sayfasına yönlendiriliyorsun.");
      setTimeout(function(){
        location.href = "/fiyatlandirma.html?from=mobile&reason=insufficient_credit&to=" + to;
      }, 900);
      return null;
    }

    await refreshMobileVideoCreditsUI();

    return {
      requestId: requestId,
      transactionId: data.transaction_id || data.transaction?.id || null
    };
  }

  async function refundMobileVideoCredits(ctx){
    if (!ctx || !ctx.requestId || !ctx.transactionId || !ctx.creditCost) return false;

    try {
      const res = await fetch("/api/credits/refund", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          app: "video",
          action: "mobile_video_generate",
          amount: ctx.creditCost,
          request_id: ctx.requestId,
          related_transaction_id: ctx.transactionId,
          reason: ctx.reason || "mobile_video_failed",
          meta: ctx.meta || {}
        })
      });

      const data = await res.json().catch(function(){
        return null;
      });

      if (res.ok && data && data.ok && (data.refunded || data.deduped || data.skipped)) {
        await refreshMobileVideoCreditsUI();
        mobileVideoToast("error", "İşlem başarısız oldu, kredi iade edildi.");
        return true;
      }
    } catch (err) {
      console.error("[MOBILE VIDEO][REFUND ERROR]", err);
    }

    return false;
  }

  function renderMobileVideoResults(){
    if (!resultsEl) return;

   const sourceJobs = mobileVideoViewMode === "library"
  ? mobileVideoLibraryJobs
  : mobileVideoCurrentJobs;

const items = sourceJobs.filter(function(job){
  return !mobileVideoDeletedIds.has(job.id);
});

    if (!items.length) {
      resultsEl.className = "empty-card";
      resultsEl.innerHTML = "Henüz mobil video başlatılmadı.";
      return;
    }

    resultsEl.className = "mobile-photofx-results";

    resultsEl.innerHTML = items.map(function(job){
      const ready = !!job.videoUrl;

      return `
        <article class="mobile-photofx-video-card" data-mobile-video-job="${esc(job.id)}">
          <div class="mobile-photofx-video-media">
            ${
              ready
                ? `<video class="mobile-photofx-video" src="${esc(job.videoUrl)}" playsinline webkit-playsinline preload="metadata"></video>`
                : `<div class="mobile-photofx-video-loading"><span>Hazırlanıyor…</span></div>`
            }

            <div class="mobile-photofx-video-actions">
              <button type="button" data-mobile-video-act="download" ${ready ? "" : "disabled"}>⬇</button>
              <button type="button" data-mobile-video-act="share" ${ready ? "" : "disabled"}>↗</button>
              <button type="button" data-mobile-video-act="sound" ${ready ? "" : "disabled"}>🔇</button>
              <button type="button" data-mobile-video-act="fullscreen" ${ready ? "" : "disabled"}>⛶</button>
              <button type="button" data-mobile-video-act="delete">🗑</button>
            </div>

            ${
              ready
                ? `<button class="mobile-photofx-video-play" type="button" data-mobile-video-act="play">▶</button>`
                : ``
            }
          </div>

          <div class="mobile-photofx-video-title">${esc(job.title || "Video")}</div>
        </article>
      `;
    }).join("");
  }

  function pollMobileVideoJob(jobId, refundCtx){
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
      console.log("[MOBILE VIDEO][POLL]", data);

      const status = String(
        data.status ||
        data.db_status ||
        data.state ||
        ""
      ).toLowerCase();

      const videoUrl = pickVideoUrl(data);

      const job = mobileVideoCurrentJobs.concat(mobileVideoLibraryJobs).find(function(item){
        return item.id === jobId;
      });

      if (!job) return;

 if (videoUrl) {
  job.videoUrl = videoUrl;
  job.status = "ready";
  job.title = job.title || "Video hazır";
  renderMobileVideoResults();
  setStatus("Video hazır.");
  clearMobileVideoLoading();
  mobileVideoToast("success", "Video hazır");
  return;
}

    if (status.includes("fail") || status.includes("error")) {
  job.status = "error";
  job.title = "Video oluşturulamadı";
  renderMobileVideoResults();
  setStatus("Video oluşturulamadı.");

  await refundMobileVideoCredits({
    requestId: refundCtx?.requestId,
    transactionId: refundCtx?.transactionId,
    creditCost: refundCtx?.creditCost,
    reason: "mobile_video_job_failed",
    meta: {
      source: "mobile.video.poll",
      job_id: jobId,
      error: data.error || "mobile_video_job_error"
    }
  });

  clearMobileVideoLoading();
  mobileVideoToast("error", "Video oluşturulamadı");
  return;
}
      setTimeout(function(){
        pollMobileVideoJob(jobId, refundCtx);
      }, 3000);
    })
    .catch(function(err){
      console.error("[MOBILE VIDEO][POLL ERROR]", err);

      setTimeout(function(){
        pollMobileVideoJob(jobId, refundCtx);
      }, 4000);
    });
  }

  async function uploadMobileVideoFile(file){
    if (!file) return "";

    const presignRes = await fetch("/api/r2/scan-and-presign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        app: "video",
        kind: "image",
        filename: file.name,
        contentType: file.type,
        prompt: state.prompt,
        title: file.name,
        description: state.prompt || file.name,
        source: "mobile_video_upload"
      })
    });

    const data = await presignRes.json().catch(function(){
      return {};
    });

    if (!presignRes.ok || !data.ok || !data.uploadUrl && !data.upload_url) {
      throw new Error(data.error || "presign_failed");
    }

    const uploadUrl = data.uploadUrl || data.upload_url;
    const publicUrl = data.publicUrl || data.public_url || data.url;
    const key = data.key || data.objectKey || "";

    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: data.required_headers || {
        "Content-Type": file.type
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
        app: "video",
        key: key,
        filename: file.name,
        contentType: file.type,
        public_url: publicUrl,
        prompt: state.prompt,
        title: file.name,
        description: state.prompt || file.name,
        source: "mobile_video_upload"
      })
    });

    const scanData = await scanRes.json().catch(function(){
      return {};
    });

    if (!scanRes.ok || scanData.decision && String(scanData.decision).toLowerCase() !== "allow") {
      throw new Error(scanData.error || "media_policy_blocked");
    }

    return scanData.public_url || publicUrl;
  }

  function setFileLabel(input, file, statusText){
    const label = input && input.closest("label");
    if (!label) return;

    const textEl = label.querySelector("b");
    const oldClear = label.querySelector(".mobile-video-file-clear");
    if (oldClear) oldClear.remove();

    if (textEl) {
      textEl.textContent = statusText || (file ? "Görsel ✓" : "Görsel Yükle");
    }

    label.classList.toggle("has-file", !!file);

    if (!file) return;

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "mobile-video-file-clear";
    clearBtn.setAttribute("data-mobile-video-clear-file", "mobileVideoImageFile");
    clearBtn.textContent = "×";
    label.appendChild(clearBtn);
  }

  function bindFileClearButton(){
    root.addEventListener("click", function(e){
      const btn = e.target.closest("[data-mobile-video-clear-file]");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      if (!imageFileEl) return;

      const hadImage = !!state.imageFile || !!state.imageUrl;

      imageFileEl.value = "";
      state.imageFile = null;
      state.imageUrl = "";

      setFileLabel(imageFileEl, null);
      setStatus("Görsel kaldırıldı.");

      if (hadImage) {
        mobileVideoToast("success", "Görsel kaldırıldı");
      }
    });
  }

  function bindUpload(){
    if (!imageFileEl) return;

    imageFileEl.addEventListener("change", async function(){
      const file = imageFileEl.files && imageFileEl.files[0] ? imageFileEl.files[0] : null;

      state.imageFile = file;
      state.imageUrl = "";

      setFileLabel(imageFileEl, file, file ? "Yükleniyor..." : "");
      if (!file) return;

     setStatus("Görsel yükleniyor...");
mobileVideoLoading("Görsel güvenlik kontrolünden geçiriliyor...");

      try {
        const publicUrl = await uploadMobileVideoFile(file);
        state.imageUrl = publicUrl;
        setFileLabel(imageFileEl, file);
       clearMobileVideoLoading();
setStatus("Görsel yüklendi.");
mobileVideoToast("success", "Görsel eklendi");
      } catch (err) {
        console.error("[MOBILE VIDEO][UPLOAD ERROR]", err);

        state.imageFile = null;
        state.imageUrl = "";
        imageFileEl.value = "";
       clearMobileVideoLoading();
        setFileLabel(imageFileEl, null);
        setStatus("Görsel yüklenemedi.");

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
  errText.includes("impersonation") ||
  errText.includes("blocked");

mobileVideoToast(
  "error",
  isPolicyBlocked ? "Bu görsel kullanılamaz." : "Yükleme hatası"
);
      }
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
  function bindModeTabs(){
  const modeButtons = Array.from(root.querySelectorAll("[data-mobile-video-mode]"));
  const panels = Array.from(root.querySelectorAll("[data-mobile-video-panel]"));

  if (!modeButtons.length || !panels.length) return;

  function setMode(mode){
    const nextMode = mode === "image" ? "image" : "text";
    state.mode = nextMode;

    modeButtons.forEach(function(btn){
      const active = btn.getAttribute("data-mobile-video-mode") === nextMode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    panels.forEach(function(panel){
      const active = panel.getAttribute("data-mobile-video-panel") === nextMode;
      panel.hidden = !active;
    });

    setStatus("");
  }

  modeButtons.forEach(function(btn){
    btn.addEventListener("click", function(){
      setMode(btn.getAttribute("data-mobile-video-mode"));
    });
  });

  setMode(state.mode || "text");
}
  function bindControls(){
    if (durationEl) {
      durationEl.addEventListener("change", function(){
        state.duration = safeText(durationEl.value) || "5";
        syncCreditButton();
      });
      state.duration = safeText(durationEl.value) || "5";
    }

    if (ratioEl) {
      ratioEl.addEventListener("change", function(){
        state.ratio = safeText(ratioEl.value) || "16:9";
      });
      state.ratio = safeText(ratioEl.value) || "16:9";
    }

    if (motionEl) {
      motionEl.addEventListener("change", function(){
        state.motion = safeText(motionEl.value) || "balanced";
      });
      state.motion = safeText(motionEl.value) || "balanced";
    }

    if (qualityEl) {
      let lastQuality = safeText(qualityEl.value) || "standard";

      qualityEl.addEventListener("change", function(){
        const nextQuality = safeText(qualityEl.value) || "standard";
        state.quality = nextQuality;

        if (nextQuality !== lastQuality) {
          if (nextQuality === "high") {
            mobileVideoToast("success", "Yüksek kalite seçildi · +5 kredi");
          } else if (lastQuality === "high") {
            mobileVideoToast("success", "Standart kalite seçildi · -5 kredi");
          }
        }

        lastQuality = nextQuality;
        syncCreditButton();
      });

      state.quality = lastQuality;
    }
  }

function buildPayload(){
  const mode = state.mode === "image" ? "image" : "text";

  return {
    app: "video",
    mode: mode,
    prompt: state.prompt,
    image_url: mode === "image" ? state.imageUrl : "",
    duration: Number(state.duration || 5),
    ratio: state.ratio || "16:9",
    resolution: state.quality === "high" ? 1080 : 720,
    motion: state.motion || "balanced",
    quality: state.quality || "standard",
    credit_cost: computeCredit(),
    meta: {
      app: "video",
      source: "mobile",
      mode: mode,
      image_url: mode === "image" ? state.imageUrl : "",
      aspect_ratio: state.ratio || "16:9",
      ratio: state.ratio || "16:9",
      duration: Number(state.duration || 5),
      motion: state.motion || "balanced",
      quality: state.quality || "standard"
    }
  };
}

  function bindGenerate(){
    if (!generateBtn) return;

    generateBtn.addEventListener("click", async function(){
      const payload = buildPayload();

   if (!payload.prompt) {
  setStatus("Lütfen prompt yaz.");
  mobileVideoToast("info", "Prompt yazmalısın");
  if (promptEl) promptEl.focus();
  return;
}

if (payload.mode === "image" && !payload.image_url) {
  setStatus("Lütfen referans görsel yükle.");
  mobileVideoToast("warning", "Lütfen referans görsel yükle.");
  return;
}

      const creditCost = Number(payload.credit_cost || computeCredit() || 0);
      const tempJobId = "mobile-video-" + Date.now();

  mobileVideoCurrentJobs.length = 0;

mobileVideoCurrentJobs.unshift({
  id: tempJobId,
  status: "processing",
  title: state.prompt.split(/\s+/).slice(0, 4).join(" ") || "Video",
  videoUrl: "",
  payload: payload
});

mobileVideoViewMode = "current";

if (resultsEl) {
  resultsEl.hidden = false;
}
mobileVideoViewMode = "current";
renderMobileVideoResults();
setStatus("Video hazırlanıyor...");
mobileVideoLoading("Video hazırlanıyor...");

      let consumed = null;

      try {
        consumed = await consumeMobileVideoCredits(creditCost);
        if (!consumed) {
          const job = mobileVideoCurrentJobs.concat(mobileVideoLibraryJobs).find(function(item){
            return item.id === tempJobId;
          });

          if (job) {
            job.status = "error";
            job.title = "Yetersiz kredi";
          }

          renderMobileVideoResults();
          setStatus("Yetersiz kredi.");
          return;
        }

        mobileVideoToast("success", creditCost + " kredi kullanıldı.");

        const res = await fetch("/api/providers/runway/video/create", {
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

        console.log("[MOBILE VIDEO][CREATE RESPONSE]", data);

        const realJobId = String(
          data.job_id ||
          data.job?.job_id ||
          data.job?.id ||
          data.id ||
          ""
        ).trim();

        if (!res.ok || !data.ok || !realJobId) {
          const job = mobileVideoCurrentJobs.concat(mobileVideoLibraryJobs).find(function(item){
            return item.id === tempJobId;
          });

          if (job) {
            job.status = "error";
            job.title = "Video başlatılamadı";
          }

          renderMobileVideoResults();
          setStatus("Video başlatılamadı.");

          await refundMobileVideoCredits({
            requestId: consumed.requestId,
            transactionId: consumed.transactionId,
            creditCost: creditCost,
            reason: "mobile_video_create_failed",
            meta: {
              source: "mobile.video.create",
              prompt: payload.prompt || "",
              image_url: payload.image_url || "",
              duration: payload.duration,
              ratio: payload.ratio,
              error: data.error || "mobile_video_create_failed"
            }
          });

         clearMobileVideoLoading();
        mobileVideoToast("error", "Video başlatılamadı");
         return;
        }

        const job = mobileVideoCurrentJobs.concat(mobileVideoLibraryJobs).find(function(item){
          return item.id === tempJobId;
        });

        if (job) {
          job.id = realJobId;
          job.status = "processing";
          job.payload = {
            ...payload,
            job_id: realJobId
          };
        }

        renderMobileVideoResults();
        setStatus("Video kuyruğa alındı.");
        mobileVideoToast("success", "Video kuyruğa alındı");

        pollMobileVideoJob(realJobId, {
          requestId: consumed.requestId,
          transactionId: consumed.transactionId,
          creditCost: creditCost
        });
      } catch (err) {
        console.error("[MOBILE VIDEO][CREATE ERROR]", err);

        const job = mobileVideoCurrentJobs.concat(mobileVideoLibraryJobs).find(function(item){
          return item.id === tempJobId;
        });

        if (job) {
          job.status = "error";
          job.title = "Video başlatılamadı";
        }

        renderMobileVideoResults();
        setStatus("Video başlatılamadı.");

        if (consumed) {
          await refundMobileVideoCredits({
            requestId: consumed.requestId,
            transactionId: consumed.transactionId,
            creditCost: creditCost,
            reason: "mobile_video_create_exception",
            meta: {
              source: "mobile.video.create",
              prompt: payload.prompt || "",
              image_url: payload.image_url || "",
              duration: payload.duration,
              ratio: payload.ratio,
              error: String(err?.message || err || "mobile_video_create_exception")
            }
          });
        }

       clearMobileVideoLoading();
mobileVideoToast("error", "Video oluşturma hatası");
      }
    });
  }

  async function hydrateMobileVideoLibrary(){
    if (!resultsEl) return;

    resultsEl.className = "empty-card";
    resultsEl.innerHTML = "Videolar yükleniyor...";

    try {
      const res = await fetch("/api/jobs/list?app=video", {
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

  mobileVideoLibraryJobs.length = 0;

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

     mobileVideoLibraryJobs.push({
  id: jobId,
  title: row.title || row.prompt || row.meta?.prompt || "Video",
  videoUrl: videoUrl,
  status: "ready",
  payload: row
});
      });

      mobileVideoViewMode = "library";
      renderMobileVideoResults();
    } catch (err) {
      console.error("[MOBILE VIDEO][HYDRATE ERROR]", err);
      resultsEl.className = "empty-card";
      resultsEl.innerHTML = "Videolar yüklenemedi.";
    }
  }

  function bindResultActions(){
    if (!resultsEl || resultsEl.__mobileVideoActionsBound) return;
    resultsEl.__mobileVideoActionsBound = true;

    resultsEl.addEventListener("click", function(e){
      const btn = e.target.closest("[data-mobile-video-act]");
      if (!btn) return;

      const card = btn.closest("[data-mobile-video-job]");
      if (!card) return;

      const act = btn.getAttribute("data-mobile-video-act");
      const id = card.getAttribute("data-mobile-video-job");

      const job =mobileVideoCurrentJobs.concat(mobileVideoLibraryJobs).find(function(item){
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
          encodeURIComponent("aivo-video.mp4");

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.setAttribute("aria-hidden", "true");
        iframe.src = downloadUrl;

        document.body.appendChild(iframe);
        mobileVideoToast("success", "İndirme başlatıldı.");

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
            title: "AIVO Video",
            url: job.videoUrl
          }).then(function(){
            mobileVideoToast("success", "Paylaşım açıldı.");
          }).catch(function(){});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(job.videoUrl).then(function(){
            mobileVideoToast("success", "Link kopyalandı.");
          }).catch(function(){});
        }

        return;
      }

      if (act === "delete") {
        mobileVideoDeletedIds.add(id);
        renderMobileVideoResults();
        mobileVideoToast("success", "Video silindi.");
        return;
      }
    });
  }

   bindPrompt();
   bindModeTabs();
   bindControls();
   bindUpload();
   bindFileClearButton();
   bindGenerate();
  bindResultActions();
  syncCreditButton();

window.mobileVideoShowCurrent = function(){
  mobileVideoViewMode = "current";
  renderMobileVideoResults();
};
window.mobileVideoHydrate = hydrateMobileVideoLibrary;
})();
