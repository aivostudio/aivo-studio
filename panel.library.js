// /panel.library.js
(function () {
  const KEY = "library";

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function mount(host, ctx = {}) {
    host.innerHTML = "";
    const root = el(`
      <div class="rp-card">
        <div class="rp-card__header">
          <div class="rp-title">Library</div>
          <div class="rp-subtitle">Son üretilenler / hızlı önizleme</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-section">
            <div class="rp-section__title">Önizleme</div>
            <div class="rp-preview">
              <div class="rp-preview__empty">Henüz bir seçim yok.</div>
              <button class="rp-btn rp-btn--ghost" data-act="pick-latest">Son işi seç</button>
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Kısayollar</div>
            <div class="rp-actions">
              <button class="rp-btn" data-act="go-music">Müzik Üret</button>
              <button class="rp-btn" data-act="go-video">Video Üret</button>
            </div>
          </div>

          <div class="rp-hint">
            Buraya /api/jobs/status ile “son işler listesi” ve “seçili item” bağlanacak.
          </div>
        </div>
      </div>
    `);

    function onClick(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      window.dispatchEvent(new CustomEvent("studio:navigate", { detail: { to: act } }));
    }

    root.addEventListener("click", onClick);
    root._cleanup = () => root.removeEventListener("click", onClick);

    host.appendChild(root);
    return () => destroy(host);
  }

  function destroy(host) {
    const root = host && host.firstElementChild;
    if (root && root._cleanup) root._cleanup();
    if (host) host.innerHTML = "";
  }

function registerWhenReady() {
  const rp = window.RightPanel;
  if (rp && typeof rp.register === "function") {
    rp.register(KEY, {
      getHeader() {
        return {
          title: "Ürettiklerim",
          meta: "Son üretilenler",
          searchEnabled: false,
          resetSearch: true
        };
      },
      mount,
      destroy
    });
    console.log("[panel.library] registered");
    return true;
  }
  return false;
}

if (registerWhenReady()) return;

const t0 = Date.now();
const timer = setInterval(() => {
  if (registerWhenReady()) {
    clearInterval(timer);
    return;
  }
  if (Date.now() - t0 > 8000) {
    clearInterval(timer);
    console.warn("[panel.library] RightPanel not ready after 8s; giving up");
  }
}, 50);
})();
