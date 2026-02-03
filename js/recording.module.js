(function () {
  function init() {
    const root = document.querySelector("#moduleHost section[data-module='recording']");
    if (!root) return false;

    console.log("[AIVO] recording.module READY");

    // burada ses kaydı eventleri, mic permission, upload vs kurarsın
    // örn:
    const btn = root.querySelector(".record-btn");
    btn?.addEventListener("click", () => {
      console.log("[AIVO] record start clicked");
    });

    return true;
  }

  if (init()) return;

  const host = document.getElementById("moduleHost");
  if (!host) return;

  const obs = new MutationObserver(() => {
    if (init()) obs.disconnect();
  });
  obs.observe(host, { childList: true, subtree: true });
})();
