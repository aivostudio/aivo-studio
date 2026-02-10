(function () {
  if (!window.RightPanel) return;

  // Basit state (panel içinde)
  const state = { items: [] };

  // ✅ Persist (refresh sonrası kalsın)
  const STORAGE_KEY = "aivo.v2.video.items";

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

  function dedupPushFront(item) {
    // url bazlı dedup (aynı video tekrar eklenmesin)
    const idx = state.items.findIndex(x => x.url === item.url);
    if (idx >= 0) state.items.splice(idx, 1);
    state.items.unshift(item);
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function uid() {
    return "v_" + Math.random().toString(36).slice(2, 9);
  }

  function findGrid(host) {
    return host.querySelector("[data-video-grid]");
  }

  // üst player kaldırıldı; ama ileride gelirse hazır (sessiz geçer)
  function findMainVideo(host) {
    return host.querySelector("[data-main-video], .videoMain video, .videoPlayer video, video.videoPlayer");
  }

  function setMain(host, url) {
    const main = findMainVideo(host);
    if (!main) return;
    try {
      main.src = url;
      main.load?.();
      main.play?.().catch(() => {});
    } catch {}
  }

  function render(host) {
    const grid = findGrid(host);
    if (!grid) return;

    if (!state.items.length) {
      grid.innerHTML = `<div class="vpEmpty">Henüz video yok.</div>`;
      return;
    }

    grid.innerHTML = state.items.slice(0, 20).map((it) => {
      const title = it.title ? esc(it.title) : "Video";
      const status = it.status || "Tamamlandı";
      return `
        <div class="vpCard" data-vpid="${esc(it.id)}" role="button" tabindex="0">
          <div class="vpThumb">
            <div class="vpBadge">${esc(status)}</div>

            <!-- ✅ gerçek mini mp4 player -->
            <video class="vpVideo"
              src="${esc(it.url)}"
              preload="metadata"
              playsinline
              controls
            ></video>

            <!-- overlay (istersen CSS ile display:none yap) -->
            <div class="vpPlay" aria-hidden="true">
              <span class="vpPlayIcon">▶</span>
            </div>
          </div>

          <div class="vpMeta">
            <div class="vpTitle" title="${title}">${title}</div>

            <div class="vpActions">
              <button class="vpIconBtn" data-act="download" title="İndir" aria-label="İndir">
                <span class="vpI">⬇</span>
              </button>
              <button class="vpIconBtn" data-act="share" title="Paylaş" aria-label="Paylaş">
                <span class="vpI">⤴</span>
              </button>
              <button class="vpIconBtn vpDanger" data-act="delete" title="Sil" aria-label="Sil">
                <span class="vpI">🗑</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function downloadUrl(url) {
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function shareUrl(url) {
    if (navigator.share) {
      navigator.share({ url }).catch(() => {});
      return;
    }
    navigator.clipboard?.writeText(url).catch(() => {});
  }

  function removeById(id) {
    const idx = state.items.findIndex(x => x.id === id);
    if (idx >= 0) state.items.splice(idx, 1);
  }

  function attachEvents(host) {
    const grid = findGrid(host);
    if (!grid) return () => {};

    const onClick = (e) => {
      const btn = e.target.closest("[data-act]");
      const card = e.target.closest(".vpCard");
      if (!card) return;

      const id = card.getAttribute("data-vpid");
      const it = state.items.find(x => x.id === id);
      if (!it) return;

      // ikon butonlar
      if (btn) {
        e.preventDefault();
        e.stopPropagation();
        const act = btn.getAttribute("data-act");
        if (act === "download") downloadUrl(it.url);
        if (act === "share") shareUrl(it.url);
        if (act === "delete") {
          removeById(id);
          saveItems();        // ✅ silince de persist güncelle
          render(host);
        }
        return;
      }

      // kart click → (ana player varsa) bas
      setMain(host, it.url);

      // kart içi play/pause toggle
      const v = card.querySelector("video.vpVideo");
      if (v) {
        if (v.paused) v.play().catch(() => {});
        else v.pause();
      }
    };

    grid.addEventListener("click", onClick);
    return () => grid.removeEventListener("click", onClick);
  }

  function attachPPEBridge(host) {
    if (!window.PPE) return () => {};

    const prev = PPE.onOutput;
    let isActive = true;

    const myHandler = (job, out) => {
      // chain
      try { prev && prev(job, out); } catch {}
      if (!isActive) return;

      if (!out || out.type !== "video" || !out.url) return;

      // ✅ sadece video modülü (job veya out.meta.app)
      if (out.type !== "video") return;

      const item = {
        id: uid(),
        url: out.url,
        status: "Tamamlandı",
        title: out?.meta?.title || out?.meta?.prompt || "Video"
      };

      // ✅ dedup + persist
      dedupPushFront(item);
      saveItems();

      // ana player yok artık; ama olursa ilk geleni basar
      setMain(host, item.url);

      render(host);
    };

    PPE.onOutput = myHandler;

    return () => {
      isActive = false;
      if (PPE.onOutput === myHandler) PPE.onOutput = prev || null;
    };
  }
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
          <div data-video-grid class="vpGrid"></div>
        </div>
      </div>
    `;

      // ✅ refresh’te geri gelsin
      state.items = loadItems();

      render(host);
      const offEvents = attachEvents(host);
      const offPPE = attachPPEBridge(host);

      return () => {
        try { offEvents(); } catch {}
        try { offPPE(); } catch {}
      };
    }
  });
})();
