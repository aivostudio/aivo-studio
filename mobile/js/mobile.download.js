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
    const value