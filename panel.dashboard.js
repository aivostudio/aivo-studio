// /panel.dashboard.js
(function () {
  const KEY = "dashboard";

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
          <div class="rp-title">Dashboard</div>
          <div class="rp-subtitle">Kısa özet</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-kpi">
            <div class="rp-kpi__item">
              <div class="rp-kpi__label">Krediler</div>
              <div class="rp-kpi__value" data-kpi="credits">—</div>
            </div>
            <div class="rp-kpi__item">
              <div class="rp-kpi__label">Son işler</div>
              <div class="rp-kpi__value" data-kpi="jobs">—</div>
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Hızlı aksiyonlar</div>
            <div class="rp-actions">
              <button class="rp-btn" data-act="go-library">Kütüphaneyi Aç</button>
              <button class="rp-btn" data-act="go-invoices">Faturalar</button>
            </div>
          </div>

          <div class="rp-hint">
            Bu panel şimdilik stub. /api/jobs/status ve credits verisi bağlanınca gerçek dashboard olacak.
          </div>
        </div>
      </div>
    `);

    // Basit örnek: ctx üzerinden KPI bas
    const credits = (ctx && ctx.credits) ?? null;
    const jobs = (ctx && ctx.jobsCount) ?? null;
    root.querySelector('[data-kpi="credits"]').textContent = credits == null ? "—" : String(credits);
    root.querySelector('[data-kpi="jobs"]').textContent = jobs == null ? "—" : String(jobs);

    function onClick(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");

      // Router entegrasyonu yoksa şimdilik sadece event atıyoruz:
      window.dispatchEvent(new CustomEvent("studio:navigate", { detail: { to: act } }));
    }

    root.addEventListener("click", onClick);
    root._cleanup = () => root.removeEventListener("click", onClick);

    host.appendChild(root);
    return () => destroy(host);
  }

  function destroy(host) {
    // listener cleanup
    const root = host && host.firstElementChild;
    if (root && root._cleanup) root._cleanup();
    if (host) host.innerHTML = "";
  }

  if (!window.RightPanel || typeof window.RightPanel.register !== "function") {
    console.warn("[panel.dashboard] RightPanel not ready; register skipped");
    return;
  }

  window.RightPanel.register(KEY, { mount, destroy });
})();
