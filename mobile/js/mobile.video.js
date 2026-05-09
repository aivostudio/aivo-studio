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

  const mobileVideoJobs = [];
  const mobileVideoDeletedIds = new Set();

  const state = {
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

  function renderMobileVideoResults(){
    if (!resultsEl) return;

    const items = mobileVideoJobs.filter(function(job){
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

  function pollMobileVideoJob(jobId){
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
      console.log("[MOBILE VIDEO][POLL]", data);

      const status = String(
        data.status ||
        data.db_status ||
        data.state ||
        ""
      ).toLowerCase();

      const videoUrl = pickVideoUrl(data);

      const job = mobileVideoJobs.find(function(item){
        return item.id === jobId;
      });

      if (!job) return;

      if (videoUrl) {
        job.videoUrl = videoUrl;
        job.status = "ready";
        job.title = job.title || "Video hazır";
        renderMobileVideoResults();
        setStatus("Video hazır.");
        return;
      }

      if (status.includes("fail") || status.includes("error")) {
        job.status = "error";
        job.title = "Video oluşturulamadı";
        renderMobileVideoResults();
        setStatus("Video oluşturulamadı.");
        return;
      }

      setTimeout(function(){
        pollMobileVideoJob(jobId);
      }, 3000);
    })
    .catch(function(err){
      console.error("[MOBILE VIDEO][POLL ERROR]", err);

      setTimeout(function(){
        pollMobileVideoJob(jobId);
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

      imageFileEl.value = "";
      state.imageFile = null;
      state.imageUrl = "";

      setFileLabel(imageFileEl, null);
      setStatus("Görsel kaldırıldı.");
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

      try {
        const publicUrl = await uploadMobileVideoFile(file);
        state.imageUrl = publicUrl;
        setFileLabel(imageFileEl, file);
        setStatus("Görsel yüklendi.");
      } catch (err) {
        console.error("[MOBILE VIDEO][UPLOAD ERROR]", err);

        state.imageFile = null;
        state.imageUrl = "";
        imageFileEl.value = "";

        setFileLabel(imageFileEl, null);
        setStatus("Görsel yüklenemedi.");
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
      qualityEl.addEventListener("change", function(){
        state.quality = safeText(qualityEl.value) || "standard";
        syncCreditButton();
      });
      state.quality = safeText(qualityEl.value) || "standard";
    }
  }

  function buildPayload(){
    return {
      app: "video",
      mode: "image",
      prompt: state.prompt,
      image_url: state.imageUrl,
      duration: Number(state.duration || 5),
      ratio: state.ratio || "16:9",
      resolution: state.quality === "high" ? 1080 : 720,
      motion: state.motion || "balanced",
      quality: state.quality || "standard",
      credit_cost: computeCredit(),
      meta: {
        app: "video",
        source: "mobile",
        mode: "image",
        image_url: state.imageUrl,
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

      if (!payload.image_url) {
        setStatus("Lütfen referans görsel yükle.");
        return;
      }

      if (!payload.prompt) {
        setStatus("Lütfen prompt yaz.");
        return;
      }

      const tempJobId = "mobile-video-" + Date.now();

      mobileVideoJobs.unshift({
        id: tempJobId,
        status: "processing",
        title: state.prompt.split(/\s+/).slice(0, 4).join(" ") || "Video",
        videoUrl: "",
        payload: payload
      });

      renderMobileVideoResults();
      setStatus("Video hazırlanıyor...");

      try {
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

        if (!res.ok || !data.ok || !data.job_id) {
          const job = mobileVideoJobs.find(function(item){
            return item.id === tempJobId;
          });

          if (job) {
            job.status = "error";
            job.title = "Video başlatılamadı";
          }

          renderMobileVideoResults();
          setStatus("Video başlatılamadı.");
          return;
        }

        const realJobId = String(data.job_id || "").trim();

        const job = mobileVideoJobs.find(function(item){
          return item.id === tempJobId;
        });

        if (job) {
          job.id = realJobId;
          job.status = "processing";
        }

        renderMobileVideoResults();
        pollMobileVideoJob(realJobId);
      } catch (err) {
        console.error("[MOBILE VIDEO][CREATE ERROR]", err);

        const job = mobileVideoJobs.find(function(item){
          return item.id === tempJobId;
        });

        if (job) {
          job.status = "error";
          job.title = "Video başlatılamadı";
        }

        renderMobileVideoResults();
        setStatus("Video başlatılamadı.");
      }
    });
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

      const job = mobileVideoJobs.find(function(item){
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
          }).catch(function(){});
        } else if (navigator.clipboard) {
          navigator.clipboard.writeText(job.videoUrl).catch(function(){});
        }

        return;
      }

      if (act === "delete") {
        mobileVideoDeletedIds.add(id);
        renderMobileVideoResults();
        return;
      }
    });
  }

  bindPrompt();
  bindControls();
  bindUpload();
  bindFileClearButton();
  bindGenerate();
  bindResultActions();
  syncCreditButton();
  renderMobileVideoResults();

  window.mobileVideoState = state;
})();
