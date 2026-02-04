// panel.music.js — STATIC CARD (CSS v1 ile birebir uyum)
// Şimdilik: "Müzik Üret" tıklanınca sağ panele 2 kart (Original + Revize) eklensin.
// Not: studio.music.generate.js içinde aivo:music:placeholder event'i atılıyor olmalı.

(function bootRegisterMusicPanel() {
  const registerOnce = () => {
    if (!window.RightPanel) return false;

    // ✅ "has()" güvenilmez olabilir; gerçek kayıt kontrolü panels üzerinden
    if (window.RightPanel.panels?.music) return true;

    window.RightPanel.register("music", {
      mount(host) {
        // sadece container bas (her seferinde komple HTML resetlemek yerine)
        host.innerHTML = `<div class="aivo-player-list" data-role="list"></div>`;
        const listEl = host.querySelector('[data-role="list"]');

        const nowTR = () => {
          try { return new Date().toLocaleString("tr-TR"); }
          catch (_) { return String(Date.now()); }
        };

        // Tek kart HTML template (senin mevcut CSS v1 yapınla uyumlu)
        const cardHTML = ({ label, title, subtitle }) => `
          <div class="aivo-player-card is-ready"
            data-src=""
            data-job-id=""
            data-output-id="">

            <!-- LEFT -->
            <div class="aivo-player-left">
              <button class="aivo-player-btn"
                data-action="toggle-play"
                aria-label="Oynat"
                title="Oynat">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M8 5v14l11-7-11-7z" fill="currentColor"></path>
                </svg>
              </button>
              <!-- loading state için:
              <div class="aivo-player-spinner" title="İşleniyor"></div>
              -->
            </div>

            <!-- MID -->
            <div class="aivo-player-mid">
              <div class="aivo-player-titleRow">
                <div class="aivo-player-title">${title}</div>

                <div class="aivo-player-tags">
                  <span class="aivo-tag">${label}</span>
                  <span class="aivo-tag">İşleniyor</span>
                </div>
              </div>

              <div class="aivo-player-sub">${subtitle}</div>

              <div class="aivo-player-meta">
                <span>--:--</span>
                <span class="aivo-player-dot"></span>
                <span>${nowTR()}</span>
              </div>

              <div class="aivo-player-controls">
                <div class="aivo-progress" title="İlerleme">
                  <i style="width:0%"></i>
                </div>
              </div>
            </div>

            <!-- RIGHT ACTIONS -->
            <div class="aivo-player-actions">
              <!-- STEM -->
              <button class="aivo-action"
                data-action="stems"
                title="Parçaları Ayır"
                aria-label="Parçaları Ayır">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3z" fill="currentColor"/>
                  <path d="M8 11c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3z" fill="currentColor" opacity=".9"/>
                  <path d="M16 13c-1.6 0-4 .8-4 2.4V18h8v-2.6c0-1.6-2.4-2.4-4-2.4z" fill="currentColor" opacity=".85"/>
                  <path d="M8 13c-1.6 0-4 .8-4 2.4V18h8v-2.6c0-1.6-2.4-2.4-4-2.4z" fill="currentColor" opacity=".75"/>
                </svg>
              </button>

              <!-- DOWNLOAD -->
              <button class="aivo-action is-blue"
                data-action="download"
                title="Dosyayı İndir"
                aria-label="Dosyayı İndir">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M8 10l4 4 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M5 20h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>

              <!-- EXTEND -->
              <button class="aivo-action is-accent"
                data-action="extend"
                title="Süreyi Uzat"
                aria-label="Süreyi Uzat">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M20 6v6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M4 18v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M20 12a8 8 0 0 0-14.6-4.6" stroke="currentColor" stroke-width="2"/>
                  <path d="M4 12a8 8 0 0 0 14.6 4.6" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>

              <!-- REVISE -->
              <button class="aivo-action"
                data-action="revise"
                title="Yeniden Yorumla"
                aria-label="Yeniden Yorumla">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 20h9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>

              <!-- DELETE -->
              <button class="aivo-action is-danger"
                data-action="delete"
                title="Müziği Sil"
                aria-label="Müziği Sil">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18" stroke="currentColor" stroke-width="2"/>
                  <path d="M8 6V4h8v2" stroke="currentColor" stroke-width="2"/>
                  <path d="M7 6l1 14h8l1-14" stroke="currentColor" stroke-width="2"/>
                  <path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2"/>
                </svg>
              </button>
            </div>
          </div>
        `;

        // 2’li grup ekle (Original + Revize)
        const addPair = () => {
          const html = `
            <div class="aivo-player-pair">
              ${cardHTML({ label: "Original", title: "Yeni Müzik", subtitle: "Üretim başladı..." })}
              ${cardHTML({ label: "Revize",   title: "Yeni Müzik", subtitle: "Üretim başladı..." })}
            </div>
          `;
          listEl.insertAdjacentHTML("afterbegin", html);
        };

        // event dinle (generate click -> placeholder)
        this._onPlaceholder = () => addPair();
        window.addEventListener("aivo:music:placeholder", this._onPlaceholder);

        // debug istersen aç:
        // console.log("[panel.music] mounted + listener ready");
      },

      destroy(host) {
        try {
          if (this._onPlaceholder) {
            window.removeEventListener("aivo:music:placeholder", this._onPlaceholder);
          }
        } catch (_) {}

        if (host) host.innerHTML = "";
      }
    });

    return true;
  };

  // İlk deneme
  if (registerOnce()) return;

  // RightPanel geç geliyorsa: bekle + register et
  let tries = 0;
  const t = setInterval(() => {
    tries++;
    if (registerOnce() || tries > 50) clearInterval(t); // ~5 sn
  }, 100);
})();
