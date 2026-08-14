(function AIVO_MOBILE_ADFILM_PRODUCTION(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_PRODUCTION_V1__) return;
  window.__AIVO_MOBILE_ADFILM_PRODUCTION_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  if (!root) return;

  const panel = root.querySelector(".mobile-adfilm-panel");
  const createButton = root.querySelector(".mobile-adfilm-create-button");
  const actionStatus = root.querySelector(".mobile-adfilm-action-status");
  const actionCard = root.querySelector("[data-mobile-adfilm-action]");
  const mount = document.getElementById("mobileAdFilmMount") || root.parentElement;

  const CREDIT_APP = "adfilm";
  const CREDIT_ACTION = "studio_adfilm_generate";
  const POLL_MS = 3000;
  const POLL_MAX = 400;

  let busy = false;
  let run = null;
  let pollTimer = null;
  let elapsedTimer = null;
  let libraryOnly = false;
  let libraryLoading = false;
  let libraryItems = [];

  function clean(value){ return String(value == null ? "" : value).trim(); }
  function lower(value){ return clean(value).toLowerCase(); }
  function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }
  function currentLocale(){
    const language = String(
      window.AIVO_LANG ||
      localStorage.getItem("aivo_mobile_language") ||
      document.documentElement.lang ||
      "tr"
    ).toLowerCase();
    return language.startsWith("en") ? "en-US" : "tr-TR";
  }
  function esc(value){
    return String(value == null ? "" : value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function activateVideo(video){
    if (!video) return "";
    const activeSource = clean(video.getAttribute("src") || video.currentSrc);
    if (activeSource) return activeSource;
    const source = clean(video.dataset.src || video.dataset.previewUrl || video.dataset.finalUrl);
    if (!source) return "";
    video.src = source;
    video.preload = "metadata";
    try { video.load(); } catch (_) {}
    return source;
  }

  function releaseVideo(video){
    if (!video) return;
    try { video.pause(); } catch (_) {}
    try {
      video.removeAttribute("src");
      video.preload = "none";
      video.load();
    } catch (_) {}
    const card = video.closest && video.closest(".mobile-adfilm-production-card");
    if (card) card.classList.remove("is-playing");
  }

  function releaseLibraryMedia(){
    root.querySelectorAll(".mobile-adfilm-production-card video").forEach(releaseVideo);
  }

  function ensureStyle(){
    if (document.querySelector('link[data-mobile-adfilm-production-style]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "/mobile/css/mobile.adfilm.production.css?v=1";
    link.setAttribute("data-mobile-adfilm-production-style", "");
    document.head.appendChild(link);
  }

  function toast(type, message, duration){
    try {
      if (window.mobileToast && typeof window.mobileToast[type] === "function") {
        return window.mobileToast[type](message, { duration: duration || 3600 });
      }
      if (window.toast && typeof window.toast[type] === "function") {
        return window.toast[type]({ message: message, duration: duration || 3600 });
      }
      if (typeof window.showToast === "function") return window.showToast(message, type);
    } catch (_) {}
    return null;
  }

  function ensureSection(){
    let section = root.querySelector("[data-mobile-adfilm-production]");
    if (section) return section;

    section = document.createElement("section");
    section.className = "mobile-adfilm-production-section";
    section.setAttribute("data-mobile-adfilm-production", "");
    section.hidden = true;
    section.innerHTML = `
      <h3 class="mobile-adfilm-production-title">Üretilen Reklam Filmleri</h3>
      <div class="mobile-adfilm-production-progress" data-mobile-adfilm-production-progress hidden>
        <div class="mobile-adfilm-production-progress-head">
          <span class="mobile-adfilm-production-spinner" aria-hidden="true"></span>
          <div class="mobile-adfilm-production-progress-copy">
            <strong>Reklam filminiz hazırlanıyor</strong>
            <span class="mobile-adfilm-production-stage-pill" data-mobile-adfilm-stage-pill>AŞAMA 1/4</span>
          </div>
        </div>
        <div class="mobile-adfilm-production-stage">
          <b data-mobile-adfilm-stage-title>Hazırlık yapılıyor</b>
          <p data-mobile-adfilm-stage-description>Üretim ayarları ve referanslar kontrol ediliyor.</p>
          <small data-mobile-adfilm-stage-time>Toplam geçen süre: 0 dk 00 sn</small>
        </div>
      </div>
      <div class="mobile-adfilm-production-list" data-mobile-adfilm-production-list></div>
    `;

    if (panel && panel.parentNode) panel.insertAdjacentElement("afterend", section);
    else root.appendChild(section);
    return section;
  }

  function section(){ return ensureSection(); }
  function listNode(){ return section().querySelector("[data-mobile-adfilm-production-list]"); }
  function progressNode(){ return section().querySelector("[data-mobile-adfilm-production-progress]"); }

  function setActionStatus(message, state){
    if (!actionStatus) return;
    actionStatus.textContent = message;
    if (state) actionStatus.dataset.state = state;
  }

  function syncApi(){ return window.AIVOMobileAdFilmProjectSync || null; }
  function currentProject(){
    const active = window.AIVOAdFilmActiveProject;
    if (active && active.id) return active;
    const sync = syncApi();
    return sync && typeof sync.project === "function" ? sync.project() : null;
  }
  function projectId(){
    const sync = syncApi();
    return clean(
      root.dataset.adfilmProjectId ||
      (currentProject() && currentProject().id) ||
      (sync && typeof sync.projectId === "function" && sync.projectId())
    );
  }

  function referencesApi(){ return window.AIVOMobileAdFilmReferences || null; }
  function currentReferences(){
    const api = referencesApi();
    if (api && typeof api.current === "function") return api.current();
    const source = currentProject() || {};
    const media = source.media || {};
    const images = Array.isArray(media.productImages) ? media.productImages : [];
    return {
      imageUrls: images.map(function(item){ return clean(item && (item.publicUrl || item.url || item.readUrl)); }).filter(Boolean),
      logoUrl: clean(media.logo && (media.logo.publicUrl || media.logo.url || media.logo.readUrl)),
      referenceMap: { hero: images.length ? 1 : null, angles: [], scenes: [] }
    };
  }

  function field(id){ return root.querySelector(id); }
  function fieldValue(id){ const node = field(id); return clean(node && node.value); }
  function voiceEnabled(){ const node = field("#mobileAdFilmVoiceEnabled"); return !node || !!node.checked; }
  function currentFormat(){
    const active = root.querySelector("[data-mobile-adfilm-format].is-active");
    return clean(active && active.getAttribute("data-mobile-adfilm-format")) || "16:9";
  }
  function normalizeAspect(value){ return value === "4:5" ? "3:4" : value; }
  function normalizeQuality(value){
    value = lower(value);
    return value === "720p" ? "720p" : value === "4k" ? "4k" : "1080p";
  }

  function creditQuote(){
    let quote = null;
    try {
      if (window.AIVOMobileAdFilmCreditPricing && typeof window.AIVOMobileAdFilmCreditPricing.current === "function") {
        quote = window.AIVOMobileAdFilmCreditPricing.current();
      }
    } catch (_) {}
    const quality = normalizeQuality(quote && quote.quality || root.dataset.adfilmCreditQuality || "1080p");
    const duration = Math.max(5, Math.min(15, Number(quote && quote.duration || root.dataset.adfilmCreditDuration || fieldValue("#mobileAdFilmDuration") || 10)));
    const amount = Math.max(0, Math.trunc(Number(quote && quote.credits || root.dataset.adfilmCreditCost || createButton && createButton.getAttribute("data-credit-cost") || 0)));
    return { quality: quality, duration: duration, amount: amount, aspectRatio: currentFormat() };
  }

  function approvedNarration(source){
    if (!voiceEnabled()) return true;
    const audio = source && source.narration && source.narration.audio;
    return !!(audio && audio.approved === true && clean(audio.url));
  }

  function currentMusicMode(source){
    const mode = lower(root.dataset.adfilmMusicMode || source && source.music && source.music.mode || "auto");
    return mode === "upload" || mode === "off" ? mode : "auto";
  }

  function readyState(){
    const source = currentProject();
    const refs = currentReferences();
    const product = fieldValue("#mobileAdFilmProductName");
    const description = fieldValue("#mobileAdFilmDescription");
    const mode = currentMusicMode(source);
    const musicTrack = source && source.media && source.media.musicTrack;

    if (!projectId()) return { ready: false, reason: "Bulut projesi hazırlanıyor." };
    if (!product || description.length < 10) return { ready: false, reason: "Ürün bilgilerini tamamla." };
    if (!refs.imageUrls || !refs.imageUrls.length) return { ready: false, reason: "Ana ürün görselini yükle." };
    if (voiceEnabled() && !approvedNarration(source)) return { ready: false, reason: "Seslendirmeyi oluşturup onayla." };
    if (mode === "upload" && !(musicTrack && clean(musicTrack.url))) return { ready: false, reason: "Yüklediğin müziğin buluta kaydolmasını bekle." };
    return { ready: true, reason: "Üretime hazır." };
  }

  function syncButton(){
    if (!createButton) return;
    const state = readyState();
    createButton.disabled = busy || !state.ready;
    createButton.classList.toggle("is-ready", !busy && state.ready);
    createButton.classList.toggle("is-producing", busy);
    if (busy) {
      createButton.textContent = "Reklam Filmi Oluşturuluyor...";
      createButton.setAttribute("aria-busy", "true");
    } else {
      createButton.removeAttribute("aria-busy");
      try {
        if (window.AIVOMobileAdFilmCreditPricing && typeof window.AIVOMobileAdFilmCreditPricing.sync === "function") {
          window.AIVOMobileAdFilmCreditPricing.sync();
        }
      } catch (_) {}
    }
  }

  function stageCopy(stage){
    if (stage === 1) return { title: "Hazırlık yapılıyor", description: "Kredi, reklam müziği ve üretim ayarları kontrol ediliyor." };
    if (stage === 2) return { title: "Referanslar hazırlanıyor", description: "Ürün görselleri, logo ve reklam talimatı üretim motoruna hazırlanıyor." };
    if (stage === 3) return { title: "Sahneler hazırlanıyor", description: "Geçişler, efektler ve görsel akış oluşturuluyor." };
    return { title: "Ses, müzik ve logo ekleniyor", description: "Final video profesyonel olarak birleştirilip dışa aktarılıyor." };
  }

  function elapsedText(){
    const startedAt = run && run.startedAt || Date.now();
    const total = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    return Math.floor(total / 60) + " dk " + String(total % 60).padStart(2, "0") + " sn";
  }

  function renderStage(stage, note){
    const productionSection = section();
    const progress = progressNode();
    const copy = stageCopy(stage);
    productionSection.hidden = false;
    progress.hidden = false;
    const pill = progress.querySelector("[data-mobile-adfilm-stage-pill]");
    const title = progress.querySelector("[data-mobile-adfilm-stage-title]");
    const description = progress.querySelector("[data-mobile-adfilm-stage-description]");
    const time = progress.querySelector("[data-mobile-adfilm-stage-time]");
    if (pill) pill.textContent = "AŞAMA " + stage + "/4";
    if (title) title.textContent = copy.title;
    if (description) description.textContent = note || copy.description;
    if (time) time.textContent = "Toplam geçen süre: " + elapsedText();
    setActionStatus("Reklam filmi hazırlanıyor...", "producing");
    syncButton();
  }

  function startElapsed(){
    clearInterval(elapsedTimer);
    elapsedTimer = setInterval(function(){
      if (busy && run) renderStage(run.stage || 1, run.note || "");
    }, 1000);
  }
  function stopElapsed(){ clearInterval(elapsedTimer); elapsedTimer = null; }

  function outputTitle(){
    return fieldValue("#mobileAdFilmBrandName") || fieldValue("#mobileAdFilmProductName") || "Reklam Filmi";
  }

  function ratioForCard(){
    const ratio = run && run.aspectRatio || currentFormat();
    if (ratio === "9:16") return "9 / 16";
    if (ratio === "1:1") return "1 / 1";
    if (ratio === "4:5" || ratio === "3:4") return "4 / 5";
    if (ratio === "4:3") return "4 / 3";
    if (ratio === "21:9") return "21 / 9";
    return "16 / 9";
  }

  function renderLoadingCard(){
    const list = listNode();
    if (!list) return;
    list.innerHTML = `
      <article class="mobile-adfilm-production-card is-loading" data-mobile-adfilm-current-card>
        <div class="mobile-adfilm-production-media" style="aspect-ratio:${esc(ratioForCard())}">
          <div class="mobile-adfilm-production-loading"><span>Reklam videon hazırlanıyor...</span></div>
        </div>
        <div class="mobile-adfilm-production-card-copy">
          <strong>${esc(outputTitle())}</strong>
          <small>Üretim devam ediyor · tamamlandığında otomatik olarak burada oynatılacak.</small>
        </div>
      </article>
    `;
  }

  function outputUrl(item){ return clean(item && (item.videoUrl || item.video_url || item.url)); }
  function previewUrl(item){ return clean(item && (item.previewUrl || item.preview_url)); }
  function posterUrl(item){ return clean(item && (item.posterUrl || item.poster_url)); }

  function readyCard(item, index){
    const finalVideo = outputUrl(item);
    const preview = previewUrl(item);
    const video = preview || finalVideo;
    const poster = posterUrl(item);
    const title = clean(item && (item.title || item.projectTitle)) || outputTitle();
    const meta = clean(item && (item.completedAt || item.finalizedAt || item.createdAt));
    const outputId = clean(item && item.id) || String(index);
    const itemProjectId = clean(item && item.projectId) || projectId();
    return `
      <article class="mobile-adfilm-production-card" data-mobile-adfilm-output="${esc(outputId)}" data-mobile-adfilm-project="${esc(itemProjectId)}">
        <div class="mobile-adfilm-production-media">
          <video data-src="${esc(video)}" data-final-url="${esc(finalVideo)}"${preview ? ` data-preview-url="${esc(preview)}"` : ""}${poster ? ` poster="${esc(poster)}"` : ""} playsinline webkit-playsinline preload="none"></video>
          <div class="mobile-adfilm-production-actions">
            <button type="button" data-mobile-adfilm-output-action="download" aria-label="Videoyu indir" title="Videoyu indir">↓</button>
            <button type="button" data-mobile-adfilm-output-action="open" aria-label="Videoyu aç" title="Videoyu aç">↗</button>
            <button type="button" data-mobile-adfilm-output-action="share" aria-label="Videoyu paylaş" title="Videoyu paylaş">⤴</button>
            <button type="button" data-mobile-adfilm-output-action="sound" aria-label="Sesi aç veya kapat" title="Sesi aç veya kapat">🔊</button>
            <button type="button" data-mobile-adfilm-output-action="fullscreen" aria-label="Tam ekran" title="Tam ekran">⛶</button>
            <button type="button" data-mobile-adfilm-output-action="report" aria-label="İçeriği bildir" title="İçeriği bildir">⚑</button>
            <button type="button" data-mobile-adfilm-output-action="delete" aria-label="Videoyu sil" title="Videoyu sil">🗑</button>
          </div>
          <button class="mobile-adfilm-production-play" type="button" data-mobile-adfilm-output-action="play" aria-label="Videoyu oynat">▶</button>
        </div>
        <div class="mobile-adfilm-production-card-copy">
          <strong>${esc(title)}</strong>
          <small>${meta ? esc(new Date(meta).toLocaleString(currentLocale())) : "Reklam filmi hazır"}</small>
        </div>
      </article>
    `;
  }

  function projectOutputs(source, summary){
    if (!source) return [];
    let outputs = Array.isArray(source.outputs) ? source.outputs.filter(function(item){ return !!outputUrl(item); }) : [];
    if (!outputs.length && source.generation && clean(source.generation.videoUrl)) {
      outputs = [{
        id: source.generation.outputId || source.generation.requestId || "legacy-output",
        version: source.generation.version || 1,
        videoUrl: source.generation.videoUrl,
        previewUrl: source.generation.previewUrl || source.generation.preview_url || "",
        posterUrl: source.generation.posterUrl || "",
        duration: source.generation.input && source.generation.input.duration || source.output && source.output.duration || "",
        aspectRatio: source.generation.input && source.generation.input.aspectRatio || source.output && source.output.aspectRatio || "",
        resolution: source.generation.input && source.generation.input.resolution || source.output && source.output.quality || "",
        createdAt: source.generation.completedAt || source.updatedAt || source.createdAt || ""
      }];
    }
    const projectTitle = clean(
      source.brief && source.brief.productName ||
      summary && summary.title ||
      summary && summary.name ||
      "Reklam Filmi"
    );
    return outputs.map(function(item){
      return Object.assign({}, item, {
        projectId: clean(source.id),
        projectTitle: projectTitle
      });
    });
  }

  function outputFromCard(card){
    const outputId = clean(card && card.getAttribute("data-mobile-adfilm-output"));
    const itemProjectId = clean(card && card.getAttribute("data-mobile-adfilm-project"));
    if (!outputId) return null;
    const pool = libraryOnly ? libraryItems : projectOutputs(currentProject());
    return pool.find(function(item){
      return clean(item && item.id) === outputId && (!itemProjectId || clean(item && item.projectId) === itemProjectId);
    }) || null;
  }

  function renderOutputItems(items){
    const list = listNode();
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="mobile-adfilm-production-empty">Henüz tamamlanmış reklam filmi yok.</div>';
      return;
    }
    list.innerHTML = items.map(readyCard).join("");
  }

  function renderOutputs(source){
    if (busy) {
      renderLoadingCard();
      return;
    }
    renderOutputItems(projectOutputs(source || currentProject()));
  }

  async function loadLibraryOutputs(){
    if (libraryLoading) return;
    libraryLoading = true;
    const list = listNode();
    if (list) list.innerHTML = '<div class="mobile-adfilm-production-empty">Reklam filmleri yükleniyor...</div>';

    try {
      const response = await fetch("/api/ad-film/projects", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: { "accept": "application/json" }
      });

      const data = await response.json().catch(function(){ return {}; });

      if (!response.ok || !Array.isArray(data.projects)) {
        throw new Error(data.error || "projects_load_failed");
      }

      libraryItems = [];
      const expectedHydratedCount = Math.min(data.projects.length, 20);
      const hydratedProjects = Array.isArray(data.hydratedProjects)
        ? data.hydratedProjects.slice(0, 20)
        : null;

      if (hydratedProjects && hydratedProjects.length === expectedHydratedCount) {
        const summariesById = new Map();

        data.projects.slice(0, 20).forEach(function(summary){
          const pid = clean(summary && (summary.id || summary.projectId));
          if (pid) summariesById.set(pid, summary);
        });

        hydratedProjects.forEach(function(project){
          const pid = clean(project && project.id);
          if (!pid) return;

          const outputs = projectOutputs(
            project,
            summariesById.get(pid) || null
          );

          if (Array.isArray(outputs) && outputs.length) {
            libraryItems = libraryItems.concat(outputs);
          }
        });
      } else {
        const settled = await Promise.allSettled(
          data.projects.slice(0, 20).map(async function(summary){
            const pid = clean(summary && (summary.id || summary.projectId));
            if (!pid) return [];

            const projectResponse = await fetch(
              "/api/ad-film/project?id=" + encodeURIComponent(pid),
              {
                method: "GET",
                credentials: "include",
                cache: "no-store",
                headers: { "accept": "application/json" }
              }
            );

            const projectData = await projectResponse.json().catch(function(){
              return {};
            });

            if (!projectResponse.ok || !projectData.project) return [];

            return projectOutputs(projectData.project, summary);
          })
        );

        settled.forEach(function(result){
          if (
            result.status === "fulfilled" &&
            Array.isArray(result.value)
          ) {
            libraryItems = libraryItems.concat(result.value);
          }
        });
      }

      libraryItems.sort(function(a, b){
        const aDate = clean(
          a && (a.completedAt || a.finalizedAt || a.createdAt)
        );
        const bDate = clean(
          b && (b.completedAt || b.finalizedAt || b.createdAt)
        );

        return bDate.localeCompare(aDate);
      });

      renderOutputItems(libraryItems);
    } catch (error) {
      console.error("[MOBILE ADFILM][LIBRARY]", error);

      libraryItems = projectOutputs(currentProject());
      renderOutputItems(libraryItems);

      toast(
        "warning",
        "Reklam filmi geçmişi tamamen yüklenemedi.",
        3600
      );
    } finally {
      libraryLoading = false;
    }
  }

  function adoptProject(source){
    if (!source || !source.id) return;
    window.AIVOAdFilmActiveProject = source;
    try {
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync", {
        detail: { project: source, projectId: source.id, media: source.media || {}, mobile: true, production: true }
      }));
    } catch (_) {}
  }

  async function request(url, options, retries){
    retries = Number(retries || 0);
    try {
      const response = await fetch(url, Object.assign({
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json", "accept": "application/json" }
      }, options || {}));
      const data = await response.json().catch(function(){ return {}; });
      if (!response.ok) {
        const error = new Error(data.message || data.error || ("HTTP " + response.status));
        error.status = response.status;
        error.data = data;
        throw error;
      }
      return data;
    } catch (error) {
      if (retries > 0 && [502, 503, 504].includes(Number(error && error.status))) {
        await sleep(1800);
        return request(url, options, retries - 1);
      }
      throw error;
    }
  }

  function applyCredits(value){
    if (typeof value !== "number" || !Number.isFinite(value)) return;
    const top = document.getElementById("topCreditCount");
    if (top) top.textContent = String(value);
    document.querySelectorAll("[data-mobile-credit-balance]").forEach(function(node){
      node.textContent = "Kredi " + value;
    });
    try {
      if (window.AIVO_STORE_V1 && typeof window.AIVO_STORE_V1.setCredits === "function") window.AIVO_STORE_V1.setCredits(value);
    } catch (_) {}
  }

  async function refreshCredits(fallback){
    if (typeof fallback === "number" && Number.isFinite(fallback)) applyCredits(fallback);
    try {
      const response = await fetch("/api/credits/get", { credentials: "include", cache: "no-store", headers: { accept: "application/json" } });
      const data = await response.json().catch(function(){ return null; });
      if (data && data.ok && typeof data.credits === "number") applyCredits(data.credits);
    } catch (_) {}
    try { if (typeof window.syncCreditsUI === "function") window.syncCreditsUI({ force: true }); } catch (_) {}
  }

  async function consumeCredit(id){
    const quote = creditQuote();
    if (!quote.amount) throw new Error("invalid_credit_amount");
    const requestId = "mobile-adfilm:" + id + ":" + Date.now() + ":" + Math.random().toString(36).slice(2, 8);
    const response = await fetch("/api/credits/consume-ledger", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ app: CREDIT_APP, action: CREDIT_ACTION, cost: quote.amount, request_id: requestId, job_id: id, reason: CREDIT_ACTION })
    });
    const data = await response.json().catch(function(){ return { ok: false, error: "non_json_response" }; });
    if (!response.ok || !data || !data.ok) {
      const error = new Error(clean(data && data.error) || "credit_consume_failed");
      error.status = response.status;
      error.data = data || {};
      error.creditConsumeFailed = true;
      throw error;
    }
    const transactionId = clean(data.transaction_id || data.transaction && data.transaction.id);
    if (!transactionId) {
      const error = new Error("credit_transaction_missing");
      error.creditConsumeFailed = true;
      throw error;
    }
    run.creditConsumed = true;
    run.creditAmount = quote.amount;
    run.creditRequestId = requestId;
    run.creditTransactionId = transactionId;
    run.creditQuality = quote.quality;
    run.creditDuration = quote.duration;
    await refreshCredits(typeof data.credits === "number" ? data.credits : null);
    toast("success", quote.amount + " kredi kullanıldı. Reklam filmin hazırlanıyor.", 4200);
    return quote;
  }

  async function refundCredit(error){
    if (!run || !run.creditConsumed || !run.creditTransactionId || !run.creditAmount) return false;
    try {
      const response = await fetch("/api/credits/refund", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          app: CREDIT_APP,
          action: CREDIT_ACTION,
          amount: Number(run.creditAmount),
          request_id: run.creditRequestId,
          job_id: run.projectId,
          provider_job_id: run.requestId || null,
          related_transaction_id: run.creditTransactionId,
          reason: "adfilm_production_failed",
          meta: {
            source: "mobile.adfilm.production",
            project_id: run.projectId,
            quality: run.creditQuality || "",
            duration: run.creditDuration || "",
            aspect_ratio: run.aspectRatio || "",
            error: clean(error && error.message)
          }
        })
      });
      const data = await response.json().catch(function(){ return null; });
      if (response.ok && data && data.ok && (data.refunded || data.deduped || data.skipped)) {
        await refreshCredits(typeof data.credits === "number" ? data.credits : null);
        return true;
      }
    } catch (_) {}
    return false;
  }

  async function ensureReferences(){
    const api = referencesApi();
    if (api && typeof api.sync === "function") await api.sync();
    const refs = currentReferences();
    if (!refs.imageUrls || !refs.imageUrls.length) throw new Error("missing_reference_image");
    return refs;
  }

  async function ensureProjectSaved(){
    const sync = syncApi();
    if (sync && typeof sync.save === "function") await sync.save();
    return currentProject();
  }

  async function ensureMusic(id){
    let source = currentProject() || {};
    const mode = currentMusicMode(source);
    if (mode === "off") return source;

    if (mode === "upload") {
      if (!(source.media && source.media.musicTrack && clean(source.media.musicTrack.url))) {
        if (window.AIVOMobileAdFilmMusic && typeof window.AIVOMobileAdFilmMusic.prepare === "function") {
          await window.AIVOMobileAdFilmMusic.prepare();
          source = currentProject() || source;
        }
      }
      if (!(source.media && source.media.musicTrack && clean(source.media.musicTrack.url))) throw new Error("music_upload_required");
      return source;
    }

    const body = {
      projectId: id,
      musicStyle: fieldValue("#mobileAdFilmMusicStyle") || "auto",
      musicEnergy: fieldValue("#mobileAdFilmMusicEnergy") || "balanced",
      duration: Number(fieldValue("#mobileAdFilmDuration") || 10)
    };
    let result = await request("/api/ad-film/music/create", { method: "POST", body: JSON.stringify(body) }, 2);
    if (result.project) { source = result.project; adoptProject(source); }
    if (result.status === "DISABLED") return source;
    if (result.status === "COMPLETED" && source.music && source.music.audio && clean(source.music.audio.url)) return source;

    for (let index = 0; index < 120; index += 1) {
      run.note = "Reklam müziği hazırlanıyor...";
      renderStage(1, run.note);
      await sleep(1800);
      result = await request("/api/ad-film/music/status?projectId=" + encodeURIComponent(id), { method: "GET" }, 2);
      if (result.project) { source = result.project; adoptProject(source); }
      if (result.status === "FAILED") throw new Error(clean(result.error || source.musicGeneration && source.musicGeneration.error) || "music_generation_failed");
      if (result.status === "COMPLETED" && source.music && source.music.audio && clean(source.music.audio.url)) return source;
    }
    throw new Error("music_generation_timeout");
  }

  function buildPrompt(refs, quote){
    const product = fieldValue("#mobileAdFilmProductName");
    const brand = fieldValue("#mobileAdFilmBrandName");
    const description = fieldValue("#mobileAdFilmDescription");
    const direction = fieldValue("#mobileAdFilmCreativeBrief");
    const narration = fieldValue("#mobileAdFilmNarrationText");
    const language = fieldValue("#mobileAdFilmVoiceLanguage") || "tr";
    const voiceStyle = fieldValue("#mobileAdFilmVoiceStyle") || "warm";
    const lines = [];

    lines.push("Create a polished " + quote.duration + "-second professional commercial advertising film.");
    lines.push("@Image1 is the exact hero product. Preserve its identity, silhouette, colors, proportions, materials, label and distinctive design consistently in every shot. Never replace it with a similar product and never create duplicate hero products.");
    if (refs.referenceMap && refs.referenceMap.angles && refs.referenceMap.angles.length) {
      lines.push(refs.referenceMap.angles.map(function(index){ return "@Image" + index; }).join(", ") + " are additional views of the same hero product and must only preserve its exact appearance.");
    }
    if (refs.referenceMap && refs.referenceMap.scenes) {
      refs.referenceMap.scenes.forEach(function(index, sceneIndex){
        lines.push("@Image" + index + " is environment reference " + (sceneIndex + 1) + ". Use its lighting, atmosphere and composition while keeping @Image1 as the hero subject.");
      });
    }
    lines.push("Product: " + product + "." + (brand ? " Brand: " + brand + "." : ""));
    lines.push("Verified product brief: " + description + ".");
    if (direction) lines.push("Director instruction: " + direction + ".");
    lines.push("Create a clear commercial arc with an immediate visual hook, product reveal, premium detail shots, purposeful movement, coherent continuity and a strong clean final hero frame. Avoid static slideshow shots, random cuts, identity drift, warped geometry, extra products, illegible text, fake logos and watermarks.");
    lines.push("Do not draw the uploaded logo inside the generated scene. Leave a clean lower corner and a clean final frame so the original logo can be added as a precise overlay.");
    if (quote.aspectRatio === "4:5") lines.push("Keep all critical product details inside a centered safe 4:5 crop area.");
    if (voiceEnabled() && narration) lines.push("The final film will use this " + language + " voice-over: \"" + narration.replace(/\"/g, "'") + "\". Pace the visual story to match it. Voice character: " + voiceStyle + ". Do not render subtitles unless explicitly requested.");
    return lines.join(" ");
  }

  async function finalize(id, data){
    run.stage = 4;
    run.note = "";
    renderStage(4);
    const outputId = clean(data && data.activeOutputId || data && data.generation && (data.generation.outputId || data.generation.requestId));
    const finalized = await request("/api/ad-film/seedance/finalize", {
      method: "POST",
      body: JSON.stringify({ projectId: id, outputId: outputId })
    }, 3);
    if (!finalized || !finalized.project || !clean(finalized.video_url)) throw new Error("final_video_missing");
    adoptProject(finalized.project);
    window.AIVOAdFilmGeneratedVideo = finalized.video_url;
    return finalized;
  }

  async function poll(id, count){
    if (!busy || !run) return;
    if (count >= POLL_MAX) throw new Error("generation_timeout");
    try {
      const data = await request("/api/ad-film/seedance/status?projectId=" + encodeURIComponent(id), { method: "GET" }, 3);
      if (data.project) adoptProject(data.project);
      if (data.status === "COMPLETED" && clean(data.video_url)) {
        const finalized = await finalize(id, data);
        complete(finalized.project);
        return;
      }
      if (data.status === "FAILED") throw new Error(clean(data.generation && data.generation.error) || "generation_failed");
      run.stage = 3;
      run.note = data.status === "IN_QUEUE" ? "Üretim kuyruğunda bekleniyor." : "Sahneler ve görsel akış oluşturuluyor.";
      renderStage(3, run.note);
      clearTimeout(pollTimer);
      pollTimer = setTimeout(function(){ poll(id, count + 1).catch(fail); }, POLL_MS);
    } catch (error) {
      if (count < 8 && [0, 502, 503, 504].includes(Number(error && error.status || 0))) {
        clearTimeout(pollTimer);
        pollTimer = setTimeout(function(){ poll(id, count + 1).catch(fail); }, POLL_MS);
        return;
      }
      throw error;
    }
  }

  function setLibraryNav(){
    document.querySelectorAll(".bottom-nav a").forEach(function(link){ link.classList.remove("active"); });
    const nav = document.querySelector('.bottom-nav a[href="#productions"]');
    if (nav) nav.classList.add("active");
    try { history.replaceState(null, "", "#productions"); } catch (_) {}
  }

  function showEditor(){
    libraryOnly = false;
    root.dataset.adfilmLibraryOnly = "0";
    releaseLibraryMedia();
    if (panel) panel.hidden = false;
    const productionSection = section();
    productionSection.hidden = !busy;
    if (busy) {
      progressNode().hidden = false;
      renderLoadingCard();
    }
  }

  async function showLibrary(){
    libraryOnly = true;
    root.dataset.adfilmLibraryOnly = "1";
    if (mount) mount.hidden = false;
    if (panel) panel.hidden = true;
    const productionSection = section();
    progressNode().hidden = !busy;
    setLibraryNav();
    window.scrollTo({ top: 0, behavior: "smooth" });

    if (busy) {
      renderLoadingCard();
      productionSection.hidden = false;
      return;
    }

    const list = listNode();
    if (list) list.innerHTML = '<div class="mobile-adfilm-production-empty">Reklam filmleri yükleniyor...</div>';
    productionSection.hidden = false;
    await loadLibraryOutputs();
  }

  function complete(source){
    busy = false;
    stopElapsed();
    clearTimeout(pollTimer);
    pollTimer = null;
    run = null;
    progressNode().hidden = true;
    setActionStatus("Reklam filmi hazır. Üretimler bölümüne eklendi.", "success");
    syncButton();
    renderOutputs(source || currentProject());
    toast("success", "Reklam filmin hazır. Üretimler bölümüne eklendi.", 4200);
    setTimeout(function(){ showLibrary(); }, 500);
  }

  async function fail(error){
    if (!busy) return;
    console.error("[MOBILE ADFILM][PRODUCTION]", error, error && error.data || "");
    const hadCredit = !!(run && run.creditConsumed);
    const refunded = hadCredit ? await refundCredit(error) : false;
    busy = false;
    stopElapsed();
    clearTimeout(pollTimer);
    pollTimer = null;
    progressNode().hidden = true;
    renderOutputs(currentProject());
    syncButton();

    const code = lower(error && error.data && error.data.error || error && error.message);
    if (code.includes("narration_audio_approval_required")) toast("warning", "Önce seslendirmeyi oluşturup onayla.", 4400);
    else if (code.includes("music_upload_required")) toast("warning", "Yüklediğin müziğin buluta kaydolmasını bekle.", 4400);
    else if (code.includes("insufficient") || code.includes("credit")) toast("warning", "Bu üretim için yeterli kredin bulunmuyor.", 4400);
    else toast("error", refunded ? "Üretim tamamlanamadı. Kullanılan kredi iade edildi." : "Reklam filmi üretimi tamamlanamadı. Tekrar deneyebilirsin.", 5200);
    setActionStatus(refunded ? "Üretim başarısız oldu · kredi iade edildi." : "Üretim tamamlanamadı.", "error");
    run = null;
  }

  async function start(){
    if (busy) return;
    const state = readyState();
    if (!state.ready) {
      toast("warning", state.reason, 3600);
      syncButton();
      return;
    }

    const id = projectId();
    busy = true;
    run = {
      projectId: id,
      startedAt: Date.now(),
      stage: 1,
      note: "",
      creditConsumed: false,
      requestId: "",
      aspectRatio: currentFormat()
    };
    window.__AIVO_MOBILE_ADFILM_CURRENT_RUN__ = run;

    libraryOnly = false;
    if (panel) panel.hidden = false;
    section().hidden = false;
    renderLoadingCard();
    renderStage(1);
    startElapsed();

    try {
      await ensureProjectSaved();
      const refs = await ensureReferences();
      const source = await ensureProjectSaved();
      if (!approvedNarration(source)) throw new Error("narration_audio_approval_required");

      const quote = await consumeCredit(id);
      run.aspectRatio = quote.aspectRatio;
      await ensureMusic(id);

      run.stage = 2;
      run.note = "";
      renderStage(2);

      const payload = {
        projectId: id,
        prompt: buildPrompt(refs, quote),
        image_urls: refs.imageUrls.slice(0, 9),
        audio_urls: [],
        logo_url: refs.logoUrl || "",
        resolution: quote.quality,
        duration: String(quote.duration),
        aspect_ratio: normalizeAspect(quote.aspectRatio),
        generate_audio: false,
        bitrate_mode: quote.quality === "4k" ? "high" : "standard",
        reference_map: refs.referenceMap || null,
        production_id: "mobile-adfilm-" + Date.now()
      };

      const created = await request("/api/ad-film/seedance/create", {
        method: "POST",
        body: JSON.stringify(payload)
      }, 3);
      if (created.project) adoptProject(created.project);
      run.requestId = clean(created.request_id || created.generation && created.generation.requestId);
      run.stage = 3;
      run.note = "Üretim kuyruğuna gönderildi.";
      renderStage(3, run.note);
      poll(id, 0).catch(fail);
    } catch (error) {
      await fail(error);
    }
  }

  function resumeIfNeeded(source){
    source = source || currentProject();
    if (!source || busy) return;
    const generation = source.generation || {};
    const status = lower(generation.status);
    if (status !== "queued" && status !== "processing") return;

    busy = true;
    run = {
      projectId: clean(source.id),
      startedAt: Date.parse(generation.startedAt || "") || Date.now(),
      stage: 3,
      note: "Devam eden reklam filmi üretimi takip ediliyor.",
      creditConsumed: false,
      requestId: clean(generation.requestId),
      aspectRatio: clean(generation.input && generation.input.aspectRatio) || currentFormat(),
      resumed: true
    };
    section().hidden = false;
    renderLoadingCard();
    renderStage(3, run.note);
    startElapsed();
    poll(run.projectId, 0).catch(fail);
  }

  function hydrate(source){
    source = source || currentProject();
    if (!busy) {
      if (libraryOnly) loadLibraryOutputs();
      else renderOutputs(source);
    }
    syncButton();
    resumeIfNeeded(source);
  }

  function openReportSheet(item, videoUrl){
    const old = document.getElementById("aivoMobileAdFilmReportSheet");
    if (old) old.remove();
    const outputId = clean(item && item.id);
    const reasons = [
      "Rahatsız edici / saldırgan içerik",
      "Nefret / taciz / ayrımcılık",
      "Şiddet / tehlikeli içerik",
      "Cinsel / uygunsuz içerik",
      "Telif / marka ihlali",
      "Yanlış / aldatıcı içerik",
      "Diğer"
    ];
    const sheet = document.createElement("div");
    sheet.id = "aivoMobileAdFilmReportSheet";
    sheet.setAttribute("role", "dialog");
    sheet.setAttribute("aria-modal", "true");
    sheet.innerHTML = `
      <div data-adfilm-report-backdrop style="position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.56);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);"></div>
      <div style="position:fixed;left:14px;right:14px;bottom:86px;z-index:9999;border-radius:26px;padding:18px;background:linear-gradient(135deg,rgba(24,26,42,.98),rgba(18,20,34,.98));border:1px solid rgba(255,255,255,.16);box-shadow:0 24px 70px rgba(0,0,0,.44);">
        <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:14px;">
          <div><b style="display:block;color:#fff;font-size:19px;">İçeriği bildir</b><span style="display:block;margin-top:4px;color:rgba(255,255,255,.62);font-size:12px;">Bu içerikle ilgili sorunu seç.</span></div>
          <button type="button" data-adfilm-report-close style="width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#fff;font-size:22px;">×</button>
        </div>
        <div style="display:grid;gap:8px;margin-bottom:14px;">
          ${reasons.map(function(reason, index){ return `<label style="display:flex;align-items:center;gap:10px;min-height:40px;padding:9px 11px;border-radius:15px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.10);color:#fff;font-size:12px;font-weight:800;"><input type="radio" name="mobileAdFilmReportReason" value="${esc(reason)}" ${index === 0 ? "checked" : ""} style="width:17px;height:17px;accent-color:#ec4899;"><span>${esc(reason)}</span></label>`; }).join("")}
        </div>
        <textarea data-adfilm-report-details maxlength="500" placeholder="İstersen kısa bir açıklama yaz..." style="box-sizing:border-box;width:100%;min-height:76px;resize:none;border-radius:15px;padding:11px;border:1px solid rgba(255,255,255,.12);outline:none;background:rgba(0,0,0,.24);color:#fff;font-size:12px;"></textarea>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px;">
          <button type="button" data-adfilm-report-close style="min-height:44px;border-radius:15px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#fff;font-weight:900;">Vazgeç</button>
          <button type="button" data-adfilm-report-submit style="min-height:44px;border-radius:15px;border:0;background:linear-gradient(135deg,#8b5cf6,#ec4899);color:#fff;font-weight:900;">Raporu gönder</button>
        </div>
      </div>`;
    document.body.appendChild(sheet);
    function close(){ sheet.remove(); }
    sheet.querySelectorAll("[data-adfilm-report-close],[data-adfilm-report-backdrop]").forEach(function(node){ node.addEventListener("click", close); });
    const submit = sheet.querySelector("[data-adfilm-report-submit]");
    submit.addEventListener("click", async function(){
      const selected = sheet.querySelector('input[name="mobileAdFilmReportReason"]:checked');
      const details = sheet.querySelector("[data-adfilm-report-details]");
      if (!selected) return;
      submit.disabled = true;
      submit.textContent = "Gönderiliyor...";
      try {
        const response = await fetch("/api/reports/create", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json", "accept": "application/json" },
          body: JSON.stringify({
            app: "adfilm",
            job_id: outputId,
            content_url: videoUrl,
            reason: selected.value,
            details: clean(details && details.value),
            source: "mobile_app",
            meta: { module: "mobile.adfilm", platform: "mobile", project_id: clean(item && item.projectId) || projectId(), title: clean(item && (item.title || item.projectTitle)) }
          })
        });
        const data = await response.json().catch(function(){ return null; });
        if (!response.ok || !data || !data.ok) throw new Error(data && data.error || "report_failed");
        close();
        toast("success", "Rapor alındı.", 2800);
      } catch (error) {
        console.error("[MOBILE ADFILM][REPORT]", error);
        submit.disabled = false;
        submit.textContent = "Raporu gönder";
        toast("error", "Rapor gönderilemedi. Lütfen tekrar dene.", 3600);
      }
    });
  }

  async function deleteOutput(item, card){
    const outputId = clean(item && item.id);
    const pid = clean(item && item.projectId) || projectId();
    if (!outputId || !pid) {
      toast("error", "Video kaydı bulunamadı.", 3200);
      return;
    }
    if (!window.confirm("Bu hazır reklam filmini silmek istiyor musun? Bu işlem geri alınamaz.")) return;
    if (card) card.classList.add("is-deleting");
    try {
      const response = await fetch("/api/ad-film/seedance/result", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "content-type": "application/json", "accept": "application/json" },
        body: JSON.stringify({
          action: "delete-output",
          projectId: pid,
          outputId: outputId,
          outputVersion: Number(item && item.version || 0) || undefined
        })
      });
      const data = await response.json().catch(function(){ return {}; });
      if (!response.ok || !data.ok) throw new Error(data.error || "delete_failed");

      libraryItems = libraryItems.filter(function(output){
        return !(clean(output && output.projectId) === pid && clean(output && output.id) === outputId);
      });

      if (clean(currentProject() && currentProject().id) === pid) {
        let nextProject = data.project || null;
        if (!nextProject) {
          try {
            const refreshed = await request("/api/ad-film/project?id=" + encodeURIComponent(pid), { method: "GET" }, 1);
            nextProject = refreshed && refreshed.project || null;
          } catch (_) {}
        }
        if (nextProject) adoptProject(nextProject);
      }

      if (libraryOnly) renderOutputItems(libraryItems);
      else renderOutputs(currentProject());
      toast("success", "Reklam filmi silindi.", 2800);
    } catch (error) {
      console.error("[MOBILE ADFILM][DELETE]", error);
      if (card) card.classList.remove("is-deleting");
      toast("error", "Video silinemedi.", 3200);
    }
  }

  function installInteractions(){
    if (createButton && !createButton.__mobileAdFilmProductionBound) {
      createButton.__mobileAdFilmProductionBound = true;
      createButton.addEventListener("click", function(event){
        event.preventDefault();
        start();
      });
    }

    root.addEventListener("click", async function(event){
      const action = event.target && event.target.closest && event.target.closest("[data-mobile-adfilm-output-action]");
      if (!action) return;
      const card = action.closest(".mobile-adfilm-production-card");
      const video = card && card.querySelector("video");
      if (!video) return;
      const type = action.getAttribute("data-mobile-adfilm-output-action");
      const item = outputFromCard(card);
      const videoUrl = video.currentSrc || video.src;
      const finalVideoUrl = outputUrl(item) || clean(video.dataset.finalUrl) || videoUrl;

      if (type === "play") {
        if (video.paused) {
          root.querySelectorAll(".mobile-adfilm-production-card video").forEach(function(other){
            if (other !== video) releaseVideo(other);
          });
          if (!activateVideo(video)) {
            toast("error", "Video kaynağı bulunamadı.", 2800);
            return;
          }
          video.play().catch(function(){});
          card.classList.add("is-playing");
        } else {
          video.pause();
          card.classList.remove("is-playing");
        }
        return;
      }
      if (type === "sound") {
        video.muted = !video.muted;
        action.textContent = video.muted ? "🔇" : "🔊";
        return;
      }
      if (type === "fullscreen") {
        try {
          if (video.requestFullscreen) await video.requestFullscreen();
          else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
        } catch (_) {}
        return;
      }
      if (type === "open") {
        try {
          const opened = window.open(finalVideoUrl, "_blank", "noopener,noreferrer");
          if (!opened) location.href = finalVideoUrl;
        } catch (_) { location.href = finalVideoUrl; }
        return;
      }
      if (type === "download") {
        let directUrl = String(finalVideoUrl || "").trim();
        const filename = "aivo-reklam-filmi.mp4";

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
          } catch (_) {}
        }

        try {
          const response = await fetch(directUrl, {
            method: "GET",
            cache: "no-store"
          });

          if (!response.ok) {
            throw new Error("mobile_adfilm_download_failed_" + response.status);
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
              title: "AIVO Reklam Filmi"
            });
            return;
          }

          const objectUrl = URL.createObjectURL(blob);
          const anchor = document.createElement("a");
          anchor.href = objectUrl;
          anchor.download = filename;
          anchor.rel = "noopener";
          anchor.style.display = "none";
          document.body.appendChild(anchor);
          anchor.click();

          setTimeout(function(){
            try { anchor.remove(); } catch (_) {}
            try { URL.revokeObjectURL(objectUrl); } catch (_) {}
          }, 1500);
        } catch (error) {
          console.error("[MOBILE ADFILM][DOWNLOAD ERROR]", error);
          toast("error", "Video indirilemedi. Tekrar deneyebilirsin.", 3200);
        }
        return;
      }
      if (type === "share") {
        try {
          if (navigator.share) await navigator.share({ title: "AIVO Reklam Filmi", url: finalVideoUrl });
          else if (navigator.clipboard) {
            await navigator.clipboard.writeText(finalVideoUrl);
            toast("success", "Video bağlantısı kopyalandı.", 2400);
          }
        } catch (_) {}
        return;
      }
      if (type === "report") {
        openReportSheet(item || { id: clean(card.getAttribute("data-mobile-adfilm-output")), projectId: clean(card.getAttribute("data-mobile-adfilm-project")), title: outputTitle() }, finalVideoUrl);
        return;
      }
      if (type === "delete") {
        await deleteOutput(item || { id: clean(card.getAttribute("data-mobile-adfilm-output")), projectId: clean(card.getAttribute("data-mobile-adfilm-project")) }, card);
      }
    });

    root.addEventListener("play", function(event){
      const video = event.target;
      if (video && video.tagName === "VIDEO") {
        const card = video.closest(".mobile-adfilm-production-card");
        if (card) card.classList.add("is-playing");
      }
    }, true);
    root.addEventListener("pause", function(event){
      const video = event.target;
      if (video && video.tagName === "VIDEO") {
        const card = video.closest(".mobile-adfilm-production-card");
        if (card) card.classList.remove("is-playing");
      }
    }, true);

    ["input", "change"].forEach(function(name){
      root.addEventListener(name, function(){ setTimeout(syncButton, 0); });
    });

    document.addEventListener("click", function(event){
      const productions = event.target && event.target.closest && event.target.closest('.bottom-nav a[href="#productions"]');
      if (productions && mount && !mount.hidden) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        showLibrary();
        return;
      }

      const tool = event.target && event.target.closest && event.target.closest('[data-tool="adfilm"],[data-mobile-tool="adfilm"],[data-mobile-tool-key="adfilm"]');
      if (tool) setTimeout(showEditor, 0);
    }, true);
  }

  ensureStyle();
  ensureSection();
  installInteractions();

  document.addEventListener("aivo:adfilm-project-sync", function(event){
    const source = event && event.detail && event.detail.project;
    setTimeout(function(){ hydrate(source || currentProject()); }, 0);
  });

  window.addEventListener("pagehide", function(){
    releaseLibraryMedia();
    stopElapsed();
    clearTimeout(pollTimer);
  });

  window.mobileAdFilmShowLibrary = showLibrary;
  window.mobileAdFilmShowEditor = showEditor;
  window.mobileAdFilmHydrate = function(){ hydrate(currentProject()); };
  window.AIVOMobileAdFilmProduction = {
    start: start,
    hydrate: hydrate,
    showLibrary: showLibrary,
    showEditor: showEditor,
    active: function(){ return busy; },
    state: function(){ return run; }
  };

  syncButton();
  hydrate(currentProject());
})();
