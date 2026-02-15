// panel.video.js
// RightPanel Video (v2) — Safari-safe (no endless proxy spam)
// - Only renders <video> when item is READY
// - Stores proxyUrl (same-origin) to avoid cross-origin/range issues
// - PPE bridge updates items to READY
// - Pending card on job_created
// - Storage version bump + auto-migrate/clean legacy broken urls

(function () {
  if (!window.RightPanel) return;

  const STORAGE_KEY = "aivo.v2.video.items.v2"; // ✅ version bump
  const LEGACY_KEYS = ["aivo.v2.video.items"];  // old key(s)
  const MAX_ITEMS = 50;

  const state = { items: [] };

  /* =======================
     Utils
     ======================= */

  function uid() {
    return "v_" + Math.random().toString(36).slice(2, 10);
  }

  function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function isReady(item) {
    const st = String(item?.status || item?.state || "").toLowerCase();
    return (
      st === "hazır" ||
      st === "ready" ||
      st === "completed" ||
      st === "succeeded"
    );
  }

  function isProcessing(item) {
    const st = String(item?.status || item?.state || "").toLowerCase();
    return (
      st === "işleniyor" ||
      st === "processing" ||
      st === "in_progress" ||
      st === "in queue" ||
      st === "in_queue" ||
      st === "queued" ||
      st === "pending"
    );
  }

  function isError(item) {
    const st = String(item?.status || item?.state || "").toLowerCase();
    return st === "error" || st === "failed" || st === "fail";
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

  // Title split: "Text video: xxx" -> type + name
  function splitTitle(raw) {
    const s = String(raw ?? "").trim();
    const m = s.match(/^([^:]{2,24})\s*:\s*(.+)$/);

    let type = m ? m[1].trim() : "";
    let name = m ? m[2].trim() : s;

    const t = type.toLowerCase();
    if (t.includes("text") && t.includes("video")) type = "Text video";
    else if (t.includes("image") && t.includes("video")) type = "Image video";
    else if (t === "video") type = "Video";
    else if (!type) type = "Video";

    if (!name) name = "Video";

    return { type, name };
  }

  function renderTitle(raw) {
    const p = splitTitle(raw);
    return `<span class="vpType">${esc(p.type)}</span><span class="vpName">${esc(p.name)}</span>`;
  }

  function findGrid(host) {
    return host.querySelector("[data-video-grid]");
  }

  // Always use same-origin proxy for video playback
  function toProxyUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    // if it's already proxy
    if (u.startsWith("/api/media/proxy?url=") || u.includes("/api/media/proxy?url=")) return u;
    return "/api/media/proxy?url=" + encodeURIComponent(u);
  }

  // Detect legacy broken R2 pattern: https://media.aivo.tr/outputs/video/<uuid>.mp4 (missing job folder)
  function looksLikeLegacyBrokenR2(url) {
    const u = String(url || "");
    return /https?:\/\/media\.aivo\.tr\/outputs\/video\/[0-9a-f-]{36}\.mp4/i.test(u);
  }

  /* =======================
     Storage (load / migrate / save)
     ======================= */

  function safeParse(json) {
    try { return JSON.parse(json); } catch { return null; }
  }

  function loadItems() {
    // 1) new key
    const rawNew = localStorage.getItem(STORAGE_KEY);
    const arrNew = rawNew ? safeParse(rawNew) : null;
    if (Array.isArray(arrNew)) return sanitizeItems(arrNew);

    // 2) legacy keys -> migrate once
    for (const k of LEGACY_KEYS) {
      const raw = localStorage.getItem(k);
      const arr = raw ? safeParse(raw) : null;
      if (Array.isArray(arr) && arr.length) {
        const cleaned = sanitizeItems(arr);
        // write into new key
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned.slice(0, MAX_ITEMS))); } catch {}
        // optionally delete legacy
        try { localStorage.removeItem(k); } catch {}
        return cleaned;
      }
    }

    return [];
  }

  function sanitizeItems(items) {
    const out = [];

    for (const it0 of (items || [])) {
      const it = it0 || {};
      const id = String(it.id || it.job_id || uid());
      const job_id = it.job_id != null ? String(it.job_id) : (it.id ? String(it.id) : "");

      // Keep original url but also create proxyUrl
      const url = String(it.url || it.video_url || "").trim();
      const proxyUrl = url ? toProxyUrl(url) : "";

      // If we detect legacy broken R2 url: keep item but force NOT-READY so it doesn't spam proxy
      const legacyBroken = looksLikeLegacyBrokenR2(url);

      const status =
        legacyBroken ? "İşleniyor" :
        (it.status || it.state || (url ? "Hazır" : "İşleniyor"));

      const title = it.title || it.meta?.title || it.meta?.prompt || it.prompt || it.text || "Video";

      out.push({
        id,
        job_id,
        title,
        status,
        url,       // raw (for download/share)
        proxyUrl,  // always same-origin for <video src>
        createdAt: it.createdAt || it.created_at || Date.now(),
        meta: {
          ...(it.meta || {}),
          mode: it.meta?.mode || it.mode || it.kind || "",
          prompt: it.meta?.prompt || it.prompt || it.text || "",
          app: it.meta?.app || "video",
        },
      });
    }

    // newest first
    out.sort((a, b) => (Number(b.createdAt || 0) - Number(a.createdAt || 0)));
    return out.slice(0, MAX_ITEMS);
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items.slice(0, MAX_ITEMS)));
    } catch {}
  }

  /* =======================
     Fullscreen helper
     ======================= */

  function goFullscreen(card) {
    const video = card?.querySelector("video");
    if (!video) return;

    // Standard Fullscreen
    try {
      if (video.requestFullscreen) {
        video.requestFullscreen().catch?.(() => {});
        return;
      }
    } catch {}

    // iOS Safari video fullscreen
    try {
      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        return;
      }
    } catch {}

    // Last resort: fullscreen the card
    try {
      if (card.requestFullscreen) {
        card.requestFullscreen().catch?.(() => {});
        return;
      }
    } catch {}
  }

  /* =======================
     Render building blocks
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

    // ✅ SAFETY: only render <video> if READY
    if (!isReady(it) || !it.proxyUrl) {
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
          src="${esc(it.proxyUrl)}"
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
    return `
      <div class="vpMeta">
        <div class="vpTitle" title="${esc(kind)}">${esc(kind)}</div>
        <div class="vpSub" title="${esc(sub)}">${esc(sub)}</div>

        <div class="vpActions ${isReady(it) ? "" : "is-disabled"}">
          <button class="vpIconBtn" data-act="download" ${isReady(it) ? "" : "disabled"} title="İndir">⬇</button>
          <button class="vpIconBtn" data-act="share" ${isReady(it) ? "" : "disabled"} title="Paylaş">⤴</button>
          <button class="vpIconBtn vpDanger" data-act="delete" title="Sil">🗑</button>
        </div>
      </div>
    `;
  }

  function renderCard(it) {
    return `
      <div class="vpCard" data-id="${esc(it.id)}" role="button" tabindex="0">
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
     Actions (download/share/delete + play toggle)
     ======================= */

  function download(url) {
    const u = String(url || "").trim();
    if (!u) return;

    const a = document.createElement("a");
    a.href = u;
    a.download = "";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function share(url) {
    const u = String(url || "").trim();
    if (!u) return;

    if (navigator.share) {
      navigator.share({ url: u }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(u).catch(() => {});
    }
  }

  function attachEvents(host) {
    const grid = findGrid(host);
    if (!grid) return () => {};

    const onClick = (e) => {
      const card = e.target.closest(".vpCard");
      if (!card) return;

      const id = card.getAttribute("data-id");
      const it = state.items.find(x => String(x.id) === String(id));
      if (!it) return;

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

        if (act === "download") download(it.url);
        if (act === "share") share(it.url);
        if (act === "delete") {
          state.items = state.items.filter(x => String(x.id) !== String(id));
          saveItems();
          render(host);
        }
        return;
      }

      // click on card toggles play/pause if video exists & ready
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
     PPE bridge (Runway outputs)
     ======================= */

  function attachPPE(host) {
    if (!window.PPE) return () => {};

    const prev = PPE.onOutput;
    let active = true;

    PPE.onOutput = (job, out) => {
      try { prev && prev(job, out); } catch {}
      if (!active) return;

      if (!out || out.type !== "video" || !out.url) return;

      const job_id =
        job?.job_id ||
        job?.id ||
        out?.meta?.job_id ||
        out?.meta?.id ||
        null;

      const jid = job_id != null ? String(job_id) : null;

      // match: job_id or id
      const existing = jid
        ? state.items.find(x => String(x.job_id || "") === jid || String(x.id || "") === jid)
        : null;

      // fallback: newest processing card with no url
      const fallbackProcessing = !existing
        ? state.items.find(x => !String(x.url || "").trim() && isProcessing(x))
        : null;

      const target = existing || fallbackProcessing;

      const title = out?.meta?.title || out?.meta?.prompt || out?.meta?.text || (target?.title || "Video");

      if (target) {
        target.url = out.url;
        target.proxyUrl = toProxyUrl(out.url);
        target.status = "Hazır";
        target.title = title;
        if (!target.job_id && jid) target.job_id = jid;
        if (!target.id && jid) target.id = jid;
        target.meta = { ...(target.meta || {}), ...(out.meta || {}), app: "video" };
      } else {
        state.items.unshift({
          id: jid || uid(),
          job_id: jid || "",
          url: out.url,
          proxyUrl: toProxyUrl(out.url),
          status: "Hazır",
          title,
          createdAt: Date.now(),
          meta: { ...(out.meta || {}), app: "video" },
        });
      }

      saveItems();
      render(host);
    };

    return () => {
      active = false;
      PPE.onOutput = prev || null;
    };
  }

  /* =======================
     Job created bridge (pending card)
     ======================= */

  function attachJobCreated(host) {
    const onJob = (e) => {
      const d = e?.detail || {};
      if (d.app !== "video" || !d.job_id) return;

      const job_id = String(d.job_id);

      const exists = state.items.some(x => String(x.job_id || "") === job_id || String(x.id || "") === job_id);
      if (exists) return;

      const modeLabel = d.mode === "image" ? "Image→Video" : "Text→Video";
      const prompt = (d.prompt && String(d.prompt).trim()) ? String(d.prompt).trim() : "";
      const title = prompt ? `${modeLabel}: ${prompt}` : modeLabel;

      state.items.unshift({
        id: job_id,
        job_id,
        url: "",          // not ready
        proxyUrl: "",     // not ready
        status: "İşleniyor",
        title,
        createdAt: d.createdAt || Date.now(),
        meta: {
          mode: d.mode || "",
          prompt: prompt,
          image_url: d.image_url || "",
          app: "video",
        },
      });

      saveItems();
      render(host);
    };

    window.addEventListener("aivo:video:job_created", onJob);
    return () => window.removeEventListener("aivo:video:job_created", onJob);
  }

  /* =======================
     Panel register
     ======================= */

  window.RightPanel.register("video", {
    getHeader() {
      return {
        title: "Videolarım",
        meta: "",
        searchPlaceholder: "Videolarda ara...",
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
      const offJobs = attachJobCreated(host);

      return () => {
        try { offEvents(); } catch {}
        try { offPPE(); } catch {}
        try { offJobs(); } catch {}
      };
    },
  });
})();
