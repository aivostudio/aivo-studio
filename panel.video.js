(function(){
  if(!window.RightPanel) return;

  function attachPPEBridge(host){
    const videoEl = host.querySelector("video");
    if (!window.PPE || !videoEl) return;

    const prev = PPE.onOutput;
    let isActive = true;

    // bizim handler
    const myHandler = (job, out) => {
      // önce chain
      try { prev && prev(job, out); } catch {}

      if (!isActive) return;
      if (!out || out.type !== "video" || !out.url) return;

      // ✅ filtre: video modülüne ait olmayanı alma
      // (job alanını senin gerçek job şemanla değiştir)
      const app = job?.app || job?.module || job?.routeKey || job?.type;
      if (app && app !== "video") return;

      videoEl.src = out.url;
      try { videoEl.load?.(); } catch {}
    };

    PPE.onOutput = myHandler;

    return () => {
      isActive = false;
      // ✅ sadece biz set ettiysek geri al (race koruması)
      if (PPE.onOutput === myHandler) PPE.onOutput = prev || null;
    };
  }

  window.RightPanel.register("video", {
    mount(host){
  host.innerHTML = `
    <div class="videoSide">
      <div class="videoSideCard">
        <div class="videoSideTitle">Videolarım</div>
        <div style="opacity:.75; font-size:13px; margin-bottom:10px;">
          PPE video output gelince otomatik basar.
        </div>

        <div style="padding:12px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
          <div style="opacity:.7; font-size:12px; margin-bottom:8px;">Player</div>
          <video controls playsinline style="width:100%; border-radius:12px; background:#000;"></video>
        </div>
      </div>
    </div>
  `;

  const cleanup = attachPPEBridge(host);
  return () => { try { cleanup && cleanup(); } catch {} };
}

  });
})();
