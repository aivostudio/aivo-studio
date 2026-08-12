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

  function notify(type, message){
    try {
      if (window.mobileToast && typeof window.mobileToast[type] === "function") {
        window.mobileToast[type](message, { duration: 2800 });
        return;
      }
      if (window.toast && typeof window.toast[type] === "function") {
        window.toast[type]({ message: message, duration: 2800 });
        return;
      }
      if (typeof window.showToast === "function") window.showToast(message, type);
    } catch (_) {}
  }

  function normalizeAdFilmShareButtons(scope){
    const host = scope && scope.querySelectorAll ? scope : document;
    host.querySelectorAll('[data-mobile-adfilm-output-action="open"]').forEach(function(button){
      button.setAttribute("aria-label", "Videoyu paylaş");
      button.setAttribute("title", "Videoyu paylaş");
      button.textContent = "↗";
    });
    host.querySelectorAll('[data-mobile-adfilm-output-action="share"]').forEach(function(button){
      button.hidden = true;
    });
  }

  async function handleAdFilmShare(event){
    const button = event.target && event.target.closest && event.target.closest('[data-mobile-adfilm-output-action="open"],[data-mobile-adfilm-output-action="share"]');
    if (!button) return;
    const card = button.closest(".mobile-adfilm-production-card");
    const video = card && card.querySelector("video");
    const videoUrl = clean(video && (video.currentSrc || video.src));
    if (!card || !videoUrl) return;

    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();

    try {
      if (navigator.share) {
        await navigator.share({ title: "AIVO Reklam Filmi", url: videoUrl });
        return;
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(videoUrl);
        notify("success", "Video bağlantısı kopyalandı.");
        return;
      }
      notify("warning", "Paylaşım bu cihazda kullanılamıyor.");
    } catch (error) {
      if (error && error.name === "AbortError") return;
      console.warn("[MOBILE ADFILM] share failed", error);
      notify("error", "Paylaşım açılamadı.");
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

  document.addEventListener("click", handleAdFilmShare, true);
  normalizeAdFilmShareButtons(document);

  if (document.body) {
    const shareObserver = new MutationObserver(function(records){
      records.forEach(function(record){
        Array.from(record.addedNodes || []).forEach(function(node){
          if (node && node.nodeType === 1) normalizeAdFilmShareButtons(node);
        });
      });
    });
    shareObserver.observe(document.body, { childList: true, subtree: true });
  }
})();