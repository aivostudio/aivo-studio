(function(){
  if(!window.RightPanel) return;

  window.RightPanel.register("video", {
    mount(host){
      host.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="font-weight:800; font-size:14px;">Video Outputs</div>
          <div style="opacity:.75; font-size:13px;">Şimdilik stub panel.</div>

          <div style="padding:12px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
            <div style="opacity:.7; font-size:12px; margin-bottom:8px;">Player</div>
            <video controls style="width:100%; border-radius:12px; background:#000;"></video>
          </div>
        </div>
      `;
      return () => {};
    }
  });
})();
