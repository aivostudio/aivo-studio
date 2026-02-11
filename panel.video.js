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

// ❌ ESKİ download(url) SİLİNDİ
// ✅ YENİ: backend üzerinden zorunlu indirme
async function download(job_id) {
  const res = await fetch(`/api/video/download?job_id=${encodeURIComponent(job_id)}`);

  if (!res.ok) {
    alert("İndirme başarısız");
    return;
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = `aivo-video-${job_id}.mp4`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(blobUrl);
}

function share(url) {
  if (navigator.share) {
    navigator.share({ url }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(url).catch(() => {});
  }
}

function attachEvents(host) {
  const grid = findGrid(host);
  if (!grid) return () => {};

  const onClick = (e) => {
    const card = e.target.closest(".vpCard");
    if (!card) return;

    const id = card.getAttribute("data-id");
    const item = state.items.find(x => x.id === id);
    if (!item) return;

    const btn = e.target.closest("[data-act]");
    const video = card.querySelector("video");
    const overlay = card.querySelector(".vpPlay");

    if (btn) {
      e.stopPropagation();

      const act = btn.getAttribute("data-act");

      if (act === "fs") {
        goFullscreen(card);
        return;
      }

      // 🔴 SADECE BU SATIR DEĞİŞTİ
      if (act === "download") download(item.job_id);

      if (act === "share") share(item.url);
      if (act === "delete") {
        state.items = state.items.filter(x => x.id !== id);
        saveItems();
        render(host);
      }
      return;
    }

    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      overlay.style.display = "none";
    } else {
      video.pause();
      overlay.style.display = "";
    }
  };

  grid.addEventListener("click", onClick);
  return () => grid.removeEventListener("click", onClick);
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
      job_id: job?.job_id || job?.id, // 🔴 KRİTİK
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
