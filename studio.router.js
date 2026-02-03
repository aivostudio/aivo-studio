// ===============================
// MODULE CSS LOADER (GLOBAL)
// ===============================
window.ensureModuleCSS = function (routeKey) {
  const link = document.getElementById("studio-module-css");
  if (!link) return;

  const v = Date.now();
  const primary = `/css/mod.${routeKey}.css?v=${v}`;
  const fallback = `/mod.${routeKey}.css?v=${v}`;

  link.onerror = () => {
    console.warn("[ensureModuleCSS] fallback:", fallback);
    link.href = fallback;
  };

  link.href = primary;
};

// ===============================
// ROUTER
// ===============================
(function () {
  const ROUTES = new Set([
    "music", "video", "cover", "atmo", "social", "hook",
    "dashboard", "library", "invoices", "profile", "settings",
  ]);

  const MODULE_BASE_CANDIDATES = ["/modules/", "/"];

  const MODULE_FILES = {
    music: "music.html",
    video: "video.html",
    cover: "cover.html",
    atmo: "atmosphere.html",
    social: "sm-pack.html",
    hook: "viral-hook.html",
    dashboard: "dashboard.html",
    library: "library.html",
    invoices: "invoices.html",
    profile: "profile.html",
    settings: "settings.html",
  };

  function parseHash() {
    const raw = (location.hash || "").replace(/^#/, "").trim();
    if (!raw) return { key: "music", params: {} };

    const [keyPart, queryPart] = raw.split("?");
    let key = (keyPart || "music").trim();
    if (!ROUTES.has(key)) key = "music";

    const params = {};
    if (queryPart) {
      const sp = new URLSearchParams(queryPart);
      for (const [k, v] of sp.entries()) params[k] = v;
    }
    return { key, params };
  }

  function setHash(key, params) {
    if (!ROUTES.has(key)) key = "music";
    const sp = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
      });
    }
    const q = sp.toString();
    location.hash = q ? `#${key}?${q}` : `#${key}`;
  }

  function setActiveNav(key) {
    document.querySelectorAll(".navBtn[data-route]").forEach((btn) => {
      const on = btn.dataset.route === key;
      btn.classList.toggle("active", on);
      btn.classList.toggle("is-active", on);
    });
  }

  async function fetchFirstOk(urls) {
    let lastErr = null;
    for (const url of urls) {
      try {
        const r = await fetch(url, { cache: "no-store" });
        if (r.ok) return await r.text();
        lastErr = new Error("HTTP " + r.status);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("fetch failed");
  }

  async function loadModuleIntoHost(key, params) {
    const host = document.getElementById("moduleHost");
    if (!host) return;

    const file = MODULE_FILES[key];
    if (!file) return;

    // ✅ aynı modulü tekrar tekrar fetch etme (özellikle music içi tab değişiminde zıplamayı keser)
    const currentKey = host.getAttribute("data-active-module") || "";
    const isSameModule = currentKey === key;

    if (!isSameModule) {
      const urls = MODULE_BASE_CANDIDATES.map((b) => b + file);
      host.innerHTML = await fetchFirstOk(urls);
      host.setAttribute("data-active-module", key);
    }

    // ✅ MUSIC SUBVIEW ZORLAMA (fetch etsek de etmesek de)
    if (key === "music") {
      const tab =
        (params && params.tab) ||
        sessionStorage.getItem("aivo_music_tab") ||
        "geleneksel";

      sessionStorage.setItem("aivo_music_tab", tab);

      // switchMusicView hazır olana kadar bekle (max 2sn)
      const started = Date.now();
      const t = setInterval(() => {
        if (typeof window.switchMusicView === "function") {
          window.switchMusicView(tab);
          clearInterval(t);
        } else if (Date.now() - started > 2000) {
          clearInterval(t);
          console.warn("[AIVO] switchMusicView bulunamadı (timeout)");
        }
      }, 50);
    }
  }

  async function go(key, params) {
    if (!ROUTES.has(key)) key = "music";

    // ✅ FIX: music route için tab boş gelmesin (race/override çözümü)
    // onNavClick tab göndermese bile (veya go(key,{}) gelirse) hash'teki / storage'taki tab'ı korur
    if (key === "music") {
      params = params || {};
      if (!params.tab) {
        const cur = parseHash();
        params.tab =
          (cur.params && cur.params.tab) ||
          sessionStorage.getItem("aivo_music_tab") ||
          "geleneksel";
      }
    }

    const cur = parseHash();

    // ✅ stable comparison (özellikle music tab için)
    const curTab = (cur.params && cur.params.tab) || "";
    const nextTab = (params && params.tab) || "";

    const sameKey = cur.key === key;
    const sameTab = curTab === nextTab;

    // hash farklıysa önce hash’i set et → hashchange tekrar go() çağıracak
    if (!sameKey || !sameTab) {
      setHash(key, params);
      return;
    }

    setActiveNav(key);
    window.ensureModuleCSS?.(key);
    await loadModuleIntoHost(key, params);

    if (window.RightPanel?.force) {
      key === "music"
        ? window.RightPanel.force("music", { tab: nextTab })
        : window.RightPanel.force(key, params);
    }
  }

  function onHashChange() {
    const { key, params } = parseHash();
    go(key, params);
  }

  // ✅ NAV SPAM ENGELİ (DOUBLE CLICK / FAST CLICK)
  let __NAV_LOCK__ = false;
  let __LAST_NAV__ = "";

  function onNavClick(e) {
    const btn = e.target.closest(".navBtn");
    if (!btn) return;

    if (__NAV_LOCK__) return;
    __NAV_LOCK__ = true;
    requestAnimationFrame(() => { __NAV_LOCK__ = false; });

    const key = btn.dataset.route || "music";
    const tab = btn.dataset.musicTab || "";

    // ✅ MUSIC içinde tab değişiyorsa: sadece view değiştir, modülü re-fetch etmeye çalışma
    if (key === "music" && tab) {
      const sig = "music::" + tab;
      if (sig === __LAST_NAV__) return;
      __LAST_NAV__ = sig;

      // hash’i güncelle (geri/ileri çalışsın)
      setHash("music", { tab });

      // moduleHost içinde music varsa direkt switchMusicView
      const musicSection = document.querySelector('#moduleHost section[data-module="music"]');
      if (musicSection && typeof window.switchMusicView === "function") {
        sessionStorage.setItem("aivo_music_tab", tab);
        window.switchMusicView(tab);
        return;
      }

      // değilse normal akışa düşsün (ilk yükleme)
      go("music", { tab });
      return;
    }

    const sig = key + "::" + tab;
    if (sig === __LAST_NAV__) return;
    __LAST_NAV__ = sig;

    go(key, {});
  }

  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("leftMenu")?.addEventListener("click", onNavClick);
    onHashChange();
  });
})();
