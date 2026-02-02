(function(){
  if (!window.RightPanel) return;

  // ✅ route ile aynı key: "atmo"
  window.RightPanel.register("atmo", {
    mount(host){
      host.innerHTML = `
        <div class="panel-card">
          <h3>Atmosfer Video</h3>
          <p style="opacity:.7;margin-top:6px;">
            Henüz job yok
          </p>
        </div>
      `;
    }
  });
})();
