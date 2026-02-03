// ===============================
// MODULE CSS LOADER (GLOBAL)
// ===============================
window.ensureModuleCSS = function(routeKey){
  const link = document.getElementById("studio-module-css");
  if(!link) return;

  const v = Date.now();
  const primary  = `/css/mod.${routeKey}.css?v=${v}`;
  const fallback = `/mod.${routeKey}.css?v=${v}`;

  // fallback'i 1 kez dene
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
    // ÜRET MODÜLLERİ
    "music",
    "recording", // ✅ NEW
    "video",
    "cover",
    "atmo",
    "social",
    "hook",

    // PANELLER
    "dashboard",
    "library",
    "invoices",
    "profile",
    "settings",
  ]);

  const MODULE_BASE_CANDIDATES = ["/modules/", "/"];

  const MODULE_FILES = {
    music: "music.html",
    recording: "recording.html", // ✅ NEW
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
        if (v === undefined || v === null || v === "") return;
        sp.set(k, String(v));
      });
    }
    const q = sp.toString();
    location.hash = q ? `#${key}?${q}` : `#${key}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setActiveNav(key) {
    document.querySelectorAll(".navBtn[data-route]").forEach((btn) => {
      const k = btn.getAttribute("data-route");
      const on = k === key;
      btn.classList.toggle("active", on);
      btn.classList.toggle("is-active", on);
    });
  }

  async function fetchFirstOk(urls) {
    let lastErr = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) return { url, html: await res.text() };
        lastErr = new Error("HTTP " + res.status);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("fetch failed");
  }

  // ✅ Route bazlı JS loader: /js/<route>.module.js
  async function ensureModuleJS(routeKey) {
    const id = "studio-module-js";
    let s = document.getElementById(id);
    if (!s) {
      s = document.createElement("script");
      s.id = id;
      s.defer = true;
      document.body.appendChild(s);
    }
    s.src = `/js/${routeKey}.module.js?v=` + Date.now();
  }

  async function loadModuleIntoHost(key) {
    const host = document.getElementById("moduleHost");
    if (!host) return;

    const file = MODULE_FILES[key];
    if (!file) {
      host.innerHTML = `
        <div class="placeholder">
          <div class="ph-title">${escapeHtml(key)} (placeholder)</div>
          <div class="ph-sub">Bu route için module HTML henüz bağlanmadı.</div>
        </div>
      `;
      host.removeAttribute("data-active-module");
      return;
    }

    // ✅ same module ise tekrar fetch etme
    const currentKey = host.getAttribute("data-active-module") || "";
    if (currentKey === key) return;

    const urlCandidates = MODULE_BASE_CANDIDATES.map((base) => base + file);

    try {
      const { html } = await fetchFirstOk(urlCandidates);
      host.innerHTML = html;
      host.setAttribute("data-active-module", key);
    } catch (e) {
      host.innerHTML = `
        <div class="placeholder">
          <div class="ph-title">Modül yüklenemedi</div>
          <div class="ph-sub">
            Denenenler:<br/>
            ${urlCandidates.map((u) => `<code>${escapeHtml(u)}</code>`).join("<br/>")}
          </div>
        </div>
      `;
      host.removeAttribute("data-active-module");
    }
  }

  async function go(key, params) {
    if (!ROUTES.has(key)) key = "music";
    params = params || {};

    const current = parseHash();
    const sameKey = current.key === key;

    // ✅ hash farklıysa sadece hash set (tek otorite)
    if (!sameKey) {
      setHash(key, params);
      return;
    }

    setActiveNav(key);

    // ✅ CSS
    window.ensureModuleCSS?.(key);

    // ✅ HTML
    await loadModuleIntoHost(key);

    // ✅ JS
    await ensureModuleJS(key);

    // ✅ Right panel (istersen recording’e özel key de verebilirsin)
    if (window.RightPanel?.force) {
      window.RightPanel.force(key, params);
    }
  }

  function onHashChange() {
    const { key, params } = parseHash();
    go(key, params);
  }

  function onNavClick(e) {
    const btn = e.target.closest(".navBtn");
    if (!btn) return;

    const key = btn.dataset.route || "music";

    // ✅ ARTIK TAB YOK. Recording ayrı route.
    // Nav click sadece hash set etsin:
    setHash(key, {});
  }

  window.StudioRouter = { go, setHash };

  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("DOMContentLoaded", function () {
    const leftMenu = document.getElementById("leftMenu") || document;
    leftMenu.addEventListener("click", onNavClick);
    onHashChange();
  });
})();
