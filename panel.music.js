// panel.music.js — STATIC CARD (CSS v1 ile birebir uyum)
// Şimdilik tek kart, davranışlar sonra bağlanacak

(function bootRegisterMusicPanel() {
  if (window.__AIVO_PANEL_MUSIC_STATIC__) return;
  window.__AIVO_PANEL_MUSIC_STATIC__ = true;

  const HOST_SEL = "#rightPanelHost";

  const getHost = (maybeHost) => {
    if (maybeHost && maybeHost.nodeType === 1) return maybeHost;
    return document.querySelector(HOST_SEL);
  };

  const registerOnce = () => {
    if (!window.RightPanel?.register) return false;

    // bazı sürümlerde RightPanel.panels var, bazılarında yok — güvenli kontrol
    try {
      if (window.RightPanel.panels?.music) return true;
    } catch {}

    window.RightPanel.register("music", {
      mount(host) {
        const el = getHost(host);
        if (!el) {
          console.warn("[panel.music] host not found:", HOST_SEL);
          return;
        }

        el.innerHTML = `
          <div class="aivo-player-list">
            <div class="aivo-player-card is-ready"
              data-src=""
              data-job-id="test_job"
              data-output-id="test_out">

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
                  <div class="aivo-player-title">gtdtg (Bonus)</div>

                  <div class="aivo-player-tags">
                    <span class="aivo-tag is-ready">Hazır</span>
                    <span class="aivo-tag">Türkçe</span>
                  </div>
                </div>

                <div class="aivo-player-sub">Türkçe gtgg</div>

                <div class="aivo-player-meta">
                  <span>1:40</span>
                  <span class="aivo-player-dot"></span>
                  <span>04.02.2026 01:28:54</span>
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
          </div>
        `;

        console.log("[panel.music] mounted (STATIC CARD)");
      },

      destroy(host) {
        const el = getHost(host);
        if (el) el.innerHTML = "";
      }
    });

    console.log("[panel.music] registered (STATIC CARD)");
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
