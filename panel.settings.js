// /panel.settings.js
(function () {
  const KEY = "settings";
  const ACTIVE_TAB_KEY = "aivo_settings_active_tab_v1";

  const TAB_CONTENT = {
    notifications: {
      title: ["studio.settings.panel.notifications.title", "Bildirimler"],
      subtitle: ["studio.settings.panel.notifications.subtitle", "Bildirim tercihleri ve bilgilendirme akışı"],
      bullets: [
        ["studio.settings.panel.notifications.bullet1", "E-posta bildirimleri üretim, kredi ve kampanya akışını kontrol eder."],
        ["studio.settings.panel.notifications.bullet2", "Tarayıcı bildirimi tarafı şu an MVP/stub davranışında olabilir."],
        ["studio.settings.panel.notifications.bullet3", "Gerçek kayıt işlemi orta paneldeki Ayarları Kaydet aksiyonuyla yapılır."]
      ],
      hint: ["studio.settings.panel.notifications.hint", "Öncelik: hangi bildirimlerin gerçekten gerekli olduğunu sade tutmak."]
    },
    music: {
      title: ["studio.settings.panel.music.title", "Müzik"],
      subtitle: ["studio.settings.panel.music.subtitle", "Kalite, otomatik çalma ve ses seviyesi tercihleri"],
      bullets: [
        ["studio.settings.panel.music.bullet1", "Varsayılan kalite üretim ve indirme deneyimini etkiler."],
        ["studio.settings.panel.music.bullet2", "Otomatik çalma player davranışını açılış sonrası etkiler."],
        ["studio.settings.panel.music.bullet3", "Ses seviyesi etiketi range input ile senkron çalışmalıdır."]
      ],
      hint: ["studio.settings.panel.music.hint", "Öncelik: kalite + autoplay + volume üçlüsünün birlikte tutarlı kalması."]
    },
    privacy: {
      title: ["studio.settings.panel.privacy.title", "Gizlilik"],
      subtitle: ["studio.settings.panel.privacy.subtitle", "Profil görünürlüğü ve veri paylaşım tercihleri"],
      bullets: [
        ["studio.settings.panel.privacy.bullet1", "Profil görünürlüğü herkese açık veya özel olarak saklanır."],
        ["studio.settings.panel.privacy.bullet2", "Aktivite paylaşımı profil üzerinde üretim görünürlüğünü etkiler."],
        ["studio.settings.panel.privacy.bullet3", "Anonim veri toplama uygulama geliştirme için ayrı bir tercihtir."]
      ],
      hint: ["studio.settings.panel.privacy.hint", "Öncelik: görünürlük ve anonim veri tercihlerini birbirine karıştırmamak."]
    },
    security: {
      title: ["studio.settings.panel.security.title", "Hesap & Güvenlik"],
      subtitle: ["studio.settings.panel.security.subtitle", "Oturum süresi ve güvenlik tercihleri"],
      bullets: [
        ["studio.settings.panel.security.bullet1", "Oturum süresi seçimi local state tarafında tutuluyor."],
        ["studio.settings.panel.security.bullet2", "2FA alanı şu an hazırlık/stub aşamasında olabilir."],
        ["studio.settings.panel.security.bullet3", "Security idle timeout akışı eski owner’dan taşınacak parçalardan biridir."]
      ],
      hint: ["studio.settings.panel.security.hint", "Öncelik: session timeout davranışını yeni owner yapısında netleştirmek."]
    },
    data: {
      title: ["studio.settings.panel.data.title", "Veri Hakları"],
      subtitle: ["studio.settings.panel.data.subtitle", "Veri indirme, düzeltme ve silme talepleri"],
      bullets: [
        ["studio.settings.panel.data.bullet1", "Veri indirme alanı export formatı seçimiyle birlikte çalışır."],
        ["studio.settings.panel.data.bullet2", "Düzeltme talebi textarea içeriği local state içinde tutulur."],
        ["studio.settings.panel.data.bullet3", "Silme talebi onayı ayrı bir güvenlik adımı olarak ele alınır."]
      ],
      hint: ["studio.settings.panel.data.hint", "Öncelik: export / rectification / delete alanlarının pane sınırını bozmamak."]
    }
  };

  function t(key, fallback) {
    try {
      if (window.AIVO_STUDIO_I18N && typeof window.AIVO_STUDIO_I18N.t === "function") {
        const value = window.AIVO_STUDIO_I18N.t(key, fallback);
        if (value && value !== key) return value;
      }
    } catch (_) {}

    try {
      if (typeof window.studioT === "function") {
        const value = window.studioT(key, fallback);
        if (value && value !== key) return value;
      }
    } catch (_) {}

    try {
      if (typeof window.t === "function") {
        const value = window.t(key);
        if (value && value !== key) return value;
      }
    } catch (_) {}

    return fallback;
  }

  function text(entry) {
    return t(entry[0], entry[1]);
  }

  function el(html) {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function getActiveTab() {
    try {
      return String(localStorage.getItem(ACTIVE_TAB_KEY) || "notifications").trim().toLowerCase();
    } catch (_) {
      return "notifications";
    }
  }

  function getTabModel() {
    const key = getActiveTab();
    const model = TAB_CONTENT[key] || TAB_CONTENT.notifications;

    return {
      title: text(model.title),
      subtitle: text(model.subtitle),
      bullets: model.bullets.map(text),
      hint: text(model.hint)
    };
  }

   function getHeader() {
    return {
      title: t(
        "studio.settings.panel.title",
        "Ayarlar"
      ),
      meta: "",
      searchEnabled: false,
      resetSearch: true
    };
  }

  function renderBody() {
    const model = getTabModel();

    return `
      <div class="rp-card">
        <div class="rp-card__header">
          <div class="rp-title">${t("studio.settings.panel.title", "Ayarlar")}</div>
          <div class="rp-subtitle">${t("studio.settings.panel.subtitle", "Bağlamsal yardım ve kısa bilgiler")}</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-section">
            <div class="rp-section__title">${t("studio.settings.panel.activeCategory", "Aktif kategori")}</div>
            <div class="rp-hint">
              <strong>${model.title}</strong><br>
              ${model.subtitle}
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">${t("studio.settings.panel.quickNotes", "Kısa Notlar")}</div>
            <ul class="rp-list">
              <li>${model.bullets[0]}</li>
              <li>${model.bullets[1]}</li>
              <li>${model.bullets[2]}</li>
            </ul>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">${t("studio.settings.panel.helperNote", "Yardımcı Not")}</div>
            <div class="rp-hint">
              ${model.hint}
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">${t("studio.settings.panel.panelNote", "Panel Notu")}</div>
            <div class="rp-hint">
              ${t("studio.settings.panel.panelNoteText", "Bu alan yalnızca aktif ayar sekmesi için özet ve yardımcı bilgi gösterir.")}
            </div>
          </div>

          <div class="rp-hint">
            ${t("studio.settings.panel.footer", "Bu sağ panel özet ve yönlendirme alanıdır. Form alanlarının sahibi orta paneldir.")}
          </div>
        </div>
      </div>
    `;
  }

  function mount(
    host,
    ctx = {},
    panelApi = {}
  ) {
    host.innerHTML = "";
    host.appendChild(el(renderBody()));

    function syncHeader() {
      if (
        panelApi &&
        typeof panelApi.setHeader === "function"
      ) {
        panelApi.setHeader(
          getHeader()
        );
      }
    }

    function onClick(e) {
      const btn = e.target.closest("[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      window.dispatchEvent(new CustomEvent("studio:navigate", { detail: { to: act } }));
    }

    function rerender() {
      const next = el(renderBody());
      const prev = host.firstElementChild;
      if (prev) prev.removeEventListener("click", onClick);
      host.innerHTML = "";
      next.addEventListener("click", onClick);
      host.appendChild(next);
    }

    function onStorage(e) {
      if (e && e.key && e.key !== ACTIVE_TAB_KEY) return;
      rerender();
    }

    function onTabChanged() {
      rerender();
    }

    function onLanguageChanged() {
      syncHeader();
      rerender();
    }

    syncHeader();

    const root = host.firstElementChild;
    root.addEventListener("click", onClick);

    window.addEventListener("storage", onStorage);
    window.addEventListener("settings:tab-changed", onTabChanged);
    document.addEventListener("aivo:language-change", onLanguageChanged);
    window.addEventListener("aivo:languagechange", onLanguageChanged);
    window.addEventListener("aivo:i18n:changed", onLanguageChanged);
    document.addEventListener("aivo:studio:i18n-applied", onLanguageChanged);

    host._cleanup = () => {
      const current = host.firstElementChild;
      if (current) current.removeEventListener("click", onClick);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("settings:tab-changed", onTabChanged);
      document.removeEventListener("aivo:language-change", onLanguageChanged);
      window.removeEventListener("aivo:languagechange", onLanguageChanged);
      window.removeEventListener("aivo:i18n:changed", onLanguageChanged);
      document.removeEventListener("aivo:studio:i18n-applied", onLanguageChanged);
    };

    return () => destroy(host);
  }

  function destroy(host) {
    if (host && host._cleanup) host._cleanup();
    if (host) host.innerHTML = "";
  }

  if (!window.RightPanel || typeof window.RightPanel.register !== "function") {
    console.warn("[panel.settings] RightPanel not ready; register skipped");
    return;
  }

  window.RightPanel.register(
    KEY,
    {
      mount,
      destroy,
      getHeader
    }
  );
})();
