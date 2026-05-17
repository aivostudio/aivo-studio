(function(){
  const root = document.getElementById("mobileCartoonSection");
  if (!root || root.__mobileCartoonBound) return;
  root.__mobileCartoonBound = true;

  const modeButtons = Array.from(root.querySelectorAll("[data-mobile-cartoon-mode]"));
  const views = Array.from(root.querySelectorAll("[data-mobile-cartoon-view]"));

  const characterPromptEl = root.querySelector("#mobileCartoonCharacterPrompt");
  const characterCountEl = root.querySelector("#mobileCartoonCharacterCount");
  const scenePromptEl = root.querySelector("#mobileCartoonScenePrompt");
  const sceneCountEl = root.querySelector("#mobileCartoonSceneCount");

  const characterBtn = root.querySelector("#mobileCartoonCharacterBtn");
  const generateBtn = root.querySelector("#mobileCartoonGenerateBtn");

  const characterStatusEl = root.querySelector("#mobileCartoonCharacterStatus");
  const statusEl = root.querySelector("#mobileCartoonStatus");

  const durationEl = root.querySelector("#mobileCartoonDuration");
  const ratioEl = root.querySelector("#mobileCartoonRatio");
  const characterImageEl = root.querySelector("#mobileCartoonCharacterImage");
const characterImageClearEl = root.querySelector("#mobileCartoonCharacterImageClear");
const characterImageTextEl = root.querySelector("#mobileCartoonCharacterImageText");

const audioFileEl = root.querySelector("#mobileCartoonAudioFile");
const audioClearEl = root.querySelector("#mobileCartoonAudioClear");
const audioTextEl = root.querySelector("#mobileCartoonAudioText");

const logoFileEl = root.querySelector("#mobileCartoonLogoFile");
const logoClearEl = root.querySelector("#mobileCartoonLogoClear");
const logoTextEl = root.querySelector("#mobileCartoonLogoText");

const customFileEl = root.querySelector("#mobileCartoonCustomFile");
const customClearEl = root.querySelector("#mobileCartoonCustomClear");
const customTextEl = root.querySelector("#mobileCartoonCustomText");

const resultsEl = root.querySelector("#mobileCartoonResults");
const mobileCartoonJobs = [];
const mobileCartoonDeletedIds = new Set();
  let mobileCartoonViewMode = "current";

function esc(value){
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMobileCartoonResults(){
  if (!resultsEl) return;

 const items = mobileCartoonJobs.filter(function(job){
  if (mobileCartoonDeletedIds.has(job.id)) return false;

  if (mobileCartoonViewMode === "current") {
    return job.scope === "current";
  }

  return job.scope === "library";
});

  if (!items.length) {
    resultsEl.className = "empty-card";
    resultsEl.innerHTML = "Henüz mobil çizgifilm videosu başlatılmadı.";
    return;
  }

  resultsEl.className = "mobile-cartoon-results";

  resultsEl.innerHTML = items.map(function(job){
    const ready = !!job.videoUrl;
    const failed = String(job.status || "").toLowerCase() === "error";

    return `
      <article class="mobile-cartoon-video-card ${failed ? "is-error" : ""}" data-mobile-cartoon-job="${esc(job.id)}">
        <div class="mobile-cartoon-video-media">
          ${
            ready
              ? `<video class="mobile-cartoon-video" src="${esc(job.videoUrl)}" playsinline webkit-playsinline preload="metadata"></video>`
              : failed
                ? `<div class="mobile-cartoon-video-loading"><span>Video çıktısı alınamadı</span></div>`
                : `<div class="mobile-cartoon-video-loading"><span>Hazırlanıyor…</span></div>`
          }

          <div class="mobile-cartoon-video-actions">
            <button type="button" data-mobile-cartoon-act="download" ${ready ? "" : "disabled"}>⬇</button>
            <button type="button" data-mobile-cartoon-act="share" ${ready ? "" : "disabled"}>↗</button>
            <button type="button" data-mobile-cartoon-act="sound" ${ready ? "" : "disabled"}>🔇</button>
            <button type="button" data-mobile-cartoon-act="fullscreen" ${ready ? "" : "disabled"}>⛶</button>
            <button type="button" data-mobile-cartoon-act="delete">🗑</button>
          </div>

          ${
            ready
              ? `<button class="mobile-cartoon-video-play" type="button" data-mobile-cartoon-act="play">▶</button>`
              : ``
          }
        </div>

        <div class="mobile-cartoon-video-title">${esc(job.title || "Çizgifilm video")}</div>
      </article>
    `;
  }).join("");
}

function pickCartoonVideoUrl(data){
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
function pickCartoonImageUrl(data){
  return String(
    data.image_url ||
    data.final_image_url ||
    data.url ||
    data.image?.url ||
    data.output?.image?.url ||
    data.meta?.final_image_url ||
    data.outputs?.[0]?.url ||
    ""
  ).trim();
}

function pollMobileCartoonCharacterJob(jobId, tempCharacterId, fallbackName, refundCtx){
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
    console.log("[MOBILE CARTOON][CHARACTER POLL]", data);

    const status = String(
      data.status ||
      data.db_status ||
      data.state ||
      ""
    ).toLowerCase();

    const imageUrl = pickCartoonImageUrl(data);
    const libraryEl = root.querySelector("#mobileCartoonCharacterLibrary");
    const card = libraryEl ? libraryEl.querySelector('[data-mobile-cartoon-character="' + tempCharacterId + '"]') : null;

    if (imageUrl && card) {
      card.setAttribute("data-mobile-cartoon-character", jobId);
      card.innerHTML = `
        <div class="mobile-cartoon-character-thumb">
          <img src="${esc(imageUrl)}" alt="${esc(fallbackName || "Karakter")}">
          <div class="mobile-cartoon-character-actions">
            <button type="button" data-mobile-cartoon-character-act="preview" data-character-url="${esc(imageUrl)}">⛶</button>
            <button type="button" data-mobile-cartoon-character-act="download" data-character-url="${esc(imageUrl)}">⬇</button>
            <button type="button" data-mobile-cartoon-character-act="select" data-character-url="${esc(imageUrl)}">✓</button>
            <button type="button" data-mobile-cartoon-character-act="delete">🗑</button>
          </div>
        </div>
        <div class="mobile-cartoon-character-name">${esc(fallbackName || "Karakter")}</div>
      `;

             setStatus("Karakter hazır.");
      clearMobileCartoonLoading();
      mobileCartoonToast("success", "Karakter hazır.");
      return;
    }

    if (status.includes("fail") || status.includes("error")) {
      if (card) {
        card.remove();
      }

      setStatus("Karakter oluşturulamadı.");
      clearMobileCartoonLoading();
      mobileCartoonToast("error", "Karakter oluşturulamadı.");

      refundMobileCartoonCredits(refundCtx, "mobile_cartoon_character_poll_failed", {
        error: "character_poll_failed",
        status: status,
        job_id: jobId,
        response: data
      });

      return;
    }
       setTimeout(function(){
      pollMobileCartoonCharacterJob(jobId, tempCharacterId, fallbackName, refundCtx);
    }, 3000);
  })
  .catch(function(err){
    console.error("[MOBILE CARTOON][CHARACTER POLL ERROR]", err);

    setTimeout(function(){
      pollMobileCartoonCharacterJob(jobId, tempCharacterId, fallbackName, refundCtx);
    }, 4000);
  });
}
function pollMobileCartoonJob(jobId){
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
    console.log("[MOBILE CARTOON][POLL]", data);

    const status = String(
      data.status ||
      data.db_status ||
      data.state ||
      ""
    ).toLowerCase();

    const videoUrl = pickCartoonVideoUrl(data);

    const job = mobileCartoonJobs.find(function(item){
      return item.id === jobId;
    });

    if (!job) return;

      if (videoUrl) {
      job.videoUrl = videoUrl;
      job.status = "ready";
      job.title = job.title || "Çizgifilm video hazır";
      renderMobileCartoonResults();
           setStatus("Çizgifilm video hazır.");
      clearMobileCartoonLoading();
      mobileCartoonToast("success", "Çizgifilm video hazır.");
      return;
    }

    if (
      (status.includes("ready") || status.includes("done") || status.includes("complete") || status.includes("success")) &&
      !videoUrl
    ) {
      job.status = "error";
      job.title = "Video çıktısı alınamadı";
      renderMobileCartoonResults();
      setStatus("Video çıktısı alınamadı.");
      clearMobileCartoonLoading();
      mobileCartoonToast("error", "Video çıktısı alınamadı.");

      refundMobileCartoonCredits(job.refundCtx, "mobile_cartoon_ready_no_output", {
        error: "ready_no_output",
        status: status,
        job_id: jobId,
        response: data
      });

      return;
    }

    if (status.includes("fail") || status.includes("error")) {
      job.status = "error";
      job.title = "Çizgifilm video oluşturulamadı";
      renderMobileCartoonResults();
           setStatus("Çizgifilm video oluşturulamadı.");
      clearMobileCartoonLoading();
      mobileCartoonToast("error", "Çizgifilm video oluşturulamadı.");

      refundMobileCartoonCredits(job.refundCtx, "mobile_cartoon_basic_poll_failed", {
        error: "basic_poll_failed",
        status: status,
        job_id: jobId,
        response: data
      });

      return;
    }

    setTimeout(function(){
      pollMobileCartoonJob(jobId);
    }, 3000);
  })
  .catch(function(err){
    console.error("[MOBILE CARTOON][POLL ERROR]", err);

    setTimeout(function(){
      pollMobileCartoonJob(jobId);
    }, 4000);
  });
}
function bindMobileCartoonCharacterActions(){
  const libraryEl = root.querySelector("#mobileCartoonCharacterLibrary");
  if (!libraryEl || libraryEl.__mobileCartoonCharacterActionsBound) return;
  libraryEl.__mobileCartoonCharacterActionsBound = true;

  libraryEl.addEventListener("click", function(e){
    const btn = e.target.closest("[data-mobile-cartoon-character-act]");
    if (!btn) return;

    const card = btn.closest("[data-mobile-cartoon-character]");
    if (!card) return;

    const act = btn.getAttribute("data-mobile-cartoon-character-act");
    const imageUrl = btn.getAttribute("data-character-url") || "";

    if (act === "preview") {
      if (!imageUrl) return;
      window.open(imageUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (act === "download") {
      if (!imageUrl) return;

      const downloadUrl =
        "/api/media/proxy?url=" +
        encodeURIComponent(imageUrl) +
        "&filename=" +
        encodeURIComponent("aivo-cizgifilm-karakter.jpg");

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

       if (act === "select") {
      state.customCharacterUrl = imageUrl;
      syncMainCharacterDisabled();
      setStatus("Karakter Basit Mod için seçildi.");
      mobileCartoonToast("success", "Karakter Basit Mod için seçildi.");
      return;
    }
    if (act === "delete") {
      card.remove();

      if (!libraryEl.querySelector(".mobile-cartoon-character-card")) {
        libraryEl.innerHTML = '<div class="mobile-cartoon-character-empty">Henüz mobil karakter oluşturulmadı.</div>';
      }

      mobileCartoonToast("success", "Karakter silindi.");
      return;
    }
  });
}
function bindMobileCartoonResultActions(){
  if (!resultsEl || resultsEl.__mobileCartoonActionsBound) return;
  resultsEl.__mobileCartoonActionsBound = true;

  resultsEl.addEventListener("click", async function(e){
    const btn = e.target.closest("[data-mobile-cartoon-act]");
    if (!btn) return;

    const card = btn.closest("[data-mobile-cartoon-job]");
    if (!card) return;

    const act = btn.getAttribute("data-mobile-cartoon-act");
    const id = card.getAttribute("data-mobile-cartoon-job");
    const job = mobileCartoonJobs.find(function(item){
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
        btn.setAttribute("aria-label", isPlaying ? "Duraklat" : "Oynat");
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

      const directUrl = String(job.videoUrl || "").split("#")[0];

      const downloadUrl =
        "/api/media/proxy?url=" +
        encodeURIComponent(directUrl) +
        "&filename=" +
        encodeURIComponent("aivo-cizgifilm-video.mp4");

      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "aivo-cizgifilm-video.mp4";
      a.rel = "noopener";
      a.style.display = "none";

      document.body.appendChild(a);
      a.click();

      setTimeout(function(){
        try {
          a.remove();
        } catch (err) {}
      }, 1500);

      return;
    }

    if (act === "share") {
      if (!job.videoUrl) return;

      if (navigator.share) {
        navigator.share({
          title: "AIVO Çizgifilm Video",
          url: job.videoUrl
        }).catch(function(){});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(job.videoUrl).catch(function(){});
      }

      return;
    }

      if (act === "delete") {
      mobileCartoonDeletedIds.add(id);
      renderMobileCartoonResults();
      mobileCartoonToast("success", "Video silindi.");
      return;
    }
  });
}
async function hydrateMobileCartoonLibrary(){
  if (!resultsEl) return;

  resultsEl.className = "empty-card";
  resultsEl.innerHTML = "Çizgifilm videoları yükleniyor...";

  try {
    const res = await fetch("/api/jobs/list?app=cartoon", {
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

    mobileCartoonJobs.length = 0;

   rows.forEach(function(row){
            const mode = String(
        row.mode ||
        row.meta?.mode ||
        row.data?.mode ||
        row.payload?.mode ||
        ""
      ).toLowerCase();

      if (mode === "character") return;
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

mobileCartoonJobs.push({
  id: jobId,
  scope: "library",
  title: row.title || row.prompt || row.meta?.prompt || "Çizgifilm video",
  videoUrl: videoUrl,
  status: "ready",
  payload: row
});
    });

    mobileCartoonViewMode = "library";
    renderMobileCartoonResults();
  } catch (err) {
    console.error("[MOBILE CARTOON][HYDRATE ERROR]", err);
    resultsEl.className = "empty-card";
    resultsEl.innerHTML = "Çizgifilm videoları yüklenemedi.";
  }
}

async function hydrateMobileCartoonCharacterLibrary(){
  const libraryEl = root.querySelector("#mobileCartoonCharacterLibrary");
  if (!libraryEl) return;

  try {
    const res = await fetch("/api/jobs/list?app=cartoon", {
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

    const characterRows = rows.filter(function(row){
      const mode = String(
        row.mode ||
        row.meta?.mode ||
        row.data?.mode ||
        row.payload?.mode ||
        ""
      ).toLowerCase();

      return mode === "character";
    });

    if (!characterRows.length) return;

    const emptyEl = libraryEl.querySelector(".mobile-cartoon-character-empty");
    if (emptyEl) emptyEl.remove();

    characterRows.forEach(function(row){
      const outputs = Array.isArray(row.outputs) ? row.outputs : [];

      const firstImageOutput = outputs.find(function(output){
        return output && (
          output.url ||
          output.image_url ||
          output.imageUrl ||
          output.src
        );
      });

      const imageUrl = String(
        row.image_url ||
        row.imageUrl ||
        row.final_image_url ||
        row.finalImageUrl ||
        row.output_url ||
        row.outputUrl ||
        row.url ||
        row.result_url ||
        row.resultUrl ||
        row.meta?.image_url ||
        row.meta?.imageUrl ||
        row.meta?.final_image_url ||
        row.meta?.finalImageUrl ||
        row.meta?.output_url ||
        row.meta?.outputUrl ||
        row.data?.image_url ||
        row.data?.imageUrl ||
        row.data?.final_image_url ||
        row.data?.output_url ||
        firstImageOutput?.url ||
        firstImageOutput?.image_url ||
        firstImageOutput?.imageUrl ||
        firstImageOutput?.src ||
        ""
      ).trim();

      const jobId = String(row.id || row.job_id || row.jobId || "").trim();

      if (!jobId || !imageUrl) return;

      if (libraryEl.querySelector('[data-mobile-cartoon-character="' + jobId + '"]')) {
        return;
      }

      const title = String(
        row.title ||
        row.name ||
        row.prompt ||
        row.meta?.name ||
        row.meta?.prompt ||
        "Karakter"
      ).trim();

      libraryEl.insertAdjacentHTML("beforeend", `
        <article class="mobile-cartoon-character-card" data-mobile-cartoon-character="${esc(jobId)}">
          <div class="mobile-cartoon-character-thumb">
            <img src="${esc(imageUrl)}" alt="${esc(title)}">
            <div class="mobile-cartoon-character-actions">
              <button type="button" data-mobile-cartoon-character-act="preview" data-character-url="${esc(imageUrl)}">⛶</button>
              <button type="button" data-mobile-cartoon-character-act="download" data-character-url="${esc(imageUrl)}">⬇</button>
              <button type="button" data-mobile-cartoon-character-act="select" data-character-url="${esc(imageUrl)}">✓</button>
              <button type="button" data-mobile-cartoon-character-act="delete">🗑</button>
            </div>
          </div>
          <div class="mobile-cartoon-character-name">${esc(title)}</div>
        </article>
      `);
    });
  } catch (err) {
    console.error("[MOBILE CARTOON][CHARACTER HYDRATE ERROR]", err);
  }
}
 const state = {
  mode: "character",
  characterPrompt: "",
  scenePrompt: "",
  mainCharacter: "red-fish",
  helpers: [],
  scene: "underwater",
  actions: ["swimming"],
  duration: "4",
  ratio: "16:9",
  characterImageFile: null,
  audioFile: null,
  logoFile: null,
  customCharacterFile: null,
  characterImageUrl: "",
  audioUrl: "",
  logoUrl: "",
  customCharacterUrl: ""
};
  function safeText(value){
    return String(value || "").trim();
  }

  function isCartoonEn(){
    return String(window.AIVO_LANG || "").toLowerCase().indexOf("en") === 0;
  }

  function cartoonText(tr, en){
    return isCartoonEn() ? en : tr;
  }

  function cartoonCreditsText(count){
    return isCartoonEn()
      ? count + " Credits"
      : count + " Kredi";
  }

  const MOBILE_CARTOON_TOAST = {
    lastKey: "",
    lastAt: 0,
    loadingId: null
  };

  function getMobileCartoonToastApi(){
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

  function mobileCartoonToast(type, message, options){
    const text = safeText(message);
    if (!text) return null;

    const normalizedType = type === "danger" ? "error" : type;
    const key = normalizedType + ":" + text;
    const now = Date.now();

    if (
      key === MOBILE_CARTOON_TOAST.lastKey &&
      now - MOBILE_CARTOON_TOAST.lastAt < 1600
    ) {
      return null;
    }

    MOBILE_CARTOON_TOAST.lastKey = key;
    MOBILE_CARTOON_TOAST.lastAt = now;

    const toastApi = getMobileCartoonToastApi();

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
    } catch (err) {
      console.warn("[MOBILE CARTOON][TOAST FALLBACK]", err);
    }

    setStatus(text);
    return null;
  }

  function mobileCartoonLoading(message){
    clearMobileCartoonLoading({ keepButtons: true });

    MOBILE_CARTOON_TOAST.loadingId = mobileCartoonToast("loading", message, {
      persist: true,
      autoClose: false,
      source: "mobile_cartoon"
    });

    return MOBILE_CARTOON_TOAST.loadingId;
  }

  function resetMobileCartoonGenerateButtons(){
    [characterBtn, generateBtn].forEach(function(btn){
      if (!btn) return;

      btn.disabled = false;
      btn.classList.remove("is-loading", "is-pressed");
      btn.removeAttribute("aria-busy");
    });
  }

  function clearMobileCartoonLoading(options){
    const keepButtons = !!(options && options.keepButtons);
    const toastApi = getMobileCartoonToastApi();

    try {
      if (MOBILE_CARTOON_TOAST.loadingId && toastApi) {
        if (typeof toastApi.dismiss === "function") {
          toastApi.dismiss(MOBILE_CARTOON_TOAST.loadingId);
        } else if (typeof toastApi.remove === "function") {
          toastApi.remove(MOBILE_CARTOON_TOAST.loadingId);
        }
      }
    } catch (err) {}

    MOBILE_CARTOON_TOAST.loadingId = null;

    if (!keepButtons) {
      resetMobileCartoonGenerateButtons();
      syncCartoonCredits();
    }
  }
  function setStatus(message){
    const text = safeText(message);

    if (state.mode === "character") {
      if (characterStatusEl) characterStatusEl.textContent = text;
      return;
    }

    if (statusEl) statusEl.textContent = text;
  }

async function uploadCartoonFile(file, kind){
  if (!file) return "";

  const presignRes = await fetch("/api/r2/scan-and-presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      app: "cartoon",
      kind: kind || "mobile-upload",
      filename: file.name,
      contentType: file.type || "application/octet-stream",
      prompt:
        state.scenePrompt ||
        state.characterPrompt ||
        "",
      title: file.name,
      description:
        state.scenePrompt ||
        state.characterPrompt ||
        file.name,
      source: "mobile_cartoon_upload"
    })
  });

  const data = await presignRes.json().catch(function(){
    return {};
  });

  if (
    !presignRes.ok ||
    !data.ok ||
    !(data.uploadUrl || data.upload_url) ||
    !(data.publicUrl || data.public_url || data.url)
  ) {
    throw new Error(
      data.error ||
      data.message ||
      "presign_failed"
    );
  }

  const uploadUrl =
    data.uploadUrl ||
    data.upload_url;

  const publicUrl =
    data.publicUrl ||
    data.public_url ||
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
      app: "cartoon",
      key: key,
      filename: file.name,
      contentType:
        file.type || "application/octet-stream",
      public_url: publicUrl,
      prompt:
        state.scenePrompt ||
        state.characterPrompt ||
        "",
      title: file.name,
      description:
        state.scenePrompt ||
        state.characterPrompt ||
        file.name,
      source: "mobile_cartoon_upload"
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

async function setUploadState(input, clearBtn, textEl, stateKey, urlKey){
  const file = input && input.files && input.files[0] ? input.files[0] : null;

  state[stateKey] = file;
  state[urlKey] = "";

   if (textEl) {
    textEl.textContent = file ? "Yükleniyor..." : "Dosya seçilmedi";
  }

   if (file) {
    mobileCartoonLoading("Dosya güvenlik kontrolünden geçiriliyor...");
  }

  if (clearBtn) {
    clearBtn.hidden = !file;
  }

  syncCartoonCredits();

  if (!file) return;

  try {
       const url = await uploadCartoonFile(file);
    clearMobileCartoonLoading();
    state[urlKey] = url;
    if (textEl) {
      textEl.textContent = file.name + " yüklendi";
    }
  } catch (err) {
    console.error("[MOBILE CARTOON][UPLOAD ERROR]", err);

    clearMobileCartoonLoading();

    state[stateKey] = null;
    state[urlKey] = "";

    if (input) {
      input.value = "";
    }

    if (textEl) {
      textEl.textContent = "Yükleme başarısız";
    }

    if (clearBtn) {
      clearBtn.hidden = true;
    }

    syncCartoonCredits();

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
      setStatus("Bu görsel kullanılamaz.");
      mobileCartoonToast("error", "Bu görsel kullanılamaz.");
      return;
    }

    setStatus("Dosya yüklenemedi. Lütfen tekrar dene.");
    mobileCartoonToast("error", "Yükleme hatası");
  }
}

function clearUpload(input, clearBtn, textEl, stateKey, urlKey){
  if (input) input.value = "";

  state[stateKey] = null;
  state[urlKey] = "";

  if (textEl) {
    textEl.textContent = "Dosya seçilmedi";
  }

  if (clearBtn) {
    clearBtn.hidden = true;
  }
}
function getCartoonCharacterCredit(){
  return state.characterImageFile ? 30 : 20;
}

function getCartoonBasicCredit(){
  const duration = String(state.duration || "4");

  let total = 30;

  if (duration === "6") total = 35;
  else if (duration === "8") total = 40;
  else if (duration === "10") total = 45;
  else if (duration === "12") total = 50;
  else if (duration === "15") total = 55;

  if (state.logoFile) total += 10;
  if (state.audioFile) total += 10;
  if (state.customCharacterFile) total += 10;

  return total;
}

function getMobileCartoonCreditAction(mode){
  return mode === "character"
    ? "studio_cartoon_character_create"
    : "studio_cartoon_basic_generate";
}

function getMobileCartoonCreditAmount(mode){
  return mode === "character"
    ? getCartoonCharacterCredit()
    : getCartoonBasicCredit();
}

async function refreshMobileCartoonCredits(){
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
      const mobileCreditEls = Array.from(document.querySelectorAll("[data-mobile-credit-balance]"));

      mobileCreditEls.forEach(function(el){
        el.textContent = "Kredi " + nextCredits;
      });
    }
  } catch (err) {
    console.warn("[MOBILE CARTOON][CREDIT REFRESH FAILED]", err);
  }
}

async function consumeMobileCartoonCredits(mode){
  const amount = getMobileCartoonCreditAmount(mode);
  const action = getMobileCartoonCreditAction(mode);
  const requestId = "mobile-cartoon:" + mode + ":" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);

  const res = await fetch("/api/credits/consume-ledger", {
    method: "POST",
    credentials: "include",
    headers: {
      "content-type": "application/json",
      "accept": "application/json"
    },
    body: JSON.stringify({
      app: "cartoon",
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

  await refreshMobileCartoonCredits();

  const transactionId = safeText(
    data.transaction_id ||
    data.transaction?.id ||
    data.related_transaction_id ||
    data.credit_transaction_id ||
    ""
  );

  return {
    app: "cartoon",
    action: action,
    amount: amount,
    request_id: requestId,
    related_transaction_id: transactionId,
    idempotency_key: transactionId ? "mobile-cartoon-refund:" + transactionId : "",
    mode: mode,
    refunded: false
  };
}

async function refundMobileCartoonCredits(refundCtx, reason, extraMeta){
  if (!refundCtx || refundCtx.refunded) return false;

  if (!refundCtx.related_transaction_id || refundCtx.amount <= 0) {
    console.warn("[MOBILE CARTOON][REFUND SKIPPED]", {
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
        job_id: refundCtx.job_id || "",
        provider_job_id: refundCtx.provider_job_id || "",
        related_transaction_id: refundCtx.related_transaction_id,
        idempotency_key: refundCtx.idempotency_key,
        reason: reason || "mobile_cartoon_failed",
        meta: {
          source: "mobile.cartoon.js",
          mode: refundCtx.mode,
          ...(extraMeta || {})
        }
      })
    });

    const data = await res.json().catch(function(){
      return {};
    });

    if (res.ok && data && data.ok) {
      await refreshMobileCartoonCredits();

      if (data.refunded) {
        mobileCartoonToast("success", "Kredi iade edildi.");
      }

      return true;
    }

    console.warn("[MOBILE CARTOON][REFUND FAILED]", data);
  } catch (err) {
    console.error("[MOBILE CARTOON][REFUND ERROR]", err);
  }

  return false;
}
function syncCartoonCredits(){
  const characterCredit = getCartoonCharacterCredit();
  const basicCredit = getCartoonBasicCredit();
  const isEN = window.AIVO_LANG === "en";

  if (characterBtn) {
    characterBtn.textContent = isEN
      ? "🧩 Create Character (" + characterCredit + " Credits)"
      : "🧩 Karakter Oluştur (" + characterCredit + " Kredi)";

    characterBtn.setAttribute("data-credit-cost", String(characterCredit));
  }

  if (generateBtn) {
    generateBtn.textContent = isEN
      ? "🎬 Create Scene (" + basicCredit + " Credits)"
      : "🎬 Sahneyi Oluştur (" + basicCredit + " Kredi)";

    generateBtn.setAttribute("data-credit-cost", String(basicCredit));
  }
}

function hasCustomCharacterActive(){
  return !!(state.customCharacterFile || state.customCharacterUrl);
}

function syncMainCharacterDisabled(){
  const mainButtons = Array.from(root.querySelectorAll("[data-cartoon-main]"));
  const disabled = hasCustomCharacterActive();

  mainButtons.forEach(function(btn){
    btn.classList.toggle("is-disabled", disabled);
    btn.setAttribute("aria-disabled", disabled ? "true" : "false");

    if (disabled) {
      btn.classList.remove("is-active");
    }
  });

  if (disabled) {
    state.mainCharacter = "";
  } else if (!state.mainCharacter && mainButtons[0]) {
    state.mainCharacter = safeText(mainButtons[0].getAttribute("data-cartoon-main")) || "red-fish";
    mainButtons[0].classList.add("is-active");
  }
}
  function setMode(mode){
    const nextMode = mode === "basic" ? "basic" : "character";
    state.mode = nextMode;

    modeButtons.forEach(function(btn){
      const active = btn.getAttribute("data-mobile-cartoon-mode") === nextMode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
    });

    views.forEach(function(view){
      const active = view.getAttribute("data-mobile-cartoon-view") === nextMode;
      view.classList.toggle("is-active", active);
      view.hidden = !active;
    });

    setStatus("");
  }

  function bindModeTabs(){
    modeButtons.forEach(function(btn){
      btn.addEventListener("click", function(){
        setMode(btn.getAttribute("data-mobile-cartoon-mode"));
      });
    });
  }

  function bindCounters(){
    if (characterPromptEl && characterCountEl) {
      function updateCharacter(){
        const value = String(characterPromptEl.value || "");
        state.characterPrompt = value.trim();
        characterCountEl.textContent = String(value.length);
      }

      characterPromptEl.addEventListener("input", updateCharacter);
      characterPromptEl.addEventListener("change", updateCharacter);
      updateCharacter();
    }

    if (scenePromptEl && sceneCountEl) {
      function updateScene(){
        const value = String(scenePromptEl.value || "");
        state.scenePrompt = value.trim();
        sceneCountEl.textContent = String(value.length);
      }

      scenePromptEl.addEventListener("input", updateScene);
      scenePromptEl.addEventListener("change", updateScene);
      updateScene();
    }
  }

  function bindSingleChoice(selector, key, attr){
    const buttons = Array.from(root.querySelectorAll(selector));

    buttons.forEach(function(btn){
      btn.addEventListener("click", function(){
               const value = safeText(btn.getAttribute(attr));
        if (!value) return;

        if (key === "mainCharacter" && hasCustomCharacterActive()) {
          state.mainCharacter = "";
          syncMainCharacterDisabled();
          setStatus("Kendi resmin seçiliyken hazır ana karakter seçilemez.");
          return;
        }

        state[key] = value;

        buttons.forEach(function(item){
          item.classList.toggle("is-active", item === btn);
        });
      });
    });
  }

  function bindControls(){
    bindSingleChoice("[data-cartoon-main]", "mainCharacter", "data-cartoon-main");
    bindSingleChoice("[data-cartoon-scene]", "scene", "data-cartoon-scene");

    Array.from(root.querySelectorAll("[data-cartoon-helper]")).forEach(function(btn){
      btn.addEventListener("click", function(){
        const value = safeText(btn.getAttribute("data-cartoon-helper"));
        if (!value) return;

        const exists = state.helpers.includes(value);

        if (exists) {
          state.helpers = state.helpers.filter(function(item){
            return item !== value;
          });
          btn.classList.remove("is-active");
          return;
        }

        if (state.helpers.length >= 3) {
          setStatus("En fazla 3 yardımcı karakter seçebilirsin.");
          return;
        }

        state.helpers.push(value);
        btn.classList.add("is-active");
      });
    });

    Array.from(root.querySelectorAll("[data-cartoon-action]")).forEach(function(btn){
      btn.addEventListener("click", function(){
        const value = safeText(btn.getAttribute("data-cartoon-action"));
        if (!value) return;

        const exists = state.actions.includes(value);

        if (exists) {
          state.actions = state.actions.filter(function(item){
            return item !== value;
          });
          btn.classList.remove("is-active");
          return;
        }

        state.actions.push(value);
        btn.classList.add("is-active");
      });
    });

   if (durationEl) {
  durationEl.addEventListener("change", function(){
    state.duration = safeText(durationEl.value) || "4";
    syncCartoonCredits();
  });
  state.duration = safeText(durationEl.value) || "4";
}

    if (ratioEl) {
      ratioEl.addEventListener("change", function(){
        state.ratio = safeText(ratioEl.value) || "16:9";
      });
      state.ratio = safeText(ratioEl.value) || "16:9";
    }
  }
function bindUploads(){
  if (characterImageEl) {
    characterImageEl.addEventListener("change", async function(){
      if (characterImageEl.files && characterImageEl.files[0]) {
        const resetIds = [
          "#mobileCartoonHairType",
          "#mobileCartoonHairColor",
          "#mobileCartoonOutfit",
          "#mobileCartoonGlasses",
          "#mobileCartoonAccessory",
          "#mobileCartoonExpression"
        ];

        resetIds.forEach(function(selector){
          const el = root.querySelector(selector);
          if (el) el.value = "";
        });
      }

      await setUploadState(characterImageEl, characterImageClearEl, characterImageTextEl, "characterImageFile", "characterImageUrl");

          if (state.characterImageUrl) {
        setStatus("Referans resim yüklendi. Gelişmiş seçenekler sıfırlandı.");
        mobileCartoonToast("success", "Referans resim eklendi · +10 kredi");
      }
    });
  }

  if (characterImageClearEl) {
    characterImageClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
          clearUpload(characterImageEl, characterImageClearEl, characterImageTextEl, "characterImageFile", "characterImageUrl");
      syncCartoonCredits();
      setStatus("Karakter referans görseli kaldırıldı.");
      mobileCartoonToast("success", "Referans resim kaldırıldı · -10 kredi");
    });
  }

  if (audioFileEl) {
    audioFileEl.addEventListener("change", async function(){
      await setUploadState(audioFileEl, audioClearEl, audioTextEl, "audioFile", "audioUrl");
      if (state.audioUrl) {
        setStatus("Müzik eklendi.");
        mobileCartoonToast("success", "Müzik eklendi · +10 kredi");
      }
    });
  }

  if (audioClearEl) {
    audioClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
           clearUpload(audioFileEl, audioClearEl, audioTextEl, "audioFile", "audioUrl");
      syncCartoonCredits();
      setStatus("Müzik kaldırıldı.");
      mobileCartoonToast("success", "Müzik kaldırıldı · -10 kredi");
    });
  }

  if (logoFileEl) {
    logoFileEl.addEventListener("change", async function(){
      await setUploadState(logoFileEl, logoClearEl, logoTextEl, "logoFile", "logoUrl");
      if (state.logoUrl) {
        setStatus("Logo eklendi.");
        mobileCartoonToast("success", "Logo eklendi · +10 kredi");
      }
    });
  }

  if (logoClearEl) {
    logoClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
          clearUpload(logoFileEl, logoClearEl, logoTextEl, "logoFile", "logoUrl");
      syncCartoonCredits();
      setStatus("Logo kaldırıldı.");
      mobileCartoonToast("success", "Logo kaldırıldı · -10 kredi");
    });
  }

  if (customFileEl) {
    customFileEl.addEventListener("change", async function(){
      await setUploadState(customFileEl, customClearEl, customTextEl, "customCharacterFile", "customCharacterUrl");
          if (state.customCharacterUrl) {
        syncMainCharacterDisabled();
        setStatus("Kendi karakter görselin yüklendi. Hazır ana karakter kapatıldı.");
        mobileCartoonToast("success", "Resim eklendi · +10 kredi");
        mobileCartoonToast("info", "Fotoğraf yüklendiği için preset ana karakter kapatıldı");
      }
    });
  }

  if (customClearEl) {
    customClearEl.addEventListener("click", function(e){
      e.preventDefault();
      e.stopPropagation();
       clearUpload(customFileEl, customClearEl, customTextEl, "customCharacterFile", "customCharacterUrl");
      syncCartoonCredits();
      syncMainCharacterDisabled();
      setStatus("Kendi karakter görselin kaldırıldı.");
      mobileCartoonToast("success", "Resim kaldırıldı · -10 kredi");
    });
  }
}
  function bindButtons(){
    if (characterBtn) {
         characterBtn.addEventListener("click", async function(){
             if (!state.characterPrompt) {
          setStatus("Lütfen karakter tanımı yaz.");
          mobileCartoonToast("warning", "Lütfen karakter tanımı yaz.");
          return;
        }

             let creditCtx = null;

        characterBtn.disabled = true;
        characterBtn.textContent = "Üretiliyor...";
        characterBtn.classList.add("is-loading", "is-pressed");
        characterBtn.setAttribute("aria-busy", "true");

        try {
          creditCtx = await consumeMobileCartoonCredits("character");
          mobileCartoonToast("success", getCartoonCharacterCredit() + " kredi kullanıldı.");
        } catch (creditErr) {
             
          console.warn("[MOBILE CARTOON][CHARACTER CREDIT ERROR]", creditErr);
          setStatus("Yetersiz kredi.");
          mobileCartoonToast("warning", "Yetersiz kredi.");

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

             

        mobileCartoonLoading("Karakter oluşturuluyor...");

        const tempCharacterId = "mobile-cartoon-character-" + Date.now();
        const libraryEl = root.querySelector("#mobileCartoonCharacterLibrary");

        function renderCharacterLibraryLoading(){
          if (!libraryEl) return;

          const emptyEl = libraryEl.querySelector(".mobile-cartoon-character-empty");
          if (emptyEl) emptyEl.remove();

          libraryEl.insertAdjacentHTML("afterbegin", `
            <article class="mobile-cartoon-character-card" data-mobile-cartoon-character="${tempCharacterId}">
              <div class="mobile-cartoon-character-thumb">
              <div class="mobile-cartoon-character-loading">Hazırlanıyor...</div>
              </div>
              <div class="mobile-cartoon-character-name">${esc(state.characterPrompt || "Karakter")}</div>
            </article>
          `);
        }

        renderCharacterLibraryLoading();

        setStatus("Karakter oluşturuluyor...");

        const payload = {
          app: "cartoon",
          mode: "character",
          prompt: state.characterPrompt,
          type: safeText(root.querySelector("#mobileCartoonCharacterType")?.value),
          name: safeText(root.querySelector("#mobileCartoonCharacterName")?.value),
          style: safeText(root.querySelector("#mobileCartoonCharacterStyle")?.value),
          hairType: safeText(root.querySelector("#mobileCartoonHairType")?.value),
          hairColor: safeText(root.querySelector("#mobileCartoonHairColor")?.value),
          outfit: safeText(root.querySelector("#mobileCartoonOutfit")?.value),
          glasses: safeText(root.querySelector("#mobileCartoonGlasses")?.value),
          accessory: safeText(root.querySelector("#mobileCartoonAccessory")?.value),
          expression: safeText(root.querySelector("#mobileCartoonExpression")?.value),
          referenceImageUrl: state.characterImageUrl
        };

        try {
          const res = await fetch("/api/providers/fal/cartoon/create", {
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

          console.log("[MOBILE CARTOON][CHARACTER CREATE RESPONSE]", data);

                               if (!res.ok || !data.ok || !data.job_id) {
            const refundCtx = {
              ...creditCtx,
              job_id: "",
              provider_job_id: safeText(data.request_id || data.requestId || "")
            };

            setStatus("Karakter oluşturulamadı.");
            clearMobileCartoonLoading();
            mobileCartoonToast("error", "Karakter oluşturulamadı.");

            refundMobileCartoonCredits(refundCtx, "mobile_cartoon_character_create_failed", {
              error: "character_create_failed",
              response: data
            });

            return;
          }

            const refundCtx = {
          ...creditCtx,
          job_id: String(data.job_id),
          provider_job_id: safeText(data.request_id || data.requestId || "")
        };

       setStatus("Karakter oluşturuluyor...");
       mobileCartoonLoading("Karakter oluşturuluyor...");
        pollMobileCartoonCharacterJob(String(data.job_id), tempCharacterId, payload.name || state.characterPrompt || "Karakter", refundCtx);
              } catch (err) {
          console.error("[MOBILE CARTOON][CHARACTER CREATE ERROR]", err);
                   setStatus("Karakter oluşturulamadı.");
          clearMobileCartoonLoading();
          mobileCartoonToast("error", "Karakter oluşturulamadı.");

          refundMobileCartoonCredits(creditCtx, "mobile_cartoon_character_create_exception", {
            error: "character_create_exception",
            message: String(err && err.message ? err.message : err)
          });
        }
      });
    }
         if (generateBtn) {
      generateBtn.addEventListener("click", async function(){
               let creditCtx = null;

        generateBtn.disabled = true;
        generateBtn.textContent = "Üretiliyor...";
        generateBtn.classList.add("is-loading", "is-pressed");
        generateBtn.setAttribute("aria-busy", "true");

        try {
          creditCtx = await consumeMobileCartoonCredits("basic");
          mobileCartoonToast("success", getCartoonBasicCredit() + " kredi kullanıldı.");
              } catch (creditErr) {
          console.warn("[MOBILE CARTOON][BASIC CREDIT ERROR]", creditErr);
          setStatus("Yetersiz kredi.");
          mobileCartoonToast("warning", "Yetersiz kredi.");

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

           

              const tempJobId = "mobile-cartoon-" + Date.now();

        setStatus("Çizgifilm sahnesi hazırlanıyor...");
            mobileCartoonLoading("Çizgifilm sahnesi hazırlanıyor...");

   mobileCartoonJobs.unshift({
  id: tempJobId,
  scope: "current",
  status: "processing",
  title: state.scenePrompt || "Çizgifilm sahnesi",
  videoUrl: ""
});

mobileCartoonViewMode = "current";

if (resultsEl) {
  resultsEl.hidden = false;
}

renderMobileCartoonResults();

        const payload = {
          app: "cartoon",
          mode: "basic",
          extraPrompt: state.scenePrompt,
          mainCharacter: state.mainCharacter,
          helperCharacters: state.helpers.slice(),
          scene: state.scene,
          actions: state.actions.slice(),
          action: state.actions.join(", "),
          duration: state.duration,
          aspectRatio: state.ratio,
          audioMode: state.audioUrl ? "upload" : "none",
          audioFileUrl: state.audioUrl,
          logoFileUrl: state.logoUrl,
          characterImageUrl: state.customCharacterUrl
        };

        console.log("[MOBILE CARTOON][BASIC PAYLOAD]", payload);

        try {
          const res = await fetch("/api/providers/fal/cartoon/create", {
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

          console.log("[MOBILE CARTOON][BASIC CREATE RESPONSE]", data);

                 if (!res.ok || !data.ok || !data.job_id) {
            const refundCtx = {
              ...creditCtx,
              job_id: "",
              provider_job_id: safeText(data.request_id || data.requestId || "")
            };

            const job = mobileCartoonJobs.find(function(item){
              return item.id === tempJobId;
            });

            if (job) {
              job.status = "error";
              job.title = "Çizgifilm video başlatılamadı";
            }

              renderMobileCartoonResults();
                      setStatus("Çizgifilm video başlatılamadı.");
            clearMobileCartoonLoading();
            mobileCartoonToast("error", "Çizgifilm video başlatılamadı.");

            refundMobileCartoonCredits(refundCtx, "mobile_cartoon_basic_create_failed", {
              error: "basic_create_failed",
              response: data
            });

            return;
          }
          const realJobId = String(data.job_id || "").trim();

          const job = mobileCartoonJobs.find(function(item){
            return item.id === tempJobId;
          });

                 const refundCtx = {
            ...creditCtx,
            job_id: realJobId,
            provider_job_id: safeText(data.request_id || data.requestId || "")
          };

          if (job) {
            job.id = realJobId;
            job.status = "processing";
            job.refundCtx = refundCtx;
          }

          renderMobileCartoonResults();
          setStatus("Çizgifilm sahnesi hazırlanıyor...");
          mobileCartoonLoading("Çizgifilm sahnesi hazırlanıyor...");
          pollMobileCartoonJob(realJobId);
             } catch (err) {
          console.error("[MOBILE CARTOON][BASIC CREATE ERROR]", err);

          const job = mobileCartoonJobs.find(function(item){
            return item.id === tempJobId;
          });

          if (job) {
            job.status = "error";
            job.title = "Çizgifilm video başlatılamadı";
          }

          renderMobileCartoonResults();
                   setStatus("Çizgifilm video başlatılamadı.");
          clearMobileCartoonLoading();
          mobileCartoonToast("error", "Çizgifilm video başlatılamadı.");

          refundMobileCartoonCredits(creditCtx, "mobile_cartoon_basic_create_exception", {
            error: "basic_create_exception",
            message: String(err && err.message ? err.message : err)
          });
        }
      });
    }
  }

bindModeTabs();
bindCounters();
bindControls();
bindUploads();
bindButtons();
syncCartoonCredits();
bindMobileCartoonCharacterActions();
bindMobileCartoonResultActions();
hydrateMobileCartoonCharacterLibrary();

setMode("character");

  window.mobileCartoonShowCurrent = function(){
  mobileCartoonViewMode = "current";
  renderMobileCartoonResults();
};

window.mobileCartoonHydrate = async function(){
  mobileCartoonViewMode = "library";
  await hydrateMobileCartoonLibrary();
  renderMobileCartoonResults();
};
  window.mobileCartoonState = state;
})();
