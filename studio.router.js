(function () {
  const host = document.getElementById("moduleHost");
  if (!host) return;

  const map = {
  "music": "/modules/music.html",
  "video": "/modules/video.html",
  "atmosphere": "/modules/atmosphere.html",
  "cover": "/modules/cover.html",
  "sm-pack": "/modules/sm-pack.html",
  "viral-hook": "/modules/viral-hook.html",
};


  async function loadModule(key, extra) {
    const url = map[key];
    if (!url) return;

    const r = await fetch(url, { cache: "no-store" });
    const html = await r.text();
    host.innerHTML = html;

    // Music tab: geleneksel / ses-kaydi
    if (key === "music" && extra?.musicTab) {
      host.querySelectorAll(".music-view[data-music-view]").forEach(el => {
        el.classList.remove("is-active");
      });
      const t = host.querySelector(`.music-view[data-music-view="${extra.musicTab}"]`);
      if (t) t.classList.add("is-active");
    }

    // Right panel sync
    if (window.RightPanel && typeof window.RightPanel.force === "function") {
      window.RightPanel.force(key);
    }

    // URL state (reload yok)
    const u = new URL(location.href);
    u.searchParams.set("page", key);
    if (extra?.musicTab) u.searchParams.set("musicTab", extra.musicTab);
    else u.searchParams.delete("musicTab");
    history.replaceState({}, "", u.toString());
  }

  // Sidebar click
  document.querySelectorAll(".sidebar-link[data-page-link]").forEach(el => {
    el.addEventListener("click", () => {
      const key = el.getAttribute("data-page-link");
      const musicTab = el.getAttribute("data-music-tab");
      loadModule(key, musicTab ? { musicTab } : null);
    });
  });

  // Initial load
  const u = new URL(location.href);
  const page = u.searchParams.get("page") || "music";
  const musicTab = u.searchParams.get("musicTab") || "geleneksel";
  loadModule(page, page === "music" ? { musicTab } : null);
})();
