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
    const sourceUrl = String(options && options.url || "").trim();
    const filename = safeName(options && options.filename, "aivo-download");

    if (!sourceUrl) return false;

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
        if (!response.ok) throw new Error("download_fetch_failed");
        const blob = await response.blob();
        const file = new File([blob], filename, {
          type: blob.type || "application/octet-stream"
        });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: filename });
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

  function openCharacterPreview(imageUrl){
    const existing = document.getElementById("aivoMobileCartoonCharacterPreview");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "aivoMobileCartoonCharacterPreview";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText = "position:fixed;inset:0;z-index:10050;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(5,7,16,.88);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);";
    overlay.innerHTML = '<button type="button" data-cartoon-preview-close aria-label="Kapat" style="position:absolute;top:max(18px,env(safe-area-inset-top));right:18px;width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(20,22,36,.88);color:#fff;font-size:28px;line-height:1;">×</button>' +
      '<img src="' + String(imageUrl).replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;") + '" alt="Karakter önizleme" style="display:block;max-width:94vw;max-height:82vh;width:auto;height:auto;object-fit:contain;border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.5);">';

    function close(){ overlay.remove(); }
    overlay.addEventListener("click", function(event){
      if (event.target === overlay || event.target.closest("[data-cartoon-preview-close]")) close();
    });
    document.body.appendChild(overlay);
  }

  let adFilmNarrationProgressRaf = 0;
  let adFilmNarrationProgressObserver = null;

  function stopAdFilmNarrationProgress(){
    if (!adFilmNarrationProgressRaf) return;
    cancelAnimationFrame(adFilmNarrationProgressRaf);
    adFilmNarrationProgressRaf = 0;
  }

  function syncAdFilmNarrationProgress(audio, line){
    if (!audio || !line) return;
    const legacyFill = line.querySelector("i");
    if (legacyFill) legacyFill.style.display = "none";

    const total = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) && audio.currentTime > 0 ? audio.currentTime : 0;
    const percent = total ? Math.max(0, Math.min(100, current / total * 100)) : 0;

    line.style.background = "linear-gradient(90deg,#8b5cf6 0%,#ec4899 " + percent + "%,rgba(255,255,255,.08) " + percent + "%,rgba(255,255,255,.08) 100%)";
  }

  function runAdFilmNarrationProgress(audio, line){
    stopAdFilmNarrationProgress();
    function frame(){
      syncAdFilmNarrationProgress(audio, line);
      if (!audio.paused && !audio.ended) {
        adFilmNarrationProgressRaf = requestAnimationFrame(frame);
      } else {
        adFilmNarrationProgressRaf = 0;
      }
    }
    adFilmNarrationProgressRaf = requestAnimationFrame(frame);
  }

  function bindAdFilmNarrationProgress(){
    const preview = document.querySelector("[data-mobile-adfilm-voice-preview]");
    const line = preview && preview.querySelector(".mobile-adfilm-voice-preview-line");
    const audio = preview && preview.querySelector("audio");
    if (!preview || !line || !audio) return false;

    syncAdFilmNarrationProgress(audio, line);
    if (audio.__aivoAdFilmNarrationProgressBound) return true;
    audio.__aivoAdFilmNarrationProgressBound = true;

    ["loadedmetadata", "durationchange", "timeupdate"].forEach(function(name){
      audio.addEventListener(name, function(){ syncAdFilmNarrationProgress(audio, line); });
    });
    audio.addEventListener("play", function(){ runAdFilmNarrationProgress(audio, line); });
    audio.addEventListener("pause", function(){
      stopAdFilmNarrationProgress();
      syncAdFilmNarrationProgress(audio, line);
    });
    audio.addEventListener("ended", function(){
      stopAdFilmNarrationProgress();
      syncAdFilmNarrationProgress(audio, line);
    });
    return true;
  }

  function ensureAdFilmNarrationProgress(){
    if (bindAdFilmNarrationProgress()) {
      if (adFilmNarrationProgressObserver) {
        adFilmNarrationProgressObserver.disconnect();
        adFilmNarrationProgressObserver = null;
      }
      return;
    }
    if (adFilmNarrationProgressObserver || !document.documentElement) return;
    adFilmNarrationProgressObserver = new MutationObserver(function(){
      if (bindAdFilmNarrationProgress()) {
        adFilmNarrationProgressObserver.disconnect();
        adFilmNarrationProgressObserver = null;
      }
    });
    adFilmNarrationProgressObserver.observe(document.documentElement, { childList:true, subtree:true });
  }

  document.addEventListener("click", function(event){
    const button = event.target && event.target.closest && event.target.closest("[data-mobile-cartoon-character-act]");
    if (!button) return;

    const action = String(button.getAttribute("data-mobile-cartoon-character-act") || "").trim();
    const imageUrl = String(button.getAttribute("data-character-url") || "").trim();
    if (!imageUrl) return;

    if (action === "preview") {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      openCharacterPreview(imageUrl);
      return;
    }

    if (action === "download" && isIOS()) {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === "function") event.stopImmediatePropagation();
      download({
        url: imageUrl,
        filename: "aivo-cizgifilm-karakter.jpg"
      });
    }
  }, true);

  document.addEventListener("aivo:adfilm-project-sync", ensureAdFilmNarrationProgress);
  ensureAdFilmNarrationProgress();

  window.AivoMobileDownload = {
    download: download,
    buildProxyUrl: buildProxyUrl
  };
})();