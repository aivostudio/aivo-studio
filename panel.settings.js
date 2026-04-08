// /panel.settings.js
(function () {
  const KEY = "settings";
  const ACTIVE_TAB_KEY = "aivo_settings_active_tab_v1";

  const TAB_CONTENT = {
    notifications: {
      title: "Bildirimler",
      subtitle: "Bildirim tercihleri ve bilgilendirme akışı",
      bullets: [
        "E-posta bildirimleri üretim, kredi ve kampanya akışını kontrol eder.",
        "Tarayıcı bildirimi tarafı şu an MVP/stub davranışında olabilir.",
        "Gerçek kayıt işlemi orta paneldeki Ayarları Kaydet aksiyonuyla yapılır."
      ],
      hint: "Öncelik: hangi bildirimlerin gerçekten gerekli olduğunu sade tutmak."
    },
    music: {
      title: "Müzik",
      subtitle: "Kalite, otomatik çalma ve ses seviyesi tercihleri",
      bullets: [
        "Varsayılan kalite üretim ve indirme deneyimini etkiler.",
        "Otomatik çalma player davranışını açılış sonrası etkiler.",
        "Ses seviyesi etiketi range input ile senkron çalışmalıdır."
      ],
      hint: "Öncelik: kalite + autoplay + volume üçlüsünün birlikte tutarlı kalması."
    },
    privacy: {
      title: "Gizlilik",
      subtitle: "Profil görünürlüğü ve veri paylaşım tercihleri",
      bullets: [
        "Profil görünürlüğü herkese açık veya özel olarak saklanır.",
        "Aktivite paylaşımı profil üzerinde üretim görünürlüğünü etkiler.",
        "Anonim veri toplama uygulama geliştirme için ayrı bir tercihtir."
      ],
      hint: "Öncelik: görünürlük ve anonim veri tercihlerini birbirine karıştırmamak."
    },
    security: {
      title: "Hesap & Güvenlik",
      subtitle: "Oturum süresi ve güvenlik tercihleri",
      bullets: [
        "Oturum süresi seçimi local state tarafında tutuluyor.",
        "2FA alanı şu an hazırlık/stub aşamasında olabilir.",
        "Security idle timeout akışı eski owner’dan taşınacak parçalardan biridir."
      ],
      hint: "Öncelik: session timeout davranışını yeni owner yapısında netleştirmek."
    },
    data: {
      title: "Veri Hakları",
      subtitle: "Veri indirme, düzeltme ve silme talepleri",
      bullets: [
        "Veri indirme alanı export formatı seçimiyle birlikte çalışır.",
        "Düzeltme talebi textarea içeriği local state içinde tutulur.",
        "Silme talebi onayı ayrı bir güvenlik adımı olarak ele alınır."
      ],
      hint: "Öncelik: export / rectification / delete alanlarının pane sınırını bozmamak."
    }
  };

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
    return TAB_CONTENT[key] || TAB_CONTENT.notifications;
  }

  function renderBody() {
    const model = getTabModel();

    return `
      <div class="rp-card">
        <div class="rp-card__header">
          <div class="rp-title">Ayarlar</div>
          <div class="rp-subtitle">Bağlamsal yardım ve kısa bilgiler</div>
        </div>

        <div class="rp-card__body">
          <div class="rp-section">
            <div class="rp-section__title">Aktif kategori</div>
            <div class="rp-hint">
              <strong>${model.title}</strong><br>
              ${model.subtitle}
            </div>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Kısa Notlar</div>
            <ul class="rp-list">
              <li>${model.bullets[0]}</li>
              <li>${model.bullets[1]}</li>
              <li>${model.bullets[2]}</li>
            </ul>
          </div>

          <div class="rp-section">
            <div class="rp-section__title">Yardımcı Not</div>
            <div class="rp-hint">
              ${model.hint}
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
            Bu sağ panel özet ve yönlendirme alanıdır. Form alanlarının sahibi orta paneldir.
          </div>
        </div>
      </div>
    `;
  }

  function mount(host, ctx = {}) {
    host.innerHTML = "";
    host.appendChild(el(renderBody()));

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

    const root = host.firstElementChild;
    root.addEventListener("click", onClick);

    window.addEventListener("storage", onStorage);
    window.addEventListener("settings:tab-changed", onTabChanged);

    host._cleanup = () => {
      const current = host.firstElementChild;
      if (current) current.removeEventListener("click", onClick);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("settings:tab-changed", onTabChanged);
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

  window.RightPanel.register(KEY, { mount, destroy });
})();
