// /js/panel.music.js
(function(){
  if(!window.RightPanel) return;

  window.RightPanel.register("music", {
    mount(host){
      host.innerHTML = `
        <div class="aivo-player-list">
          <div class="aivo-player-card is-ready"
               data-src=""
               data-job-id="test_job"
               data-output-id="test_out">

            <button class="aivo-player-playBtn"
                    data-action="toggle-play"
                    aria-label="Oynat"
                    title="Oynat"></button>

            <div class="aivo-player-center">
              <div class="aivo-player-title">Test Track</div>
              <div class="aivo-player-sub">Console inject</div>

              <div class="aivo-player-row">
                <div class="aivo-progress"><i style="width:0%"></i></div>
                <div class="aivo-player-time" data-bind="time">0:00</div>
              </div>
            </div>

            <div class="aivo-player-right">
              <button class="aivo-action" data-action="download">indir</button>
              <button class="aivo-action" data-action="delete">sil</button>
            </div>
          </div>
        </div>
      `;

      // player.js bazen host sonradan dolduğu için buton ikon init vs. gerekebiliyor:
      // burada ekstra bir şey yapmıyoruz; player.js zaten delegation ile yakalıyor.

      return () => {
        host.innerHTML = "";
      };
    }
  });
})();
