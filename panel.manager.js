(function () {
  const registry = new Map();
  let current = { key: null, destroy: null };

  function getHost() {
    return document.getElementById("rightPanelHost");
  }

  function getJobsSafe() {
    // AIVO_JOBS array değilse (senin notlarında upsert objesi), burada [] döner
    const j = window.AIVO_JOBS;
    return Array.isArray(j) ? j : [];
  }

  function normalizeFactory(factoryOrPanel) {
    // 1) Zaten function ise dokunma
    if (typeof factoryOrPanel === "function") return factoryOrPanel;

    // 2) Object panel: { mount(host, ctx), destroy?(host, ctx) }
    if (factoryOrPanel && typeof factoryOrPanel.mount === "function") {
      return (host, ctx) => {
        // mount
        factoryOrPanel.mount(host, ctx);

        // destroy handle: function veya instance-like object döndür
        return () => {
          try {
            factoryOrPanel.destroy?.(host, ctx);
          } catch (e) {
            console.error("[RightPanel] panel.destroy error:", e);
          }
        };
      };
    }

    console.warn("[RightPanel] invalid panel registration:", factoryOrPanel);
    return null;
  }

  function getPageKey() {
    // En sağlam yöntem: root container'a data-page koyun
    // ör: <div id="pageRoot" data-page="audio"></div>
    const el = document.querySelector("[data-page]");
    if (el?.dataset?.page) return el.dataset.page;

    // fallback: URL hash / path (siz nasıl nav yapıyorsanız)
    const h = (location.hash || "").toLowerCase();
    if (h.includes("muzik")) return "audio";
    if (h.includes("ses")) return "recording";
    if (h.includes("video")) return "video";
    if (h.includes("kapak")) return "cover";
    return "unknown";
  }

  function runDestroy(d) {
    if (!d) return;

    // destroy function
    if (typeof d === "function") {
      try { d(); } catch (e) { console.error("[RightPanel] destroy() error:", e); }
      return;
    }

    // destroy object { destroy(){} }
    if (typeof d.destroy === "function") {
      try { d.destroy(); } catch (e) { console.error("[RightPanel] destroy.destroy() error:", e); }
    }
  }

  function switchPanel(nextKey) {
    const host = getHost();
    if (!host) return;

    if (current.key === nextKey) return;

    // 1) destroy old (interval, listener, fetch abort vs.)
    runDestroy(current.destroy);

    // 2) clear DOM
    host.innerHTML = "";

    // 3) mount new
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
      const destroy = factory(host, {
        jobs: getJobsSafe(),
        // buraya gerekirse başka context koyarsınız
      });

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
    // debug için (istersen sonra sil)
    _debug: { registry, getPageKey }
  };

  // değişimleri yakala
  window.addEventListener("hashchange", () => window.RightPanel.refresh());

  // data-page / class değişimleri SPA'de sık oluyor; ikisini de izle
  const mo = new MutationObserver(() => window.RightPanel.refresh());
  mo.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-page", "class"]
  });

  // ilk açılış
  window.RightPanel.refresh();
})();
