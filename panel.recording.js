(function () {
  const KEY = "recording";

  function mount(host, params) {
    host.innerHTML = `
      <div class="right-card">
        <div class="right-card__title">Ses Kaydı</div>
        <div class="right-card__sub">Kayıt/Upload çıktıları burada görünecek.</div>
      </div>
    `;
  }

  window.RightPanel = window.RightPanel || {};
  const prev = window.RightPanel.panels || {};
  window.RightPanel.panels = prev;

  window.RightPanel.panels[KEY] = { mount };

  // manager "force" ile bunu çağıracak
})();
