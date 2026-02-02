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
    const root = el(`
      <div class="rp-card">
        <div class="rp-card__header">
          <div class="rp-title">Profile</div>
          <div class="rp-subtitle">Plan / kredi / kullanıcı</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-section">
            <div class="rp-section__title">Plan</div>
            <div class="rp-row">
              <div class="rp-row__label">Paket</div>
              <div class="rp-row__value" data-val="plan">—</div>
            </div>
            <div class="rp-row">
              <div class="rp-row__label">Kredi</div>
              <div class="rp-row__value" data-val="credits">—</div>
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Kısayollar</div>
            <div class="rp-actions">
              <button class="rp-btn" data-act="buy-credits">Kredi Satın Al</button>
              <button class="rp-btn rp-btn--ghost" data-act="go-invoices">Invoices</button>
            </div>
          </div>

          <div class="rp-hint">
            “Kredi Satın Al” şu an event fırlatır; gerçek satın alma akışına bağlanacak.
          </div>
        </div>
      </div>
    `);

    root.querySelector('[data-val="plan"]').textContent = (ctx && ctx.planName) ? String(ctx.planName) : "—";
    root.querySelector('[data-val="credits"]').textContent = (ctx && ctx.credits != null) ? String(ctx.credits) : "—";

    function onClick(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");

      if (act === "buy-credits") {
        window.dispatchEvent(new CustomEvent("studio:buy_credits"));
        return;
      }

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
    console.warn("[panel.profile] RightPanel not ready; register skipped");
    return;
  }

  window.RightPanel.register(KEY, { mount, destroy });
})();
