(function () {
  function tryInit() {
    const host = document.getElementById("moduleHost");
    if (!host) return false;

    // video module bazen host içinde section[data-module="video"], bazen direkt host üstünde duruyor.
    const module =
      host.querySelector("section[data-module='video']") ||
      host.querySelector("[data-module='video']") ||
      (host.getAttribute("data-active-module") === "video" ? host : null);

    if (!module) return false;

    const tabs = Array.from(module.querySelectorAll("[data-video-tab]"));
    const subviews = Array.from(module.querySelectorAll("[data-video-subview]"));

    if (!tabs.length || !subviews.length) return false;

    function setTab(key) {
      tabs.forEach((t) => t.classList.toggle("is-active", t.dataset.videoTab === key));
      subviews.forEach((sv) => {
        const on = sv.dataset.videoSubview === key;
        sv.classList.toggle("is-active", on);
        // CSS yoksa bile çalışsın diye:
        sv.style.display = on ? "" : "none";
      });
      try { sessionStorage.setItem("aivo_video_tab", key); } catch(e) {}
    }

    // default
    let saved = "text";
    try { saved = sessionStorage.getItem("aivo_video_tab") || "text"; } catch(e) {}
    setTab(saved);

    // idempotent bind
    if (!module.__aivo_video_bound) {
      module.__aivo_video_bound = true;
      module.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-video-tab]");
        if (!btn) return;
        setTab(btn.dataset.videoTab);
      });
      console.log("[AIVO] video.module READY", { tabs: tabs.length, subviews: subviews.length });
    }

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
