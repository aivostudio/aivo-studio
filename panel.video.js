// panel.video.js
// RightPanel Video (v2) — DB source-of-truth ONLY (/api/jobs/list?app=video)
// NO LocalStorage, NO placeholders, NO PPE/job_created cards
// Goal: DOM cards === DB items (no ghost "işleniyor" cards)

(function () {
  if (!window.RightPanel) return;

  const MAX_ITEMS = 50;
  const state = { items: [] };

  /* =======================
     Utils
     ======================= */

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");
  }

  // status/db_status önce, state sonra (done + PENDING gibi durumlar var)
  function getStatusText(item) {
    const primary = norm(item?.status || item?.db_status);
    const secondary = norm(item?.state);
    return primary || secondary || "";
  }

  function toMaybeProxyUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.startsWith("/api/media/proxy?url=") || u.includes("/api/media/proxy?url=")) return u;
    if (u.startsWith("http://")) return "/api/media/proxy?url=" + encodeURIComponent(u);
    return u;
  }

  function getPlaybackUrl(it) {
    const a = String(it?.archive_url || it?.archiveUrl || "").trim();
    if (a) return toMaybeProxyUrl(a);
    const u = String(it?.url || it?.video_url || it?.videoUrl || it?.video?.url || "").trim();
    if (!u) return "";
    return toMaybeProxyUrl(u);
  }

  function bestShareUrl(it) {
    const a = String(it?.archive_url || it?.archiveUrl || "").trim();
    if (a) return a;
    const u = String(it?.url || it?.video_url || it?.videoUrl || it?.video?.url || "").trim();
    return u;
  }

  function pickVideoUrlFromOutputs(outputs) {
    if (!Array.isArray(outputs)) return "";

    const pickUrl = (o) => {
      if (!o) return "";
      const u =
        o.archive_url || o.archiveUrl || o.archiveURL ||
        (o.meta && (o.meta.archive_url || o.meta.archiveUrl || o.meta.archiveURL)) ||
        o.url || o.video_url || o.videoUrl ||
        (o.meta && (o.meta.url || o.meta.video_url || o.meta.videoUrl));
      return String(u || "").trim();
    };

    const isVideo = (o) => {
      if (!o) return false;
      const t = String(o.type || o.kind || "").toLowerCase();
      const mt = String(o.meta?.type || o.meta?.kind || "").toLowerCase();
      // type boş gelse bile url varsa kabul edeceğiz; ama video öncelikli
      return t === "video" || mt === "video";
    };

    const hit = outputs.find((o) => isVideo(o) && pickUrl(o));
    if (hit) return pickUrl(hit);

    const any = outputs.find((o) => pickUrl(o));
    return any ? pickUrl(any) : "";
  }

  // output var mı?
  function hasOutput(item) {
    // playbackUrl varsa hazır demektir
    if (String(item?.playbackUrl || "").trim()) return true;

    // top-level
    if (String(item?.archive_url || item?.archiveUrl || "").trim()) return true;
    if (String(item?.url || item?.video_url || item?.videoUrl || item?.video?.url || "").trim()) return true;

    // outputs[]
    const outs = item?.outputs;
    if (Array.isArray(outs)) {
      return outs.some((o) => {
        const u = String(
          o?.archive_url ||
          o?.archiveUrl ||
          o?.meta?.archive_url ||
          o?.meta?.archiveUrl ||
          o?.url ||
          o?.video_url ||
          o?.videoUrl ||
          o?.meta?.url ||
          o?.meta?.video_url ||
          o?.meta?.videoUrl ||
          ""
        ).trim();
        return !!u;
      });
    }
    return false;
  }

  function isError(item) {
    const st = getStatusText(item);
    return (
      st === "hata" ||
      st === "error" ||
      st === "failed" ||
      st === "fail" ||
      st === "canceled" ||
      st === "cancelled"
    );
  }

  function isReady(item) {
    // ALTIN KURAL: output varsa READY
    if (hasOutput(item)) return true;

    const st = getStatusText(item);
    return (
      st === "hazır" ||
      st === "ready" ||
      st === "done" ||
      st === "completed" ||
      st === "complete" ||
      st === "succeeded" ||
      st === "success" ||
      st === "suceeded"
    );
  }

  function normalizeBadge(item) {
    if (isReady(item)) return "Hazır";
    if (isError(item)) return "Hata";
    return "İşleniyor";
  }

  function formatKind(item) {
    const k = (item?.meta?.mode || item?.meta?.kind || item?.kind || "").toString().toLowerCase();
    if (k.includes("image")) return "Image→Video";
    if (k.includes("text")) return "Text→Video";
    return "Video";
  }

  function findGrid(host) {
    return host.querySelector("[data-video-grid]");
  }

  /* =======================
     DB hydrate (/api/jobs/list?app=video)
     ======================= */

  function extractListItems(j) {
    if (!j) return [];
    if (Array.isArray(j.items)) return j.items;
    if (Array.isArray(j.jobs)) return j.jobs;
    if (Array.isArray(j.rows)) return j.rows;
    if (Array.isArray(j.data)) return j.data;
    if (Array.isArray(j.results)) return j.results;
    if (Array.isArray(j.items?.rows)) return j.items.rows;
    return [];
  }

  function mapDbItemToPanelItem(r) {
    const job_id = String(r?.job_id || r?.id || "").trim();
    const meta = r?.meta || {};
    const outputs = Array.isArray(r?.outputs) ? r.outputs : [];

    // archive_url önce
    const archive_url =
      String(r?.archive_url || r?.archiveUrl || meta?.archive_url || meta?.archiveUrl || "").trim() || "";

    // url: outputs -> video.url -> meta provider
    const urlFromOutputs =
      pickVideoUrlFromOutputs(outputs) ||
      r?.video?.url ||
      r?.video_url ||
      r?.videoUrl ||
      "";

    const providerUrl =
      String(
        meta?.video?.url ||
        meta?.runway?.video?.url ||
        meta?.provider?.video?.url ||
        meta?.output?.url ||
        meta?.result?.url ||
        ""
      ).trim();

    const url = String(urlFromOutputs || providerUrl || "").trim();

    const title =
      meta?.title ||
      meta?.prompt ||
      r?.prompt ||
      "Video";

    const createdAt =
      r?.created_at ? new Date(r.created_at).getTime()
      : (r?.createdAt ? new Date(r.createdAt).getTime() : Date.now());

    const item = {
      id: job_id,            // ✅ tek anahtar
      job_id: job_id,        // ✅ tek anahtar
      title,
      status: r?.status || r?.db_status || r?.state || "İşleniyor",
      url,
      archive_url,
      createdAt,
      meta: {
        ...(meta || {}),
        mode: meta?.mode || "",
        prompt: meta?.prompt || r?.prompt || "",
        app: "video",
      },
      outputs,
      state: r?.state,
      db_status: r?.db_status,
      video: r?.video,
    };

    item.playbackUrl = getPlaybackUrl(item) || "";

    // badge/status normalize (UI için)
    if (isError(item)) item.status = "Hata";
    else if (isReady(item)) item.status = "Hazır";
    else item.status = "İşleniyor";

    return item;
  }

  async function hydrateFromDB(host) {
    try {
      const r = await fetch("/api/jobs/list?app=video", { method: "GET" });
      const text = await r.text().catch(() => "");
      let j = null;
      try { j = text ? JSON.parse(text) : null; } catch { j = null; }

      if (!r.ok || !j || !j.ok) {
        console.warn("[video.panel] hydrate failed", r.status, j || text);
        return;
      }

      const rows = extractListItems(j);

      const incoming = (rows || [])
        .map(mapDbItemToPanelItem)
        .filter((x) => x && String(x.job_id || "").trim());

      // ✅ TEK SOURCE OF TRUTH: DB
      state.items = incoming
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
        .slice(0, MAX_ITEMS);

      render(host);
    } catch (e) {
      console.warn("[video.panel] hydrate exception", e);
    }
  }

  /* =======================
     Fullscreen helper
     ======================= */

  function goFullscreen(card) {
    const video = card?.querySelector("video");
    if (!video) return;

    try {
      if (video.requestFullscreen) {
        video.requestFullscreen().catch?.(() => {});
        return;
      }
    } catch {}

    try {
      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        return;
      }
    } catch {}

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

  function renderSkeleton(badge) {
    return `
      <div class="vpSkel" aria-label="İşleniyor">
        <div class="vpBadge">${esc(badge)}</div>
        <div class="vpSkelShimmer"></div>
        <div class="vpSkelPlay">
          <div class="vpSkelPlayRing"></div>
          <div class="vpSkelPlayTri"></div>
        </div>
      </div>
    `;
  }

  function renderThumb(it) {
    const badge = normalizeBadge(it);

    if (!isReady(it) || !it.playbackUrl) {
      return `
        <div class="vpThumb is-loading">
          ${renderSkeleton(badge)}
          <button class="vpFsBtn" data-act="fs" title="Büyüt" aria-label="Büyüt">⛶</button>
        </div>
      `;
    }

    return `
      <div class="vpThumb">
        <div class="vpBadge">${esc(badge)}</div>

        <video
          class="vpVideo"
          preload="metadata"
          playsinline
          controls
          src="${esc(it.playbackUrl)}"
        ></video>

        <div class="vpPlay">
          <span class="vpPlayIcon">▶</span>
        </div>

        <button class="vpFsBtn" data-act="fs" title="Büyüt" aria-label="Büyüt">⛶</button>
      </div>
    `;
  }

  function renderMeta(it) {
    const kind = formatKind(it);
    const sub = it?.meta?.prompt || it?.meta?.title || it?.title || "";
    const ready = isReady(it);

    return `
      <div class="vpMeta">
        <div class="vpTitle" title="${esc(kind)}">${esc(kind)}</div>
        <div class="vpSub" title="${esc(sub)}">${esc(sub)}</div>

        <div class="vpActions">
          <button class="vpIconBtn" data-act="download" ${ready ? "" : "disabled"} title="İndir">⬇</button>
          <button class="vpIconBtn" data-act="share" ${ready ? "" : "disabled"} title="Paylaş">⤴</button>
          <button class="vpIconBtn vpDanger" data-act="delete" title="Sil">🗑</button>
        </div>
      </div>
    `;
  }

  function renderCard(it) {
    const key = String(it.job_id || it.id || "").trim(); // ✅ job_id
    return `
      <div class="vpCard" data-id="${esc(key)}" role="button" tabindex="0">
        ${renderThumb(it)}
        ${renderMeta(it)}
      </div>
    `;
  }

  function render(host) {
    const grid = findGrid(host);
    if (!grid) return;

    if (!state.items.length) {
      grid.innerHTML = `<div class="vpEmpty">Henüz video yok.</div>`;
      return;
    }

    grid.innerHTML = state.items.map(renderCard).join("");
  }

  /* =======================
     Actions
     ======================= */

  function downloadUrl(u) {
    const url = String(u || "").trim();
    if (!url) return;

    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function shareUrl(u) {
    const url = String(u || "").trim();
    if (!url) return;

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
      const it = state.items.find(x => String(x.job_id || x.id || "") === String(id));
      if (!it) return;

      const btn = e.target.closest("[data-act]");
      const video = card.querySelector("video");
      const overlay = card.querySelector(".vpPlay");

      if (btn) {
        e.stopPropagation();
        const act = btn.getAttribute("data-act");

        if (act === "fs") { goFullscreen(card); return; }
        if (act === "download") { downloadUrl(bestShareUrl(it)); return; }
        if (act === "share") { shareUrl(bestShareUrl(it)); return; }

        if (act === "delete") {
          // Şimdilik UI'den kaldırır (backend delete ayrı bağlanacak)
          state.items = state.items.filter(x => String(x.job_id || x.id || "") !== String(id));
          render(host);
          return;
        }
        return;
      }

      if (!video || !isReady(it)) return;

      if (video.paused) {
        video.play().catch(() => {});
        if (overlay) overlay.style.display = "none";
      } else {
        video.pause();
        if (overlay) overlay.style.display = "";
      }
    };

    grid.addEventListener("click", onClick);
    return () => grid.removeEventListener("click", onClick);
  }

  /* =======================
     Panel register
     ======================= */

  window.RightPanel.register("video", {
    getHeader() {
      return { title: "Videolarım", meta: "", searchPlaceholder: "Videolarda ara..." };
    },

    mount(host) {
      host.innerHTML = `
        <div class="videoSide">
          <div class="videoSideCard">
            <div class="vpGrid" data-video-grid></div>
          </div>
        </div>
      `;

      // ✅ İlk render DB hydrate ile
      hydrateFromDB(host);

      // ✅ Periyodik hydrate
      const t = setInterval(() => hydrateFromDB(host), 15000);

      const offEvents = attachEvents(host);

      return () => {
        try { clearInterval(t); } catch {}
        try { offEvents(); } catch {}
      };
    },
  });
})();
