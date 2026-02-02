(function(){
  if(!window.RightPanel) return;

  window.RightPanel.register("cover", {
    mount(host){
      host.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="font-weight:800; font-size:14px;">Kapak Outputs</div>
          <div style="opacity:.75; font-size:13px;">Şimdilik stub panel.</div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
            <div style="aspect-ratio:1/1; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);"></div>
            <div style="aspect-ratio:1/1; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);"></div>
          </div>
        </div>
      `;
      return () => {};
    }
  });
})();
