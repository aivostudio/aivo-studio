(function () {
  if (!window.RightPanel) return;

  const STORAGE_KEY = "aivo.v2.video.items";
  const state = { items: [] };

  /* =======================
     Persist helpers
     ======================= */
  function loadItems() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items.slice(0, 50)));
    } catch {}
  }

  function uid() {
    return "v_" + Math.random().toString(36).slice(2, 10);
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;",
      '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function findGrid(host) {
    return host.querySelector("[data-video-grid]");
  }

  /* =======================
     Fullscreen helper
     ======================= */
  function goFullscreen(card) {
    const video = card?.querySelector("video");
    if (!video) return;

    // 1) Standard Fullscreen API (desktop + most browsers)
    try {
      if (video.requestFullscreen) {
        video.requestFullscreen().catch?.(() => {});
        return;
      }
    } catch {}

    // 2) iOS Safari (video element fullscreen)
    try {
      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        return;
      }
    } catch {}

    // 3) Last resort: fullscreen the card container
    try {
      if (card.requestFullscreen) {
        card.requestFullscreen().catch?.(() => {});
        return;
      }
    } catch {}
  }

  /* =======================
     Render
     ======================= */
  function render(host) {
    const grid = findGrid(host);
    if (!grid) return;

    if (!state.items.length) {
      grid.innerHTML = `<div class="vpEmpty">Henüz video yok.</div>`;
      return;
    }

    grid.innerHTML = state.items.map(it => `
      <div class="vpCard" data-id="${it.id}" role="button" tabindex="0">
        <div class="vpThumb">
          <div class="vpBadge">${esc(it.status)}</div>

          <video
            class="vpVideo"
            src="${esc(it.url)}"
            preload="metadata"
            playsinline
          ></video>

          <div class="vpPlay">
            <span class="vpPlayIcon">▶</span>
          </div>

          <!-- Fullscreen tool -->
          <button class="vpFsBtn" data-act="fs" title="Büyüt" aria-label="Büyüt">⛶</button>
        </div>

        <div class="vpMeta">
          <div class="vpTitle">${esc(it.title)}</div>

          <div class="vpActions">
            <button class="vpIconBtn" data-act="download">⬇</button>
            <button class="vpIconBtn" data-act="share">⤴</button>
            <button class="vpIconBtn vpDanger" data-act="delete">🗑</button>
          </div>
        </div>
      </div>
    `).join("");
  }
  /* =======================
     Actions
     ======================= */

  async function downloadByJobId(job_id, fallbackUrl) {
    try {
      const res = await fetch(`/api/video/download?job_id=${encodeURIComponent(job_id)}`, {
        method: "GET",
        credentials: "same-origin"
      });

      if (!res.ok) throw new Error("download_failed");

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `aivo-video-${job_id}.mp4`;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    } catch (err) {
      // fallback (job_id yoksa veya endpoint hata verirse)
      if (fallbackUrl) {
        const a = document.createElement("a");
        a.href = fallbackUrl;
        a.download = "";
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    }
  }

  function download(url) {
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function share(url) {
    if (navigator.share) {
      navigator.share({ url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).catch(() => {});
    }
  }

  /* =======================
     PPE bridge (Runway)
     ======================= */
  function attachPPE(host) {
    if (!window.PPE) return () => {};

    const prev = PPE.onOutput;
    let active = true;

    PPE.onOutput = (job, out) => {
      try { prev && prev(job, out); } catch {}
      if (!active) return;

      if (!out || out.type !== "video" || !out.url) return;

      state.items.unshift({
        id: uid(),
        url: out.url,
        status: "Tamamlandı",
        title: out?.meta?.title || out?.meta?.prompt || "Video"
      });

      saveItems();
      render(host);
    };

    return () => {
      active = false;
      if (PPE.onOutput === arguments.callee) PPE.onOutput = prev || null;
    };
  }

  /* =======================
     Panel register
     ======================= */
  window.RightPanel.register("video", {
    getHeader() {
      return {
        title: "Videolarım",
        meta: "",
        searchPlaceholder: "Videolarda ara..."
      };
    },

    mount(host) {
      host.innerHTML = `
        <div class="videoSide">
          <div class="videoSideCard">
            <div class="vpGrid" data-video-grid></div>
          </div>
        </div>
      `;

      state.items = loadItems();
      render(host);

      const offEvents = attachEvents(host);
      const offPPE = attachPPE(host);

      return () => {
        try { offEvents(); } catch {}
        try { offPPE(); } catch {}
      };
    }
  });
})();
