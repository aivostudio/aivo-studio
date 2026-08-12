(function AIVO_MOBILE_ADFILM_POLL_SAFETY(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_POLL_SAFETY_V1__) return;
  window.__AIVO_MOBILE_ADFILM_POLL_SAFETY_V1__ = true;

  const nativeFetch = window.fetch.bind(window);
  let resumeCheckBusy = false;
  let lastResumeCheckAt = 0;

  function clean(value){
    return String(value == null ? "" : value).trim();
  }

  function terminalProviderError(data, responseStatus){
    const providerStatus = Number(data && data.fal_status || responseStatus || 0);
    const code = clean(data && data.error).toLowerCase();
    if (code !== "fal_result_error" && code !== "fal_status_error" && code !== "fal_error") return false;
    return providerStatus >= 400 && providerStatus < 500 && ![408,409,425,429].includes(providerStatus);
  }

  function errorReason(data){
    try {
      const detail = data && data.fal_response && data.fal_response.detail;
      if (Array.isArray(detail) && detail[0] && detail[0].msg) {
        return clean(detail[0].msg).slice(0, 500);
      }
    } catch (_) {}
    return clean(data && data.error || "provider_generation_failed");
  }

  function projectIdFromUrl(url){
    const match = String(url || "").match(/[?&]projectId=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function currentProject(){
    try {
      if (window.AIVOAdFilmActiveProject && window.AIVOAdFilmActiveProject.id) {
        return window.AIVOAdFilmActiveProject;
      }
      const sync = window.AIVOMobileAdFilmProjectSync;
      if (sync && typeof sync.project === "function") return sync.project();
    } catch (_) {}
    return null;
  }

  function currentProjectId(){
    const root = document.getElementById("mobileAdFilmSection");
    const source = currentProject();
    try {
      const sync = window.AIVOMobileAdFilmProjectSync;
      return clean(
        root && root.dataset && root.dataset.adfilmProjectId ||
        source && source.id ||
        sync && typeof sync.projectId === "function" && sync.projectId()
      );
    } catch (_) {
      return clean(root && root.dataset && root.dataset.adfilmProjectId || source && source.id);
    }
  }

  function publishProject(project){
    if (!project || !project.id) return;
    window.AIVOAdFilmActiveProject = project;
    try {
      document.dispatchEvent(new CustomEvent("aivo:adfilm-project-sync", {
        detail: {
          project: project,
          projectId: project.id,
          media: project.media || {},
          mobile: true,
          foregroundResume: true
        }
      }));
    } catch (_) {}
    try {
      if (window.AIVOMobileAdFilmProduction && typeof window.AIVOMobileAdFilmProduction.hydrate === "function") {
        window.AIVOMobileAdFilmProduction.hydrate(project);
      }
    } catch (_) {}
  }

  function notify(type, message){
    try {
      if (window.mobileToast && typeof window.mobileToast[type] === "function") {
        window.mobileToast[type](message, { duration: 3000 });
        return;
      }
      if (window.toast && typeof window.toast[type] === "function") {
        window.toast[type]({ message: message, duration: 3000 });
        return;
      }
      if (typeof window.showToast === "function") window.showToast(message, type);
    } catch (_) {}
  }

  function confirmAdFilmDelete(){
    return new Promise(function(resolve){
      const previous = document.getElementById("aivoIosAdFilmDeleteConfirm");
      if (previous) previous.remove();

      const english = String(document.documentElement.lang || "").toLowerCase().startsWith("en");
      const sheet = document.createElement("div");
      sheet.id = "aivoIosAdFilmDeleteConfirm";
      sheet.setAttribute("role", "dialog");
      sheet.setAttribute("aria-modal", "true");
      sheet.innerHTML = `
        <div data-aivo-ios-adfilm-delete-cancel style="position:fixed;inset:0;z-index:10020;background:rgba(0,0,0,.58);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);"></div>
        <div style="position:fixed;left:16px;right:16px;bottom:92px;z-index:10021;border-radius:24px;padding:18px;background:linear-gradient(135deg,rgba(24,26,42,.99),rgba(17,19,32,.99));border:1px solid rgba(255,255,255,.16);box-shadow:0 24px 70px rgba(0,0,0,.48);">
          <strong style="display:block;color:#fff;font-size:18px;font-weight:900;">${english ? "Delete ad film?" : "Reklam filmi silinsin mi?"}</strong>
          <span style="display:block;margin-top:7px;color:rgba(255,255,255,.68);font-size:13px;line-height:1.45;">${english ? "This action cannot be undone." : "Bu işlem geri alınamaz."}</span>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:16px;">
            <button type="button" data-aivo-ios-adfilm-delete-cancel style="min-height:46px;border-radius:15px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.08);color:#fff;font-weight:900;">${english ? "Cancel" : "Vazgeç"}</button>
            <button type="button" data-aivo-ios-adfilm-delete-confirm style="min-height:46px;border-radius:15px;border:0;background:linear-gradient(135deg,#dc2626,#ef4444);color:#fff;font-weight:900;">${english ? "Delete" : "Sil"}</button>
          </div>
        </div>`;
      document.body.appendChild(sheet);

      let settled = false;
      function finish(value){
        if (settled) return;
        settled = true;
        try { sheet.remove(); } catch (_) {}
        resolve(value);
      }

      sheet.querySelectorAll("[data-aivo-ios-adfilm-delete-cancel]").forEach(function(node){
        node.addEventListener("click", function(){ finish(false); });
      });
      const confirmButton = sheet.querySelector("[data-aivo-ios-adfilm-delete-confirm]");
      if (confirmButton) confirmButton.addEventListener("click", function(){ finish(true); });
    });
  }

  async function handleIosAdFilmDelete(event){
    const button = event.target && event.target.closest && event.target.closest('[data-mobile-adfilm-output-action="delete"]');
    if (!button) return;

    const card = button.closest(".mobile-adfilm-production-card");
    if (!card) return;

    const outputId = clean(card.getAttribute("data-mobile-adfilm-output"));
    const projectId = clean(card.getAttribute("data-mobile-adfilm-project")) || currentProjectId();
    if (!outputId || !projectId) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

    const confirmed = await confirmAdFilmDelete();
    if (!confirmed) return;

    button.disabled = true;
    card.classList.add("is-deleting");

    try {
      const response = await nativeFetch(
        "/api/ad-film/seedance/result?projectId=" + encodeURIComponent(projectId) + "&outputId=" + encodeURIComponent(outputId),
        {
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
          headers: { accept: "application/json" }
        }
      );
      const data = await response.json().catch(function(){ return {}; });
      if (!response.ok) throw new Error(clean(data && data.error) || "delete_failed");

      if (data && data.project) publishProject(data.project);
      try { card.remove(); } catch (_) {}
      notify("success", document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith("en") ? "Ad film deleted." : "Reklam filmi silindi.");
    } catch (error) {
      button.disabled = false;
      card.classList.remove("is-deleting");
      console.error("[MOBILE ADFILM] iOS delete failed", error);
      notify("error", document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith("en") ? "Video could not be deleted." : "Video silinemedi.");
    }
  }

  function completedProjectFromStatus(source, statusData){
    const generation = Object.assign({}, source && source.generation || {}, statusData && statusData.generation || {});
    const finalizationStatus = clean(generation && generation.finalization && generation.finalization.status).toLowerCase();
    const mixVersion = Number(generation && generation.mixVersion || 0);
    const videoUrl = clean(statusData && statusData.video_url || generation && generation.videoUrl);
    if (finalizationStatus !== "completed" || mixVersion < 12 || !videoUrl) return null;

    return Object.assign({}, source || {}, statusData && statusData.project || {}, {
      id: clean(statusData && statusData.projectId) || clean(source && source.id),
      status: "completed",
      generation: generation,
      outputs: Array.isArray(statusData && statusData.outputs) ? statusData.outputs : (source && source.outputs || []),
      activeOutputId: clean(statusData && statusData.activeOutputId) || clean(source && source.activeOutputId) || clean(generation.outputId)
    });
  }

  async function resumeCompletionCheck(){
    if (document.visibilityState === "hidden") return;
    if (resumeCheckBusy) return;

    const now = Date.now();
    if (now - lastResumeCheckAt < 1200) return;
    lastResumeCheckAt = now;

    const projectId = currentProjectId();
    if (!projectId) return;

    const source = currentProject();
    const generationStatus = clean(source && source.generation && source.generation.status).toLowerCase();
    if (generationStatus && !["queued", "processing", "running", "completed"].includes(generationStatus)) return;

    resumeCheckBusy = true;
    try {
      const statusResponse = await nativeFetch(
        "/api/ad-film/seedance/status?projectId=" + encodeURIComponent(projectId),
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: { accept: "application/json" }
        }
      );
      const statusData = await statusResponse.json().catch(function(){ return {}; });
      if (!statusResponse.ok || !statusData) return;

      if (statusData.project) publishProject(statusData.project);

      const status = clean(statusData.status).toUpperCase();
      if (status !== "COMPLETED" || !clean(statusData.video_url)) return;

      const completedProject = completedProjectFromStatus(source, statusData);
      if (completedProject) {
        publishProject(completedProject);
        try {
          if (window.AIVOMobileAdFilmProduction && typeof window.AIVOMobileAdFilmProduction.finish === "function") {
            window.AIVOMobileAdFilmProduction.finish(completedProject);
          }
        } catch (_) {}
        return;
      }

      const outputId = clean(
        statusData.activeOutputId ||
        statusData.generation && (statusData.generation.outputId || statusData.generation.requestId) ||
        statusData.project && statusData.project.generation && (statusData.project.generation.outputId || statusData.project.generation.requestId) ||
        source && source.generation && (source.generation.outputId || source.generation.requestId)
      );
      if (!outputId) return;

      const finalizeResponse = await nativeFetch("/api/ad-film/seedance/finalize", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({ projectId: projectId, outputId: outputId })
      });
      const finalized = await finalizeResponse.json().catch(function(){ return {}; });

      if (finalizeResponse.ok && finalized && finalized.project) {
        publishProject(finalized.project);
        try {
          if (window.AIVOMobileAdFilmProduction && typeof window.AIVOMobileAdFilmProduction.finish === "function") {
            window.AIVOMobileAdFilmProduction.finish(finalized.project);
          }
        } catch (_) {}
      }
    } catch (error) {
      console.warn("[MOBILE ADFILM] foreground completion check failed", error);
    } finally {
      resumeCheckBusy = false;
    }
  }

  window.fetch = async function(input, options){
    const url = typeof input === "string" ? input : input && input.url || "";

    if (url.indexOf("/api/ad-film/music/create") >= 0) {
      const nextOptions = Object.assign({}, options || {});
      nextOptions.headers = Object.assign({}, nextOptions.headers || {}, {
        "x-aivo-adfilm-client": "ios"
      });
      options = nextOptions;
    }

    const response = await nativeFetch(input, options);

    if (url.indexOf("/api/ad-film/music/create") >= 0 && response.ok) {
      const data = await response.clone().json().catch(function(){ return null; });
      const status = clean(data && data.status).toUpperCase();
      if (data && ["IN_QUEUE", "RUNNING"].includes(status)) {
        return new Response(JSON.stringify(Object.assign({}, data, {
          status: "DISABLED",
          background_music_generation: true
        })), {
          status: 200,
          headers: {
            "Content-Type":"application/json; charset=utf-8",
            "Cache-Control":"no-store"
          }
        });
      }
      return response;
    }

    if (url.indexOf("/api/ad-film/seedance/status") < 0 || response.ok) {
      return response;
    }

    const data = await response.clone().json().catch(function(){ return {}; });
    if (!terminalProviderError(data, response.status)) return response;

    const projectId = projectIdFromUrl(url);
    const reason = errorReason(data);

    if (projectId) {
      nativeFetch("/api/ad-film/seedance/cancel", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId,
          mode: "failed",
          reason: reason
        })
      }).catch(function(error){
        console.warn("[MOBILE ADFILM] terminal generation cancel failed", error);
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      projectId: projectId || null,
      status: "FAILED",
      video_url: null,
      generation: {
        status: "failed",
        error: reason
      }
    }), {
      status: 200,
      headers: {
        "Content-Type":"application/json; charset=utf-8",
        "Cache-Control":"no-store"
      }
    });
  };

  document.addEventListener("click", handleIosAdFilmDelete, true);

  document.addEventListener("visibilitychange", function(){
    if (document.visibilityState !== "hidden") {
      setTimeout(resumeCompletionCheck, 80);
    }
  });

  window.addEventListener("pageshow", function(){
    setTimeout(resumeCompletionCheck, 120);
  });
})();