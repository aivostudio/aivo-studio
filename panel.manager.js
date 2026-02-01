(function () {
  const registry = new Map();
  let current = { key: null, destroy: null };

  function getHost() {
    return document.getElementById("rightPanelHost");
  }

  function getJobsSafe() {
    const j = window.AIVO_JOBS;
    return Array.isArray(j) ? j : [];
  }

  function normalizeFactory(factoryOrPanel) {
    if (typeof factoryOrPanel === "function") return factoryOrPanel;

    if (factoryOrPanel && typeof factoryOrPanel.mount === "function") {
      return (host, ctx) => {
        factoryOrPanel.mount(host, ctx);
        return () => {
          try { factoryOrPanel.destroy?.(host, ctx); }
          catch (e) { console.error("[RightPanel] panel.destroy error:", e); }
        };
      };
    }

    console.warn("[RightPanel] invalid panel registration:", factoryOrPanel);
    return null;
  }

  function getPageKey() {
    // 1) BODY dataset aktif sayfa
    const ap = (document.body?.dataset?.activePage || "").toLowerCase();
    if (ap === "music") return "audio";
    if (ap === "recording") return "recording";
    if (ap === "video") return "video";
    if (ap === "cover") return "cover";
    if (ap) return ap;

    // 2) Aktif page class (.page.page-music.is-active vb.)
    const page = document.querySelector(".page.is-active");
    if (page) {
      if (page.classList.contains("page-music")) return "audio";
      if (page.classList.contains("page-recording")) return "recording";
      if (page.classList.contains("page-video")) return "video";
      if (page.classList.contains("page-cover")) return "cover";
    }

    // 3) data-page fallback (varsa)
    const el = document.querySelector("[data-page]");
    if (el?.dataset?.page) return (el.dataset.page || "").toLowerCase();

    // 4) URL fallback
    const h = ((location.hash || "") + " " + (location.pathname || "")).toLowerCase();
    if (h.includes("music") || h.includes("muzik")) return "audio";
    if (h.includes("record") || h.includes("ses")) return "recording";
    if (h.includes("video")) return "video";
    if (h.includes("cover") || h.includes("kapak")) return "cover";

    return "unknown";
  }

  function runDestroy(d) {
    if (!d) return;

    if (typeof d === "function") {
      try { d(); } catch (e) { console.error("[RightPanel] destroy() error:", e); }
      return;
    }

    if (typeof d.destroy === "function") {
      try { d.destroy(); } catch (e) { console.error("[RightPanel] destroy.destroy() error:", e); }
    }
  }

  function switchPanel(nextKey) {
    const host = getHost();
    if (!host) return;

    if (current.key === nextKey) return;

    runDestroy(current.destroy);
    host.innerHTML = "";

    const factory = registry.get(nextKey) || registry.get("unknown");

    if (!factory) {
      host.innerHTML =
        `<div style="padding:12px;color:#fff;opacity:.65;font-size:13px">
          Panel not registered: <b>${nextKey}</b>
        </div>`;
      current = { key: nextKey, destroy: null };
      return;
    }

    try {
      const destroy = factory(host, { jobs: getJobsSafe() });
      current = { key: nextKey, destroy };
    } catch (e) {
      console.error("[RightPanel] factory error for key:", nextKey, e);
      host.innerHTML =
        `<div style="padding:12px;color:#fff">
          Panel error: <b>${nextKey}</b><br/>
          <span style="opacity:.7;font-size:12px">Console'da [RightPanel] factory error log'una bak.</span>
        </div>`;
      current = { key: nextKey, destroy: null };
    }
  }

  window.RightPanel = {
    register(key, factoryOrPanel) {
      const f = normalizeFactory(factoryOrPanel);
      if (!f) return;
      registry.set(key, f);
    },
    refresh() { switchPanel(getPageKey()); },
    force(key) { switchPanel(key); },
    _debug: { registry, getPageKey }
  };

  window.addEventListener("hashchange", () => window.RightPanel.refresh());

  const mo = new MutationObserver((muts) => {
    // rightPanelHost içindeki DOM değişimleri refresh tetiklemesin (force() sonrası geri silmesin)
    if (muts.some(m => m.target && (m.target.id === "rightPanelHost" || m.target.closest?.("#rightPanelHost")))) return;
    window.RightPanel.refresh();
  });

  mo.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-page", "class", "data-active-page"]
  });

  window.RightPanel.refresh();
})();
