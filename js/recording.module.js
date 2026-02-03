(function () {
  function tryInit() {
    const root = document.querySelector("#moduleHost section[data-module='recording']");
    if (!root) return false;

    const recordBtn = root.querySelector('[data-action="toggle-record"]') || root.querySelector(".record-btn");
    const circleBtn = root.querySelector(".record-circle");

    function toggleRecording() {
      root.classList.toggle("is-recording");
      const on = root.classList.contains("is-recording");

      if (recordBtn) recordBtn.textContent = on ? "⏹ Kaydı Durdur" : "⏺ Kaydı Başlat";
      // circle'a da basınca çalışsın
    }

    if (recordBtn && !recordBtn.__aivo_bound) {
      recordBtn.__aivo_bound = true;
      recordBtn.addEventListener("click", toggleRecording);
    }

    if (circleBtn && !circleBtn.__aivo_bound) {
      circleBtn.__aivo_bound = true;
      circleBtn.addEventListener("click", toggleRecording);
    }

    console.log("[AIVO] recording.module READY");
    return true;
  }

  if (tryInit()) return;

  const host = document.getElementById("moduleHost");
  if (!host) return;

  const obs = new MutationObserver(() => {
    if (tryInit()) obs.disconnect();
  });

  obs.observe(host, { childList: true, subtree: true });
})();
