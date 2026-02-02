(function(){
  if(!window.RightPanel) return;

  window.RightPanel.register("music", {
    mount(host){
      host.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="font-weight:800; font-size:14px;">Müzik Outputs</div>

          <div style="opacity:.75; font-size:13px;">
            Şimdilik stub panel. Buraya:
            <ul style="margin:8px 0 0 18px; opacity:.8;">
              <li>Job listesi</li>
              <li>Durum (processing/ready/failed)</li>
              <li>Play / Download / Delete</li>
            </ul>
          </div>

          <div style="padding:12px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
            <div style="opacity:.7; font-size:12px; margin-bottom:8px;">Player</div>
            <audio controls style="width:100%"></audio>
          </div>
        </div>
      `;

      return () => { /* cleanup */ };
    }
  });
})();
