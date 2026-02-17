// panel.video.js
// RightPanel Video (v2.1) — Hybrid: DB list hydrate + per-job status poll
// Goal: instant placeholder on create + NEVER stuck on "İşleniyor"
// Source of truth preference:
//  1) /api/jobs/status?job_id=... (for in-flight items; fastest)
//  2) /api/jobs/list?app=video (for history / bulk hydrate)
//  3) PPE.onOutput (bridge)

(function () {
  if (!window.RightPanel) return;

  const STORAGE_KEY = "aivo.v2.video.items.v4";
  const LEGACY_KEYS = ["aivo.v2.video.items.v3", "aivo.v2.video.items.v2", "aivo.v2.video.items"];
  const MAX_ITEMS = 50;

  // polling
  const LIST_POLL_MS = 15000;
  const STATUS_POLL_MS = 5000;

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
    const u = String(it?.url || it?.video_url || it?.videoUrl || "").trim();
    if (!u) return "";
    return toMaybeProxyUrl(u);
  }

  function bestShareUrl(it) {
    const a = String(it?.archive_url || it?.archiveUrl || "").trim();
    if (a) return a;
    const u = String(it?.url || it?.video_url || it?.videoUrl || "").trim();
    return u;
  }

  // output var mı? (UI item + DB row shape)
  function hasOutput(item) {
    if (String(item?.playbackUrl || "").trim()) return true;

    if (String(item?.archive_url || item?.archiveUrl || "").trim()) return true;
    if (String(item?.url || item?.video_url || item?.videoUrl || "").trim()) return true;

    const outs = item?.outputs;
    if (Array.isArray(outs)) {
      return outs.some((o) => {
        const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind || "");
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
        return (t === "video" || t === "") && !!u;
      });
    }
    return false;
  }

  function isReady(item) {
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

  function isProcessing(item) {
    if (isReady(item)) return false;
    const st = getStatusText(item);
    return (
      st === "işleniyor" ||
      st === "processing" ||
      st === "running" ||
      st === "pending" ||
      st === "queued" ||
      st === "in queue" ||
      st === "in progress" ||
      st === "started"
    );
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

  function safeParse(json) {
    try { return JSON.parse(json); } catch { return null; }
  }

  function nowMs() {
    return Date.now();
  }

  /* =======================
     Storage (load / migrate / save)
     ======================= */

  function sanitizeItems(items) {
    const out = [];

    for (const it0 of (items || [])) {
      const it = it0 || {};
      const job_id = String(it.job_id || it.id || "").trim();
      const id = job_id || String(it.id || uid());

      const url = String(it.url || it.video_url || it.videoUrl || "").trim();
      const archive_url = String(it.archive_url || it.archiveUrl || it.meta?.archive_url || it.meta?.archiveUrl || "").trim();

      const pb = getPlaybackUrl({ archive_url, url });

      out.push({
        id,
        job_id,
        title: it.title || it.meta?.title || it.meta?.prompt || it.prompt || it.text || "Video",
        status: it.status || it.db_status || it.state || (pb ? "Hazır" : "İşleniyor"),
        url,
        archive_url,
        playbackUrl: pb || "",
        createdAt: it.createdAt || it.created_at || nowMs(),
        lastPolledAt: it.lastPolledAt || 0,
        meta: {
          ...(it.meta || {}),
          mode: it.meta?.mode || it.mode || it.kind || "",
          prompt: it.meta?.prompt || it.prompt || it.text || "",
          app: it.meta?.app || "video",
        },
        outputs: Array.isArray(it.outputs) ? it.outputs : [],
        state: it.state,
        db_status: it.db_status,
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

    const any = outputs.find((o) => pickUrl(o));
    return any ? pickUrl(any) : "";
  }

  function mapDbItemToPanelItem(r) {
    const job_id = String(r?.job_id || r?.id || "").trim();
    const meta = r?.meta || {};
    const outputs = r?.outputs || [];

    const archive_url =
      String(r?.archive_url || r?.archiveUrl || meta?.archive_url || meta?.archiveUrl || "").trim() || "";

    const urlFromOutputs =
      pickVideoUrlFromOutputs(outputs) ||
      r?.video?.url ||
      r?.video_url ||
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
    const pb = getPlaybackUrl({ archive_url, url });

    const title =
      meta?.title ||
      meta?.prompt ||
      r?.prompt ||
      "Video";

    const item = {
      id: job_id || uid(),
      job_id: job_id || "",
      title,
      status: pb ? "Hazır" : "İşleniyor",
      url: url || "",
      archive_url: archive_url || "",
      playbackUrl: pb || "",
      createdAt: (r?.created_at ? new Date(r.created_at).getTime() : (r?.createdAt ? new Date(r.createdAt).getTime() : nowMs())),
      lastPolledAt: 0,
      meta: {
        ...(meta || {}),
        mode: meta?.mode || "",
        prompt: meta?.prompt || r?.prompt || "",
        app: "video",
      },
      outputs: Array.isArray(outputs) ? outputs : [],
      state: r?.state,
      db_status: r?.db_status,
    };

    // if DB says failed
    const rawState = String(r?.state || "").toUpperCase();
    const rawDbStatus = norm(r?.db_status);
    const rawStatus = norm(r?.status);

    const isFailed =
      rawState === "FAILED" ||
      rawState === "ERROR" ||
      rawDbStatus === "error" ||
      rawDbStatus === "failed" ||
      rawStatus === "error" ||
      rawStatus === "failed";

    if (isFailed) item.status = "Hata";
    else if (pb) item.status = "Hazır";

    return item;
  }

  function mergeByJobId(existing, incoming) {
    const map = new Map();

    for (const it of (existing || [])) {
      const key = String(it.job_id || it.id || "");
      map.set(key || uid(), it);
    }

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
    if (!j) return [];
    if (Array.isArray(j.items)) return j.items;
    if (Array.isArray(j.jobs)) return j.jobs;
    if (Array.isArray(j.rows)) return j.rows;
    if (Array.isArray(j.data)) return j.data;
    if (Array.isArray(j.results)) return j.results;
    if (Array.isArray(j.items?.rows)) return j.items.rows;
    return [];
  }

  async function hydrateFromDB(host) {
    try {
      const r = await fetch("/api/jobs/list?app=video", { method: "GET", credentials: "include" });
      const j = await r.json().catch(() => null);

      if (!r.ok || !j || !j.ok) {
        console.warn("[video.panel] hydrate failed", r.status, j);
        return;
      }

      const rows = extractListItems(j);

      const incoming = (rows || [])
        .map(mapDbItemToPanelItem)
        .filter((x) => x && (x.job_id || x.id));

      state.items = mergeByJobId(state.items, incoming);

      saveItems();
      render(host);
    } catch (e) {
      console.warn("[video.panel] hydrate exception", e);
    }
  }

  /* =======================
     Status poll (/api/jobs/status?job_id=...)
     ======================= */

  function applyStatusToItem(it, st) {
    if (!it || !st) return;

    // st shape (from your screenshot):
    // { ok:true, job_id, status:"ready", db_status:"done", outputs:[...], video:{url}, ... }
    it.state = st.state;
    it.db_status = st.db_status;
    it.status = st.status || it.status;

    // outputs / url
    const videoUrl = String(st?.video?.url || "").trim();
    if (videoUrl) it.url = videoUrl;

    if (Array.isArray(st.outputs)) it.outputs = st.outputs;

    // READY override if output exists
    const pb = getPlaybackUrl(it);
    if (pb) {
      it.playbackUrl = pb;
      it.status = "Hazır";
    } else {
      // keep error if exists
      const nst = norm(st.status || st.db_status || st.state);
      if (nst === "error" || nst === "failed") it.status = "Hata";
      else it.status = "İşleniyor";
    }

    it.lastPolledAt = nowMs();
  }

  async function pollStatusForJob(job_id) {
    const jid = String(job_id || "").trim();
    if (!jid) return null;

    const r = await fetch("/api/jobs/status?job_id=" + encodeURIComponent(jid), { credentials: "include" });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.ok) return null;
    return j;
  }

  async function pollPendingStatuses(host) {
    // only poll items that are processing (no output yet)
    const pending = state.items.filter(it => it && (it.job_id || it.id) && !isReady(it) && !isError(it));

    if (!pending.length) return;

    for (const it of pending) {
      const jid = String(it.job_id || it.id || "").trim();
      if (!jid) continue;

      // throttle per item
      if (it.lastPolledAt && (nowMs() - Number(it.lastPolledAt)) < (STATUS_POLL_MS - 200)) continue;

      try {
        const st = await pollStatusForJob(jid);
        if (st) {
          applyStatusToItem(it, st);
        }
      } catch {}
    }

    saveItems();
    render(host);
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

    const pb = String(it.playbackUrl || "").trim();
    if (!isReady(it) || !pb) {
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
          src="${esc(pb)}"
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

      if (target) {
        if (url) target.url = url;
        if (archive_url) target.archive_url = archive_url;

        target.title = title;
        target.meta = { ...(target.meta || {}), ...(out.meta || {}), app: "video" };

        if (!target.job_id && jid) target.job_id = jid;
        if (!target.id && jid) target.id = jid;

        // READY if playback exists
        const pb = getPlaybackUrl(target);
        target.playbackUrl = pb || "";
        target.status = pb ? "Hazır" : "İşleniyor";
      } else {
        const item = {
          id: jid || uid(),
          job_id: jid || "",
          url: url || "",
          archive_url: archive_url || "",
          status: "İşleniyor",
          title,
          createdAt: nowMs(),
          lastPolledAt: 0,
          meta: { ...(out.meta || {}), app: "video" },
          outputs: [],
        };
        const pb = getPlaybackUrl(item);
        item.playbackUrl = pb || "";
        item.status = pb ? "Hazır" : "İşleniyor";
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
     Job created bridge (pending card) + immediate status poll
     ======================= */

  function upsertPendingCard(host, d) {
    const job_id = String(d?.job_id || d?.id || "").trim();
    if (!job_id) return;

    const exists = state.items.find(x => String(x.job_id || x.id || "") === job_id);
    const modeLabel = d.mode === "image" ? "Image→Video" : "Text→Video";
    const prompt = (d.prompt && String(d.prompt).trim()) ? String(d.prompt).trim() : "";
    const title = prompt ? `${modeLabel}: ${prompt}` : modeLabel;

    if (!exists) {
      state.items.unshift({
        id: job_id,
        job_id,
        url: "",
        archive_url: "",
        playbackUrl: "",
        status: "İşleniyor",
        title,
        createdAt: d.createdAt || nowMs(),
        lastPolledAt: 0,
        meta: {
          mode: d.mode || "",
          prompt: prompt,
          image_url: d.image_url || "",
          app: "video",
        },
        outputs: [],
      });
    } else {
      // update meta/title if missing
      exists.title = exists.title || title;
      exists.meta = { ...(exists.meta || {}), mode: d.mode || exists.meta?.mode, prompt: prompt || exists.meta?.prompt, app: "video" };
      if (!exists.status) exists.status = "İşleniyor";
    }

    // render immediately + kick a status poll (no need to wait 5s)
    saveItems();
    render(host);

    // immediate status fetch
    (async () => {
      try {
        const st = await pollStatusForJob(job_id);
        if (!st) return;
        const it = state.items.find(x => String(x.job_id || x.id || "") === job_id);
        if (!it) return;
        applyStatusToItem(it, st);
        saveItems();
        render(host);
      } catch {}
    })();
  }

  function attachJobCreated(host) {
    const onJob = (e) => {
      const d = e?.detail || {};
      // accept {app:"video"} or missing app (some older emitters)
      if (d.app && d.app !== "video") return;
      if (!d.job_id && !d.id) return;
      upsertPendingCard(host, d);
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

      // 2) hydrate from DB (history)
      hydrateFromDB(host);

      // 3) periodic hydrate (DB list)
      const tList = setInterval(() => hydrateFromDB(host), LIST_POLL_MS);

      // 4) periodic status poll for pending items (this prevents "stuck processing")
      const tStatus = setInterval(() => pollPendingStatuses(host), STATUS_POLL_MS);

      const offEvents = attachEvents(host);
      const offPPE = attachPPE(host);
      const offJobs = attachJobCreated(host);

      // initial status sweep (fast)
      pollPendingStatuses(host);

      return () => {
        try { clearInterval(tList); } catch {}
        try { clearInterval(tStatus); } catch {}
        try { offEvents(); } catch {}
        try { offPPE(); } catch {}
        try { offJobs(); } catch {}
      };
    },
  });
})();
