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

  function esc(value){
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderMobileAtmoResults(){
    if (!resultsEl) return;

    const items = mobileAtmoJobs.filter(function(job){
      return !mobileAtmoDeletedIds.has(job.id);
    });

    if (!items.length) {
      resultsEl.className = "empty-card";
      resultsEl.innerHTML = "Henüz mobil atmosfer videosu başlatılmadı.";
      return;
    }

    resultsEl.className = "mobile-atmo-results";

    resultsEl.innerHTML = items.map(function(job){
      const ready = !!job.videoUrl;

      return `
        <article class="mobile-atmo-video-card" data-mobile-atmo-job="${esc(job.id)}">
          <div class="mobile-atmo-video-media">
            ${
              ready
                ? `<video class="mobile-atmo-video" src="${esc(job.videoUrl)}" playsinline webkit-playsinline preload="metadata"></video>`
                : `<div class="mobile-atmo-video-loading"><span>Hazırlanıyor…</span></div>`
            }

            <div class="mobile-atmo-video-actions">
              <button type="button" data-mobile-atmo-act="download" ${ready ? "" : "disabled"}>⬇</button>
              <button type="button" data-mobile-atmo-act="share" ${ready ? "" : "disabled"}>↗</button>
              <button type="button" data-mobile-atmo-act="fullscreen" ${ready ? "" : "disabled"}>⛶</button>
              <button type="button" data-mobile-atmo-act="delete">🗑</button>
            </div>

                    ${
              ready
                ? `<button class="mobile-atmo-video-play" type="button" data-mobile-atmo-act="play">▶</button>`
                : ``
            }
          </div>

          <div class="mobile-atmo-video-title">${esc(job.title || "Atmosfer video")}</div>
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
        job.status = "ready";
        job.title = job.title || "Atmosfer video hazır";
        renderMobileAtmoResults();
        setStatus("Atmosfer video hazır.");
        return;
      }

      if (status.includes("fail") || status.includes("error")) {
        job.status = "error";
        job.title = "Atmosfer video oluşturulamadı";
        renderMobileAtmoResults();
        setStatus("Atmosfer video oluşturulamadı.");
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

        if (video.paused) {
          video.play().catch(function(){});
        } else {
          video.pause();
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
          encodeURIComponent("aivo-atmosfer-video.mp4");

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
            title: "AIVO Atmosfer Video",
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
        return;
      }
    });
  }
  const state = {
    mode: "basic",

    basic: {
      scene: "",
      effects: [],
      duration: "4",
      ratio: "1:1",
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
   function uploadMobileAtmoFile(file, kind){
    if (!file) return Promise.resolve("");

    return fetch("/api/r2/scan-and-presign", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify({
        app: "atmo",
        kind: kind,
        filename: file.name,
        contentType: file.type,
        prefix: "uploads/atmo/tmp/"
      })
    })
    .then(function(res){
      return res.json();
    })
    .then(function(data){
      if (!data || !data.ok || !data.upload_url || !data.public_url) {
        throw new Error("presign_failed");
      }

      return fetch(data.upload_url, {
        method: "PUT",
        headers: data.required_headers || {
          "Content-Type": file.type
        },
        body: file
      })
      .then(function(uploadRes){
        if (!uploadRes.ok) {
          throw new Error("r2_upload_failed");
        }

        return data.public_url;
      });
    });
  }
  function setFileLabel(input, file){
    const label = input && input.closest("label");
    if (!label) return;

    if (!label.dataset.originalText) {
      label.dataset.originalText = safeText(label.textContent);
    }

    if (!file) {
      label.childNodes.forEach(function(node){
        if (node.nodeType === Node.TEXT_NODE) {
          node.textContent = " " + label.dataset.originalText.replace(/^[^\s]+\s*/, "");
        }
      });
      return;
    }

    const name = file.name && file.name.length > 18
      ? file.name.slice(0, 15) + "..."
      : file.name;

    label.childNodes.forEach(function(node){
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent = " " + name;
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
      has_image: !!state.basic.imageFile,
      has_logo: !!state.basic.logoFile,
      has_audio: !!state.basic.audioFile,
      meta: {
        app: "atmo",
        mode: "basic",
        aspect_ratio: state.basic.ratio,
        duration: state.basic.duration
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
      has_image: !!state.pro.imageFile,
      has_logo: !!state.pro.logoFile,
      has_audio: !!state.pro.audioFile,
      meta: {
        app: "atmo",
        mode: "pro",
        prompt: state.pro.prompt,
        aspect_ratio: state.pro.ratio,
        duration: state.pro.duration
      }
    };
  }

  function bindGenerateButtons(){
    if (basicGenerateBtn) {
      basicGenerateBtn.addEventListener("click", function(){
        const payload = buildBasicPayload();

        if (!payload.scene && !payload.has_image) {
          setStatus("Lütfen bir arka mekan seç veya resim yükle.");
          return;
        }

                const tempId = "mobile-atmo-" + Date.now();

        mobileAtmoJobs.unshift({
          id: tempId,
          title: "Atmosfer video hazırlanıyor",
          videoUrl: "",
          payload: payload,
          status: "processing"
        });

        renderMobileAtmoResults();

        setStatus("Atmosfer video hazırlanıyor...");

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
            job.status = "error";
            job.title = "Job ID alınamadı";
            renderMobileAtmoResults();
            setStatus("Üretim başladı ama gerçek job_id alınamadı.");
            console.warn("[MOBILE ATMO][BASIC NO UUID]", data);
            return;
          }

          job.id = realJobId;
          job.status = "processing";

          renderMobileAtmoResults();
          pollMobileAtmoJob(realJobId);
        })
        .catch(function(err){
          console.error("[MOBILE ATMO][BASIC ERROR]", err);
          setStatus("Atmosfer üretimi başlatılamadı.");
        });
      });
    }

    if (proGenerateBtn) {
      proGenerateBtn.addEventListener("click", function(){
        const payload = buildProPayload();

        if (!payload.prompt) {
          setStatus("Süper Mod için prompt yazmalısın.");
          return;
        }

                   const tempId = "mobile-atmo-" + Date.now();

        mobileAtmoJobs.unshift({
          id: tempId,
          title: payload.prompt || "Süper atmosfer video hazırlanıyor",
          videoUrl: "",
          payload: payload,
          status: "processing"
        });

        renderMobileAtmoResults();

        setStatus("Süper atmosfer video hazırlanıyor...");

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
            job.status = "error";
            job.title = "Job ID alınamadı";
            renderMobileAtmoResults();
            setStatus("Üretim başladı ama gerçek job_id alınamadı.");
            console.warn("[MOBILE ATMO][PRO NO UUID]", data);
            return;
          }

          job.id = realJobId;
          job.status = "processing";

          renderMobileAtmoResults();
          pollMobileAtmoJob(realJobId);
        })
        .catch(function(err){
          console.error("[MOBILE ATMO][PRO ERROR]", err);
          setStatus("Süper atmosfer üretimi başlatılamadı.");
        });
      });
    }
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
  bindGenerateButtons();
 bindMobileAtmoResultActions();

  setMode("basic");

  window.mobileAtmoState = state;
})();
