// ===============================
// MODULE CSS LOADER (GLOBAL)
// ===============================
window.ensureModuleCSS = function () {
  return Promise.resolve();
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

  const RIGHT_PANEL_KEY = {
    music: "music",
    video: "video",
    cover: "cover",
    atmo: "atmo",
    cartoon: "cartoon",
    photofx: "photofx",
    dashboard: "dashboard",
    library: "library",
    invoices: "invoices",
    profile: "profile",
    settings: "settings",
  };

  const ROUTES = new Set([
    "music",
    "video",
    "cover",
    "atmo",
    "cartoon",
    "photofx",
    "dashboard",
    "library",
    "invoices",
    "profile",
    "settings",
  ]);

const MODULE_BASE_CANDIDATES = ["/modules/", "/"];

  const MODULE_FILES = {
    music: "music.html",
    video: "video.html",
    cover: "cover.html",
    atmo: "atmosphere.html",
    cartoon: "child-cartoon.html",
    photofx: "photofx.html",
    dashboard: "dashboard.html",
    library: "library.html",
    invoices: "invoices.html",
    profile: "profile.html",
    settings: "settings.html",
  };

let __moduleLoadSeq = 0;
let __moduleLoadCtrl = null;
let __goSeq = 0;
const __moduleHtmlCache = new Map();

  // -------------------------------
  // URL HELPERS
  // -------------------------------
  function parseQueryRouteKey() {
    const sp = new URLSearchParams(location.search || "");
    const p = (sp.get("page") || "").trim();
    if (!p) return null;


    if (p === "atmosphere") return "atmo";
    if (p === "atm") return "atmo";
    if (p === "photofx") return "photofx";

    return p;
  }

  function hasHashKey() {
    return (location.hash || "").replace(/^#/, "").trim().length > 0;
  }

  // -------------------------------
  // HASH ROUTING
  // -------------------------------
  function parseHash() {
    const raw = (location.hash || "").replace(/^#/, "").trim();
    if (!raw) return { key: "music", params: {} };

    const [keyPart] = raw.split("?");
    let key = (keyPart || "music").trim();

 
    if (key === "atmosphere") key = "atmo";
    if (key === "atm") key = "atmo";
    if (key === "photofx") key = "photofx";

    if (!ROUTES.has(key)) key = "music";
    return { key, params: {} };
  }

  function setHash(key) {
    if (!ROUTES.has(key)) key = "music";
    const nextHash = `#${key}`;
    if (location.hash === nextHash) return;
    location.hash = nextHash;
  }

  function normalizeInitialRoute() {
    const qp = parseQueryRouteKey();
    if (qp && ROUTES.has(qp)) {
      setHash(qp);
      return;
    }

    if (hasHashKey()) return;

    setHash("music");
  }

  function setActiveNav(key) {
    document.querySelectorAll(".navBtn[data-route]").forEach((btn) => {
      const on = btn.dataset.route === key;
      btn.classList.toggle("active", on);
      btn.classList.toggle("is-active", on);
    });
  }

  async function fetchFirstOk(urls, signal) {
    let lastErr = null;

    for (const url of urls) {
      try {
      const r = await fetch(url, { signal });
        if (r.ok) return await r.text();
        lastErr = new Error("HTTP " + r.status);
      } catch (e) {
        if (e?.name === "AbortError") throw e;
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

    __moduleLoadSeq += 1;
    const seq = __moduleLoadSeq;

    try {
      __moduleLoadCtrl?.abort();
    } catch (_) {}

    __moduleLoadCtrl = new AbortController();

    const urls = MODULE_BASE_CANDIDATES.map((b) => b + file);

    host.setAttribute("data-loading-module", key);
    console.log("[ROUTER][LOAD] fetch:start", { key, seq, urls });

    let html = __moduleHtmlCache.get(key);

if (html) {
  console.log("[ROUTER][LOAD] cache:hit", {
    key,
    seq,
    htmlLength: (html || "").length
  });
} else {
  html = await fetchFirstOk(urls, __moduleLoadCtrl.signal);
  __moduleHtmlCache.set(key, html);
  console.log("[ROUTER][LOAD] fetch:done", {
    key,
    seq,
    htmlLength: (html || "").length
  });
}
    if (seq !== __moduleLoadSeq) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = html;

    const incomingRoot =
      wrap.querySelector("[data-module-root]") ||
      wrap.firstElementChild ||
      wrap.firstChild;

    if (!incomingRoot) {
      throw new Error("module html empty: " + key);
    }

    if (seq !== __moduleLoadSeq) return;
    console.log("[ROUTER][LOAD] mount:before", {
      key,
      seq,
      currentActive: host.getAttribute("data-active-module"),
      incomingTag: incomingRoot && incomingRoot.nodeName
    });

    host.replaceChildren(incomingRoot);
    host.setAttribute("data-active-module", key);
    host.removeAttribute("data-loading-module");
    console.log("[ROUTER][LOAD] mount:after", {
      key,
      seq,
      activeNow: host.getAttribute("data-active-module"),
      childCount: host.childNodes.length
    });
  }

  async function go(key) {
    if (!ROUTES.has(key)) key = "music";
    const host = document.getElementById("moduleHost");
    const activeKey = host?.getAttribute("data-active-module") || "";
    const loadingKey = host?.getAttribute("data-loading-module") || "";

    if (activeKey === key || loadingKey === key) {
      console.log("[ROUTER][GO] skip duplicate", { key, activeKey, loadingKey });
      setActiveNav(key);
      window.ensureModuleCSS?.(key);
      return;
    }

    const mySeq = ++__goSeq;

    const cur = parseHash();
    if (cur.key !== key) {
      setHash(key);
      return;
    }

    setActiveNav(key);
  await window.ensureModuleCSS?.(key);
    try {
      await loadModuleIntoHost(key);
    } catch (e) {
      if (e?.name === "AbortError") return;
      console.warn("[ROUTER] loadModuleIntoHost failed:", key, e);
      return;
    }

    if (mySeq !== __goSeq) return;

    const panelKey = RIGHT_PANEL_KEY[key] || "music";
    try {
      requestAnimationFrame(() => {
        setTimeout(() => {
          try {
            const hostNow = document.getElementById("moduleHost");
            const activeNow = hostNow?.getAttribute("data-active-module") || "";
            if (activeNow !== key) {
              console.log("[ROUTER] RightPanel.force skipped stale route", {
                key,
                activeNow,
                panelKey
              });
              return;
            }

            window.RightPanel?.force?.(panelKey, {});
          } catch (err) {
            console.warn("[ROUTER] RightPanel.force delayed failed:", panelKey, err);
          }
        }, 0);
      });
    } catch (e) {
      console.warn("[ROUTER] RightPanel.force failed:", panelKey, e);
    }
  }

  function onHashChange() {
    const { key } = parseHash();
    go(key);
  }

  function onNavClick(e) {
    const btn = e.target.closest(".navBtn");
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    const key = btn.dataset.route || "music";
    setHash(key);
  }

  window.StudioRouter = { go, setHash };

  window.addEventListener("hashchange", onHashChange);

  window.addEventListener("DOMContentLoaded", () => {
    const navRoot = document.getElementById("leftMenu") || document;

    if (!navRoot.__aivoRouterClickBound) {
      navRoot.__aivoRouterClickBound = true;
      navRoot.addEventListener("click", onNavClick, true);
    }

       const hadHash = hasHashKey();
    normalizeInitialRoute();
    if (hadHash) onHashChange();
  });
})();
