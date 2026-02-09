// panel.video.js (FINAL - no main player)
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

  async function shareUrl(url) {
    try {
      if (navigator.share) { await navigator.share({ url }); return true; }
    } catch {}
    try { await navigator.clipboard?.writeText(url); return true; } catch {}
    return false;
  }

  function downloadUrl(url) {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = "";
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {}
  }

  function attachPPEBridge(host) {
    const grid = host.querySelector("[data-video-grid]");
    if (!window.PPE || !grid) return;

    const prev = PPE.onOutput;
    let isActive = true;

    const state = { items: [], max: 4 };

    function dedupePush(url, meta) {
      state.items = state.items.filter(x => x.url !== url);
      state.items.unshift({
        url,
        id: "v_" + Math.random().toString(16).slice(2),
        ts: Date.now(),
        status: meta?.status || "Tamamlandı",
      });
      if (state.items.length > state.max) state.items.length = state.max;
    }

    function render() {
      if (!state.items.length) {
        grid.innerHTML = `<div class="vpEmpty">Henüz video yok.</div>`;
        return;
      }

      grid.innerHTML = state.items.map((it) => {
        return `
          <div class="vpCard" data-card data-url="${it.url}">
            <div class="vpThumb">
              <div class="vpBadge">${it.status}</div>
              <video class="vpVideo" src="${it.url}" preload="metadata" playsinline controls></video>
            </div>

            <div class="vpActions" role="group" aria-label="Video actions">
              <button class="vpIconBtn" data-action="download" data-url="${it.url}" title="İndir" aria-label="İndir">
                <svg viewBox="0 0 24 24"><path d="M12 3v10m0 0 4-4m-4 4-4-4M5 19h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>

              <button class="vpIconBtn" data-action="share" data-url="${it.url}" title="Paylaş" aria-label="Paylaş">
                <svg viewBox="0 0 24 24"><path d="M15 8a3 3 0 1 0-2.83-4H12a3 3 0 0 0 3 4ZM6 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm12 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM8.7 15.6l6.6-3.2M8.7 18.4l6.6 3.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>

              <button class="vpIconBtn danger" data-action="delete" data-id="${it.id}" title="Sil" aria-label="Sil">
                <svg viewBox="0 0 24 24"><path d="M3 6h18M9 6V4h6v2m-8 0 1 16h8l1-16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>
        `;
      }).join("");
    }

    // delegation
    grid.addEventListener("click", async (e) => {
      const btn = e.target?.closest?.("[data-action]");
      if (btn) {
        const action = btn.getAttribute("data-action");
        if (action === "download") return downloadUrl(btn.getAttribute("data-url"));
        if (action === "share") return shareUrl(btn.getAttribute("data-url"));
        if (action === "delete") {
          const id = btn.getAttribute("data-id");
          state.items = state.items.filter(x => x.id !== id);
          render();
        }
        return;
      }

      // kart tık → video play/pause toggle
      const card = e.target?.closest?.("[data-card]");
      if (!card) return;
      const v = card.querySelector("video");
      if (!v) return;
      try { v.paused ? v.play() : v.pause(); } catch {}
    });

    const myHandler = (job, out) => {
      try { prev && prev(job, out); } catch {}
      if (!isActive) return;
      if (!out || out.type !== "video" || !out.url) return;
      if (!isMp4(out.url)) return;

      const app = getAppFrom(job, out);
      if (app && app !== "video") return;

      dedupePush(out.url, { status: "Tamamlandı" });
      render();
    };

    PPE.onOutput = myHandler;
    render();

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
            <div class="videoSideSubtitle">PPE video output gelince otomatik basar.</div>

            <div class="videoGridTitle">Çıktılar</div>
            <div data-video-grid class="vpGrid"></div>

            <div class="videoFootNote">Kart’a tıkla → oynat/durdur.</div>
          </div>
        </div>
      `;

      const cleanup = attachPPEBridge(host);
      return () => { try { cleanup && cleanup(); } catch {} };
    }
  });
})();
