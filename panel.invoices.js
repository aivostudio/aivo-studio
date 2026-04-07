// /panel.invoices.js
(function () {
  const KEY = "invoices";

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
          <div class="rp-title">Faturalarım</div>
          <div class="rp-subtitle">Faturalama özeti ve hızlı erişim</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-kpi">
            <div class="rp-kpi__item">
              <div class="rp-kpi__label">Bu ay</div>
              <div class="rp-kpi__value" data-kpi="month">—</div>
            </div>
            <div class="rp-kpi__item">
              <div class="rp-kpi__label">Toplam</div>
              <div class="rp-kpi__value" data-kpi="total">—</div>
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">İpuçları</div>
            <ul class="rp-list">
              <li>Fatura detayları orta panelde listelenir.</li>
              <li>Her satın alım için tarih, paket ve tutar bilgisi burada gösterilir.</li>
            </ul>
          </div>

          <div class="rp-actions">
            <button class="rp-btn rp-btn--ghost" data-act="profile">Profil</button>
            <button class="rp-btn rp-btn--ghost" data-act="settings">Ayarlar</button>
          </div>
        </div>
      </div>
    `);

    const month = (ctx && ctx.monthSpend) ?? null;
    const total = (ctx && ctx.totalSpend) ?? null;

    root.querySelector('[data-kpi="month"]').textContent =
      month == null ? "—" : String(month);

    root.querySelector('[data-kpi="total"]').textContent =
      total == null ? "—" : String(total);

    function onClick(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      window.dispatchEvent(
        new CustomEvent("studio:navigate", { detail: { to: act } })
      );
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
            title: "Faturalarım",
            meta: "Faturalama özeti",
            searchEnabled: false,
            resetSearch: true
          };
        },
        mount,
        destroy
      });
      console.log("[panel.invoices] registered");
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
      console.warn("[panel.invoices] RightPanel not ready after 8s; giving up");
    }
  }, 50);
})();
