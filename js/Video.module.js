(function () {
  function tryInit() {
    const host = document.getElementById("moduleHost");
    if (!host) return false;

    const module = host.querySelector('section[data-module="video"]');
    if (!module) return false;

    const tabs = Array.from(module.querySelectorAll("[data-video-tab]"));
    const subs = Array.from(module.querySelectorAll("[data-video-subview]"));
    if (!tabs.length || !subs.length) return false;

    function setTab(key) {
      tabs.forEach((b) => b.classList.toggle("is-active", b.dataset.videoTab === key));
      subs.forEach((v) => v.classList.toggle("is-active", v.dataset.videoSubview === key));
    }

    // default (DOM'da hangisi is-active ise onu koru, yoksa text)
    const activeSubview =
      module.querySelector('[data-video-subview].is-active')?.dataset.videoSubview || "text";
    setTab(activeSubview);

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
