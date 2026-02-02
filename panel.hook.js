(function(){
  if (!window.RightPanel) return;

  RightPanel.register("hook", {
    mount(host){
      host.innerHTML = `
        <div class="panel-card">
          <h3>Viral Hook</h3>
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
