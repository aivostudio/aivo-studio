(function(){
  if (!window.RightPanel) return;

  window.RightPanel.register("music", {
    mount(host){
      host.innerHTML = `
        <div class="aivo-player">
          <div class="aivo-player-head">
            <div class="aivo-player-title">Müzik Outputs</div>
            <div class="aivo-player-sub">
              Üretilen müzikler burada kart olarak listelenecek.
            </div>
          </div>

          <div class="aivo-player-list">
            <!-- STUB CARD (output gelince gerçekleri basacağız) -->
            <div class="aivo-player-card is-loadingState"
                 data-job-id=""
                 data-output-id=""
                 data-src="">
              <div class="aivo-player-row">
                <button
                  class="aivo-play"
                  data-action="toggle-play"
                  aria-label="Oynat"
                  title="Oynat">
                </button>

                <div class="aivo-meta">
                  <div class="aivo-player-title">Henüz müzik yok</div>
                  <div class="aivo-player-sub">
                    Müzik ürettiğinde burada görünecek
                  </div>
                </div>

                <div class="aivo-time" data-bind="time">0:00</div>
              </div>

              <div class="aivo-progress">
                <i style="width:0%"></i>
              </div>

              <div class="aivo-actions">
                <button class="aivo-action" data-action="download">İndir</button>
                <button class="aivo-action" data-action="delete">Sil</button>
              </div>
            </div>
          </div>
        </div>
      `;

      // cleanup gerekirse ileride buraya
      return () => {};
    }
  });
})();
