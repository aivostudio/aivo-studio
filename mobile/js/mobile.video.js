(function(){
  const mount = document.getElementById("mobileVideoMount");
  const root = mount
    ? mount.querySelector("#mobileVideoSection")
    : document.getElementById("mobileVideoSection");

  if (!root || root.__mobileVideoBound) return;
  root.__mobileVideoBound = true;

  const promptEl = root.querySelector("#mobileVideoPrompt");
  const promptCountEl = root.querySelector("#mobileVideoPromptCount");
  const imagePromptEl = root.querySelector("#mobileVideoImagePrompt");
  const imagePromptCountEl = root.querySelector("#mobileVideoImagePromptCount");
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
  imagePrompt: "",
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
   function pickPosterUrl(data){
    const outputs = Array.isArray(data?.outputs) ? data.outputs : [];
    const firstPosterOutput = outputs.find(function(output){
      return output && (
        output.poster_url ||
        output.posterUrl ||
        output.thumbnail_url ||
        output.thumbnailUrl ||
        output.thumb_url ||
        output.thumbUrl ||
        output.meta?.poster_url ||
        output.meta?.posterUrl ||
        output.meta?.thumbnail_url ||
        output.meta?.thumbnailUrl ||
        output.meta?.thumb_url ||
        output.meta?.thumbUrl
      );
    });

    return String(
      data.poster_url ||
      data.posterUrl ||
      data.thumbnail_url ||
      data.thumbnailUrl ||
      data.thumb_url ||
      data.thumbUrl ||
      data.meta?.poster_url ||
      data.meta?.posterUrl ||
      data.meta?.thumbnail_url ||
      data.meta?.thumbnailUrl ||
      data.meta?.thumb_url ||
      data.meta?.thumbUrl ||
      firstPosterOutput?.poster_url ||
      firstPosterOutput?.posterUrl ||
      firstPosterOutput?.thumbnail_url ||
      firstPosterOutput?.thumbnailUrl ||
      firstPosterOutput?.thumb_url ||
      firstPosterOutput?.thumbUrl ||
      firstPosterOutput?.meta?.poster_url ||
      firstPosterOutput?.meta?.posterUrl ||
      firstPosterOutput?.meta?.thumbnail_url ||
      firstPosterOutput?.meta?.thumbnailUrl ||
      firstPosterOutput?.meta?.thumb_url ||
      firstPosterOutput?.meta?.thumbUrl ||
      ""
    ).trim();
  }
  function safeText(value){
    return String(value || "").trim();
  }

  function isMobileVideoEn(){
    return String(window.AIVO_LANG || "").toLowerCase().indexOf("en") === 0;
  }

  function mobileVideoText(tr, en){
    return isMobileVideoEn() ? en : tr;
  }

  function mobileVideoCreditsText(count){
    return isMobileVideoEn()
      ? count + " Credits"
      : count + " Kredi";
  }

  const MOBILE_VIDEO_TOAST = {
    lastKey: "",
    lastAt: 0,
    loadingId: null
  };

  function getMobileVideoToastApi(){
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

  function mobileVideoToast(type, message, options){
    const text = safeText(message);
    if (!text) return null;

    const normalizedType = type === "danger" ? "error" : type || "info";
    const key = normalizedType + ":" + text;
    const now = Date.now();

    if (
      key === MOBILE_VIDEO_TOAST.lastKey &&
      now - MOBILE_VIDEO_TOAST.lastAt < 1600
    ) {
      return null;
    }

    MOBILE_VIDEO_TOAST.lastKey = key;
    MOBILE_VIDEO_TOAST.lastAt = now;

    const api = getMobileVideoToastApi();

    try {
      if (api) {
        if (typeof api[normalizedType] === "function") {
          return api[normalizedType](text, options || {});
        }

        if (typeof api.show === "function") {
          return api.show({
            type: normalizedType,
            message: text,
            ...(options || {})
          });
        }

        if (typeof api.push === "function") {
          return api.push({
            type: normalizedType,
            message: text,
            ...(options || {})
          });
        }

        if (typeof api === "function") {
          return api(text, normalizedType, options || {});
        }
      }

      if (window.Toast && typeof window.Toast.show === "function") {
        return window.Toast.show(text, normalizedType);
      }
    } catch (err) {
      console.warn("[MOBILE VIDEO][TOAST FALLBACK]", err);
    }

    setStatus(text);
    return null;
  }

  function mobileVideoLoading(message){
    const api = getMobileVideoToastApi();

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

    MOBILE_VIDEO_TOAST.loadingId = mobileVideoToast("loading", message, {
      persist: true,
      autoClose: false,
      source: "mobile_video"
    });

    return MOBILE_VIDEO_TOAST.loadingId;
  }
  function clearMobileVideoLoading(){
    const api = getMobileVideoToastApi();

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

    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.classList.remove("is-loading", "is-pressed");
      generateBtn.removeAttribute("aria-busy");
      syncCreditButton();
    }
  }

  function mapMobileVideoErrorMessage(err){
    const raw = String(
      err?.message ||
      err?.error ||
      err?.detail ||
      err ||
      ""
    ).toLowerCase();

    if (
      raw.includes("media_policy") ||
      raw.includes("policy_reject") ||
      raw.includes("public_figure") ||
      raw.includes("public figure") ||
      raw.includes("celebrity") ||
      raw.includes("protected_person") ||
      raw.includes("impersonation") ||
      raw.includes("image_blocked") ||
      raw.includes("blocked")
    ) {
      return mobileVideoText(
        "Bu görsel güvenlik politikası nedeniyle kullanılamaz.",
        "This image cannot be used due to safety policy restrictions."
      );
    }

    if (
      raw.includes("insufficient") ||
      raw.includes("yetersiz") ||
      raw.includes("credit")
    ) {
      return mobileVideoText(
        "Yetersiz kredi. Devam etmek için kredi yüklemelisin.",
        "Insufficient credits. Please purchase more credits to continue."
      );
    }

    if (
      raw.includes("presign") ||
      raw.includes("scan") ||
      raw.includes("upload") ||
      raw.includes("r2")
    ) {
      return mobileVideoText(
        "Yükleme sırasında sorun oluştu. Lütfen görseli kontrol edip tekrar dene.",
        "Upload failed. Please check your image and try again."
      );
    }

    if (
      raw.includes("network") ||
      raw.includes("failed to fetch")
    ) {
      return mobileVideoText(
        "Bağlantı sorunu oluştu. Lütfen tekrar dene.",
        "Connection issue detected. Please try again."
      );
    }

    return safeText(err?.message || err?.detail || err) || mobileVideoText(
      "İşlem tamamlanamadı.",
      "The operation could not be completed."
    );
  }

  function setStatus(message){
    if (!statusEl) return;
    statusEl.textContent = safeText(message);
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

    generateBtn.textContent = mobileVideoText(
      "🎬 Video Oluştur (" + mobileVideoCreditsText(credit) + ")",
      "🎬 Create Video (" + mobileVideoCreditsText(credit) + ")"
    );

    generateBtn.setAttribute("data-credit-cost", String(credit));
  }
  function safeMobileVideoUrl(value){
    return String(value == null ? "" : value).trim();
  }

  function normalizeMobileVideoProxyUrl(value){
    const original = safeMobileVideoUrl(value);
    if (!original) return "";

    if (
      !original.startsWith("/api/media/proxy?") &&
      !original.includes("/api/media/proxy?")
    ) {
      return original;
    }

    try {
      const marker = "/api/media/proxy?";
      const query = original.includes(marker)
        ? original.split(marker)[1] || ""
        : original.split("?")[1] || "";

      const params = new URLSearchParams(query);
      const rawUrl = safeMobileVideoUrl(params.get("url"));

      if (
        rawUrl &&
        (
          rawUrl.startsWith("http://") ||
          rawUrl.startsWith("https://")
        )
      ) {
        return rawUrl;
      }
    } catch (err) {}

    return original;
  }

  function isMobileVideoOutput(output){
    const type = safeMobileVideoUrl(
      output?.type ||
      output?.kind ||
      output?.meta?.type ||
      output?.meta?.kind
    ).toLowerCase();

    if (type && type !== "video") return false;

    const app = safeMobileVideoUrl(
      output?.meta?.app ||
      output?.meta?.module ||
      output?.meta?.routeKey
    ).toLowerCase();

    if (app && !app.includes("video")) return false;

    return true;
  }

  function pickMobileVideoOutputUrl(output){
    return safeMobileVideoUrl(
      output?.archive_url ||
      output?.archiveUrl ||
      output?.url ||
      output?.video_url ||
      output?.videoUrl ||
      output?.raw_url ||
      output?.rawUrl ||
      output?.final_video_url ||
      output?.finalVideoUrl ||
      output?.src ||
      output?.meta?.archive_url ||
      output?.meta?.archiveUrl ||
      output?.meta?.url ||
      output?.meta?.video_url ||
      output?.meta?.videoUrl ||
      output?.meta?.raw_url ||
      output?.meta?.rawUrl ||
      output?.meta?.final_video_url ||
      output?.meta?.finalVideoUrl ||
      output?.meta?.src ||
      ""
    );
  }

  function pickVideoUrl(data){
    const outputs = Array.isArray(data?.outputs)
      ? data.outputs.filter(isMobileVideoOutput)
      : [];

    const directFinal = safeMobileVideoUrl(
      data.video_url ||
      data.videoUrl ||
      data.final_url ||
      data.finalUrl ||
      data.final_video_url ||
      data.finalVideoUrl ||
      data.url ||
      data.video?.url ||
      data.output?.video?.url ||
      data.meta?.final_video_url ||
      data.meta?.finalVideoUrl ||
      data.meta?.final_url ||
      data.meta?.finalUrl ||
      data.meta?.video_url ||
      data.meta?.videoUrl ||
      ""
    );

    if (directFinal) {
      return normalizeMobileVideoProxyUrl(directFinal);
    }

    const finalizedOutput = outputs.find(function(output){
      const variant = safeMobileVideoUrl(output?.meta?.variant).toLowerCase();

      return (
        variant === "finalized" ||
        variant === "final" ||
        output?.meta?.is_final === true
      );
    });

    const finalizedUrl = pickMobileVideoOutputUrl(finalizedOutput);
    if (finalizedUrl) {
      return normalizeMobileVideoProxyUrl(finalizedUrl);
    }

    const providerOutput = outputs.find(function(output){
      return safeMobileVideoUrl(output?.meta?.variant).toLowerCase() === "provider";
    });

    const providerUrl = pickMobileVideoOutputUrl(providerOutput);
    if (providerUrl) {
      return normalizeMobileVideoProxyUrl(providerUrl);
    }

    const previewOutput = outputs.find(function(output){
      return safeMobileVideoUrl(output?.meta?.variant).toLowerCase() === "preview";
    });

    const previewUrl = pickMobileVideoOutputUrl(previewOutput);
    if (previewUrl) {
      return normalizeMobileVideoProxyUrl(previewUrl);
    }

    const firstOutputUrl = pickMobileVideoOutputUrl(outputs[0]);
    if (firstOutputUrl) {
      return normalizeMobileVideoProxyUrl(firstOutputUrl);
    }

    return "";
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

      const nextCredits = creditGetData?.credits ?? creditGetData?.balance ?? creditGetData?.credit;

      if (creditGetData && creditGetData.ok && typeof nextCredits === "number") {
        const topCreditCountEl = document.getElementById("topCreditCount");
        if (topCreditCountEl) {
          topCreditCountEl.textContent = String(nextCredits);
        }

        const mobileCreditEls = Array.from(document.querySelectorAll("[data-mobile-credit-balance]"));
        mobileCreditEls.forEach(function(el){
          el.textContent = isMobileVideoEn()
            ? "Credits " + nextCredits
            : "Kredi " + nextCredits;
        });

        if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") {
          window.AIVO_STORE_V1.setCredits(nextCredits);
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
      mobileVideoToast("warning", mobileVideoText(
        "Yetersiz kredi. Krediler bölümüne yönlendiriliyorsun...",
        "Insufficient credits. Redirecting you to Credits..."
      ));

      location.hash = "#credits";

      const creditsNav =
        document.querySelector('.bottom-nav a[href="#credits"]') ||
        document.querySelector('[data-mobile-nav="credits"]') ||
        document.querySelector('[data-mobile-tab="credits"]');

      if (creditsNav) {
        creditsNav.click();
      }

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
        mobileVideoToast("error", mobileVideoText(
          "İşlem başarısız oldu, kredi iade edildi.",
          "The process failed, credits were refunded."
        ));
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
      resultsEl.innerHTML = mobileVideoText(
        "Henüz video üretimi yok.",
        "No video has been created yet."
      );
      return;
    }

    resultsEl.className = "mobile-photofx-results";

    resultsEl.innerHTML = items.map(function(job){
      const ready = !!job.videoUrl;
      const posterAttr = job.posterUrl
        ? ` poster="${esc(job.posterUrl)}"`
        : "";

      return `
        <article class="mobile-photofx-video-card" data-mobile-video-job="${esc(job.id)}">
          <div class="mobile-photofx-video-media">
            ${
              ready
                  ? `<video class="mobile-photofx-video" src="${esc(job.videoUrl)}"${posterAttr} playsinline webkit-playsinline preload="metadata"></video>`
                : `<div class="mobile-photofx-video-loading"><span>${mobileVideoText("Hazırlanıyor…", "Preparing…")}</span></div>`
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

          <div class="mobile-photofx-video-title">${esc(job.title || mobileVideoText("Video", "Video"))}</div>
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
        job.posterUrl = pickPosterUrl(data);
        job.status = "ready";
        job.title = job.title || mobileVideoText(
          "Video hazır",
          "Video is ready"
        );
        renderMobileVideoResults();
        setStatus(mobileVideoText(
          "Video hazır.",
          "Video is ready."
        ));
        clearMobileVideoLoading();
        mobileVideoToast("success", mobileVideoText(
          "Video hazır.",
          "Video is ready."
        ));
        return;
      }

      if (
        status.includes("fail") ||
        status.includes("error") ||
        status.includes("cancel")
      ) {
        job.status = "error";
        job.title = mobileVideoText(
          "Video oluşturulamadı",
          "Video could not be created"
        );

        renderMobileVideoResults();
        setStatus(mobileVideoText(
          "Video oluşturulamadı.",
          "Video could not be created."
        ));

        await refundMobileVideoCredits({
          requestId: refundCtx?.requestId,
          transactionId: refundCtx?.transactionId,
          creditCost: refundCtx?.creditCost,
          reason: "mobile_video_job_failed",
          meta: {
            source: "mobile.video.poll",
            job_id: jobId,
            error: data.error || "mobile_video_job_error",
            status: status,
            response: data
          }
        });

        clearMobileVideoLoading();
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
      textEl.textContent = statusText || (file
        ? mobileVideoText("Görsel ✓", "Image ✓")
        : mobileVideoText("Görsel Yükle", "Upload Image")
      );
    }

    label.classList.toggle("has-file", !!file);

    if (!file) return;

    const clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "mobile-video-file-clear";
    clearBtn.setAttribute("data-mobile-video-clear-file", "mobileVideoImageFile");
    clearBtn.setAttribute("aria-label", mobileVideoText("Görseli kaldır", "Remove image"));
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
      setStatus(mobileVideoText(
        "Görsel kaldırıldı.",
        "Image removed."
      ));

      if (hadImage) {
        mobileVideoToast("success", mobileVideoText(
          "Görsel kaldırıldı.",
          "Image removed."
        ));
      }
    });
  }

  function bindUpload(){
    if (!imageFileEl) return;

    imageFileEl.addEventListener("change", async function(){
      const file = imageFileEl.files && imageFileEl.files[0] ? imageFileEl.files[0] : null;

      state.imageFile = file;
      state.imageUrl = "";

      setFileLabel(imageFileEl, file, file
        ? mobileVideoText("Yükleniyor...", "Uploading...")
        : ""
      );

      if (!file) return;

      setStatus(mobileVideoText(
        "Görsel yükleniyor...",
        "Image is uploading..."
      ));
      mobileVideoLoading(mobileVideoText(
        "Görsel güvenlik kontrolünden geçiriliyor...",
        "Image is being checked for safety..."
      ));

      try {
        const publicUrl = await uploadMobileVideoFile(file);
        state.imageUrl = publicUrl;

        setFileLabel(imageFileEl, file);
        clearMobileVideoLoading();

        setStatus(mobileVideoText(
          "Görsel yüklendi.",
          "Image uploaded."
        ));
        mobileVideoToast("success", mobileVideoText(
          "Görsel eklendi.",
          "Image added."
        ));
      } catch (err) {
        console.error("[MOBILE VIDEO][UPLOAD ERROR]", err);

        state.imageFile = null;
        state.imageUrl = "";
        imageFileEl.value = "";

        clearMobileVideoLoading();
        setFileLabel(imageFileEl, null);

        const message = mapMobileVideoErrorMessage(err);

        setStatus(message);
        mobileVideoToast("error", message);
      }
    });
  }

  function bindPrompt(){
    function updateTextPrompt(){
      if (!promptEl) return;

      const value = String(promptEl.value || "");
      state.prompt = value.trim();

      if (promptCountEl) {
        promptCountEl.textContent = String(value.length);
      }
    }

    function updateImagePrompt(){
      if (!imagePromptEl) return;

      const value = String(imagePromptEl.value || "");
      state.imagePrompt = value.trim();

      if (imagePromptCountEl) {
        imagePromptCountEl.textContent = String(value.length);
      }
    }

    if (promptEl) {
      promptEl.addEventListener("input", updateTextPrompt);
      promptEl.addEventListener("change", updateTextPrompt);
    }

    if (imagePromptEl) {
      imagePromptEl.addEventListener("input", updateImagePrompt);
      imagePromptEl.addEventListener("change", updateImagePrompt);
    }

    updateTextPrompt();
    updateImagePrompt();
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
            mobileVideoToast("success", mobileVideoText(
              "Yüksek kalite seçildi · +5 kredi",
              "High quality selected · +5 credits"
            ));
          } else if (lastQuality === "high") {
            mobileVideoToast("success", mobileVideoText(
              "Standart kalite seçildi · -5 kredi",
              "Standard quality selected · -5 credits"
            ));
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
  const activePrompt = mode === "image" ? state.imagePrompt : state.prompt;

  return {
    app: "video",
    mode: mode,
    prompt: activePrompt,
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
      if (state.mode === "image") {
        if (imagePromptEl) {
          state.imagePrompt = safeText(imagePromptEl.value);

          if (imagePromptCountEl) {
            imagePromptCountEl.textContent =
              String(String(imagePromptEl.value || "").length);
          }
        }
      } else {
        if (promptEl) {
          state.prompt = safeText(promptEl.value);

          if (promptCountEl) {
            promptCountEl.textContent =
              String(String(promptEl.value || "").length);
          }
        }
      }

      const payload = buildPayload();

      if (!safeText(payload.prompt)) {
        const message = mobileVideoText(
          "Lütfen prompt yaz.",
          "Please enter a prompt."
        );

        setStatus(message);
        mobileVideoToast("info", message);

        if (state.mode === "image") {
          if (imagePromptEl) imagePromptEl.focus();
        } else {
          if (promptEl) promptEl.focus();
        }

        return;
      }

      if (payload.mode === "image" && !payload.image_url) {
        const message = mobileVideoText(
          "Lütfen referans görsel yükle.",
          "Please upload a reference image."
        );

        setStatus(message);
        mobileVideoToast("warning", message);
        return;
      }

      const creditCost = Number(payload.credit_cost || computeCredit() || 0);
      const tempJobId = "mobile-video-" + Date.now();
      const activeTitle = payload.prompt.split(/\s+/).slice(0, 4).join(" ") || mobileVideoText("Video", "Video");

      mobileVideoCurrentJobs.length = 0;

      mobileVideoCurrentJobs.unshift({
        id: tempJobId,
        status: "processing",
        title: activeTitle,
        videoUrl: "",
        payload: payload
      });

      mobileVideoViewMode = "current";

      if (resultsEl) {
        resultsEl.hidden = false;
      }

      generateBtn.disabled = true;
      generateBtn.textContent = mobileVideoText("Üretiliyor...", "Generating...");
      generateBtn.classList.add("is-loading", "is-pressed");
      generateBtn.setAttribute("aria-busy", "true");

      renderMobileVideoResults();
      setStatus(mobileVideoText(
        "Video hazırlanıyor...",
        "Video is being prepared..."
      ));
      mobileVideoLoading(mobileVideoText(
        "Video hazırlanıyor...",
        "Video is being prepared..."
      ));

      let consumed = null;

      try {
        consumed = await consumeMobileVideoCredits(creditCost);

        if (!consumed) {
          const job = mobileVideoCurrentJobs.concat(mobileVideoLibraryJobs).find(function(item){
            return item.id === tempJobId;
          });

          if (job) {
            job.status = "error";
            job.title = mobileVideoText(
              "Yetersiz kredi",
              "Insufficient credits"
            );
          }

          renderMobileVideoResults();
          setStatus(mobileVideoText(
            "Yetersiz kredi.",
            "Insufficient credits."
          ));
          clearMobileVideoLoading();
          return;
        }

        mobileVideoToast("success", mobileVideoText(
          creditCost + " kredi düşüldü.",
          creditCost + " credits used."
        ));

        setStatus(mobileVideoText(
          "Üretim başlatılıyor...",
          "Generation is starting..."
        ));
        mobileVideoLoading(mobileVideoText(
          "Üretim başlatılıyor...",
          "Generation is starting..."
        ));

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
            job.title = mobileVideoText(
              "Video başlatılamadı",
              "Video could not be started"
            );
          }

          renderMobileVideoResults();
          setStatus(mobileVideoText(
            "Video başlatılamadı.",
            "Video could not be started."
          ));

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
        setStatus(mobileVideoText(
          "Video kuyruğa alındı.",
          "Video has been queued."
        ));
        mobileVideoLoading(mobileVideoText(
          "Video hazırlanıyor...",
          "Video is being prepared..."
        ));

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
          job.title = mobileVideoText(
            "Video başlatılamadı",
            "Video could not be started"
          );
        }

        renderMobileVideoResults();

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

        const message = mapMobileVideoErrorMessage(err);

        setStatus(message);
        clearMobileVideoLoading();
        mobileVideoToast("error", message);
      }
    });
  }
  async function hydrateMobileVideoLibrary(){
    if (!resultsEl) return;

    resultsEl.className = "empty-card";
    resultsEl.innerHTML = mobileVideoText(
      "Videolar yükleniyor...",
      "Videos are loading..."
    );

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
          title: row.title || row.prompt || row.meta?.prompt || mobileVideoText("Video", "Video"),
          videoUrl: videoUrl,
          posterUrl: pickPosterUrl(row),
          status: "ready",
          payload: row
        });
      });

      mobileVideoViewMode = "library";
      renderMobileVideoResults();
    } catch (err) {
      console.error("[MOBILE VIDEO][HYDRATE ERROR]", err);
      resultsEl.className = "empty-card";
      resultsEl.innerHTML = mobileVideoText(
        "Videolar yüklenemedi.",
        "Videos could not be loaded."
      );
    }
  }

  function bindResultActions(){
    if (!resultsEl || resultsEl.__mobileVideoActionsBound) return;
    resultsEl.__mobileVideoActionsBound = true;

    resultsEl.addEventListener("click", async function(e){
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

             function syncPlayButton(){
          const isPlaying = !video.paused && !video.ended;

          btn.classList.toggle("is-playing", isPlaying);
          btn.setAttribute("data-playing", isPlaying ? "true" : "false");

          btn.setAttribute(
            "aria-label",
            isPlaying
              ? mobileVideoText("Duraklat", "Pause")
              : mobileVideoText("Oynat", "Play")
          );
        }

        video.onplay = syncPlayButton;
        video.onpause = syncPlayButton;
        video.onended = syncPlayButton;

        if (video.paused || video.ended) {
          video.play().then(syncPlayButton).catch(syncPlayButton);
        } else {
          video.pause();
          syncPlayButton();
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
          return;
        }

        if (video.webkitEnterFullscreen) {
          video.webkitEnterFullscreen();
          return;
        }

        if (video.webkitRequestFullscreen) {
          video.webkitRequestFullscreen();
          return;
        }

        return;
      }
       if (act === "download") {
        if (!job.videoUrl) return;

        let directUrl = String(job.videoUrl || "").trim();
        const filename = "aivo-video.mp4";

        directUrl = directUrl.includes("#")
          ? directUrl.split("#")[0]
          : directUrl;

        if (
          directUrl.startsWith("/api/media/proxy?url=") ||
          directUrl.includes("/api/media/proxy?url=")
        ) {
          try {
            const encoded = directUrl.split("url=")[1] || "";
            directUrl = decodeURIComponent(encoded).split("#")[0];
          } catch {}
        }

        try {
          const response = await fetch(directUrl, {
            method: "GET",
            cache: "no-store"
          });

          if (!response.ok) {
            throw new Error("mobile_video_download_failed_" + response.status);
          }

          const blob = await response.blob();
          const file = new File([blob], filename, {
            type: blob.type || "video/mp4"
          });

          if (
            navigator.canShare &&
            navigator.canShare({ files: [file] }) &&
            navigator.share
          ) {
            await navigator.share({
              files: [file],
              title: "AIVO Video"
            });
            return;
          }

          const objectUrl = URL.createObjectURL(blob);

          const a = document.createElement("a");
          a.href = objectUrl;
          a.download = filename;
          a.rel = "noopener";
          a.style.display = "none";

          document.body.appendChild(a);
          a.click();

          mobileVideoToast("success", mobileVideoText(
            "İndirme başlatıldı.",
            "Download started."
          ));

          setTimeout(function(){
            try {
              a.remove();
            } catch (err) {}

            try {
              URL.revokeObjectURL(objectUrl);
            } catch (err) {}
          }, 1500);
        } catch (err) {
          console.error("[MOBILE VIDEO][DOWNLOAD ERROR]", err);
          window.open(directUrl, "_blank", "noopener");
        }

        return;
      }

      if (act === "share") {
        if (!job.videoUrl) return;

        if (navigator.share) {
          navigator.share({
            title: "AIVO Video",
            url: job.videoUrl
          }).then(function(){
                mobileVideoToast("success", mobileVideoText(
              "Paylaşım açıldı.",
              "Share sheet opened."
            ));
          }).catch(function(){});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(job.videoUrl).then(function(){
                  mobileVideoToast("success", mobileVideoText(
              "Link kopyalandı.",
              "Link copied."
            ));
          }).catch(function(){});
        }

        return;
      }

      if (act === "delete") {
             mobileVideoDeletedIds.add(id);

        renderMobileVideoResults();

        mobileVideoToast("success", mobileVideoText(
          "Video silindi.",
          "Video deleted."
        ));

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
