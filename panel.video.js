(function () {
  if (!window.RightPanel) return;

  // Basit state (panel içinde)
  const state = { items: [] };

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

  function findMainVideo(host) {
    // Üst player'ı kaldırmak istiyoruz ama ileride geri gelir diye güvenli arama:
    return host.querySelector("[data-main-video], .videoMain video, .videoPlayer video, video.videoPlayer");
  }

  function setMain(host, url) {
    const main = findMainVideo(host);
    if (!main) return; // şu an üst player yoksa sessiz geç
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

            <!-- ✅ gerçek mini player -->
            <video class="vpVideo"
              src="${esc(it.url)}"
              preload="metadata"
              playsinline
              controls
            ></video>

            <!-- (overlay varsa CSS ile kapatacağız) -->
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
    // Web Share API varsa onu kullan
    if (navigator.share) {
      navigator.share({ url }).catch(() => {});
      return;
    }
    // fallback: kopyala
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
          render(host);
        }
        return;
      }

      // kart click → üst player’da aç (ileride geri geldiğinde çalışacak)
      setMain(host, it.url);

      // ayrıca kart içi videoyu play/pause toggle
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

      // ✅ sadece video modülü
      const app = job?.app || job?.module || job?.routeKey || job?.type || out?.meta?.app;
      if (app && app !== "video") return;

      const item = {
        id: uid(),
        url: out.url,
        status: "Tamamlandı",
        title: out?.meta?.title || out?.meta?.prompt || "Video"
      };

      // yeni gelen en üste
      state.items.unshift(item);

      // ilk video geldiyse ana player’a bas (ana player varsa)
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
    mount(host) {
      host.innerHTML = `
        <div class="videoSide">
          <div class="videoSideCard">
            <div class="videoSideTitle">Videolarım</div>
            <div class="videoSideSubtitle">PPE video output gelince otomatik basar.</div>

            <div class="videoGridTitle">Çıktılar</div>
            <div data-video-grid class="vpGrid"></div>

            <div class="videoFootNote">Kart’a tıkla → üst player’da aç / kart içinde oynat.</div>
          </div>
        </div>
      `;

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
