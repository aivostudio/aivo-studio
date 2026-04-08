// /panel.profile.js
(function () {
  const KEY = "profile";

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function mount(host, ctx = {}) {
    host.innerHTML = "";

    const profileName =
      (ctx && ctx.name != null && String(ctx.name).trim()) ||
      "Harun";

    const profileMail =
      (ctx && ctx.email != null && String(ctx.email).trim()) ||
      "harun@example.com";

    const totalCredits =
      (ctx && ctx.credits != null && String(ctx.credits).trim()) ||
      "31";

    const spentCredits =
      (ctx && ctx.spentCredits != null && String(ctx.spentCredits).trim()) ||
      "1825";

    const root = el(`
      <div class="rp-card">
        <div class="rp-card__header">
          <div class="rp-title">Profil</div>
          <div class="rp-subtitle">Hesap özeti</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-section">
            <div class="rp-section__title">Hesap</div>
            <div class="rp-row">
              <div class="rp-row__label">Kullanıcı</div>
              <div class="rp-row__value" data-val="name">—</div>
            </div>
            <div class="rp-row">
              <div class="rp-row__label">E-posta</div>
              <div class="rp-row__value" data-val="email">—</div>
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Krediler</div>
            <div class="rp-metric-grid">
              <div class="rp-metric">
                <div class="rp-metric__label">Toplam</div>
                <div class="rp-metric__value" data-val="credits">—</div>
              </div>
              <div class="rp-metric">
                <div class="rp-metric__label">Harcanan</div>
                <div class="rp-metric__value" data-val="spent">—</div>
              </div>
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Kısayollar</div>
            <div class="rp-actions">
              <button class="rp-btn" type="button" data-act="buy-credits">Kredi Satın Al</button>
              <button class="rp-btn rp-btn--ghost" type="button" data-act="go-library">Ürettiklerim</button>
            </div>
          </div>

          <div class="rp-hint">
            Profil özeti ve hızlı erişim bu panelde gösterilir.
          </div>
        </div>
      </div>
    `);

    root.querySelector('[data-val="name"]').textContent = profileName;
    root.querySelector('[data-val="email"]').textContent = profileMail;
    root.querySelector('[data-val="credits"]').textContent = totalCredits;
    root.querySelector('[data-val="spent"]').textContent = spentCredits;

    function onClick(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;

      const act = btn.getAttribute("data-act");

      if (act === "buy-credits") {
        window.location.href = "/fiyatlandirma.html#packs";
        return;
      }

      if (act === "go-library") {
        if (window.StudioRouter && typeof window.StudioRouter.setHash === "function") {
          window.StudioRouter.setHash("library");
          return;
        }
        window.location.hash = "#library";
      }
    }

    root.addEventListener("click", onClick);
    root._cleanup = () => root.removeEventListener("click", onClick);

    host.appendChild(root);
    return function unmount() {
      destroy(host);
    };
  }

  function destroy(host) {
    const root = host && host.firstElementChild;
    if (root && root._cleanup) root._cleanup();
    if (host) host.innerHTML = "";
  }

  if (!window.RightPanel || typeof window.RightPanel.register !== "function") {
    console.warn("[panel.profile] RightPanel not ready; register skipped");
    return;
  }

  window.RightPanel.register(KEY, { mount, destroy });
})();
