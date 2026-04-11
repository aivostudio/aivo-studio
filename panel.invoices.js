(function () {
  const KEY = "invoices";

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function mount(host) {
    host.innerHTML = "";

    const root = el(`
      <div class="rp-card">
        <div class="rp-card__header">
          <div class="rp-title">Faturalarım</div>
          <div class="rp-subtitle">Faturalama özeti ve hızlı erişim</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-section">
            <div class="rp-section__title">İpuçları</div>
            <ul class="rp-list">
              <li>Fatura detayları orta panelde listelenir.</li>
              <li>Satın alım ve iade kayıtları orta alandaki kartlarda görüntülenir.</li>
              <li>Belge açma ve inceleme işlemleri orta panel üzerinden yapılır.</li>
            </ul>
          </div>
        </div>
      </div>
    `);

    host.appendChild(root);
    return () => destroy(host);
  }

  function destroy(host) {
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
