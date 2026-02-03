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
    console.warn("[ensureModuleCSS] fallback:", fallback);
    link.href = fallback;
  };

  link.href = primary;
};

// ===============================
// ROUTER
// ===============================
(function () {
  // ✅ SADECE GERÇEK VE KULLANILAN ROUTE’LAR
  const ROUTES = new Set([
    // ÜRET MODÜLLERİ
    "music",
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

  // /modules varsa onu kullan, yoksa root’tan yükle
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

  async function loadModuleIntoHost(key, params) {
    const host = document.getElementById("moduleHost");
    if (!host) return;

    if (key === "music" && params && params.tab) {
      window.__AIVO_MUSIC_TAB__ = params.tab;
    } else if (key === "music") {
      window.__AIVO_MUSIC_TAB__ = null;
    }

    const file = MODULE_FILES[key];
    if (!file) {
      host.innerHTML = `
        <div class="placeholder">
          <div class="ph-title">${escapeHtml(key)} (placeholder)</div>
          <div class="ph-sub">Bu route için module HTML henüz bağlanmadı.</div>
        </div>
      `;
      return;
    }

    const urlCandidates = MODULE_BASE_CANDIDATES.map((base) => base + file);

    try {
      const { html } = await fetchFirstOk(urlCandidates);
      host.innerHTML = html;
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
    }
  }

  async function go(key, params) {
    if (!ROUTES.has(key)) key = "music";

    const current = parseHash();
    const sameKey = current.key === key;
    const sameTab =
      ((current.params && current.params.tab) || "") ===
      ((params && params.tab) || "");

    if (!sameKey || !sameTab) {
      setHash(key, params);
      return;
    }

    setActiveNav(key);

    // ✅ MODULE CSS BURADA
    if (typeof window.ensureModuleCSS === "function") {
      window.ensureModuleCSS(key);
    }

    await loadModuleIntoHost(key, params);

    if (window.RightPanel && typeof window.RightPanel.force === "function") {
      if (key === "music") {
        window.RightPanel.force("music", { tab: params && params.tab });
      } else {
        window.RightPanel.force(key, params);
      }
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
    const tab = btn.dataset.musicTab;

    const params = {};
    if (key === "music" && tab) params.tab = tab;

    go(key, params);
  }

  window.StudioRouter = { go };

  window.addEventListener("hashchange", onHashChange);
  window.addEventListener("DOMContentLoaded", function () {
    const leftMenu = document.getElementById("leftMenu") || document;
    leftMenu.addEventListener("click", onNavClick);
    onHashChange();
  });
})();
