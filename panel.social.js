(function(){
  if (!window.RightPanel) return;

  RightPanel.register("social", {
    mount(host){
      host.innerHTML = `
        <div class="panel-card">
          <h3>Sosyal Medya Paketi</h3>
          <p style="opacity:.7;margin-top:6px;">
            Henüz job yok
          </p>
        </div>
      `;
    },
    destroy(){
      // şimdilik boş
    }
  });
})();
