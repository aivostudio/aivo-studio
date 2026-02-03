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
    if (link.__fellBackOnce) return;
    link.__fellBackOnce = true;
    console.warn("[ensureModuleCSS] fallback:", fallback);
    link.href = fallback;
  };

  link.__fellBackOnce = false;
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

  // ✅ SINGLE-FLIGHT NAV TOKEN (race killer)
  let NAV_TOKEN = 0;

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

  // ---- music tab resolver (tek otorite)
  function resolveMusicTab(params) {
    if (params && params.tab) return params.tab;
    const cur = parseHash();
    if (cur.params && cur.params.tab) return cur.params.tab;
    return sessionStorage.getItem("aivo_music_tab") || "geleneksel";
  }

  // ✅ wait helper (interval yok, rAF ile polling)
  function rafSleep() {
    return new Promise((r) => requestAnimationFrame(r));
  }

  async function waitForMusicReady(token, timeoutMs = 2000) {
    const started = performance.now();

    while (performance.now() - started < timeoutMs) {
      if (token !== NAV_TOKEN) return false; // ❌ cancelled

      const root = document.querySelector('#moduleHost section[data-module="music"]');
      const a = root?.querySelector('[data-music-view="geleneksel"]');
      const b = root?.querySelector('[data-music-view="ses-kaydi"]');

      if (typeof window.switchMusicView === "function" && a && b) return true;

      await rafSleep();
    }

    return false;
  }

  async function loadModuleIntoHost(key) {
    const host = document.getElementById("moduleHost");
    if (!host) return;

    const file = MODULE_FILES[key];
    if (!file) return;

    // ✅ aynı modulü tekrar tekrar fetch etme
    const currentKey = host.getAttribute("data-active-module") || "";
    const isSameModule = currentKey === key;

    if (!isSameModule) {
      const urls = MODULE_BASE_CANDIDATES.map((b) => b + file);
      host.innerHTML = await fetchFirstOk(urls);
      host.setAttribute("data-active-module", key);
    }
  }

  async function go(key, params) {
    if (!ROUTES.has(key)) key = "music";

    // ✅ new nav flight
    const token = ++NAV_TOKEN;

    // ✅ music tab her zaman dolu
    if (key === "music") {
      params = params || {};
      if (!params.tab) params.tab = resolveMusicTab(params);
      sessionStorage.setItem("aivo_music_tab", params.tab);
    } else {
      params = params || {};
    }

    const cur = parseHash();
    const curTab = (cur.params && cur.params.tab) || "";
    const nextTab = (params && params.tab) || "";

    const sameKey = cur.key === key;
    const sameTab = curTab === nextTab;

    // hash farklıysa: sadece hash set (tek akış)
    if (!sameKey || !sameTab) {
      setHash(key, params);
      return;
    }

    // ✅ UI apply (cancel-safe)
    setActiveNav(key);
    window.ensureModuleCSS?.(key);

    await loadModuleIntoHost(key);

    if (token !== NAV_TOKEN) return; // ❌ cancelled (başka nav geldi)

    // ✅ MUSIC SUBVIEW apply sadece burada, sadece 1 kez
    if (key === "music") {
      const ok = await waitForMusicReady(token, 2000);
      if (!ok || token !== NAV_TOKEN) {
        console.warn("[AIVO] music subview not ready / cancelled");
        return;
      }
      window.switchMusicView(params.tab);
    }

    if (token !== NAV_TOKEN) return; // ❌ cancelled

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

    // ✅ MUSIC: sadece hash
    if (key === "music") {
      const nextTab = tab || (sessionStorage.getItem("aivo_music_tab") || "geleneksel");
      const sig = "music::" + nextTab;
      if (sig === __LAST_NAV__) return;
      __LAST_NAV__ = sig;

      sessionStorage.setItem("aivo_music_tab", nextTab);
      setHash("music", { tab: nextTab });
      return;
    }

    const sig = key;
    if (sig === __LAST_NAV__) return;
    __LAST_NAV__ = sig;

    setHash(key, {}); // yine tek akış
  }

  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("DOMContentLoaded", () => {
    document.getElementById("leftMenu")?.addEventListener("click", onNavClick);
    onHashChange();
  });
})();
