(function () {
  const host = document.getElementById("rightPanelHost");
  if (!host) return;

  const registry = new Map();
  let current = { key: null, destroy: null };

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

  function switchPanel(nextKey) {
    if (current.key === nextKey) return;

    // 1) destroy old (interval, listener, fetch abort vs.)
    if (typeof current.destroy === "function") {
      try { current.destroy(); } catch (e) {}
    }

    // 2) clear DOM
    host.innerHTML = "";

    // 3) mount new
    const factory = registry.get(nextKey) || registry.get("unknown");
    if (!factory) {
      current = { key: nextKey, destroy: null };
      return;
    }

    const destroy = factory(host, {
      jobs: window.AIVO_JOBS || [],
      // buraya gerekirse başka context koyarsınız
    });

    current = { key: nextKey, destroy };
  }

  window.RightPanel = {
    register(key, factory) { registry.set(key, factory); },
    refresh() { switchPanel(getPageKey()); },
    force(key) { switchPanel(key); },
  };

  // değişimleri yakala
  window.addEventListener("hashchange", () => window.RightPanel.refresh());
  const mo = new MutationObserver(() => window.RightPanel.refresh());
  mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-page"] });

  // ilk açılış
  window.RightPanel.refresh();
})();
