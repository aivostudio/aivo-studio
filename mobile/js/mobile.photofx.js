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
      return !mobilePhotoFxDeletedIds.has(job.id);
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
    .then(function(data){
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
        return;
      }

      if (status.includes("fail") || status.includes("error")) {
        job.status = "error";
        job.title = "PhotoFX klip oluşturulamadı";
        renderMobilePhotoFxResults();
        setStatus("PhotoFX klip oluşturulamadı.");
        return;
      }

      setTimeout(function(){
        pollMobilePhotoFxJob(jobId);
      }, 3000);
    })
    .catch(function(err){
      console.error("[MOBILE PHOTOFX][POLL ERROR]", err);

      setTimeout(function(){
        pollMobilePhotoFxJob(jobId);
      }, 4000);
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
        contentType: file.type,
        prefix: "uploads/photofx/tmp/"
      })
    });

    const data = await presignRes.json().catch(function(){
      return {};
    });

    if (!presignRes.ok || !data.ok || !data.upload_url || !data.public_url) {
      throw new Error(data.error || "presign_failed");
    }

    const uploadRes = await fetch(data.upload_url, {
      method: "PUT",
      headers: data.required_headers || {
        "Content-Type": file.type
      },
      body: file
    });

    if (!uploadRes.ok) {
      throw new Error("r2_upload_failed");
    }

    return data.public_url;
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
        state.imageFile = null;
        state.imageUrl = "";
      }

      if (inputId === "mobilePhotoFxLogoFile") {
        state.logoFile = null;
        state.logoUrl = "";
      }

      if (inputId === "mobilePhotoFxAudioFile") {
        state.audioFile = null;
        state.audioUrl = "";
      }

      setFileLabel(input, null);
      syncCreditButton();
      setStatus("Dosya kaldırıldı.");
    });
  }

  function bindUploads(){
    const fileMap = [
      { input:imageFileEl, fileKey:"imageFile", urlKey:"imageUrl", kind:"imageFile" },
      { input:logoFileEl, fileKey:"logoFile", urlKey:"logoUrl", kind:"logoFile" },
      { input:audioFileEl, fileKey:"audioFile", urlKey:"audioUrl", kind:"audioFile" }
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

        try {
          const publicUrl = await uploadMobilePhotoFxFile(file, item.kind);
          state[item.urlKey] = publicUrl;
          setFileLabel(input, file);
          syncCreditButton();
          setStatus("Dosya yüklendi.");
        } catch (err) {
          console.error("[MOBILE PHOTOFX][UPLOAD ERROR]", err);

          state[item.fileKey] = null;
          state[item.urlKey] = "";
          input.value = "";

          setFileLabel(input, null);
          syncCreditButton();
          setStatus("Dosya yüklenemedi.");
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
        } else {
          state.styles.push(value);
          btn.classList.add("is-active");
          btn.setAttribute("aria-pressed", "true");
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
        return;
      }

      if (!payload.prompt) {
        setStatus("Lütfen prompt yaz.");
        return;
      }

      const tempJobId = "mobile-photofx-" + Date.now();

      mobilePhotoFxJobs.unshift({
        id: tempJobId,
        status: "processing",
        title: state.prompt.split(/\s+/).slice(0, 4).join(" ") || "PhotoFX klip",
        videoUrl: "",
        payload: payload
      });

      renderMobilePhotoFxResults();
      setStatus("PhotoFX klip hazırlanıyor...");

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
          return;
        }

        const realJobId = String(data.job_id || "").trim();

        const job = mobilePhotoFxJobs.find(function(item){
          return item.id === tempJobId;
        });

        if (job) {
          job.id = realJobId;
          job.status = "processing";
        }

        renderMobilePhotoFxResults();
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
      }
    });
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
          navigator.clipboard.writeText(job.videoUrl).catch(function(){});
        }

        return;
      }

      if (act === "delete") {
        mobilePhotoFxDeletedIds.add(id);
        renderMobilePhotoFxResults();
        return;
      }
    });
  }
  function bindTapFallbacks(){
    root.addEventListener("click", function(e){
      const styleBtn = e.target.closest("[data-photofx-style]");
      if (styleBtn && root.contains(styleBtn)) {
        const value = safeText(styleBtn.getAttribute("data-photofx-style"));
        if (value) {
          const exists = state.styles.includes(value);

          if (exists) {
            state.styles = state.styles.filter(function(item){
              return item !== value;
            });
            styleBtn.classList.remove("is-active");
            styleBtn.setAttribute("aria-pressed", "false");
          } else {
            state.styles.push(value);
            styleBtn.classList.add("is-active");
            styleBtn.setAttribute("aria-pressed", "true");
          }

          syncCreditButton();
        }

        return;
      }

  
    }, true);
  }
   bindPrompt();
  bindStyleButtons();
  bindControls();
  bindUploads();
  bindFileClearButtons();
  bindGenerate();
  bindResultActions();
  syncCreditButton();
  renderMobilePhotoFxResults();

  window.mobilePhotoFxState = state;
})();
