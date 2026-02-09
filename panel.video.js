// panel.video.js
(function () {
  if (!window.RightPanel) return;

  function isMp4(url) {
    try { return /\.mp4(\?|#|$)/i.test(url || ""); } catch { return false; }
  }

  function getAppFrom(job, out) {
    const a =
      out?.meta?.app ||
      out?.meta?.module ||
      out?.meta?.routeKey ||
      job?.app ||
      job?.module ||
      job?.routeKey ||
      job?.type;
    return (a || "").toString().toLowerCase();
  }

  function safeShare(url) {
    try {
      if (navigator.share) {
        navigator.share({ url }).catch(() => {});
        return;
      }
    } catch {}
    try {
      navigator.clipboard?.writeText(url);
      // istersen toast hook’la
    } catch {}
  }

  function attachPPEBridge(host) {
    const mainVideo = host.querySelector("[data-main-video]");
    const grid = host.querySelector("[data-video-grid]");
    if (!window.PPE || !mainVideo || !grid) return;

    const prev = PPE.onOutput;
    let isActive = true;

    // ✅ local state (panel içinde)
    const state = {
      items: [], // [{url, id, ts}]
      max: 4,
    };

    function dedupePush(url) {
      // aynı url varsa başa taşı
      state.items = state.items.filter(x => x.url !== url);
      state.items.unshift({ url, id: "v_" + Math.random().toString(16).slice(2), ts: Date.now() });
      if (state.items.length > state.max) state.items.length = state.max;
    }

    function render() {
      const html = state.items.map((it) => {
        return `
          <div class="mp4Card" data-id="${it.id}">
            <div class="mp4Thumb">
              <video class="mp4Video" src="${it.url}" preload="metadata" playsinline controls></video>
            </div>

            <div class="mp4Actions">
              <a class="mp4Btn" href="${it.url}" download target="_blank" rel="noopener">İndir</a>
              <button class="mp4Btn" data-action="share" data-url="${it.url}">Paylaş</button>
              <button class="mp4Btn danger" data-action="delete" data-id="${it.id}">Sil</button>
            </div>
          </div>
        `;
      }).join("");

      grid.innerHTML = html || `<div class="mp4Empty">Henüz video yok.</div>`;
    }

    function setMain(url) {
      if (!url) return;
      if (mainVideo.src !== url) {
        mainVideo.src = url;
        try { mainVideo.load?.(); } catch {}
      }
    }

    // event delegation
    grid.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-action]");
      if (!btn) return;

      const action = btn.getAttribute("data-action");
      if (action === "share") {
        const url = btn.getAttribute("data-url");
        if (url) safeShare(url);
        return;
      }

      if (action === "delete") {
        const id = btn.getAttribute("data-id");
        if (!id) return;
        state.items = state.items.filter(x => x.id !== id);
        render();
        // ✅ backend delete sonradan (şimdilik UI’dan kaldır)
        return;
      }
    });

    const myHandler = (job, out) => {
      // chain korunuyor
      try { prev && prev(job, out); } catch {}

      if (!isActive) return;
      if (!out || out.type !== "video" || !out.url) return;
      if (!isMp4(out.url)) return;

      // ✅ sadece video modülü
      const app = getAppFrom(job, out);
      if (app && app !== "video") return;

      // ✅ liste + main player
      dedupePush(out.url);
      render();
      setMain(out.url);
    };

    PPE.onOutput = myHandler;

    // ilk render
    render();

    return () => {
      isActive = false;
      try { grid.replaceWith(grid.cloneNode(true)); } catch {}
      if (PPE.onOutput === myHandler) PPE.onOutput = prev || null;
    };
  }

  window.RightPanel.register("video", {
    mount(host) {
      host.innerHTML = `
        <div class="videoSide">
          <div class="videoSideCard">
            <div class="videoSideTitle">Videolarım</div>
            <div class="videoSideSubtitle">PPE video output gelince otomatik basar.</div>

            <!-- üstte sabit player (bunu istiyordun: player burada sabit kalabilir) -->
            <div class="videoPlayerCard">
              <div class="videoPlayerLabel">Player</div>
              <video data-main-video class="videoPlayer" controls playsinline></video>
            </div>

            <!-- altta 2x2 grid -->
            <div class="videoGridTitle">Çıktılar</div>
            <div data-video-grid class="videoGrid"></div>

            <div class="videoFootNote">Output aksiyonları / player burada sabit kalabilir.</div>
          </div>
        </div>
      `;

      const cleanup = attachPPEBridge(host);
      return () => { try { cleanup && cleanup(); } catch {} };
    }
  });
})();
