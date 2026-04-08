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
          <div class="rp-title">Ayarlar</div>
          <div class="rp-subtitle">Bağlamsal yardım ve kısa bilgiler</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-section">
            <div class="rp-section__title">Bu panel ne işe yarar?</div>
            <ul class="rp-list">
              <li>Orta panelde açık olan ayar kategorisine yardımcı olur.</li>
              <li>Ayarların kopyasını göstermez; kısa açıklama ve yönlendirme sunar.</li>
              <li>Gerçek değişiklik ve kayıt işlemi orta panelden yapılır.</li>
            </ul>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Aktif kategori</div>
            <div class="rp-hint">
              Bildirimler, Müzik, Gizlilik, Hesap & Güvenlik ve Veri Hakları sekmelerine göre bu alan daha sonra dinamik içerik gösterecek.
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Kısayollar</div>
            <div class="rp-actions">
              <button class="rp-btn rp-btn--ghost" data-act="go-profile">Profile Git</button>
              <button class="rp-btn rp-btn--ghost" data-act="go-dashboard">Dashboard’a Git</button>
            </div>
          </div>

          <div class="rp-hint">
            Bu sağ panelin rolü: özet, ipucu ve bağlamsal yardım. Form alanlarının sahibi orta paneldir.
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
