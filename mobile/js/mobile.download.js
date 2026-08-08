(function(){
  if (window.AivoMobileDownload) return;

  function isIOS(){
    return /iPad|iPhone|iPod/.test(navigator.userAgent || "") ||
      (
        navigator.platform === "MacIntel" &&
        navigator.maxTouchPoints > 1
      );
  }

  function isAndroid(){
    return /Android/i.test(navigator.userAgent || "");
  }

  function safeName(name, fallback){
    const value = String(name || "").trim() || fallback || "aivo-download";
    return value
      .replace(/[\/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, " ")
      .slice(0, 140);
  }

  function buildProxyUrl(url, filename){
    return "/api/media/proxy?url=" +
      encodeURIComponent(String(url || "")) +
      "&filename=" +
      encodeURIComponent(String(filename || "aivo-download"));
  }

  async function download(options){
    const sourceUrl = String(options?.url || "").trim();
    const filename = safeName(options?.filename, "aivo-download");

    if (!sourceUrl) {
      return false;
    }
       
    const proxyUrl = sourceUrl.includes("/api/media/proxy")
      ? sourceUrl
      : buildProxyUrl(sourceUrl, filename);

    if (isAndroid()) {
      const a = document.createElement("a");
      a.href = proxyUrl;
      a.download = filename;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();

      setTimeout(function(){
        try { a.remove(); } catch (err) {}
      }, 1500);

      return true;
    }

    if (isIOS() && navigator.share) {
      try {
        const response = await fetch(proxyUrl, {
          method: "GET",
          credentials: "include",
          cache: "no-store"
        });

        if (!response.ok) {
          throw new Error("download_fetch_failed");
        }

        const blob = await response.blob();
        const file = new File([blob], filename, {
          type: blob.type || "application/octet-stream"
        });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename
          });
          return true;
        }

        return true;
      } catch (err) {
        return true;
      }
    }

    const a = document.createElement("a");
    a.href = proxyUrl;
    a.download = filename;
    a.rel = "noopener";
    a.target = "_blank";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();

    setTimeout(function(){
      try { a.remove(); } catch (err) {}
    }, 1500);

    return true;
  }

  function installAdFilmDownloadBridge(){
    if (window.__AIVO_MOBILE_ADFILM_DOWNLOAD_BRIDGE__) return;
    window.__AIVO_MOBILE_ADFILM_DOWNLOAD_BRIDGE__ = true;

    document.addEventListener("click", function(event){
      const target = event.target;
      const button = target && target.closest
        ? target.closest('[data-mobile-adfilm-output-action="download"]')
        : null;

      if (!button) return;

      const card = button.closest(".mobile-adfilm-production-card");
      const video = card && card.querySelector("video");
      const videoUrl = String(video && (video.currentSrc || video.src) || "").trim();

      if (!videoUrl) return;

      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();

      download({
        url: videoUrl,
        filename: "aivo-reklam-filmi.mp4"
      }).catch(function(err){
        console.error("[MOBILE ADFILM][DOWNLOAD BRIDGE]", err);
      });
    }, true);
  }

  window.AivoMobileDownload = {
    download: download,
    buildProxyUrl: buildProxyUrl
  };

  installAdFilmDownloadBridge();
})();
