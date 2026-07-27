(function () {
  "use strict";

  const KEY = "invoices";

  function currentLanguage() {
    const raw = String(
      window.AIVO_LANG ||
      document.documentElement.lang ||
      "tr"
    ).trim().toLowerCase();

    return raw.indexOf("en") === 0 ? "en" : "tr";
  }

  function invoiceText(key, trFallback, enFallback, parameters) {
    const fallback = currentLanguage() === "en" ? enFallback : trFallback;

    try {
      if (
        window.AIVO_STUDIO_I18N &&
        typeof window.AIVO_STUDIO_I18N.translate === "function"
      ) {
        const translated = window.AIVO_STUDIO_I18N.translate(
          key,
          fallback,
          parameters
        );

        if (translated && translated !== key) {
          return translated;
        }
      }

      if (
        window.AIVO_STUDIO_I18N &&
        typeof window.AIVO_STUDIO_I18N.t === "function"
      ) {
        const translated = window.AIVO_STUDIO_I18N.t(
          key,
          fallback,
          parameters
        );

        if (translated && translated !== key) {
          return translated;
        }
      }

      if (typeof window.t === "function") {
        const translated = window.t(key, parameters);

        if (translated && translated !== key) {
          return translated;
        }
      }
    } catch (_) {}

    return fallback;
  }

  function el(html) {
    const template = document.createElement("template");
    template.innerHTML = html.trim();
    return template.content.firstElementChild;
  }

  function getHeader() {
    return {
      title: invoiceText(
        "studio.invoices.panel.title",
        "Faturalarım",
        "My Invoices"
      ),
      meta: invoiceText(
        "studio.invoices.panel.meta",
        "Faturalama özeti",
        "Billing summary"
      ),
      searchEnabled: false,
      resetSearch: true
    };
  }

  function buildPanel() {
    return el(`
      <div class="rp-card">
        <div class="rp-card__header">
          <div class="rp-title">${invoiceText(
            "studio.invoices.panel.title",
            "Faturalarım",
            "My Invoices"
          )}</div>

          <div class="rp-subtitle">${invoiceText(
            "studio.invoices.panel.subtitle",
            "Faturalama özeti ve hızlı erişim",
            "Billing summary and quick access"
          )}</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-section">
            <div class="rp-section__title">${invoiceText(
              "studio.invoices.panel.tips",
              "İpuçları",
              "Tips"
            )}</div>

            <ul class="rp-list">
              <li>${invoiceText(
                "studio.invoices.panel.tip.list",
                "Fatura detayları orta panelde listelenir.",
                "Invoice details are listed in the main panel."
              )}</li>

              <li>${invoiceText(
                "studio.invoices.panel.tip.records",
                "Satın alım ve iade kayıtları orta alandaki kartlarda görüntülenir.",
                "Purchase and refund records are shown on the cards in the main area."
              )}</li>

              <li>${invoiceText(
                "studio.invoices.panel.tip.documents",
                "Belge açma ve inceleme işlemleri orta panel üzerinden yapılır.",
                "Documents can be opened and reviewed from the main panel."
              )}</li>
            </ul>
          </div>
        </div>
      </div>
    `);
  }

  function render(host) {
    if (!host) return;
    host.replaceChildren(buildPanel());
  }

  function refreshHeader() {
    try {
      const rp = window.RightPanel;

      if (
        rp &&
        typeof rp.getCurrentKey === "function" &&
        rp.getCurrentKey() === KEY &&
        typeof rp.setHeader === "function"
      ) {
        rp.setHeader(getHeader());
      }
    } catch (_) {}
  }

  function mount(host) {
    let destroyed = false;

    function onLanguageChange() {
      if (destroyed || !host || !host.isConnected) return;
      render(host);
      refreshHeader();
    }

    render(host);

    document.addEventListener("aivo:language-change", onLanguageChange);
    window.addEventListener("aivo:languagechange", onLanguageChange);
    window.addEventListener("aivo:i18n:changed", onLanguageChange);

    host._cleanup = function () {
      destroyed = true;
      document.removeEventListener("aivo:language-change", onLanguageChange);
      window.removeEventListener("aivo:languagechange", onLanguageChange);
      window.removeEventListener("aivo:i18n:changed", onLanguageChange);
    };

    return function unmount() {
      destroy(host);
    };
  }

  function destroy(host) {
    if (host && typeof host._cleanup === "function") {
      host._cleanup();
      host._cleanup = null;
    }

    if (host) {
      host.innerHTML = "";
    }
  }

  function registerWhenReady() {
    const rp = window.RightPanel;

    if (rp && typeof rp.register === "function") {
      rp.register(KEY, {
        getHeader,
        mount,
        destroy
      });

      console.log("[panel.invoices] registered");
      return true;
    }

    return false;
  }

  if (registerWhenReady()) return;

  const startedAt = Date.now();
  const timer = window.setInterval(function () {
    if (registerWhenReady()) {
      window.clearInterval(timer);
      return;
    }

    if (Date.now() - startedAt > 8000) {
      window.clearInterval(timer);
      console.warn("[panel.invoices] RightPanel not ready after 8s; giving up");
    }
  }, 50);
})();
