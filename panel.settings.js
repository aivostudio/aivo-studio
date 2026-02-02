// /panel.settings.js
(function () {
  const KEY = "settings";

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
          <div class="rp-title">Settings</div>
          <div class="rp-subtitle">İpuçları ve hızlı kontroller</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-section">
            <div class="rp-section__title">Hızlı Notlar</div>
            <ul class="rp-list">
              <li>Outputs tek kaynaktan: <code>/api/jobs/status</code></li>
              <li>Global Player shell içinde; route değişse de playback devam eder</li>
              <li>Scroll yalnızca outputs alanında</li>
            </ul>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Kısayollar</div>
            <div class="rp-actions">
              <button class="rp-btn rp-btn--ghost" data-act="go-profile">Profile</button>
              <button class="rp-btn rp-btn--ghost" data-act="go-dashboard">Dashboard</button>
            </div>
          </div>

          <div class="rp-hint">
            Bu panel şimdilik stub. Gerçek ayarlar orta panelde yönetilecek.
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

  if (!window.RightPanel || typeof window.RightPanel.register !== "function") {
    console.warn("[panel.settings] RightPanel not ready; register skipped");
    return;
  }

  window.RightPanel.register(KEY, { mount, destroy });
})();
