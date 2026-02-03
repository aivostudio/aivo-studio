(function () {
  function getTabFromHash() {
    const raw = (location.hash || "").replace(/^#/, "");
    if (!raw) return null;
    const [keyPart, queryPart] = raw.split("?");
    const key = (keyPart || "").trim();
    if (key !== "music") return null;
    if (!queryPart) return null;
    const sp = new URLSearchParams(queryPart);
    return sp.get("tab");
  }

  function tryInit() {
    const module = document.querySelector("#moduleHost section[data-module='music']");
    if (!module) return false;

    const views = module.querySelectorAll(".music-view");
    if (!views.length) return false;

    function applyView(view) {
      if (!view) return;
      views.forEach((v) => {
        v.style.display = (v.dataset.musicView === view) ? "block" : "none";
      });
    }

    // ✅ GLOBAL API: Router burayı çağıracak
    window.switchMusicView = function (view, opts) {
      opts = opts || {};
      const persist = (opts.persist !== false);

      // DOM yoksa noop yerine false döndür (router waitFor ile anlayabilir)
      if (!views || !views.length) return false;

      applyView(view);

      if (persist) {
        sessionStorage.setItem("aivo_music_tab", view);
      }

      // debug için istersen:
      // console.log("[AIVO] switchMusicView", view, { persist });

      return true;
    };

    // ✅ IMPORTANT: init sırasında DEFAULT SWITCH YOK.
    // Router (hash -> go) bu view’i zaten set edecek.
    // Sadece güvenlik: hash’te tab varsa ve router henüz basmadıysa,
    // "first paint" için bir kere uygula (ama storage default'a zorlamadan).
    const hashTab = getTabFromHash();
    if (hashTab) {
      // router zaten basmışsa tekrar basmayalım
      if (!window.__AIVO_MUSIC_VIEW_APPLIED__) {
        window.__AIVO_MUSIC_VIEW_APPLIED__ = true;
        window.switchMusicView(hashTab, { persist: true });
      }
    }

    console.log("[AIVO] music.module READY");
    return true;
  }

  // 1) Hemen dene
  if (tryInit()) return;

  // 2) module inject edilene kadar bekle
  const host = document.getElementById("moduleHost");
  if (!host) return;

  const obs = new MutationObserver(() => {
    if (tryInit()) obs.disconnect();
  });

  obs.observe(host, { childList: true, subtree: true });
})();
