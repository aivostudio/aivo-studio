(function(){
  const root = document.getElementById("mobileLipsyncSection");
  if (!root || root.__mobileLipsyncBound) return;
  root.__mobileLipsyncBound = true;

  const scriptEl = root.querySelector("#mobileLipsyncScript");
  const counterEl = root.querySelector("#mobileLipsyncCounter");
  const photoInput = root.querySelector("#mobileLipsyncPhotoFile");
  const audioInput = root.querySelector("#mobileLipsyncAudioFile");
  const audioNameEl = root.querySelector("#mobileLipsyncAudioName");
  const photoDrop = root.querySelector(".mobile-lipsync-photo-drop");
  const photoPreview = root.querySelector("[data-mobile-lipsync-photo-preview]");
  const photoRemoveBtn = root.querySelector("[data-mobile-lipsync-photo-remove]");
  const resolutionEl = root.querySelector("#mobileLipsyncResolution");
  const aspectEl = root.querySelector("#mobileLipsyncAspect");
  const voiceSelectEl = root.querySelector("#mobileLipsyncVoice");
  const speedEl = root.querySelector("[data-mobile-lipsync-voice-speed]");
  const volumeEl = root.querySelector("[data-mobile-lipsync-voice-volume]");
  const speedLabelEl = root.querySelector("[data-mobile-lipsync-speed-label]");
  const volumeLabelEl = root.querySelector("[data-mobile-lipsync-volume-label]");
  const previewVoiceBtn = root.querySelector("[data-mobile-lipsync-preview-voice]");
  const recordOpenBtn = root.querySelector("[data-mobile-lipsync-record-open]");
  const uploadOpenBtn = root.querySelector("[data-mobile-lipsync-upload-open]");
  const generateBtn = root.querySelector("#mobileLipsyncGenerateBtn");
  const statusEl = root.querySelector("#mobileLipsyncStatus");
  const resultsEl = root.querySelector("#mobileLipsyncResults");

  const mobileLipsyncCurrentJobs = [];
  const mobileLipsyncLibraryJobs = [];
  const mobileLipsyncDeletedIds = new Set();
  let mobileLipsyncViewMode = "current";

  const state = {
    photoFile: null,
    audioFile: null,
    photoUrl: "",
    audioUrl: "",
    audioDurationSeconds: 0,
    script: "",
    resolution: "1080p",
    aspectRatio: "16:9",
    voiceKey: "tranquil_tulin",
    voiceName: "Tranquil Tülin",
    voiceSpeed: 1,
    voiceVolume: 1
  };

  const VOICE_PREVIEW_R2_URLS = {
    tranquil_tulin: "https://media.aivo.tr/lipsync/voice-previews/tranquil-tulin.mp3",
    iker: "https://media.aivo.tr/lipsync/voice-previews/iker.mp3",
    deep_dieter: "https://media.aivo.tr/lipsync/voice-previews/deep-dieter.mp3",
    william: "https://media.aivo.tr/lipsync/voice-previews/william.mp3",
    menon: "https://media.aivo.tr/lipsync/voice-previews/menon.mp3",
    knox: "https://media.aivo.tr/lipsync/voice-previews/knox.mp3",
    aaron: "https://media.aivo.tr/lipsync/voice-previews/aaron.mp3",
    lily: "https://media.aivo.tr/lipsync/voice-previews/lily.mp3",
    april: "https://media.aivo.tr/lipsync/voice-previews/april.mp3",
    tiffany: "https://media.aivo.tr/lipsync/voice-previews/tiffany.mp3",
    brianna: "https://media.aivo.tr/lipsync/voice-previews/brianna.mp3",
    evelyn: "https://media.aivo.tr/lipsync/voice-previews/evelyn.mp3"
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

  const LIPSYNC_BAD_TEXT_MESSAGE =
    "Bu metin uygunsuz dil içerdiği için üretim başlatılamadı. Lütfen küfür, hakaret veya nefret söylemi içermeyen bir metin girin.";

  const MOBILE_LIPSYNC_TOAST = {
    lastKey: "",
    lastAt: 0,
    loadingId: null
  };

  function normalizeLipsyncPolicyText(value){
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasLipsyncBadLanguage(value){
    const text = normalizeLipsyncPolicyText(value);

    const blockedTerms = [
      "amk",
      "aq",
      "mk",
      "orospu",
      "orospu cocugu",
      "pic",
      "pezevenk",
      "got",
      "gotveren",
      "siktir",
      "sik",
      "sikerim",
      "sikeyim",
      "yarrak",
      "yarak",
      "tasak",
      "tassak",
      "ibne",
      "kahpe",
      "kaltak",
      "aptal",
      "salak",
      "gerizekali",
      "mal",
      "ezik",
      "asagilik",
      "aşağılık",
      "nefret",
      "geber",
      "ol geber",
      "oldur",
      "öldür",
      "katlet",
      "yok et"
    ];

    return blockedTerms.some(function(term){
      const safeTerm = normalizeLipsyncPolicyText(term);
      if (!safeTerm) return false;

      const pattern = safeTerm
        .split(/\s+/)
        .filter(Boolean)
        .map(function(part){
          return part + "[a-z0-9]*";
        })
        .join("\\s+");

      const rx = new RegExp("(^|\\s)" + pattern + "(?=\\s|$)", "i");
      return rx.test(text);
    });
  }

  function getMobileToastApi(){
    return (
      window.mobileToast ||
      window.MobileToast ||
      window.AIVO_MOBILE_TOAST ||
      window.aivoMobileToast ||
      window.toast ||
      null
    );
  }

  function callMobileToast(type, message, options){
    const text = safeText(message);
    if (!text) return null;

    const normalizedType = type === "danger" ? "error" : type;
    const key = normalizedType + ":" + text;
    const now = Date.now();

    if (
      key === MOBILE_LIPSYNC_TOAST.lastKey &&
      now - MOBILE_LIPSYNC_TOAST.lastAt < 1600
    ) {
      return null;
    }

    MOBILE_LIPSYNC_TOAST.lastKey = key;
    MOBILE_LIPSYNC_TOAST.lastAt = now;

    const toastApi = getMobileToastApi();

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
    } catch (err) {
      console.warn("[MOBILE LIPSYNC][TOAST FALLBACK]", err);
    }

    setStatus(text);
    return null;
  }

  function showMobileLipsyncToast(type, message, options){
    return callMobileToast(type || "info", message, options || {});
  }

  function showMobileLipsyncLoading(message){
    MOBILE_LIPSYNC_TOAST.loadingId = showMobileLipsyncToast("loading", message, {
      persist: true,
      autoClose: false,
      source: "mobile_lipsync"
    });

    return MOBILE_LIPSYNC_TOAST.loadingId;
  }

  function clearMobileLipsyncLoading(){
    const toastApi = getMobileToastApi();

    try {
      if (MOBILE_LIPSYNC_TOAST.loadingId && toastApi) {
        if (typeof toastApi.dismiss === "function") {
          toastApi.dismiss(MOBILE_LIPSYNC_TOAST.loadingId);
        } else if (typeof toastApi.remove === "function") {
          toastApi.remove(MOBILE_LIPSYNC_TOAST.loadingId);
        }
      }
    } catch {}

    MOBILE_LIPSYNC_TOAST.loadingId = null;

    if (generateBtn) {
      generateBtn.disabled = false;
      generateBtn.classList.remove("is-loading", "is-pressed");
      generateBtn.removeAttribute("aria-busy");
      syncGenerateButton();
    }
  }

  function mapMobileLipsyncErrorMessage(err){
    const raw = String(
      err?.message ||
      err?.error ||
      err?.detail ||
      err ||
      ""
    ).toLowerCase();

    if (
      raw.includes("bad_language_policy") ||
      raw.includes("uygunsuz dil")
    ) {
      return LIPSYNC_BAD_TEXT_MESSAGE;
    }

    if (raw.includes("script_too_long")) {
      return "Bu metin çok uzun. Lütfen daha kısa bir metin gir.";
    }

    if (raw.includes("audio_too_long")) {
      return "Ses dosyası en fazla 60 saniye olabilir.";
    }

    if (
      raw.includes("media_policy") ||
      raw.includes("policy_reject") ||
      raw.includes("impersonation") ||
      raw.includes("tanınmış kişi") ||
      raw.includes("taninmis kisi") ||
      raw.includes("kamu figürü") ||
      raw.includes("kamu figuru")
    ) {
      return "Bu medya güvenlik politikası nedeniyle kullanılamaz.";
    }

    if (
      raw.includes("insufficient") ||
      raw.includes("yetersiz") ||
      raw.includes("credit")
    ) {
      return "Yetersiz kredi. Devam etmek için kredi yüklemelisin.";
    }

    if (raw.includes("presign") || raw.includes("scan") || raw.includes("upload")) {
      return "Yükleme sırasında sorun oluştu. Lütfen dosyayı kontrol edip tekrar dene.";
    }

    if (raw.includes("network") || raw.includes("failed to fetch")) {
      return "Bağlantı sorunu oluştu. Lütfen tekrar dene.";
    }

    return safeText(err?.message || err?.detail || err) || "İşlem tamamlanamadı.";
  }

  function setStatus(message){
    if (!statusEl) return;
    statusEl.textContent = safeText(message);
  }

  function calculateCredits(){
    if (state.audioFile && state.audioDurationSeconds > 0) {
      return Math.ceil(state.audioDurationSeconds / 2) * 3;
    }

    const charsPerSecond = 9;
    const seconds = Math.max(1, Math.ceil(safeText(state.script).length / charsPerSecond));
    return safeText(state.script) ? Math.ceil(seconds / 2) * 3 : 0;
  }

  function calculateSpeechSeconds(){
    if (state.audioFile && state.audioDurationSeconds > 0) {
      return state.audioDurationSeconds;
    }

    const charsPerSecond = 9;
    return Math.max(1, Math.ceil(safeText(state.script).length / charsPerSecond));
  }
    const MOBILE_LIPSYNC_CREDIT_ACTION = "mobile_lipsync_generate";

  async function refreshMobileLipsyncCredits(){
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

  async function consumeMobileLipsyncCredits(creditCost, requestId){
    const res = await fetch("/api/credits/consume-ledger", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        app: "lipsync",
        action: MOBILE_LIPSYNC_CREDIT_ACTION,
        cost: creditCost,
        request_id: requestId,
        reason: MOBILE_LIPSYNC_CREDIT_ACTION
      })
    });

    const data = await res.json().catch(function(){
      return {};
    });

    if (!res.ok || !data || !data.ok) {
      const err = new Error(data.error || "insufficient_credit");
      err.data = data;
      err.status = res.status;
      throw err;
    }

    await refreshMobileLipsyncCredits();

    return {
      transactionId: data.transaction_id || data.transaction?.id || "",
      raw: data
    };
  }

  async function refundMobileLipsyncCredits(refundState, reason, meta){
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
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          app: "lipsync",
          action: MOBILE_LIPSYNC_CREDIT_ACTION,
          amount: refundState.creditCost,
          request_id: refundState.requestId,
          related_transaction_id: refundState.transactionId,
          reason: reason || "mobile_lipsync_failed",
          meta: {
            source: "mobile.lipsync",
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
        await refreshMobileLipsyncCredits();
        showMobileLipsyncToast("error", "İşlem başarısız oldu, kredi iade edildi.");
        return true;
      }
    } catch (err) {
      console.error("[MOBILE LIPSYNC][REFUND ERROR]", err);
    }

    return false;
  }
  
  function syncGenerateButton(){
    if (!generateBtn) return;

    const hasSpeech = Boolean(safeText(state.script) || state.audioFile);
    const credits = calculateCredits();
    const policyBlocked = Boolean(safeText(state.script) && hasLipsyncBadLanguage(state.script));

    if (policyBlocked) {
      generateBtn.disabled = true;
      generateBtn.classList.add("is-policy-blocked");
      generateBtn.textContent = "Üretim Engellendi";
      return;
    }

    generateBtn.classList.remove("is-policy-blocked");
    generateBtn.disabled = false;

    if (!hasSpeech) {
      generateBtn.textContent = "Dudak Senkron Video Üret";
      return;
    }

    generateBtn.textContent = "Dudak Senkron Video Üret (" + credits + " Kredi)";
  }

  function isMobileLipsyncLibraryView(){
    const activeNav = document.querySelector(".mobile-bottom-nav .is-active, [data-mobile-nav].is-active, [data-mobile-tab].is-active");
    const activeText = String(activeNav?.textContent || "").toLowerCase();

    return (
      activeText.includes("üretimler") ||
      activeText.includes("uretimler") ||
      document.body.classList.contains("is-mobile-productions")
    );
  }

  function renderMobileLipsyncResults(forceMode){
    if (!resultsEl) return;

    const mode = forceMode || mobileLipsyncViewMode;

    const sourceJobs = mode === "library"
      ? mobileLipsyncLibraryJobs
      : mobileLipsyncCurrentJobs;
    const items = sourceJobs.filter(function(job){
      return !mobileLipsyncDeletedIds.has(job.id);
    });

    if (!items.length) {
      resultsEl.className = "empty-card";
      resultsEl.innerHTML = "Henüz dudak senkron video üretimi yok.";
      return;
    }

    resultsEl.className = "mobile-lipsync-results";

    resultsEl.innerHTML = items.map(function(job){
      const ready = Boolean(job.videoUrl);

      return `
        <article class="mobile-lipsync-video-card" data-mobile-lipsync-job="${esc(job.id)}">
          <div class="mobile-lipsync-video-media">
            ${
              ready
                ? `<video class="mobile-lipsync-video" src="${esc(job.videoUrl)}" playsinline webkit-playsinline preload="metadata"></video>`
                : `<div class="mobile-lipsync-video-loading"><span>Hazırlanıyor…</span></div>`
            }

            <div class="mobile-lipsync-video-actions">
              <button type="button" data-mobile-lipsync-act="download" ${ready ? "" : "disabled"}>⬇</button>
              <button type="button" data-mobile-lipsync-act="share" ${ready ? "" : "disabled"}>↗</button>
              <button type="button" data-mobile-lipsync-act="sound" ${ready ? "" : "disabled"}>🔇</button>
              <button type="button" data-mobile-lipsync-act="fullscreen" ${ready ? "" : "disabled"}>⛶</button>
              <button type="button" data-mobile-lipsync-act="delete">🗑</button>
            </div>

            ${
              ready
                ? `<button class="mobile-lipsync-video-play" type="button" data-mobile-lipsync-act="play">▶</button>`
                : ``
            }
          </div>

          <div class="mobile-lipsync-video-title">${esc(job.title || "Dudak senkron video")}</div>
        </article>
      `;
    }).join("");
  }

  function bindMobileLipsyncResultActions(){
    if (!resultsEl || resultsEl.__mobileLipsyncActionsBound) return;
    resultsEl.__mobileLipsyncActionsBound = true;

    resultsEl.addEventListener("click", async function(e){
      const btn = e.target.closest("[data-mobile-lipsync-act]");
      if (!btn) return;

      const card = btn.closest("[data-mobile-lipsync-job]");
      if (!card) return;

      const act = btn.getAttribute("data-mobile-lipsync-act");
      const id = card.getAttribute("data-mobile-lipsync-job");
      const allJobs = mobileLipsyncCurrentJobs.concat(mobileLipsyncLibraryJobs);

      const job = allJobs.find(function(item){
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
          encodeURIComponent("aivo-dudak-senkron-video.mp4");

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.setAttribute("aria-hidden", "true");
        iframe.src = downloadUrl;

        document.body.appendChild(iframe);

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
            title: "AIVO Dudak Senkron Video",
            url: job.videoUrl
          }).catch(function(){});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(job.videoUrl).catch(function(){});
        }

        return;
      }

      if (act === "delete") {
        mobileLipsyncDeletedIds.add(id);
       renderMobileLipsyncResults("library");

        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
          fetch("/api/jobs/delete", {
            method: "POST",
            credentials: "include",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              job_id: id,
              app: "lipsync"
            })
          }).catch(function(){});
        }

        return;
      }
    });
  }

  function pickVideoUrl(data){
    return String(
      data?.video_url ||
      data?.videoUrl ||
      data?.final_url ||
      data?.url ||
      data?.output?.url ||
      data?.output?.video_url ||
      data?.outputs?.[0]?.url ||
      data?.outputs?.[0]?.video_url ||
      data?.job?.video_url ||
      data?.job?.videoUrl ||
      ""
    ).trim();
  }

  function pollMobileLipsyncJob(jobId, providerJobId){
    if (!jobId && !providerJobId) return;

    const statusUrl = jobId
      ? "/api/jobs/status?job_id=" + encodeURIComponent(jobId)
      : "/api/lipsync/status?lipsync_id=" + encodeURIComponent(providerJobId);

    fetch(statusUrl, {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    })
    .then(function(res){
      return res.json();
    })
    .then(async function(data){
      console.log("[MOBILE LIPSYNC][POLL]", data);

      const status = String(
        data.status ||
        data.db_status ||
        data.raw_status ||
        data.state ||
        ""
      ).toLowerCase();

      const videoUrl = pickVideoUrl(data);

      const job = mobileLipsyncCurrentJobs.find(function(item){
        return item.id === jobId || item.providerJobId === providerJobId;
      });

      if (!job) return;

         if (videoUrl) {
        job.videoUrl = videoUrl;
        job.status = "ready";
        job.title = job.title || "Dudak senkron video hazır";

        if (jobId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId)) {
          fetch("/api/lipsync/finalize", {
            method: "POST",
            credentials: "include",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify({
              job_id: jobId
            })
          }).catch(function(err){
            console.warn("[MOBILE LIPSYNC][FINALIZE BACKGROUND ERROR]", err);
          });
        }

        renderMobileLipsyncResults("current");
        setStatus("Dudak senkron video hazır.");
        clearMobileLipsyncLoading();
        showMobileLipsyncToast("success", "Dudak senkron video hazır.");
        return;
      }

         if (status.includes("fail") || status.includes("error") || status.includes("cancel")) {
        job.status = "error";
        job.title = "Dudak senkron video oluşturulamadı";
        renderMobileLipsyncResults("current");
        setStatus("Dudak senkron video oluşturulamadı.");
        clearMobileLipsyncLoading();

        await refundMobileLipsyncCredits(job.refundState, "mobile_lipsync_poll_failed", {
          error: "poll_failed",
          status: status,
          response: data
        });

        return;
      }

      setTimeout(function(){
        pollMobileLipsyncJob(jobId, providerJobId);
      }, 3500);
    })
    .catch(function(err){
      console.error("[MOBILE LIPSYNC][POLL ERROR]", err);

      setTimeout(function(){
        pollMobileLipsyncJob(jobId, providerJobId);
      }, 4500);
    });
  }

  async function hydrateMobileLipsyncLibrary(){
    if (!resultsEl) return;

    resultsEl.className = "empty-card";
    resultsEl.innerHTML = "Dudak senkron videoları yükleniyor...";

    try {
      const res = await fetch("/api/jobs/list?app=lipsync", {
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

     window.mobileLipsyncLastRows = rows;

      mobileLipsyncLibraryJobs.length = 0;

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
          row.final_video_url ||
          row.finalVideoUrl ||
          row.video_url ||
          row.videoUrl ||
          row.final_url ||
          row.output_url ||
          row.url ||
          row.meta?.final_video_url ||
          row.meta?.finalVideoUrl ||
          row.meta?.video_url ||
          row.meta?.videoUrl ||
          row.meta?.final_url ||
          row.meta?.provider_video_url ||
          row.meta?.providerVideoUrl ||
          row.outputs?.video_url ||
          row.outputs?.videoUrl ||
          firstVideoOutput?.archive_url ||
          firstVideoOutput?.archiveUrl ||
          firstVideoOutput?.url ||
          firstVideoOutput?.video_url ||
          firstVideoOutput?.videoUrl ||
          firstVideoOutput?.src ||
          ""
        ).trim();

        const jobId = String(row.job_id || row.id || row.jobId || "").trim();

        if (!jobId) return;

              mobileLipsyncLibraryJobs.push({
          id: jobId,
          title: row.title || row.prompt || row.meta?.prompt || "Dudak senkron video",
          videoUrl: videoUrl,
          status: "ready",
          payload: row
        });
      });

         if (mobileLipsyncViewMode === "library") {
        renderMobileLipsyncResults("library");
      }
    } catch (err) {
      console.error("[MOBILE LIPSYNC][HYDRATE ERROR]", err);
      resultsEl.className = "empty-card";
      resultsEl.innerHTML = "Dudak senkron videoları yüklenemedi.";
    }
  }

  function getAudioMeta(file){
    return new Promise(function(resolve){
      if (!file) {
        resolve({
          durationSeconds: 0
        });
        return;
      }

      const audio = document.createElement("audio");
      const url = URL.createObjectURL(file);

      audio.preload = "metadata";

      audio.onloadedmetadata = function(){
        const durationSeconds = Math.max(1, Math.ceil(Number(audio.duration || 1)));
        URL.revokeObjectURL(url);

        resolve({
          durationSeconds: durationSeconds
        });
      };

      audio.onerror = function(){
        URL.revokeObjectURL(url);

        resolve({
          durationSeconds: 0
        });
      };

      audio.src = url;
    });
  }

  async function uploadMobileLipsyncFile(file, kind){
    if (!file) return "";

    const filename = file.name || "aivo-lipsync-file";
    const contentType = file.type || "application/octet-stream";

    const presignRes = await fetch("/api/r2/scan-and-presign", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        app: "lipsync",
        kind: kind,
        filename: filename,
        contentType: contentType,
        prompt: kind === "audio" ? safeText(state.script) : "",
        title: filename,
        description: filename,
        source: "mobile_lipsync_upload"
      })
    });

    const presignData = await presignRes.json().catch(function(){
      return null;
    });

    if (!presignRes.ok || !presignData || presignData.ok === false) {
      throw new Error(presignData?.message || presignData?.error || "lipsync_presign_failed");
    }

    const uploadUrl = presignData.uploadUrl || presignData.upload_url || "";
    const publicUrl = presignData.publicUrl || presignData.public_url || presignData.url || "";
    const key = presignData.key || presignData.objectKey || "";

    if (!uploadUrl || !publicUrl || !key) {
      throw new Error("lipsync_presign_invalid");
    }

    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "content-type": contentType
      },
      body: file
    });

    if (!putRes.ok) {
      throw new Error("lipsync_r2_put_failed_" + putRes.status);
    }

    const scanRes = await fetch("/api/r2/scan-upload", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        app: "lipsync",
        kind: kind,
        key: key,
        filename: filename,
        contentType: contentType,
        public_url: publicUrl,
        prompt: kind === "audio" ? safeText(state.script) : "",
        title: filename,
        description: filename,
        source: "mobile_lipsync_upload"
      })
    });

    const scanData = await scanRes.json().catch(function(){
      return null;
    });

    if (!scanRes.ok || !scanData || scanData.ok === false) {
      throw new Error(scanData?.message || scanData?.error || "lipsync_scan_upload_failed");
    }

    if (scanData.decision && scanData.decision !== "allow") {
      throw new Error("media_policy_" + scanData.decision);
    }

    return String(scanData.public_url || publicUrl || "").trim();
  }

  function bindScript(){
    if (!scriptEl) return;

    scriptEl.addEventListener("input", function(){
      state.script = safeText(scriptEl.value);

      if (counterEl) {
        counterEl.textContent = String(String(scriptEl.value || "").length);
      }

      if (state.script && hasLipsyncBadLanguage(state.script)) {
        showMobileLipsyncToast("error", LIPSYNC_BAD_TEXT_MESSAGE);
      }

      syncGenerateButton();
    });
  }

  function bindPhoto(){
    if (!photoInput) return;

    photoInput.addEventListener("change", function(){
      const file = photoInput.files && photoInput.files[0] ? photoInput.files[0] : null;
      if (!file) return;

      state.photoFile = file;
      state.photoUrl = "";

      const url = URL.createObjectURL(file);

          if (photoPreview) {
        photoPreview.src = url;
      }

      if (photoDrop) {
        photoDrop.style.setProperty("--mobile-lipsync-preview-bg", "url('" + url + "')");
      }

      if (photoDrop) {
        photoDrop.classList.add("has-photo");
      }

      setStatus("Fotoğraf seçildi.");
      showMobileLipsyncToast("success", "Fotoğraf seçildi.");
    });

    if (photoRemoveBtn) {
      photoRemoveBtn.addEventListener("click", function(e){
        e.preventDefault();
        e.stopPropagation();

        state.photoFile = null;
        state.photoUrl = "";

        if (photoInput) photoInput.value = "";

        if (photoPreview) {
          photoPreview.removeAttribute("src");
        }

        if (photoDrop) {
          photoDrop.classList.remove("has-photo");
        }

        setStatus("Fotoğraf kaldırıldı.");
        showMobileLipsyncToast("info", "Fotoğraf kaldırıldı.");
      });
    }
  }

  function bindAudio(){
    if (!audioInput) return;

    audioInput.addEventListener("change", async function(){
      const file = audioInput.files && audioInput.files[0] ? audioInput.files[0] : null;
      if (!file) return;

      state.audioFile = file;
      state.audioUrl = "";

      const meta = await getAudioMeta(file);
      state.audioDurationSeconds = meta.durationSeconds;

      if (scriptEl) {
        scriptEl.value = "";
        scriptEl.disabled = true;
      }

      state.script = "";

      if (counterEl) {
        counterEl.textContent = "0";
      }

          if (audioNameEl) {
        audioNameEl.innerHTML = `
          <span class="mobile-lipsync-inline-audio">
            <button type="button" data-mobile-lipsync-inline-audio-play>▶</button>
            <strong>${file.name || "Ses dosyası seçildi"}</strong>
            <em>${state.audioDurationSeconds || 0} sn</em>
            <button type="button" data-mobile-lipsync-inline-audio-remove>🗑</button>
          </span>
        `;
      }

      setStatus("Ses dosyası seçildi.");
      showMobileLipsyncToast("success", "Ses dosyası seçildi.");
      syncGenerateButton();
    });

    if (uploadOpenBtn) {
      uploadOpenBtn.addEventListener("click", function(e){
        e.preventDefault();
        audioInput.click();
      });
    }
  }
    function syncAspectPreview(){
    if (!photoDrop || !aspectEl) return;

    const value = String(aspectEl.value || "16:9").trim();
    photoDrop.classList.toggle("is-portrait", value === "9:16");
    photoDrop.classList.toggle("is-landscape", value !== "9:16");
  }

  function bindAspectPreview(){
    if (!aspectEl) return;

    aspectEl.addEventListener("change", syncAspectPreview);
    syncAspectPreview();
  }
  function bindVoice(){
    if (voiceSelectEl) {
      voiceSelectEl.addEventListener("change", function(){
        const option = voiceSelectEl.selectedOptions && voiceSelectEl.selectedOptions[0] ? voiceSelectEl.selectedOptions[0] : null;

        state.voiceKey = safeText(voiceSelectEl.value) || "tranquil_tulin";
        state.voiceName = safeText(option?.dataset?.voiceName || option?.textContent || "Tranquil Tülin").replace("Ses:", "").trim();
      });
    }

    if (speedEl) {
      speedEl.addEventListener("input", function(){
        const val = Number(speedEl.value || 1);
        state.voiceSpeed = Math.max(0.5, Math.min(1.5, val));

        if (speedLabelEl) {
          if (val < 0.9) speedLabelEl.textContent = "Yavaş";
          else if (val > 1.1) speedLabelEl.textContent = "Hızlı";
          else speedLabelEl.textContent = "Normal";
        }
      });
    }

    if (volumeEl) {
      volumeEl.addEventListener("input", function(){
        const val = Number(volumeEl.value || 1);
        state.voiceVolume = Math.max(0.5, Math.min(1.5, val));

        if (volumeLabelEl) {
          volumeLabelEl.textContent = Math.round(val * 100) + "%";
        }
      });
    }

    if (previewVoiceBtn) {
      previewVoiceBtn.addEventListener("click", async function(e){
        e.preventDefault();

        const voiceKey = safeText(state.voiceKey || voiceSelectEl?.value || "tranquil_tulin");
        const audioUrl = VOICE_PREVIEW_R2_URLS[voiceKey] || "";

        if (!audioUrl) {
          setStatus("Bu ses için ön izleme bulunamadı.");
          return;
        }

        try {
          if (window.__AIVO_MOBILE_LIPSYNC_VOICE_PREVIEW_AUDIO__) {
            window.__AIVO_MOBILE_LIPSYNC_VOICE_PREVIEW_AUDIO__.pause();
            window.__AIVO_MOBILE_LIPSYNC_VOICE_PREVIEW_AUDIO__.currentTime = 0;
            window.__AIVO_MOBILE_LIPSYNC_VOICE_PREVIEW_AUDIO__ = null;
            previewVoiceBtn.textContent = "▶";
            return;
          }

          const audio = new Audio(audioUrl);
          audio.playbackRate = Number(state.voiceSpeed || 1);
          audio.volume = Math.max(0, Math.min(1, Number(state.voiceVolume || 1)));

          window.__AIVO_MOBILE_LIPSYNC_VOICE_PREVIEW_AUDIO__ = audio;
          previewVoiceBtn.textContent = "■";

          audio.addEventListener("ended", function(){
            previewVoiceBtn.textContent = "▶";
            window.__AIVO_MOBILE_LIPSYNC_VOICE_PREVIEW_AUDIO__ = null;
          });

          await audio.play();
        } catch (err) {
          console.error("[MOBILE LIPSYNC][VOICE PREVIEW ERROR]", err);
          previewVoiceBtn.textContent = "▶";
          window.__AIVO_MOBILE_LIPSYNC_VOICE_PREVIEW_AUDIO__ = null;
          setStatus("Ses ön izlemesi çalınamadı.");
          showMobileLipsyncToast("error", "Ses ön izlemesi çalınamadı.");
        }
      });
    }
  }

  function bindRecord(){
    if (!recordOpenBtn) return;

    let recorder = null;
    let chunks = [];
    let stream = null;
    let startedAt = 0;
    let modal = null;

    function closeModal(){
      if (recorder && recorder.state === "recording") {
        recorder.stop();
      }

      if (stream) {
        stream.getTracks().forEach(function(track){
          track.stop();
        });
      }

      stream = null;
      recorder = null;
      chunks = [];
      startedAt = 0;

      if (modal) {
        modal.remove();
        modal = null;
      }
    }

    function createModal(){
      modal = document.createElement("div");
      modal.className = "mobile-lipsync-record-modal";
      modal.innerHTML = `
        <div class="mobile-lipsync-record-box">
          <button type="button" class="mobile-lipsync-record-close" data-mobile-lipsync-record-close>×</button>

          <h3>Ses Kaydet</h3>

          <div class="mobile-lipsync-record-tabs">
            <button type="button" class="is-active">Ses Kaydı</button>
            <button type="button" data-mobile-lipsync-record-upload>Ses Yükle</button>
          </div>

          <div class="mobile-lipsync-record-screen">
            <div class="mobile-lipsync-record-spinner" data-mobile-lipsync-record-spinner></div>
            <b data-mobile-lipsync-record-title>Mikrofon hazır</b>
            <span data-mobile-lipsync-record-sub>Başlamak için kayıt butonuna bas.</span>
          </div>

          <button type="button" class="mobile-lipsync-record-main" data-mobile-lipsync-record-main>
            ●
          </button>

          <div class="mobile-lipsync-record-status" data-mobile-lipsync-record-status>
            Mikrofon hazır bekliyor...
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      modal.querySelector("[data-mobile-lipsync-record-close]").addEventListener("click", closeModal);

      modal.querySelector("[data-mobile-lipsync-record-upload]").addEventListener("click", function(){
        closeModal();
        if (audioInput) audioInput.click();
      });

      return modal;
    }

    async function startRecording(){
      const currentModal = modal || createModal();
      const mainBtn = currentModal.querySelector("[data-mobile-lipsync-record-main]");
      const titleEl = currentModal.querySelector("[data-mobile-lipsync-record-title]");
      const subEl = currentModal.querySelector("[data-mobile-lipsync-record-sub]");
      const statusBox = currentModal.querySelector("[data-mobile-lipsync-record-status]");

      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder = new MediaRecorder(stream);
      chunks = [];
      startedAt = Date.now();

      recorder.addEventListener("dataavailable", function(event){
        if (event.data && event.data.size > 0) {
          chunks.push(event.data);
        }
      });

         recorder.addEventListener("stop", function(){
        const blob = new Blob(chunks, { type: "audio/webm" });
        const file = new File([blob], "aivo-kayit-" + Date.now() + ".webm", { type: "audio/webm" });
        const durationSeconds = Math.max(1, Math.ceil((Date.now() - startedAt) / 1000));
        const previewUrl = URL.createObjectURL(blob);

        if (stream) {
          stream.getTracks().forEach(function(track){
            track.stop();
          });
        }

        stream = null;
        recorder = null;
        chunks = [];
        startedAt = 0;

        const currentModal = modal;
        if (!currentModal) return;

        const screen = currentModal.querySelector(".mobile-lipsync-record-screen");
        const statusBox = currentModal.querySelector("[data-mobile-lipsync-record-status]");
        const mainBtn = currentModal.querySelector("[data-mobile-lipsync-record-main]");

        if (mainBtn) {
          mainBtn.classList.remove("is-recording");
        }

        if (screen) {
          screen.innerHTML = `
            <div class="mobile-lipsync-record-preview">
              <button type="button" class="mobile-lipsync-record-play" data-mobile-lipsync-record-play>▶</button>

              <div class="mobile-lipsync-record-info">
                <b>${file.name}</b>
                <span>Kaydedilen ses hazır • ${durationSeconds} sn</span>
              </div>

              <button type="button" class="mobile-lipsync-record-use" data-mobile-lipsync-record-use>Kullan</button>
              <button type="button" class="mobile-lipsync-record-discard" data-mobile-lipsync-record-discard>×</button>

              <audio src="${previewUrl}" data-mobile-lipsync-record-audio></audio>
            </div>
          `;
        }

        if (statusBox) {
          statusBox.textContent = "🎙️ Kayıt hazır: " + file.name;
        }

        const audio = currentModal.querySelector("[data-mobile-lipsync-record-audio]");
        const playBtn = currentModal.querySelector("[data-mobile-lipsync-record-play]");
        const useBtn = currentModal.querySelector("[data-mobile-lipsync-record-use]");
        const discardBtn = currentModal.querySelector("[data-mobile-lipsync-record-discard]");

        if (playBtn && audio) {
          playBtn.addEventListener("click", function(){
            if (audio.paused) {
              audio.play().catch(function(){});
              playBtn.textContent = "❚❚";
            } else {
              audio.pause();
              playBtn.textContent = "▶";
            }
          });

          audio.addEventListener("ended", function(){
            playBtn.textContent = "▶";
          });
        }

        if (discardBtn) {
          discardBtn.addEventListener("click", function(){
            URL.revokeObjectURL(previewUrl);
            closeModal();
          });
        }

        if (useBtn) {
          useBtn.addEventListener("click", function(){
            state.audioFile = file;
            state.audioUrl = "";
            state.audioDurationSeconds = durationSeconds;
            state.script = "";

            if (scriptEl) {
              scriptEl.value = "";
              scriptEl.disabled = true;
              scriptEl.classList.add("has-audio");
            }

            if (counterEl) {
              counterEl.textContent = "0";
            }

            if (audioNameEl) {
              audioNameEl.innerHTML = `
                <span class="mobile-lipsync-inline-audio">
                  <button type="button" data-mobile-lipsync-inline-audio-play>▶</button>
                  <strong>${file.name}</strong>
                  <em>${durationSeconds} sn</em>
                  <button type="button" data-mobile-lipsync-inline-audio-remove>🗑</button>
                </span>
              `;
            }

            syncGenerateButton();
            setStatus("Ses kaydı eklendi.");
            showMobileLipsyncToast("success", "Ses kaydı eklendi.");
            URL.revokeObjectURL(previewUrl);
            closeModal();
          });
        }
      });

      recorder.start();

      if (mainBtn) mainBtn.classList.add("is-recording");
      if (titleEl) titleEl.textContent = "Kayıt alınıyor";
      if (subEl) subEl.textContent = "Durdurmak için tekrar bas";
      if (statusBox) statusBox.textContent = "🔴 Kayıt alınıyor... Durdurmak için tekrar bas.";
    }

    recordOpenBtn.addEventListener("click", async function(e){
      e.preventDefault();

      try {
        const currentModal = modal || createModal();
        const mainBtn = currentModal.querySelector("[data-mobile-lipsync-record-main]");

        if (recorder && recorder.state === "recording") {
          recorder.stop();
          return;
        }

        if (mainBtn && !mainBtn.__mobileLipsyncRecordBound) {
          mainBtn.__mobileLipsyncRecordBound = true;
          mainBtn.addEventListener("click", async function(){
            if (recorder && recorder.state === "recording") {
              recorder.stop();
              return;
            }

            await startRecording();
          });
        }
      } catch (err) {
        console.error("[MOBILE LIPSYNC][RECORD ERROR]", err);
        setStatus("Mikrofon izni alınamadı.");
        showMobileLipsyncToast("error", "Mikrofon izni alınamadı.");
      }
    });
  }

  function buildPayload(){
    const option = voiceSelectEl?.selectedOptions && voiceSelectEl.selectedOptions[0] ? voiceSelectEl.selectedOptions[0] : null;

    const voiceKey = safeText(voiceSelectEl?.value || state.voiceKey || "tranquil_tulin");
    const voiceName = safeText(option?.dataset?.voiceName || state.voiceName || "Tranquil Tülin");

    return {
      app: "lipsync",
      script: safeText(state.script),
      image_url: safeText(state.photoUrl),
      imageUrl: safeText(state.photoUrl),
      audio_url: safeText(state.audioUrl),
      audioUrl: safeText(state.audioUrl),
      audioDurationSeconds: Number(state.audioDurationSeconds || 0),
      audio_duration_seconds: Number(state.audioDurationSeconds || 0),
      estimatedSpeechSeconds: calculateSpeechSeconds(),
      estimated_speech_seconds: calculateSpeechSeconds(),
      resolution: safeText(resolutionEl?.value || state.resolution || "1080p"),
      aspectRatio: safeText(aspectEl?.value || state.aspectRatio || "16:9"),
      aspect_ratio: safeText(aspectEl?.value || state.aspectRatio || "16:9"),
      voice_key: voiceKey,
      voiceKey: voiceKey,
      voice_name: voiceName,
      voiceName: voiceName,
      voiceSpeed: Number(state.voiceSpeed || 1),
      voice_speed: Number(state.voiceSpeed || 1),
      voiceVolume: Number(state.voiceVolume || 1),
      voice_volume: Number(state.voiceVolume || 1),
      durationSeconds: Math.min(60, Math.max(1, calculateSpeechSeconds())),
      duration: Math.min(60, Math.max(1, calculateSpeechSeconds()))
    };
  }
    function bindInlineAudioPlayer(){
    if (!audioNameEl || audioNameEl.__mobileLipsyncInlineAudioBound) return;
    audioNameEl.__mobileLipsyncInlineAudioBound = true;

    let inlineAudio = null;

    audioNameEl.addEventListener("click", function(e){
      const playBtn = e.target.closest("[data-mobile-lipsync-inline-audio-play]");
      const removeBtn = e.target.closest("[data-mobile-lipsync-inline-audio-remove]");

      if (playBtn) {
        e.preventDefault();

        if (!state.audioFile) return;

        if (!inlineAudio) {
          inlineAudio = new Audio(URL.createObjectURL(state.audioFile));

          inlineAudio.addEventListener("ended", function(){
            playBtn.textContent = "▶";
          });
        }

        if (inlineAudio.paused) {
          inlineAudio.play().catch(function(){});
          playBtn.textContent = "❚❚";
        } else {
          inlineAudio.pause();
          playBtn.textContent = "▶";
        }

        return;
      }

      if (removeBtn) {
        e.preventDefault();

        if (inlineAudio) {
          inlineAudio.pause();
          inlineAudio = null;
        }

        state.audioFile = null;
        state.audioUrl = "";
        state.audioDurationSeconds = 0;

        if (scriptEl) {
          scriptEl.disabled = false;
          scriptEl.classList.remove("has-audio");
        }

        if (audioInput) {
          audioInput.value = "";
        }

        audioNameEl.textContent = "Ses yüklenmedi.";

        syncGenerateButton();
        setStatus("Ses kaldırıldı.");
        showMobileLipsyncToast("info", "Ses kaldırıldı.");
      }
    });
  }
  function bindGenerate(){
    if (!generateBtn) return;

    generateBtn.addEventListener("click", async function(){
      clearMobileLipsyncLoading();

      if (safeText(state.script) && hasLipsyncBadLanguage(state.script)) {
        syncGenerateButton();
        showMobileLipsyncToast("error", LIPSYNC_BAD_TEXT_MESSAGE);
        return;
      }

      if (!state.photoFile && !state.photoUrl) {
        setStatus("Lütfen bir fotoğraf yükle.");
        showMobileLipsyncToast("info", "Lütfen bir fotoğraf yükle.");
        return;
      }

      if (!safeText(state.script) && !state.audioFile && !state.audioUrl) {
        setStatus("Lütfen metin yaz veya ses dosyası yükle.");
        showMobileLipsyncToast("info", "Lütfen metin yaz veya ses dosyası yükle.");
        return;
      }

      const estimatedSpeechSeconds = calculateSpeechSeconds();

      if (estimatedSpeechSeconds > 60) {
        const durationMessage = state.audioFile
          ? "Ses dosyası en fazla 60 saniye olabilir."
          : "Bu metin yaklaşık " + estimatedSpeechSeconds + " saniye sürer. Maksimum süre 60 saniye.";

        setStatus(durationMessage);
        showMobileLipsyncToast("error", durationMessage);
        return;
      }

              setStatus("Dudak senkron hazırlanıyor...");
      showMobileLipsyncLoading("Dudak senkron hazırlanıyor...");
      const tempId = "mobile-lipsync-" + Date.now();

      mobileLipsyncCurrentJobs.length = 0;

      mobileLipsyncCurrentJobs.unshift({
        id: tempId,
        title: "Dudak senkron hazırlanıyor",
        videoUrl: "",
        status: "processing",
        payload: {}
      });

      if (resultsEl) {
        resultsEl.hidden = false;
      }

          mobileLipsyncViewMode = "current";
      renderMobileLipsyncResults("current");

      let refundState = null;

      try {
        if (state.photoFile && !state.photoUrl) {
          setStatus("Fotoğraf yükleniyor...");
          showMobileLipsyncLoading("Fotoğraf güvenlik kontrolünden geçiriliyor...");
          state.photoUrl = await uploadMobileLipsyncFile(state.photoFile, "image");
          showMobileLipsyncToast("success", "Fotoğraf yüklendi.");
        }

        if (state.audioFile && !state.audioUrl) {
          setStatus("Ses yükleniyor...");
          showMobileLipsyncLoading("Ses güvenlik kontrolünden geçiriliyor...");
          state.audioUrl = await uploadMobileLipsyncFile(state.audioFile, "audio");
          showMobileLipsyncToast("success", "Ses yüklendi.");
        }

               const payload = buildPayload();

        const creditCost = calculateCredits();
        const consumeRequestId = "mobile-lipsync:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);

               refundState = {
          consumed: false,
          refunded: false,
          creditCost: creditCost,
          requestId: consumeRequestId,
          transactionId: ""
        };

        try {
          const consumeResult = await consumeMobileLipsyncCredits(creditCost, consumeRequestId);

          refundState.consumed = true;
          refundState.transactionId = consumeResult.transactionId || "";

           showMobileLipsyncToast("success", creditCost + " kredi düşüldü.");
     catch (creditErr) {
  console.warn("[MOBILE LIPSYNC][CREDIT ERROR]", creditErr);

  setStatus("Yetersiz kredi.");
  showMobileLipsyncToast("warning", "Yetersiz kredi. Krediler bölümüne yönlendiriliyorsun...");

  clearMobileLipsyncLoading();

  try {
    window.mobileNavigateTo?.("credits");
  } catch {}

  return;
}
                generateBtn.disabled = true;
        generateBtn.textContent = "Üretiliyor...";
        generateBtn.classList.add("is-loading", "is-pressed");
        generateBtn.setAttribute("aria-busy", "true");
        setStatus("Üretim başlatılıyor...");
        showMobileLipsyncLoading("Üretim başlatılıyor...");

        const res = await fetch("/api/lipsync/create", {
          method: "POST",
          headers: {
            "content-type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(function(){
          return {};
        });

        console.log("[MOBILE LIPSYNC][CREATE RESPONSE]", data);

        if (!res.ok || !data || data.ok === false) {
          const error = new Error(data?.message || data?.detail || data?.error || "lipsync_create_failed");
          error.payload = data;
          error.error = data?.error || "";
          throw error;
        }

        const realJobId = safeText(
          data.job_id ||
          data.job?.job_id ||
          data.job?.id ||
          data.id ||
          ""
        );

        const providerJobId = safeText(
          data.provider_job_id ||
          data.providerJobId ||
          data.lipsync_id ||
          data.video_id ||
          ""
        );

        const job = mobileLipsyncCurrentJobs.find(function(item){
          return item.id === tempId;
        });

              if (job) {
          job.id = realJobId || tempId;
          job.providerJobId = providerJobId;
          job.status = "processing";
          job.title = "Dudak senkron video";
          job.payload = payload;
          job.refundState = refundState;
        }

        mobileLipsyncViewMode = "current";
        renderMobileLipsyncResults("current");
        setStatus("Dudak senkron video hazırlanıyor...");
        showMobileLipsyncLoading("Dudak senkron video hazırlanıyor...");
        pollMobileLipsyncJob(realJobId || tempId, providerJobId);
      } catch (err) {
        console.error("[MOBILE LIPSYNC][GENERATE ERROR]", err);

        clearMobileLipsyncLoading();

        const job = mobileLipsyncCurrentJobs.find(function(item){
          return item.id === tempId;
        });

        if (job) {
          job.status = "error";
          job.title = "Dudak senkron başlatılamadı";
        }

        if (state.audioFile) {
          const errText = String(err?.message || err?.error || err || "").toLowerCase();

          if (
            errText.includes("media_policy") ||
            errText.includes("audio_too_long") ||
            errText.includes("lipsync_audio") ||
            errText.includes("scan")
          ) {
            state.audioFile = null;
            state.audioUrl = "";
            state.audioDurationSeconds = 0;

            if (audioInput) audioInput.value = "";
            if (audioNameEl) audioNameEl.textContent = "Ses yüklenmedi.";
            if (scriptEl) {
              scriptEl.disabled = false;
              scriptEl.classList.remove("has-audio");
            }
          }
        }

               mobileLipsyncViewMode = "current";
        renderMobileLipsyncResults("current");

           const refunded = await refundMobileLipsyncCredits(refundState, "mobile_lipsync_generate_failed", {
          error: String(err?.message || err?.error || err || "generate_failed"),
          payload: err?.payload || null
        });

        const message = refunded
          ? "İşlem başarısız oldu, kredi iade edildi."
          : mapMobileLipsyncErrorMessage(err?.payload || err);

        setStatus(message);

        if (!refunded) {
          showMobileLipsyncToast("error", message);
        }
           } finally {
      }
    });
  }


window.mobileLipsyncShowLibrary = async function(){
  mobileLipsyncViewMode = "library";
  await hydrateMobileLipsyncLibrary();
  renderMobileLipsyncResults("library");
};

window.mobileLipsyncShowCurrent = function(){
  mobileLipsyncViewMode = "current";
  renderMobileLipsyncResults("current");
};
  bindScript();
  bindPhoto();
  bindAudio();
 bindAspectPreview();
  bindVoice();
  bindRecord();
  bindInlineAudioPlayer();
  bindGenerate();
  bindMobileLipsyncResultActions();
  syncGenerateButton();
  hydrateMobileLipsyncLibrary();

  window.mobileLipsyncState = state;
})();
