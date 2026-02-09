// panel.video.js
(function () {
  if (!window.RightPanel) return;

  function getAppFrom(job, out) {
    // Öncelik: output meta
    const a =
      out?.meta?.app ||
      out?.meta?.module ||
      out?.meta?.routeKey ||
      // Fallback: job
      job?.app ||
      job?.module ||
      job?.routeKey ||
      job?.type;

    return (a || "").toString().toLowerCase();
  }

  function isMp4(url) {
    try {
      return /\.mp4(\?|#|$)/i.test(url || "");
    } catch {
      return false;
    }
  }

  function attachPPEBridge(host) {
    const videoEl = host.querySelector("video");
    if (!window.PPE || !videoEl) return;

    const prev = PPE.onOutput;
    let isActive = true;

    const myHandler = (job, out) => {
      // chain önce
      try {
        prev && prev(job, out);
      } catch {}

      if (!isActive) return;

      // ✅ sadece video output
      if (!out || out.type !== "video" || !out.url) return;

      // ✅ mp4 guard (runway/fal bazı url varyantları için)
      if (!isMp4(out.url)) return;

      // ✅ kritik filtre: SADECE video modülü
      const app = getAppFrom(job, out);
      if (app && app !== "video") return;

      // ✅ bas
      if (videoEl.src !== out.url) {
        videoEl.src = out.url;
        try { videoEl.load?.(); } catch {}
      }
    };

    PPE.onOutput = myHandler;

    return () => {
      isActive = false;
      if (PPE.onOutput === myHandler) PPE.onOutput = prev || null;
    };
  }

  window.RightPanel.register("video", {
    mount(host) {
      host.innerHTML = `
        <div class="videoSide">
          <div class="videoSideCard">
            <div class="videoSideTitle">Videolarım</div>
            <div class="videoSideSubtitle">
              PPE video output gelince otomatik basar.
            </div>

            <div class="videoPlayerCard">
              <div class="videoPlayerLabel">Player</div>
              <video class="videoPlayer" controls playsinline></video>
            </div>

            <!-- ✅ burada özellikle LİSTE yok: müzik kartı basabileceği hiçbir alan bırakmıyoruz -->
          </div>
        </div>
      `;

      const cleanup = attachPPEBridge(host);
      return () => { try { cleanup && cleanup(); } catch {} };
    },
  });
})();
