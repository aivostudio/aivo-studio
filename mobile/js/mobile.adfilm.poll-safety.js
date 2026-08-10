(function AIVO_MOBILE_ADFILM_POLL_SAFETY(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_POLL_SAFETY_V1__) return;
  window.__AIVO_MOBILE_ADFILM_POLL_SAFETY_V1__ = true;

  const nativeFetch = window.fetch.bind(window);

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
})();

(function AIVO_MOBILE_ADFILM_VIDEO_LAZY_SAFETY(){
  "use strict";
  if (window.__AIVO_MOBILE_ADFILM_VIDEO_LAZY_SAFETY_V1__) return;
  window.__AIVO_MOBILE_ADFILM_VIDEO_LAZY_SAFETY_V1__ = true;

  const root = document.getElementById("mobileAdFilmSection");
  if (!root) return;

  function parkVideo(video){
    if (!(video instanceof HTMLVideoElement)) return;
    if (!video.closest("[data-mobile-adfilm-production]")) return;
    if (video.dataset.aivoLazySrc) return;

    const src = video.getAttribute("src");
    if (!src) return;

    video.dataset.aivoLazySrc = src;
    video.preload = "none";
    video.removeAttribute("src");
    try { video.load(); } catch (_) {}
  }

  function scan(node){
    if (!node || node.nodeType !== 1) return;
    if (node.matches && node.matches("video")) parkVideo(node);
    if (node.querySelectorAll) node.querySelectorAll("video").forEach(parkVideo);
  }

  function restoreVideo(video){
    if (!(video instanceof HTMLVideoElement)) return;
    if (video.getAttribute("src")) return;
    const src = video.dataset.aivoLazySrc;
    if (!src) return;

    video.src = src;
    video.preload = "metadata";
    try { video.load(); } catch (_) {}
  }

  scan(root);

  const observer = new MutationObserver(function(records){
    records.forEach(function(record){
      Array.from(record.addedNodes || []).forEach(scan);
    });
  });

  observer.observe(root, { subtree:true, childList:true });

  root.addEventListener("click", function(event){
    const action = event.target && event.target.closest
      ? event.target.closest("[data-mobile-adfilm-output-action]")
      : null;
    if (!action) return;

    const actionName = action.getAttribute("data-mobile-adfilm-output-action");
    if (!["play", "sound", "fullscreen"].includes(actionName)) return;

    const card = action.closest(".mobile-adfilm-production-card");
    const video = card && card.querySelector("video[data-aivo-lazy-src]");
    if (video) restoreVideo(video);
  }, true);

  window.addEventListener("pagehide", function(){
    observer.disconnect();
  }, { once:true });
})();