(function(){
  if(!window.RightPanel) return;

  // PPE output hook: video geldiğinde panel video elementine bas
  function attachPPEBridge(host){
    const videoEl = host.querySelector("video");

    // PPE yoksa çık
    if (!window.PPE || !videoEl) return;

    // Önceki handler varsa ezmeyelim diye sakla
    const prev = PPE.onOutput;

    PPE.onOutput = (job, out) => {
      try { prev && prev(job, out); } catch {}

      if (!out || out.type !== "video" || !out.url) return;

      // Stub panel video player'a bas
      videoEl.src = out.url;
      videoEl.load?.();
    };

    // cleanup: panel unmount olunca eski handler'a dön
    return () => {
      // sadece biz set ettiysek geri alalım
      PPE.onOutput = prev || null;

    };
  }

  window.RightPanel.register("video", {
    mount(host){
      host.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:12px;">
          <div style="font-weight:800; font-size:14px;">Video Outputs</div>
          <div style="opacity:.75; font-size:13px;">Şimdilik stub panel. PPE video output gelince otomatik basar.</div>

          <div style="padding:12px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
            <div style="opacity:.7; font-size:12px; margin-bottom:8px;">Player</div>
            <video controls playsinline style="width:100%; border-radius:12px; background:#000;"></video>
          </div>
        </div>
      `;

      const cleanup = attachPPEBridge(host);
      return () => { try { cleanup && cleanup(); } catch {} };
    }
  });
})();
