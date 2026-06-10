(function(){
  const root = document.getElementById("mobileAtmoSection");
  if (!root || root.__mobileAtmoBound) return;
  root.__mobileAtmoBound = true;

  const modeButtons = Array.from(root.querySelectorAll("[data-mobile-atmo-mode]"));
  const panels = Array.from(root.querySelectorAll("[data-mobile-atmo-panel]"));

  const basicStatusEl = root.querySelector("#mobileAtmoStatus");
  const proStatusEl = root.querySelector("#mobileAtmoProStatus");

  const promptEl = root.querySelector("#mobileAtmoPrompt");
  const promptCountEl = root.querySelector("#mobileAtmoPromptCount");

  const basicDurationEl = root.querySelector("#mobileAtmoDuration");
  const basicRatioEl = root.querySelector("#mobileAtmoRatio");

const proDurationEl = root.querySelector("#mobileAtmoProDuration");
const proRatioEl = root.querySelector("#mobileAtmoProRatio");
  const basicGenerateBtn = root.querySelector("#mobileAtmoGenerateBtn");
  const proGenerateBtn = root.querySelector("#mobileAtmoProGenerateBtn");
   const resultsEl = root.querySelector("#mobileAtmoResults");

  const mobileAtmoJobs = [];
  const mobileAtmoDeletedIds = new Set();
  let mobileAtmoViewMode = "current";

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
   function renderMobileAtmoResults(){
    if (!resultsEl) return;

    const items = mobileAtmoJobs.filter(function(job){
      if (mobileAtmoDeletedIds.has(job.id)) return false;

      if (mobileAtmoViewMode === "current") {
        return job.scope === "current";
      }

      return job.scope === "library";
    });

    if (!items.length) {
      resultsEl.className = "empty-card";
      resultsEl.innerHTML = atmoText(
        "Henüz mobil atmosfer videosu başlatılmadı.",
        "No mobile atmosphere video has been started yet."
      );
      return;
    }

    resultsEl.className = "mobile-atmo-results";

     resultsEl.innerHTML = items.map(function(job){
      const ready = !!job.videoUrl;
      const failed = String(job.status || "").toLowerCase() === "error";
      const posterAttr = job.posterUrl
        ? ` poster="${esc(job.posterUrl)}"`
        : "";

      return `
        <article class="mobile-atmo-video-card ${failed ? "is-error" : ""}" data-mobile-atmo-job="${esc(job.id)}">
          <div class="mobile-atmo-video-media">
            ${
              ready
                 ? `<video class="mobile-atmo-video" src="${esc(job.videoUrl)}"${posterAttr} playsinline webkit-playsinline preload="metadata"></video>`
                : failed
                  ? `<div class="mobile-atmo-video-loading"><span>${atmoText("Video çıktısı alınamadı", "Video output could not be received")}</span></div>`
                  : `<div class="mobile-atmo-video-loading"><span>${atmoText("Hazırlanıyor…", "Preparing…")}</span></div>`
            }

            <div class="mobile-atmo-video-actions">
              <button type="button" data-mobile-atmo-act="download" ${ready ? "" : "disabled"}>⬇</button>
              <button type="button" data-mobile-atmo-act="share" ${ready ? "" : "disabled"}>↗</button>
              <button type="button" data-mobile-atmo-act="sound" ${ready ? "" : "disabled"}>🔇</button>
              <button type="button" data-mobile-atmo-act="fullscreen" ${ready ? "" : "disabled"}>⛶</button>
              <button type="button" data-mobile-atmo-act="delete">🗑</button>
            </div>

            ${
              ready
                ? `<button class="mobile-atmo-video-play" type="button" data-mobile-atmo-act="play">▶</button>`
                : ``
            }
          </div>

          <div class="mobile-atmo-video-title">${esc(job.title || atmoText("Atmosfer video", "Atmosphere video"))}</div>
        </article>
      `;
    }).join("");
  }
  function pollMobileAtmoJob(jobId){
    if (!jobId) return;

    fetch("/api/jobs/status?job_id=" + encodeURIComponent(jobId), {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    })
    .then(function(res){
      return res.json();
    })
    .then(function(data){
      console.log("[MOBILE ATMO][POLL]", data);

      const status = String(
        data.status ||
        data.db_status ||
        data.state ||
        ""
      ).toLowerCase();

      const videoUrl = String(
        data.video_url ||
        data.final_url ||
        data.url ||
        data.video?.url ||
        data.output?.video?.url ||
        data.outputs?.[0]?.url ||
        ""
      ).trim();

      const job = mobileAtmoJobs.find(function(item){
        return item.id === jobId;
      });

      if (!job) return;

         if (videoUrl) {
        job.videoUrl = videoUrl;
        job.posterUrl = pickPosterUrl(data);
        job.status = "ready";
        job.title = job.title || atmoText(
          "Atmosfer video hazır",
          "Atmosphere video is ready"
        );

        renderMobileAtmoResults();

        setStatus(atmoText(
          "Atmosfer video hazır.",
          "Atmosphere video is ready."
        ));

        clearMobileAtmoLoading();

        mobileAtmoToast("success", atmoText(
          "Atmosfer video hazır.",
          "Atmosphere video is ready."
        ));

        return;
      }

      if (
        (status.includes("ready") || status.includes("done") || status.includes("complete") || status.includes("success")) &&
        !videoUrl
      ) {
        job.status = "error";
        job.title = atmoText(
          "Video çıktısı alınamadı",
          "Video output could not be received"
        );

        renderMobileAtmoResults();

        setStatus(atmoText(
          "Video çıktısı alınamadı.",
          "Video output could not be received."
        ));

        clearMobileAtmoLoading();

        mobileAtmoToast("error", atmoText(
          "Video çıktısı alınamadı.",
          "Video output could not be received."
        ));

        refundMobileAtmoCredits(job.refundCtx, "mobile_atmo_ready_no_output", {
          error: "ready_no_output",
          status: status,
          response: data
        });

        return;
      }

      if (status.includes("fail") || status.includes("error")) {
        job.status = "error";
        job.title = atmoText(
          "Atmosfer video oluşturulamadı",
          "Atmosphere video could not be created"
        );

        renderMobileAtmoResults();

        setStatus(atmoText(
          "Atmosfer video oluşturulamadı.",
          "Atmosphere video could not be created."
        ));

        clearMobileAtmoLoading();

        mobileAtmoToast("error", atmoText(
          "Atmosfer video oluşturulamadı.",
          "Atmosphere video could not be created."
        ));

        refundMobileAtmoCredits(job.refundCtx, "mobile_atmo_poll_failed", {
          error: "poll_failed",
          status: status,
          response: data
        });

        return;
      }

      setTimeout(function(){
        pollMobileAtmoJob(jobId);
      }, 3000);
    })
    .catch(function(err){
      console.error("[MOBILE ATMO][POLL ERROR]", err);

      setTimeout(function(){
        pollMobileAtmoJob(jobId);
      }, 4000);
    });
  }
   function bindMobileAtmoResultActions(){
    if (!resultsEl || resultsEl.__mobileAtmoActionsBound) return;
    resultsEl.__mobileAtmoActionsBound = true;

    resultsEl.addEventListener("click", async function(e){
      const btn = e.target.closest("[data-mobile-atmo-act]");
      if (!btn) return;

      const card = btn.closest("[data-mobile-atmo-job]");
      if (!card) return;

      const act = btn.getAttribute("data-mobile-atmo-act");
      const id = card.getAttribute("data-mobile-atmo-job");
      const job = mobileAtmoJobs.find(function(item){
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
              ? atmoText("Duraklat", "Pause")
              : atmoText("Oynat", "Play")
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
        const filename = "aivo-atmosphere-video.mp4";

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
            throw new Error("mobile_atmo_download_failed_" + response.status);
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
              title: "AIVO Atmosfer Video"
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

          setTimeout(function(){
            try {
              a.remove();
            } catch (err) {}

            try {
              URL.revokeObjectURL(objectUrl);
            } catch (err) {}
          }, 1500);
        } catch (err) {
          console.error("[MOBILE ATMO][DOWNLOAD ERROR]", err);
          window.open(directUrl, "_blank", "noopener");
        }

        return;
      }

      if (act === "share") {
        if (!job.videoUrl) return;

        if (navigator.share) {
          navigator.share({
            title: atmoText("AIVO Atmosfer Video", "AIVO Atmosphere Video"),
            url: job.videoUrl
          }).catch(function(){});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(job.videoUrl).catch(function(){});
        }

        return;
      }

      if (act === "delete") {
        mobileAtmoDeletedIds.add(id);
        renderMobileAtmoResults();
        mobileAtmoToast("success", atmoText(
          "Video silindi.",
          "Video deleted."
        ));
        return;
      }
    });
  }
  async function hydrateMobileAtmoLibrary(){
    if (!resultsEl) return;

    resultsEl.className = "empty-card";
    resultsEl.innerHTML = atmoText(
      "Atmosfer videoları yükleniyor...",
      "Atmosphere videos are loading..."
    );

    try {
      const res = await fetch("/api/jobs/list?app=atmo", {
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

      mobileAtmoJobs.length = 0;

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
          row.output_url ||
          row.url ||
          row.meta?.video_url ||
          row.meta?.videoUrl ||
          row.meta?.final_url ||
          row.outputs?.video_url ||
          row.outputs?.videoUrl ||
          firstVideoOutput?.url ||
          firstVideoOutput?.video_url ||
          firstVideoOutput?.videoUrl ||
          firstVideoOutput?.src ||
          ""
        ).trim();

        const jobId = String(row.id || row.job_id || row.jobId || "").trim();

        if (!jobId || !videoUrl) return;

            mobileAtmoJobs.push({
          id: jobId,
          scope: "library",
          title: row.title || row.prompt || row.meta?.prompt || atmoText(
            "Atmosfer video",
            "Atmosphere video"
          ),
          videoUrl: videoUrl,
          posterUrl: pickPosterUrl(row),
          status: "ready",
          payload: row
        });
      });

      mobileAtmoViewMode = "library";
      renderMobileAtmoResults();
    } catch (err) {
      console.error("[MOBILE ATMO][HYDRATE ERROR]", err);

      resultsEl.className = "empty-card";
      resultsEl.innerHTML = atmoText(
        "Atmosfer videoları yüklenemedi.",
        "Atmosphere videos could not be loaded."
      );
    }
  }
  const state = {
    mode: "basic",

      basic: {
      scene: "",
      effects: [],
      duration: "4",
      ratio: "16:9",
      imageFile: null,
      logoFile: null,
      audioFile: null,
      imageUrl: "",
      logoUrl: "",
      audioUrl: ""
    },

      pro: {
      prompt: "",
      light: "",
      mood: "",
     details: [],
     duration: "4",
     ratio: "16:9",
      imageFile: null,
      logoFile: null,
      audioFile: null,
      imageUrl: "",
      logoUrl: "",
      audioUrl: ""
    }
  };

  function safeText(value){
    return String(value || "").trim();
  }

  function isAtmoEn(){
    return String(window.AIVO_LANG || "").toLowerCase().indexOf("en") === 0;
  }

  function atmoText(tr, en){
    return isAtmoEn() ? en : tr;
  }

  function atmoCreditsText(count){
    return isAtmoEn()
      ? count + " Credits"
      : count + " Kredi";
  }

  const MOBILE_ATMO_TOAST = {
    lastKey: "",
    lastAt: 0,
    loadingId: null
  };

  function getMobileAtmoToastApi(){
    return (
      window.mobileToast ||
      window.MobileToast ||
      window.AIVO_MOBILE_TOAST ||
      window.aivoMobileToast ||
      window.toast ||
      null
    );
  }

  function callMobileAtmoToast(type, message, options){
    const text = safeText(message);
    if (!text) return null;

    const normalizedType = type === "danger" ? "error" : type;
    const key = normalizedType + ":" + text;
    const now = Date.now();

    if (
      key === MOBILE_ATMO_TOAST.lastKey &&
      now - MOBILE_ATMO_TOAST.lastAt < 1600
    ) {
      return null;
    }

    MOBILE_ATMO_TOAST.lastKey = key;
    MOBILE_ATMO_TOAST.lastAt = now;

    const toastApi = getMobileAtmoToastApi();

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
      console.warn("[MOBILE ATMO][TOAST FALLBACK]", err);
    }

    setStatus(text);
    return null;
  }

  function mobileAtmoToast(type, message, options){
    return callMobileAtmoToast(type || "info", message, options || {});
  }

  function mobileAtmoLoading(message){
    MOBILE_ATMO_TOAST.loadingId = mobileAtmoToast("loading", message, {
      persist: true,
      autoClose: false,
      source: "mobile_atmo"
    });

    return MOBILE_ATMO_TOAST.loadingId;
  }
  function resetMobileAtmoGenerateButtons(){
    [basicGenerateBtn, proGenerateBtn].forEach(function(btn){
      if (!btn) return;

      btn.disabled = false;
      btn.classList.remove("is-loading", "is-pressed");
      btn.removeAttribute("aria-busy");
    });
  }

  function clearMobileAtmoLoading(){
    const toastApi = getMobileAtmoToastApi();

    try {
      if (MOBILE_ATMO_TOAST.loadingId && toastApi) {
        if (typeof toastApi.dismiss === "function") {
          toastApi.dismiss(MOBILE_ATMO_TOAST.loadingId);
        } else if (typeof toastApi.remove === "function") {
          toastApi.remove(MOBILE_ATMO_TOAST.loadingId);
        }
      }
    } catch {}

    MOBILE_ATMO_TOAST.loadingId = null;
    resetMobileAtmoGenerateButtons();
    syncMobileAtmoCreditButtons();
  }

  async function refreshMobileAtmoCredits(){
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

      if (typeof nextCredits === "number") {
        const topCreditCountEl = document.getElementById("topCreditCount");

        if (topCreditCountEl) {
          topCreditCountEl.textContent = String(nextCredits);
        }

        const mobileCreditEls = Array.from(document.querySelectorAll("[data-mobile-credit-balance]"));

        mobileCreditEls.forEach(function(el){
          el.textContent = isAtmoEn()
            ? "Credits " + nextCredits
            : "Kredi " + nextCredits;
        });

        if (
          window.AIVO_STORE_V1 &&
          typeof window.AIVO_STORE_V1.setCredits === "function"
        ) {
          window.AIVO_STORE_V1.setCredits(nextCredits);
        }
      }
    } catch (err) {
      console.warn("[MOBILE ATMO][CREDIT REFRESH FAILED]", err);
    }

    try {
      window.syncCreditsUI?.({ force: true });
    } catch (err) {}
  }

  function getMobileAtmoCreditAction(mode){
    return mode === "pro"
      ? "studio_atmo_generate_pro"
      : "studio_atmo_generate_basic";
  }
    async function consumeMobileAtmoCredits(mode){
    const amount = computeMobileAtmoCredit(mode);
    const action = getMobileAtmoCreditAction(mode);
    const requestId = "mobile-atmo:" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);

    const res = await fetch("/api/credits/consume-ledger", {
      method: "POST",
      credentials: "include",
      headers: {
        "content-type": "application/json",
        "accept": "application/json"
      },
      body: JSON.stringify({
        app: "atmo",
        action: action,
        cost: amount,
        request_id: requestId,
        reason: action
      })
    });

    const data = await res.json().catch(function(){
      return {};
    });

    if (!res.ok || !data || !data.ok) {
      throw {
        type: "insufficient_credit",
        data: data
      };
    }

    await refreshMobileAtmoCredits();

    return {
      app: "atmo",
      action: action,
      amount: amount,
      request_id: requestId,
      related_transaction_id: safeText(
        data.transaction_id ||
        data.transaction?.id ||
        data.related_transaction_id ||
        data.credit_transaction_id ||
        ""
      ),
      idempotency_key: safeText(
        data.transaction_id ||
        data.transaction?.id ||
        data.related_transaction_id ||
        data.credit_transaction_id ||
        ""
      )
        ? "mobile-atmo-refund:" + safeText(
            data.transaction_id ||
            data.transaction?.id ||
            data.related_transaction_id ||
            data.credit_transaction_id ||
            ""
          )
        : "",
      mode: mode,
      refunded: false
    };
  }

  function buildMobileAtmoRefundContext(mode, payload, data, jobId){
    const source = data || {};
    const transaction =
      source.transaction ||
      source.credit_transaction ||
      source.creditTransaction ||
      source.credits?.transaction ||
      null;

      const relatedTransactionId = safeText(
      source.related_transaction_id ||
      source.relatedTransactionId ||
      source.transaction_id ||
      source.transactionId ||
      source.credit_transaction_id ||
      source.creditTransactionId ||
      source.consume_transaction_id ||
      source.consumeTransactionId ||
      source.ledger_transaction_id ||
      source.ledgerTransactionId ||
      source.credit?.transaction_id ||
      source.credit?.transactionId ||
      source.credits?.transaction_id ||
      source.credits?.transactionId ||
      source.ledger?.transaction_id ||
      source.ledger?.transactionId ||
      source.consume?.transaction_id ||
      source.consume?.transactionId ||
      transaction?.id ||
      ""
    );

    const requestId = safeText(
      source.request_id ||
      source.requestId ||
      source.meta?.request_id ||
      source.meta?.requestId ||
      payload?.request_id ||
      payload?.requestId ||
      ""
    );

    const providerJobId = safeText(
      source.provider_job_id ||
      source.providerJobId ||
      source.provider_request_id ||
      source.providerRequestId ||
      source.fal_request_id ||
      source.falRequestId ||
      source.request_id ||
      source.requestId ||
      ""
    );

    return {
      app: "atmo",
      action: getMobileAtmoCreditAction(mode),
      amount: computeMobileAtmoCredit(mode),
      request_id: requestId,
      job_id: safeText(jobId),
      provider_job_id: providerJobId,
      related_transaction_id: relatedTransactionId,
      idempotency_key: relatedTransactionId
        ? "mobile-atmo-refund:" + relatedTransactionId
        : "",
      mode: mode,
      refunded: false
    };
  }

  async function refundMobileAtmoCredits(refundCtx, reason, extraMeta){
    if (!refundCtx || refundCtx.refunded) return false;

    if (!refundCtx.related_transaction_id || refundCtx.amount <= 0) {
      console.warn("[MOBILE ATMO][REFUND SKIPPED]", {
        reason: reason,
        refundCtx: refundCtx
      });
      return false;
    }

    refundCtx.refunded = true;

    try {
      const res = await fetch("/api/credits/refund", {
        method: "POST",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "accept": "application/json"
        },
        body: JSON.stringify({
          app: refundCtx.app,
          action: refundCtx.action,
          amount: refundCtx.amount,
          request_id: refundCtx.request_id,
          job_id: refundCtx.job_id,
          provider_job_id: refundCtx.provider_job_id,
          related_transaction_id: refundCtx.related_transaction_id,
          idempotency_key: refundCtx.idempotency_key,
          reason: reason || "mobile_atmo_failed",
          meta: {
            source: "mobile.atmo.js",
            mode: refundCtx.mode,
            ...(extraMeta || {})
          }
        })
      });

      const data = await res.json().catch(function(){
        return {};
      });

      if (res.ok && data && data.ok) {
        await refreshMobileAtmoCredits();

        if (data.refunded) {
          mobileAtmoToast("success", atmoText(
            "Kredi iade edildi.",
            "Credits refunded."
          ));
        }

        return true;
      }

      console.warn("[MOBILE ATMO][REFUND FAILED]", data);
    } catch (err) {
      console.error("[MOBILE ATMO][REFUND ERROR]", err);
    }

    return false;
  }

  function computeMobileAtmoCredit(mode){
  const target = mode === "pro" ? state.pro : state.basic;

  const duration = String(target.duration || "4");

  let baseCredit = mode === "pro" ? 45 : 30;

  if (duration === "6") baseCredit += 5;
  else if (duration === "8") baseCredit += 10;
  else if (duration === "10") baseCredit += 15;
  else if (duration === "12") baseCredit += 20;
  else if (duration === "15") baseCredit += 25;

  const logoExtra = target.logoUrl ? 10 : 0;
  const audioExtra = target.audioUrl ? 10 : 0;

  return baseCredit + logoExtra + audioExtra;
}
  function syncMobileAtmoCreditButtons(){
    const basicCredit = computeMobileAtmoCredit("basic");
    const proCredit = computeMobileAtmoCredit("pro");

    if (basicGenerateBtn) {
      basicGenerateBtn.textContent = atmoText(
        "🎬 Atmosfer Video Oluştur (" + basicCredit + " Kredi)",
        "🎬 Create Atmosphere Video (" + basicCredit + " Credits)"
      );
    }

    if (proGenerateBtn) {
      proGenerateBtn.textContent = atmoText(
        "✨ Süper Atmosfer Video Oluştur (" + proCredit + " Kredi)",
        "✨ Create Super Atmosphere Video (" + proCredit + " Credits)"
      );
    }
  }

  function setStatus(message){
    const text = safeText(message);

    if (state.mode === "pro") {
      if (proStatusEl) proStatusEl.textContent = text;
      return;
    }

    if (basicStatusEl) basicStatusEl.textContent = text;
  }

  function setMode(mode){
    const nextMode = mode === "pro" ? "pro" : "basic";
    state.mode = nextMode;

    modeButtons.forEach(function(btn){
      const active = btn.getAttribute("data-mobile-atmo-mode") === nextMode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    panels.forEach(function(panel){
      const active = panel.getAttribute("data-mobile-atmo-panel") === nextMode;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    setStatus("");
  }

  function bindModeTabs(){
    modeButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        setMode(btn.getAttribute("data-mobile-atmo-mode"));
      });
    });
  }

  function bindBasicScenes(){
    const sceneButtons = Array.from(root.querySelectorAll("[data-atmo-scene]"));

    sceneButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        const scene = safeText(btn.getAttribute("data-atmo-scene"));
        state.basic.scene = scene;

        sceneButtons.forEach(function(item){
          item.classList.toggle("is-active", item === btn);
        });
      });
    });
  }

  function bindBasicEffects(){
    const effectButtons = Array.from(root.querySelectorAll("[data-atmo-eff]"));

    effectButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        const effect = safeText(btn.getAttribute("data-atmo-eff"));
        if (!effect) return;

        const exists = state.basic.effects.includes(effect);

        if (exists) {
          state.basic.effects = state.basic.effects.filter(function(item){
            return item !== effect;
          });
        } else {
          state.basic.effects.push(effect);
        }

        btn.classList.toggle("is-active", !exists);
        btn.setAttribute("aria-pressed", !exists ? "true" : "false");
      });
    });
  }

  function bindBasicControls(){
    if (basicDurationEl) {
    basicDurationEl.addEventListener("change", function(){
  state.basic.duration = safeText(basicDurationEl.value) || "4";
  syncMobileAtmoCreditButtons();
});

      state.basic.duration = safeText(basicDurationEl.value) || "4";
    }

    if (basicRatioEl) {
      basicRatioEl.addEventListener("change", function(){
        state.basic.ratio = safeText(basicRatioEl.value) || "1:1";
      });

      state.basic.ratio = safeText(basicRatioEl.value) || "1:1";
    }
  }

  function bindProPrompt(){
    if (!promptEl || !promptCountEl) return;

    function updatePrompt(){
      const value = String(promptEl.value || "");
      state.pro.prompt = value.trim();
      promptCountEl.textContent = String(value.length);
    }

    promptEl.addEventListener("input", updatePrompt);
    promptEl.addEventListener("change", updatePrompt);
    updatePrompt();
  }

  function bindProStyle(){
    const lightButtons = Array.from(root.querySelectorAll("[data-atmo-light]"));
    const moodButtons = Array.from(root.querySelectorAll("[data-atmo-mood]"));

    lightButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        const value = safeText(btn.getAttribute("data-atmo-light"));
        state.pro.light = value;

        lightButtons.forEach(function(item){
          item.classList.toggle("is-active", item === btn);
        });
      });
    });

    moodButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        const value = safeText(btn.getAttribute("data-atmo-mood"));
        state.pro.mood = value;

        moodButtons.forEach(function(item){
          item.classList.toggle("is-active", item === btn);
        });
      });
    });
  }

  function bindProDetails(){
    const checks = Array.from(root.querySelectorAll("[data-atmo-detail]"));

    checks.forEach(function(input){
      input.addEventListener("change", function(){
        const value = safeText(input.getAttribute("data-atmo-detail"));
        if (!value) return;

        if (input.checked) {
          if (!state.pro.details.includes(value)) {
            state.pro.details.push(value);
          }
        } else {
          state.pro.details = state.pro.details.filter(function(item){
            return item !== value;
          });
        }
      });
    });
  }

function bindProControls(){
  if (proDurationEl) {
  proDurationEl.addEventListener("change", function(){
  state.pro.duration = safeText(proDurationEl.value) || "4";
  syncMobileAtmoCreditButtons();
});

    state.pro.duration = safeText(proDurationEl.value) || "4";
  }

  if (proRatioEl) {
    proRatioEl.addEventListener("change", function(){
      state.pro.ratio = safeText(proRatioEl.value) || "1:1";
    });

    state.pro.ratio = safeText(proRatioEl.value) || "1:1";
  }
}
  async function uploadMobileAtmoFile(file, kind){
  if (!file) return "";

  const presignRes = await fetch("/api/r2/scan-and-presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      app: "atmo",
      kind: kind || "mobile-upload",
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      prompt:
        state.pro.prompt ||
        state.basic.scene ||
        "",
      title: file.name,
      description:
        state.pro.prompt ||
        state.basic.scene ||
        file.name,
      source: "mobile_atmo_upload"
    })
  });

  const data = await presignRes.json().catch(function(){
    return {};
  });

  if (
    !presignRes.ok ||
    !data.ok ||
    !(data.upload_url || data.uploadUrl) ||
    !(data.public_url || data.publicUrl || data.url)
  ) {
    throw new Error(
      data.error ||
      data.message ||
      "presign_failed"
    );
  }

  const uploadUrl =
    data.upload_url ||
    data.uploadUrl;

  const publicUrl =
    data.public_url ||
    data.publicUrl ||
    data.url;

  const key =
    data.key ||
    data.objectKey ||
    "";

  if (!key) {
    throw new Error("missing_upload_key");
  }

  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: data.required_headers || {
      "Content-Type":
        file.type || "application/octet-stream"
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
      app: "atmo",
      key: key,
      filename: file.name,
      contentType:
        file.type || "application/octet-stream",
      public_url: publicUrl,
      prompt:
        state.pro.prompt ||
        state.basic.scene ||
        "",
      title: file.name,
      description:
        state.pro.prompt ||
        state.basic.scene ||
        file.name,
      source: "mobile_atmo_upload"
    })
  });

  const scanData = await scanRes.json().catch(function(){
    return {};
  });

  if (!scanRes.ok) {
    throw new Error(
      scanData.error ||
      scanData.message ||
      "media_policy_blocked"
    );
  }

  if (
    !scanData.ok ||
    (
      scanData.decision &&
      String(scanData.decision).toLowerCase() !== "allow"
    )
  ) {
    throw new Error(
      scanData.error ||
      scanData.message ||
      "media_policy_blocked"
    );
  }

  return scanData.public_url || publicUrl;
}
function setFileLabel(input, file){
  const label = input && input.closest("label");
  if (!label) return;

  const labelMap = {
    mobileAtmoImageFile: atmoText("Resim Seç", "Select Image"),
    mobileAtmoLogoFile: atmoText("Logo Seç", "Select Logo"),
    mobileAtmoAudioFile: atmoText("Audio Seç", "Select Audio"),
    mobileAtmoProImageFile: atmoText("Referans", "Reference"),
    mobileAtmoProLogoFile: atmoText("Logo", "Logo"),
    mobileAtmoProAudioFile: atmoText("Audio", "Audio")
  };

  const cleanText = labelMap[input.id] || atmoText("Dosya Seç", "Select File");
  const nextText = file ? cleanText + " ✓" : cleanText;

  const oldClear = label.querySelector(".mobile-atmo-file-clear");
  if (oldClear) oldClear.remove();

  const textEl = label.querySelector("b");
  if (textEl) {
    textEl.textContent = nextText;
  }

  label.classList.toggle("has-file", !!file);

  if (!file) return;

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "mobile-atmo-file-clear";
  clearBtn.setAttribute("data-mobile-atmo-clear-file", input.id);
  clearBtn.setAttribute("aria-label", atmoText("Dosyayı kaldır", "Remove file"));
  clearBtn.textContent = "×";
  label.appendChild(clearBtn);
}
   function bindFileClearButtons(){
    root.addEventListener("click", function(e){
      const btn = e.target.closest("[data-mobile-atmo-clear-file]");
      if (!btn) return;

      e.preventDefault();
      e.stopPropagation();

      const inputId = btn.getAttribute("data-mobile-atmo-clear-file");
      const input = root.querySelector("#" + inputId);
      if (!input) return;

      input.value = "";

      const fileMapItem = {
        mobileAtmoImageFile: { target:"basic", key:"imageFile", urlKey:"imageUrl" },
        mobileAtmoLogoFile: { target:"basic", key:"logoFile", urlKey:"logoUrl" },
        mobileAtmoAudioFile: { target:"basic", key:"audioFile", urlKey:"audioUrl" },
        mobileAtmoProImageFile: { target:"pro", key:"imageFile", urlKey:"imageUrl" },
        mobileAtmoProLogoFile: { target:"pro", key:"logoFile", urlKey:"logoUrl" },
        mobileAtmoProAudioFile: { target:"pro", key:"audioFile", urlKey:"audioUrl" }
      }[inputId];

      if (!fileMapItem) return;

      state[fileMapItem.target][fileMapItem.key] = null;
      state[fileMapItem.target][fileMapItem.urlKey] = "";

      setFileLabel(input, null);
      syncMobileAtmoCreditButtons();

      if (fileMapItem.urlKey === "imageUrl") {
        setStatus(atmoText(
          "Görsel kaldırıldı.",
          "Image removed."
        ));
        mobileAtmoToast("success", atmoText(
          "Görsel kaldırıldı.",
          "Image removed."
        ));
      } else if (fileMapItem.urlKey === "logoUrl") {
        setStatus(atmoText(
          "Logo kaldırıldı.",
          "Logo removed."
        ));
        mobileAtmoToast("success", atmoText(
          "Logo kaldırıldı · -10 kredi",
          "Logo removed · -10 credits"
        ));
      } else if (fileMapItem.urlKey === "audioUrl") {
        setStatus(atmoText(
          "Müzik kaldırıldı.",
          "Music removed."
        ));
        mobileAtmoToast("success", atmoText(
          "Müzik kaldırıldı · -10 kredi",
          "Music removed · -10 credits"
        ));
      }
    });
  }
  function bindFiles(){
    const fileMap = [
      { id:"#mobileAtmoImageFile", target:"basic", key:"imageFile" },
      { id:"#mobileAtmoLogoFile", target:"basic", key:"logoFile" },
      { id:"#mobileAtmoAudioFile", target:"basic", key:"audioFile" },
      { id:"#mobileAtmoProImageFile", target:"pro", key:"imageFile" },
      { id:"#mobileAtmoProLogoFile", target:"pro", key:"logoFile" },
      { id:"#mobileAtmoProAudioFile", target:"pro", key:"audioFile" }
    ];

    fileMap.forEach(function(item){
      const input = root.querySelector(item.id);
      if (!input) return;

      input.addEventListener("change", function(){
        const file = input.files && input.files[0] ? input.files[0] : null;

        state[item.target][item.key] = file;
        setFileLabel(input, file);

        const urlKey =
          item.key === "imageFile"
            ? "imageUrl"
            : item.key === "logoFile"
              ? "logoUrl"
              : "audioUrl";

        if (!file) {
          state[item.target][urlKey] = "";
          syncMobileAtmoCreditButtons();
          return;
        }

        setStatus(atmoText(
          "Dosya yükleniyor...",
          "File is uploading..."
        ));

        mobileAtmoLoading(atmoText(
          "Dosya güvenlik kontrolünden geçiriliyor...",
          "File is being checked for safety..."
        ));

        uploadMobileAtmoFile(file, item.key)
          .then(function(publicUrl){
            clearMobileAtmoLoading();

            state[item.target][urlKey] = publicUrl;
            syncMobileAtmoCreditButtons();

            if (urlKey === "imageUrl") {
              setStatus(atmoText(
                "Resim eklendi.",
                "Image added."
              ));
              mobileAtmoToast("success", atmoText(
                "Resim eklendi.",
                "Image added."
              ));
            } else if (urlKey === "logoUrl") {
              setStatus(atmoText(
                "Logo eklendi.",
                "Logo added."
              ));
              mobileAtmoToast("success", atmoText(
                "Logo eklendi · +10 kredi",
                "Logo added · +10 credits"
              ));
            } else if (urlKey === "audioUrl") {
              setStatus(atmoText(
                "Müzik eklendi.",
                "Music added."
              ));
              mobileAtmoToast("success", atmoText(
                "Müzik eklendi · +10 kredi",
                "Music added · +10 credits"
              ));
            }
          })
          .catch(function(err){
            console.error("[MOBILE ATMO][UPLOAD ERROR]", err);

            clearMobileAtmoLoading();

            state[item.target][urlKey] = "";

            if (input) {
              input.value = "";
            }

            setFileLabel(input, null);
            syncMobileAtmoCreditButtons();

            const errText = String(
              err?.message ||
              err ||
              ""
            ).toLowerCase();

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

            if (isPolicyBlocked) {
              setStatus(atmoText(
                "Bu görsel kullanılamaz.",
                "This image cannot be used."
              ));
              mobileAtmoToast("error", atmoText(
                "Bu görsel kullanılamaz.",
                "This image cannot be used."
              ));
              return;
            }

            setStatus(atmoText(
              "Dosya yüklenemedi.",
              "File could not be uploaded."
            ));
            mobileAtmoToast("error", atmoText(
              "Dosya yüklenemedi.",
              "File could not be uploaded."
            ));
          });
      });
    });
  }
  function buildBasicPayload(){
    return {
      app: "atmo",
      mode: "basic",
      scene: state.basic.scene,
      effects: state.basic.effects.slice(),
      duration: state.basic.duration,
      aspect: state.basic.ratio,
      ratio: state.basic.ratio,
        has_image: !!state.basic.imageUrl,
      has_logo: !!state.basic.logoUrl,
      has_audio: !!state.basic.audioUrl,
      image_url: state.basic.imageUrl,
      logo_url: state.basic.logoUrl,
          audio_url: state.basic.audioUrl,
      audio_mode: state.basic.audioUrl ? "embed" : "none",
      audio_trim: state.basic.audioUrl ? "loop_to_fit" : "loop_to_fit",
      silent_copy: state.basic.audioUrl ? false : true,
      meta: {
        app: "atmo",
        mode: "basic",
        aspect_ratio: state.basic.ratio,
        duration: state.basic.duration,
        image_url: state.basic.imageUrl,
        logo_url: state.basic.logoUrl,
        audio_url: state.basic.audioUrl
      }
    };
  }

  function buildProPayload(){
    return {
      app: "atmo",
      mode: "pro",
      prompt: state.pro.prompt,
      light: state.pro.light,
      mood: state.pro.mood,
      details: state.pro.details.slice(),
      duration: state.pro.duration,
      aspect: state.pro.ratio,
      ratio: state.pro.ratio,
          has_image: !!state.pro.imageUrl,
      has_logo: !!state.pro.logoUrl,
      has_audio: !!state.pro.audioUrl,
      image_url: state.pro.imageUrl,
      logo_url: state.pro.logoUrl,
           audio_url: state.pro.audioUrl,
      audio_mode: state.pro.audioUrl ? "embed" : "none",
      audio_trim: state.pro.audioUrl ? "loop_to_fit" : "loop_to_fit",
      silent_copy: state.pro.audioUrl ? false : true,
      meta: {
        app: "atmo",
        mode: "pro",
        prompt: state.pro.prompt,
        aspect_ratio: state.pro.ratio,
        duration: state.pro.duration,
        image_url: state.pro.imageUrl,
        logo_url: state.pro.logoUrl,
        audio_url: state.pro.audioUrl
      }
    };
  }

  function bindGenerateButtons(){
    if (basicGenerateBtn) {
       basicGenerateBtn.addEventListener("click", async function(){
        const payload = buildBasicPayload();

        if (!payload.scene && !payload.has_image) {
          setStatus(atmoText(
            "Lütfen bir arka mekan seç veya resim yükle.",
            "Please select a background scene or upload an image."
          ));
          mobileAtmoToast("warning", atmoText(
            "Lütfen bir arka mekan seç veya resim yükle.",
            "Please select a background scene or upload an image."
          ));
          return;
        }

        let creditCtx = null;

        basicGenerateBtn.disabled = true;
        basicGenerateBtn.textContent = atmoText(
          "Üretiliyor...",
          "Generating..."
        );
        basicGenerateBtn.classList.add("is-loading", "is-pressed");
        basicGenerateBtn.setAttribute("aria-busy", "true");

        try {
          creditCtx = await consumeMobileAtmoCredits("basic");
          mobileAtmoToast("success", atmoText(
            computeMobileAtmoCredit("basic") + " kredi kullanıldı.",
            computeMobileAtmoCredit("basic") + " credits used."
          ));
        } catch (creditErr) {
          console.warn("[MOBILE ATMO][BASIC CREDIT ERROR]", creditErr);

          setStatus(atmoText(
            "Yetersiz kredi.",
            "Insufficient credits."
          ));

          mobileAtmoToast("warning", atmoText(
            "Yetersiz kredi. Krediler bölümüne yönlendiriliyorsun...",
            "Insufficient credits. Redirecting you to Credits..."
          ));

          clearMobileAtmoLoading();

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

        mobileAtmoLoading(atmoText(
          "Atmosfer video hazırlanıyor...",
          "Atmosphere video is being prepared..."
        ));

        const tempId = "mobile-atmo-" + Date.now();

        mobileAtmoJobs.length = 0;

        mobileAtmoJobs.unshift({
          id: tempId,
          scope: "current",
          title:
            payload.scene === "winter_cafe" ? atmoText("Kış Kafe", "Winter Cafe") :
            payload.scene === "cozy_cabin" ? atmoText("Dağ Evi", "Mountain Cabin") :
            payload.scene === "lake_cabin" ? atmoText("Göl Kenarı", "Lakeside") :
            payload.scene === "city_night" ? atmoText("Şehir Gecesi", "City Night") :
            payload.scene === "rainy_window" ? atmoText("Yağmurlu Pencere", "Rainy Window") :
            payload.scene === "old_stone_street" ? atmoText("Eski Taş Sokak", "Old Stone Street") :
            atmoText("Atmosfer video", "Atmosphere video"),
          videoUrl: "",
          payload: payload,
          status: "processing"
        });

        mobileAtmoViewMode = "current";

        if (resultsEl) {
          resultsEl.hidden = false;
        }

        renderMobileAtmoResults();

        setStatus(atmoText(
          "Atmosfer video hazırlanıyor...",
          "Atmosphere video is being prepared..."
        ));

         fetch("/api/jobs/create-atmo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify(payload)
        })
        .then(function(res){
          return res.json();
        })
        .then(function(data){
          console.log("[MOBILE ATMO][BASIC RESPONSE]", data);

          const realJobId = String(
            data.job_id ||
            data.job?.job_id ||
            data.job?.id ||
            data.id ||
            ""
          ).trim();

          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realJobId);

          const job = mobileAtmoJobs.find(function(item){
            return item.id === tempId;
          });

          if (!job) return;

          if (!isUuid) {
            const refundCtx = {
              ...creditCtx,
              job_id: "",
              provider_job_id: safeText(data.request_id || data.requestId || "")
            };

            job.status = "error";
            job.title = atmoText(
              "Job ID alınamadı",
              "Job ID could not be received"
            );

            renderMobileAtmoResults();

            setStatus(atmoText(
              "Üretim başladı ama gerçek job_id alınamadı.",
              "Generation started but a valid job_id could not be received."
            ));

            clearMobileAtmoLoading();

            mobileAtmoToast("error", atmoText(
              "Üretim başladı ama gerçek job_id alınamadı.",
              "Generation started but a valid job_id could not be received."
            ));

            console.warn("[MOBILE ATMO][BASIC NO UUID]", data);

            refundMobileAtmoCredits(refundCtx, "mobile_atmo_missing_job_id", {
              error: "missing_job_id",
              response: data
            });

            return;
          }

          const refundCtx = {
            ...creditCtx,
            job_id: realJobId,
            provider_job_id: safeText(data.request_id || data.requestId || "")
          };

          job.id = realJobId;
          job.status = "processing";
          job.refundCtx = refundCtx;

          renderMobileAtmoResults();

          setStatus(atmoText(
            "Atmosfer video hazırlanıyor...",
            "Atmosphere video is being prepared..."
          ));

          mobileAtmoLoading(atmoText(
            "Atmosfer video hazırlanıyor...",
            "Atmosphere video is being prepared..."
          ));

          pollMobileAtmoJob(realJobId);
        })
        .catch(function(err){
          console.error("[MOBILE ATMO][BASIC ERROR]", err);

          setStatus(atmoText(
            "Atmosfer üretimi başlatılamadı.",
            "Atmosphere generation could not be started."
          ));

          clearMobileAtmoLoading();

          mobileAtmoToast("error", atmoText(
            "Atmosfer üretimi başlatılamadı.",
            "Atmosphere generation could not be started."
          ));

          refundMobileAtmoCredits(creditCtx, "mobile_atmo_basic_create_failed", {
            error: String(err?.message || err || "basic_create_failed")
          });
        });
      });
    }

    if (proGenerateBtn) {
          proGenerateBtn.addEventListener("click", async function(){
        const payload = buildProPayload();

        if (!payload.prompt) {
          setStatus(atmoText(
            "Süper Mod için prompt yazmalısın.",
            "You need to write a prompt for Super Mode."
          ));
          mobileAtmoToast("warning", atmoText(
            "Süper Mod için prompt yazmalısın.",
            "You need to write a prompt for Super Mode."
          ));
          return;
        }

        let creditCtx = null;

        proGenerateBtn.disabled = true;
        proGenerateBtn.textContent = atmoText(
          "Üretiliyor...",
          "Generating..."
        );
        proGenerateBtn.classList.add("is-loading", "is-pressed");
        proGenerateBtn.setAttribute("aria-busy", "true");

        try {
          creditCtx = await consumeMobileAtmoCredits("pro");
          mobileAtmoToast("success", atmoText(
            computeMobileAtmoCredit("pro") + " kredi kullanıldı.",
            computeMobileAtmoCredit("pro") + " credits used."
          ));
        } catch (creditErr) {
          console.warn("[MOBILE ATMO][PRO CREDIT ERROR]", creditErr);

          setStatus(atmoText(
            "Yetersiz kredi.",
            "Insufficient credits."
          ));

          mobileAtmoToast("warning", atmoText(
            "Yetersiz kredi. Krediler bölümüne yönlendiriliyorsun...",
            "Insufficient credits. Redirecting you to Credits..."
          ));

          clearMobileAtmoLoading();

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

        mobileAtmoLoading(atmoText(
          "Süper atmosfer video hazırlanıyor...",
          "Super atmosphere video is being prepared..."
        ));

        const tempId = "mobile-atmo-" + Date.now();

        const proTitleWords = String(payload.prompt || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 4);

        mobileAtmoJobs.length = 0;

        mobileAtmoJobs.unshift({
          id: tempId,
          scope: "current",
          title: proTitleWords.length
            ? proTitleWords.join(" ") + "..."
            : atmoText("Süper atmosfer video", "Super atmosphere video"),
          videoUrl: "",
          payload: payload,
          status: "processing"
        });

        mobileAtmoViewMode = "current";

        if (resultsEl) {
          resultsEl.hidden = false;
        }

        renderMobileAtmoResults();

             setStatus(atmoText(
          "Süper atmosfer video hazırlanıyor...",
          "Super atmosphere video is being prepared..."
        ));

        fetch("/api/jobs/create-atmo", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          credentials: "include",
          body: JSON.stringify(payload)
        })
        .then(function(res){
          return res.json();
        })
        .then(function(data){
          console.log("[MOBILE ATMO][PRO RESPONSE]", data);

          const realJobId = String(
            data.job_id ||
            data.job?.job_id ||
            data.job?.id ||
            data.id ||
            ""
          ).trim();

          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realJobId);

          const job = mobileAtmoJobs.find(function(item){
            return item.id === tempId;
          });

          if (!job) return;

          if (!isUuid) {
            const refundCtx = {
              ...creditCtx,
              job_id: "",
              provider_job_id: safeText(data.request_id || data.requestId || "")
            };

            job.status = "error";
            job.title = atmoText(
              "Job ID alınamadı",
              "Job ID could not be received"
            );

            renderMobileAtmoResults();

            setStatus(atmoText(
              "Üretim başladı ama gerçek job_id alınamadı.",
              "Generation started but a valid job_id could not be received."
            ));

            clearMobileAtmoLoading();

            mobileAtmoToast("error", atmoText(
              "Üretim başladı ama gerçek job_id alınamadı.",
              "Generation started but a valid job_id could not be received."
            ));

            console.warn("[MOBILE ATMO][PRO NO UUID]", data);

            refundMobileAtmoCredits(refundCtx, "mobile_atmo_missing_job_id", {
              error: "missing_job_id",
              response: data
            });

            return;
          }

          const refundCtx = {
            ...creditCtx,
            job_id: realJobId,
            provider_job_id: safeText(data.request_id || data.requestId || "")
          };

          job.id = realJobId;
          job.status = "processing";
          job.refundCtx = refundCtx;

          renderMobileAtmoResults();

          setStatus(atmoText(
            "Süper atmosfer video hazırlanıyor...",
            "Super atmosphere video is being prepared..."
          ));

          mobileAtmoLoading(atmoText(
            "Süper atmosfer video hazırlanıyor...",
            "Super atmosphere video is being prepared..."
          ));

          pollMobileAtmoJob(realJobId);
        })
        .catch(function(err){
          console.error("[MOBILE ATMO][PRO ERROR]", err);

          setStatus(atmoText(
            "Süper atmosfer üretimi başlatılamadı.",
            "Super atmosphere generation could not be started."
          ));

          clearMobileAtmoLoading();

          mobileAtmoToast("error", atmoText(
            "Süper atmosfer üretimi başlatılamadı.",
            "Super atmosphere generation could not be started."
          ));

          refundMobileAtmoCredits(creditCtx, "mobile_atmo_pro_create_failed", {
            error: String(err?.message || err || "pro_create_failed")
          });
        });
      });
    }
  }

  function syncMobileAtmoLocalizedUi(){
    syncMobileAtmoCreditButtons();

    const badgeMap = {
      mobileAtmoLogoFile: "atmo.badgePlus10",
      mobileAtmoAudioFile: "atmo.badgePlus10",
      mobileAtmoProImageFile: "atmo.badgeFree",
      mobileAtmoProLogoFile: "atmo.badgePlus10",
      mobileAtmoProAudioFile: "atmo.badgePlus10"
    };

    [
      "#mobileAtmoImageFile",
      "#mobileAtmoLogoFile",
      "#mobileAtmoAudioFile",
      "#mobileAtmoProImageFile",
      "#mobileAtmoProLogoFile",
      "#mobileAtmoProAudioFile"
    ].forEach(function(selector){
      const input = root.querySelector(selector);
      if (!input) return;

      const label = input.closest("label");
      const badgeKey = badgeMap[input.id];

      if (label && badgeKey) {
        label.setAttribute(
          "data-atmo-cost-label",
          typeof window.t === "function" ? window.t(badgeKey) : label.getAttribute("data-atmo-cost-label")
        );
      }

      const hasFile = Boolean(input.files && input.files[0]);
      setFileLabel(input, hasFile ? input.files[0] : null);
    });

    renderMobileAtmoResults();
  }

  bindModeTabs();
  bindBasicScenes();
  bindBasicEffects();
  bindBasicControls();
  bindProPrompt();
  bindProStyle();
  bindProDetails();
  bindProControls();
  bindFiles();
  bindFileClearButtons();
  bindGenerateButtons();
  bindMobileAtmoResultActions();

  syncMobileAtmoLocalizedUi();

  document.addEventListener("aivo:language-change", function(){
    syncMobileAtmoLocalizedUi();
  });

  setMode("basic");
 
  window.mobileAtmoShowCurrent = function(){
  mobileAtmoViewMode = "current";
  renderMobileAtmoResults();
};

window.mobileAtmoHydrate = async function(){
  mobileAtmoViewMode = "library";
  await hydrateMobileAtmoLibrary();
  renderMobileAtmoResults();
};
  window.mobileAtmoState = state;
})();
