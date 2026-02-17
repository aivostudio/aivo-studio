// panel.video.js
// RightPanel Video (v2) — DB source-of-truth hydrate (/api/jobs/list?app=video)
// FIX: list response key variations + robust outputs parsing + output->READY override

(function () {
  if (!window.RightPanel) return;

  const STORAGE_KEY = "aivo.v2.video.items.v3";
  const LEGACY_KEYS = ["aivo.v2.video.items.v2", "aivo.v2.video.items"];
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
    return st === "hazır" || st === "ready" || st === "completed" || st === "succeeded";
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
      st === "pending" ||
      st === "running"
    );
  }

  function isError(item) {
    const st = String(item?.status || item?.state || "").toLowerCase();
    return st === "error" || st === "failed" || st === "fail" || st === "hata";
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

  function looksLikeLegacyBrokenR2(url) {
  // 🔥 Geçici fix:
  // media.aivo.tr linklerini artık "legacy broken" saymıyoruz.
  return false;
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
    const u = String(it?.url || it?.video_url || "").trim();
    if (!u) return "";
    return toMaybeProxyUrl(u);
  }

  function bestShareUrl(it) {
    const a = String(it?.archive_url || it?.archiveUrl || "").trim();
    if (a) return a;
    const u = String(it?.url || "").trim();
    return u;
  }

  /* =======================
     Storage (load / migrate / save)
     ======================= */

  function safeParse(json) {
    try { return JSON.parse(json); } catch { return null; }
  }

  function sanitizeItems(items) {
    const out = [];

    for (const it0 of (items || [])) {
      const it = it0 || {};
      const id = String(it.id || it.job_id || uid());
      const job_id = it.job_id != null ? String(it.job_id) : (it.id ? String(it.id) : "");

      const url = String(it.url || it.video_url || "").trim();
      const archive_url = String(it.archive_url || it.archiveUrl || it.meta?.archive_url || "").trim();

      const legacyBroken = looksLikeLegacyBrokenR2(archive_url || url);

      const status =
        legacyBroken ? "İşleniyor" :
        (it.status || it.state || ((archive_url || url) ? "Hazır" : "İşleniyor"));

      const title = it.title || it.meta?.title || it.meta?.prompt || it.prompt || it.text || "Video";
      const playbackUrl = (!legacyBroken && (archive_url || url))
        ? getPlaybackUrl({ archive_url, url })
        : "";

      out.push({
        id,
        job_id,
        title,
        status,
        url,
        archive_url,
        playbackUrl,
        createdAt: it.createdAt || it.created_at || Date.now(),
        meta: {
          ...(it.meta || {}),
          mode: it.meta?.mode || it.mode || it.kind || "",
          prompt: it.meta?.prompt || it.prompt || it.text || "",
          app: it.meta?.app || "video",
        },
      });
    }

    out.sort((a, b) => (Number(b.createdAt || 0) - Number(a.createdAt || 0)));
    return out.slice(0, MAX_ITEMS);
  }

  function loadItems() {
    const rawNew = localStorage.getItem(STORAGE_KEY);
    const arrNew = rawNew ? safeParse(rawNew) : null;
    if (Array.isArray(arrNew)) return sanitizeItems(arrNew);

    for (const k of LEGACY_KEYS) {
      const raw = localStorage.getItem(k);
      const arr = raw ? safeParse(raw) : null;
      if (Array.isArray(arr) && arr.length) {
        const cleaned = sanitizeItems(arr);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned.slice(0, MAX_ITEMS))); } catch {}
        try { localStorage.removeItem(k); } catch {}
        return cleaned;
      }
    }
    return [];
  }

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items.slice(0, MAX_ITEMS)));
    } catch {}
  }

  /* =======================
     DB hydrate (/api/jobs/list?app=video)
     ======================= */

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
      return t === "video" || mt === "video";
    };

    const hit = outputs.find((o) => isVideo(o) && pickUrl(o));
    if (hit) return pickUrl(hit);

    // fallback: any output that has a url
    const any = outputs.find((o) => pickUrl(o));
    return any ? pickUrl(any) : "";
  }

  function mapDbItemToPanelItem(r) {
    const job_id = String(r?.job_id || r?.id || "").trim();
    const meta = r?.meta || {};
    const outputs = r?.outputs || [];

    // possible top-level archive_url (optional)
    const archive_url =
      String(r?.archive_url || r?.archiveUrl || meta?.archive_url || meta?.archiveUrl || "").trim() || "";

    const urlFromOutputs = pickVideoUrlFromOutputs(outputs);

    // provider URLs sometimes nested
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

    const item = {
      id: job_id || uid(),
      job_id: job_id || "",
      title,
      status: "İşleniyor",
      url: url || "",
      archive_url: archive_url || "",
      createdAt: (r?.created_at ? new Date(r.created_at).getTime() : (r?.createdAt ? new Date(r.createdAt).getTime() : Date.now())),
      meta: {
        ...(meta || {}),
        mode: meta?.mode || "",
        prompt: meta?.prompt || r?.prompt || "",
        app: "video",
      },
    };

    const legacyBroken = looksLikeLegacyBrokenR2(item.archive_url || item.url);

    // playback
    const pb = legacyBroken ? "" : getPlaybackUrl(item);
    const hasOutput = !!pb;

    const rawState = String(r?.state || r?.status || r?.db_status || "").toUpperCase();
    const rawDbStatus = String(r?.db_status || "").toLowerCase();
    const isFailed = rawState === "FAILED" || rawState === "ERROR" || rawDbStatus === "error" || rawDbStatus === "failed";

    // ✅ RULE: output varsa her durumda READY
    if (legacyBroken) {
      item.status = "İşleniyor";
    } else if (isFailed) {
      item.status = "Hata";
    } else if (hasOutput) {
      item.status = "Hazır";
    } else {
      // fallback state mapping
      if (rawState === "COMPLETED" || rawState === "DONE" || rawState === "READY") item.status = "Hazır";
      else if (rawState === "RUNNING" || rawState === "PROCESSING") item.status = "İşleniyor";
      else item.status = "İşleniyor";
    }

    item.playbackUrl = hasOutput ? pb : "";
    return item;
  }

  function mergeByJobId(existing, incoming) {
    const map = new Map();

    // existing first (LS fast UI)
    for (const it of (existing || [])) {
      const key = String(it.job_id || it.id || "");
      map.set(key || uid(), it);
    }

    // DB overwrites
    for (const it of (incoming || [])) {
      const key = String(it.job_id || it.id || "");
      if (!key) continue;

      const prev = map.get(key);
      if (!prev) {
        map.set(key, it);
        continue;
      }

      map.set(key, {
        ...prev,
        ...it,
        title: it.title || prev.title,
        meta: { ...(prev.meta || {}), ...(it.meta || {}) },
      });
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => (Number(b.createdAt || 0) - Number(a.createdAt || 0)));
    return arr.slice(0, MAX_ITEMS);
  }

  function extractListItems(j) {
    // supports many backend shapes:
    // {ok:true, items:[...]} OR {ok:true, jobs:[...]} OR {ok:true, rows:[...]} OR {ok:true, data:[...]}
    if (!j) return [];
    if (Array.isArray(j.items)) return j.items;
    if (Array.isArray(j.jobs)) return j.jobs;
    if (Array.isArray(j.rows)) return j.rows;
    if (Array.isArray(j.data)) return j.data;
    if (Array.isArray(j.results)) return j.results;
    // sometimes list returns {ok:true, items:{rows:[...]}}
    if (Array.isArray(j.items?.rows)) return j.items.rows;
    return [];
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
        .filter((x) => x && (x.job_id || x.id));

      state.items = mergeByJobId(state.items, incoming);

      saveItems();
      render(host);

      // debug (optional)
      // console.table(incoming.map(x => ({ job_id:x.job_id, status:x.status, playback:!!x.playbackUrl })));

      // console.log("[video.panel] hydrated from DB:", incoming.length);
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
      const it = state.items.find(x => String(x.id) === String(id));
      if (!it) return;

      const btn = e.target.closest("[data-act]");
      const video = card.querySelector("video");
      const overlay = card.querySelector(".vpPlay");

      if (btn) {
        e.stopPropagation();
        const act = btn.getAttribute("data-act");

        if (act === "fs") { goFullscreen(card); return; }
        if (act === "download") downloadUrl(bestShareUrl(it));
        if (act === "share") shareUrl(bestShareUrl(it));

        if (act === "delete") {
          // şimdilik UI + LS delete (backend delete sonra eklenecek)
          state.items = state.items.filter(x => String(x.id) !== String(id));
          saveItems();
          render(host);
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
     PPE bridge (Runway outputs)
     ======================= */

  function attachPPE(host) {
    if (!window.PPE) return () => {};

    const prev = PPE.onOutput;
    let active = true;

    PPE.onOutput = (job, out) => {
      try { prev && prev(job, out); } catch {}
      if (!active) return;

      if (!out || String(out.type || "").toLowerCase() !== "video") return;

      const url = String(out.url || "").trim();
      const archive_url = String(out.archive_url || out.archiveUrl || out.meta?.archive_url || out.meta?.archiveUrl || "").trim();
      if (!url && !archive_url) return;

      const job_id =
        job?.job_id ||
        job?.id ||
        out?.meta?.job_id ||
        out?.meta?.id ||
        null;

      const jid = job_id != null ? String(job_id) : null;

      const existing = jid
        ? state.items.find(x => String(x.job_id || "") === jid || String(x.id || "") === jid)
        : null;

      const fallbackProcessing = !existing
        ? state.items.find(x => !String(x.url || "").trim() && !String(x.archive_url || "").trim() && isProcessing(x))
        : null;

      const target = existing || fallbackProcessing;

      const title =
        out?.meta?.title ||
        out?.meta?.prompt ||
        out?.meta?.text ||
        (target?.title || "Video");

      const nextUrl = archive_url || url;
      const legacyBroken = looksLikeLegacyBrokenR2(nextUrl);

      if (target) {
        if (url) target.url = url;
        if (archive_url) target.archive_url = archive_url;

        target.status = legacyBroken ? "İşleniyor" : "Hazır";
        target.title = title;

        if (!target.job_id && jid) target.job_id = jid;
        if (!target.id && jid) target.id = jid;

        target.meta = { ...(target.meta || {}), ...(out.meta || {}), app: "video" };
        target.playbackUrl = (!legacyBroken && isReady(target)) ? getPlaybackUrl(target) : "";
      } else {
        const item = {
          id: jid || uid(),
          job_id: jid || "",
          url: url || "",
          archive_url: archive_url || "",
          status: legacyBroken ? "İşleniyor" : "Hazır",
          title,
          createdAt: Date.now(),
          meta: { ...(out.meta || {}), app: "video" },
        };
        item.playbackUrl = (!legacyBroken && isReady(item)) ? getPlaybackUrl(item) : "";
        state.items.unshift(item);
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
        url: "",
        archive_url: "",
        playbackUrl: "",
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

      // 1) instant UI from LS
      state.items = loadItems();
      render(host);

      // 2) hydrate from DB (source of truth)
      hydrateFromDB(host);

      // 3) periodic hydrate
      const t = setInterval(() => hydrateFromDB(host), 15000);

      const offEvents = attachEvents(host);
      const offPPE = attachPPE(host);
      const offJobs = attachJobCreated(host);

      return () => {
        try { clearInterval(t); } catch {}
        try { offEvents(); } catch {}
        try { offPPE(); } catch {}
        try { offJobs(); } catch {}
      };
    },
  });
})();
