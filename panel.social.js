(function(){
  if (!window.RightPanel) return;

  window.RightPanel.register("social", {
    mount(host){
      host.innerHTML = `
        <div class="panel-card">
          <h3>Sosyal Medya Paketi</h3>
          <p style="opacity:.7;margin-top:6px;">
            Henüz job yok
          </p>
        </div>
      `;
      // manager "unmount function" destekliyor, istersen burada return () => {...} dönebilirsin
      // destroy alanın şu an manager tarafından otomatik çağrılmıyor (manager unmount function kullanıyor).
    }
  });
})();
