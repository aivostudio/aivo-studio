(function () {
  function tryInit() {
    const moduleHost = document.getElementById("moduleHost");
    if (!moduleHost) return false;

    // sadece video aktifken çalışsın
    if (moduleHost.getAttribute("data-active-module") !== "video") return false;

    const module = moduleHost.querySelector("section[data-module='video']");
    if (!module) return false;

    const tabs = Array.from(module.querySelectorAll("[data-video-tab]"));
    const views = Array.from(module.querySelectorAll("[data-video-subview]"));
    if (!tabs.length || !views.length) return false;

    function setTab(key) {
      tabs.forEach((b) => {
        const on = b.dataset.videoTab === key;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
      views.forEach((v) => v.classList.toggle("is-active", v.dataset.videoSubview === key));
    }

    // default: text
    setTab("text");

    if (!module.__aivo_video_tabs_bound) {
      module.__aivo_video_tabs_bound = true;
      module.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-video-tab]");
        if (!btn) return;
        setTab(btn.dataset.videoTab);
      });
    }

    console.log("[AIVO] video.module READY (tabs ok)");
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
