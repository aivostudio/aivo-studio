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
      }
    } catch (error) {
      console.warn("[MOBILE ADFILM] foreground completion check failed", error);
    } finally {
      resumeCheckBusy = false;
    }
  }

  window.fetch = async function(input, options){
    const url = typeof input === "string" ? input : input && input.url || "";
    const response = await nativeFetch(input, options);

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
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  };

  document.addEventListener("visibilitychange", function(){
    if (document.visibilityState !== "hidden") {
      setTimeout(resumeCompletionCheck, 80);
    }
  });

  window.addEventListener("pageshow", function(){
    setTimeout(resumeCompletionCheck, 120);
  });
})();