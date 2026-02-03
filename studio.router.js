// ===============================
// MODULE CSS LOADER (GLOBAL)
// ===============================
window.ensureModuleCSS = function(routeKey){
  const link = document.getElementById("studio-module-css");
  if(!link) return;

  const v = Date.now();
  const primary  = `/css/mod.${routeKey}.css?v=${v}`;
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
  if (window.__AIVO_ROUTER_BOOTED__) {
    console.warn("[AIVO] router already booted, skipping");
    return;
  }
  window.__AIVO_ROUTER_BOOTED__ = true;

  const ROUTES = new Set([
    "music",
    "recording", // ✅ ses kaydı artık ayrı route
    "video",
    "cover",
    "atmo",
    "social",
    "hook",
    "dashboard",
    "library",
    "invoices",
    "profile",
    "settings",
  ]);

  const MODULE_BASE_CANDIDATES = ["/modules/", "/"];

  const MODULE_FILES = {
    music: "music.html",
    recording: "recording.html", // ✅
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

    const [keyPart] = raw.split("?");
    let key = (keyPart || "music").trim();
    if (!ROUTES.has(key)) key = "music";
    return { key, params: {} };
  }

  function setHash(key) {
    if (!ROUTES.has(key)) key = "music";
    location.hash = `#${key}`;
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

  async function loadModuleIntoHost(key) {
    const host = document.getElementById("moduleHost");
    if (!host) return;

    const file = MODULE_FILES[key];
    if (!file) return;

    // same module ise tekrar fetch etme
    const currentKey = host.getAttribute("data-active-module") || "";
    if (currentKey === key) return;

    const urls = MODULE_BASE_CANDIDATES.map((b) => b + file);
    host.innerHTML = await fetchFirstOk(urls);
    host.setAttribute("data-active-module", key);
  }

  async function go(key) {
    if (!ROUTES.has(key)) key = "music";

    const cur = parseHash();
    if (cur.key !== key) {
      setHash(key);
      return;
    }

    setActiveNav(key);
    window.ensureModuleCSS?.(key);
    await loadModuleIntoHost(key);

    // right panel
    window.RightPanel?.force?.(key, {});
  }

  function onHashChange() {
    const { key } = parseHash();
    go(key);
  }

  function onNavClick(e) {
    const btn = e.target.closest(".navBtn");
    if (!btn) return;
    const key = btn.dataset.route || "music";
    setHash(key); // tek akış
  }

  window.StudioRouter = { go, setHash };

  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("DOMContentLoaded", () => {
    (document.getElementById("leftMenu") || document).addEventListener("click", onNavClick);
    onHashChange();
  });
})();
