// panel.video.js
// RightPanel Video (v2) — STRICT app filtering (video only)
// Fix: Atmo outputs leaking into Video panel via PPE bridge
// Fix: Hydrate from DB must ignore non-video rows even if endpoint returns mixed data
// UX: Safari-friendly attrs (muted + webkit-playsinline)

(function () {
  if (!window.RightPanel) return;

  const STORAGE_KEY = "aivo.v2.video.items.v4";
  const LEGACY_KEYS = [
    "aivo.v2.video.items.v3",
    "aivo.v2.video.items.v2",
    "aivo.v2.video.items",
  ];
  const MAX_ITEMS = 50;

  const STATUS_POLL_EVERY_MS = 4000;
  const STATUS_POLL_BATCH = 3;
  const STATUS_POLL_TIMEOUT_MS = 15000;

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

  function isVideoApp(x) {
    // accept only "video" (strict)
    return norm(x) === "video";
  }

  function toMaybeProxyUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.startsWith("/api/media/proxy?url=") || u.includes("/api/media/proxy?url=")) return u;
    if (u.startsWith("http://")) return "/api/media/proxy?url=" + encodeURIComponent(u);
    return u;
  }

  /* =======================
     Outputs URL picking
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

  function pickBestUrl(it) {
    if (!it) return "";
    const a = String(it.archive_url || it.archiveUrl || "").trim();
    if (a) return a;
    const u = String(it.url || it.video_url || it.videoUrl || "").trim();
    if (u) return u;
    const uo = pickVideoUrlFromOutputs(it.outputs);
    if (uo) return uo;
    return "";
  }

  function getPlaybackUrl(it) {
    const best = pickBestUrl(it);
    if (!best) return "";
    return toMaybeProxyUrl(best);
  }

  function bestShareUrl(it) {
    return String(pickBestUrl(it) || "").trim();
  }

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

  function getStatusText(item) {
    const primary = norm(item?.status || item?.db_status);
    const secondary = norm(item?.state);
    return primary || secondary || "";
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

  /* =======================
     Storage
     ======================= */

  function safeParse(json) {
    try { return JSON.parse(json); } catch { return null; }
  }

  function sanitizeItems(items) {
    const out = [];

    for (const it0 of (items || [])) {
      const it = it0 || {};

      // STRICT: keep only video app items
      const appGuess =
        it?.meta?.app ||
        it?.app ||
        it0?.meta?.app ||
        it0?.app ||
        "";
      if (!isVideoApp(appGuess)) continue;

      const id = String(it.id || it.job_id || uid());
      const job_id = it.job_id != null ? String(it.job_id) : (it.id ? String(it.id) : "");

      const outs0 = Array.isArray(it.outputs) ? it.outputs : (Array.isArray(it0?.outputs) ? it0.outputs : []);
      const fromOut = pickVideoUrlFromOutputs(outs0);

      const url = String(it.url || it.video_url || it.videoUrl || fromOut || "").trim();
      const archive_url = String(it.archive_url || it.archiveUrl || it.meta?.archive_url || it.meta?.archiveUrl || "").trim();

      const readyByOutput = !!(archive_url || url);
      const status = readyByOutput ? "Hazır" : (it.status || it.state || it.db_status || "İşleniyor");

      const title = it.title || it.meta?.title || it.meta?.prompt || it.prompt || it.text || "Video";
      const pb = (archive_url || url) ? getPlaybackUrl({ ...it, archive_url, url, outputs: outs0 }) : "";

      out.push({
        id,
        job_id,
        title,
        status,
        url,
        archive_url,
        playbackUrl: pb || "",
        createdAt: it.createdAt || it.created_at || Date.now(),
        meta: {
          ...(it.meta || {}),
          mode: it.meta?.mode || it.mode || it.kind || "",
          prompt: it.meta?.prompt || it.prompt || it.text || "",
          app: "video",
        },
        outputs: outs0,
        state: it.state,
        db_status: it.db_status,
        app: "video",
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
  // ❌ Artık localStorage kullanmıyoruz.
  // Source of truth = backend (/api/jobs/list)
  return;
}

  /* =======================
     DB hydrate
     ======================= */

  function extractListItems(j) {
    if (!j) return [];
    if (Array.isArray(j.items)) return j.items;
    if (Array.isArray(j.jobs)) return j.jobs;
    if (Array.isArray(j.rows)) return j.rows;
    if (Array.isArray(j.data)) return j.data;
    if (Array.isArray(j.results)) return j.results;
    return [];
  }

  function mapDbItemToPanelItem(r) {
    const job_id = String(r?.job_id || r?.id || "").trim();
    const meta = r?.meta || {};
    const outputs = Array.isArray(r?.outputs) ? r.outputs : [];

    const appGuess = String(r?.app || meta?.app || "").trim();
    if (!isVideoApp(appGuess)) return null; // STRICT

    const archive_url =
      String(r?.archive_url || r?.archiveUrl || meta?.archive_url || meta?.archiveUrl || "").trim() || "";

    const urlFromOutputs = pickVideoUrlFromOutputs(outputs);
    const providerUrl =
      String(
        meta?.video?.url ||
        meta?.runway?.video?.url ||
        meta?.provider?.video?.url ||
        meta?.output?.url ||
        meta?.result?.url ||
        ""
      ).trim();

    const url = String(urlFromOutputs || r?.video?.url || r?.video_url || providerUrl || "").trim();

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
      createdAt: (r?.created_at ? new Date(r.created_at).getTime() : Date.now()),
      meta: {
        ...(meta || {}),
        mode: meta?.mode || "",
        prompt: meta?.prompt || r?.prompt || "",
        app: "video",
      },
      outputs,
      state: r?.state,
      db_status: r?.db_status,
      app: "video",
    };

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
    else if (hasOutput(item)) item.status = "Hazır";
    else if (rawState === "COMPLETED" || rawState === "DONE" || rawState === "READY") item.status = "Hazır";
    else item.status = "İşleniyor";

    item.playbackUrl = getPlaybackUrl(item) || "";

    return item;
  }

  function mergeByJobId(existing, incoming) {
    const map = new Map();

    for (const it of (existing || [])) {
      const key = String(it.job_id || it.id || "");
      if (!key) continue;
      map.set(key, it);
    }

    for (const it of (incoming || [])) {
      if (!it) continue;
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
        outputs: Array.isArray(it.outputs) && it.outputs.length ? it.outputs : (prev.outputs || []),
        playbackUrl: String(it.playbackUrl || prev.playbackUrl || "").trim() || getPlaybackUrl(it) || getPlaybackUrl(prev) || "",
        app: "video",
      });
    }

    const arr = Array.from(map.values());
    arr.sort((a, b) => (Number(b.createdAt || 0) - Number(a.createdAt || 0)));
    return arr.slice(0, MAX_ITEMS);
  }

  async function hydrateFromDB(host) {
    try {
      const r = await fetch("/api/jobs/list?app=video", {
        method: "GET",
        credentials: "include",
        headers: { "accept": "application/json" },
      });

      const j = await r.json().catch(() => null);

      if (!r.ok || !j || !j.ok) {
        console.warn("[video.panel] hydrate failed", r.status, j);
        return;
      }

    const rows = extractListItems(j);

// DB = tek gerçek kaynak (source-of-truth)
const incoming = (rows || [])
  .map(mapDbItemToPanelItem)
  .filter(Boolean);

// ✅ merge YOK: DB ne döndürdüyse o
state.items = incoming;

// ✅ DB hydrate sırasında localStorage'a yazma (geri gelme kökü buydu)
render(host);

pollPendingStatuses(host).catch(() => {});
} catch (e) {
  console.warn("[video.panel] hydrate exception", e);
}
}


  /* =======================
     Status poll
     ======================= */

  function pickStatusVideoUrl(j) {
    if (!j) return "";
    const u1 = j?.video?.url;
    if (u1) return String(u1).trim();
    const uo = pickVideoUrlFromOutputs(j?.outputs);
    if (uo) return String(uo).trim();
    return "";
  }

  async function fetchStatus(job_id) {
    const jid = String(job_id || "").trim();
    if (!jid) return null;

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort("timeout"), STATUS_POLL_TIMEOUT_MS);

    try {
      const r = await fetch("/api/jobs/status?job_id=" + encodeURIComponent(jid), {
        method: "GET",
        credentials: "include",
        headers: { "accept": "application/json" },
        signal: ctrl.signal,
      });

      const j = await r.json().catch(() => null);
      if (!r.ok || !j || !j.ok) return null;

      // STRICT: status payload might include meta.app; ignore if not video
      const appGuess = String(j?.app || j?.meta?.app || "").trim();
      if (appGuess && !isVideoApp(appGuess)) return null;

      return j;
    } catch {
      return null;
    } finally {
      try { clearTimeout(t); } catch {}
    }
  }

  async function pollPendingStatuses(host) {
    const pending = state.items
      .filter(it => it && (it.job_id || it.id))
      .filter(it => !isReady(it) || !String(it.playbackUrl || "").trim())
      .filter(it => !isError(it))
      .slice(0, STATUS_POLL_BATCH);

    if (!pending.length) return;

    for (const it of pending) {
      const jid = String(it.job_id || it.id || "").trim();
      if (!jid) continue;

      const s = await fetchStatus(jid);
      if (!s) continue;

      const st = norm(s.status);
      const ready = st === "ready" || st === "done" || st === "completed";
      const url = pickStatusVideoUrl(s);
      const hasUrl = !!String(url || "").trim();

      const err = st === "error" || st === "failed";
      if (err) {
        it.status = "Hata";
        saveItems();
        render(host);
        continue;
      }

      if (ready || hasUrl) {
        if (hasUrl) it.url = url;
        if (Array.isArray(s.outputs)) it.outputs = s.outputs;

        it.db_status = s.db_status || it.db_status;
        it.state = s.state || it.state;
        it.status = "Hazır";
        it.playbackUrl = getPlaybackUrl(it) || "";

        saveItems();
        render(host);
      }
    }
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

  if (!it.playbackUrl) {
    const pb2 = getPlaybackUrl(it);
    if (pb2) it.playbackUrl = pb2;
  }

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
        webkit-playsinline
        muted
        controls
        data-user-gesture="0"
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

  // ✅ id’yi butonlara da basıyoruz (event handler işi kolaylaşsın)
  return `
    <div class="vpMeta">
      <div class="vpTitle" title="${esc(kind)}">${esc(kind)}</div>
      <div class="vpSub" title="${esc(sub)}">${esc(sub)}</div>

      <div class="vpActions">
        <button class="vpIconBtn" data-act="download" data-id="${esc(it.id)}" ${ready ? "" : "disabled"} title="İndir">⬇</button>
        <button class="vpIconBtn" data-act="share" data-id="${esc(it.id)}" ${ready ? "" : "disabled"} title="Paylaş">⤴</button>
        <button class="vpIconBtn vpDanger" data-act="delete" data-id="${esc(it.id)}" title="Sil">🗑</button>
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
   Actions (ADD/REPLACE)
   ======================= */

// ✅ Bu handler, “Sil”i backend’e bağlar.
// Not: `db` panel scope’unda olmalı (DBJobs.create(...) ile).
function bindActions(host) {
  if (!host || host.__vpActionsBound) return;
  host.__vpActionsBound = true;

  host.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;
    const card = btn.closest(".vpCard");
    const id = (btn.dataset.id || (card && card.dataset.id) || "").trim();
    if (!id) return;

    // buton tıklaması kart click’ine karışmasın
    e.preventDefault();
    e.stopPropagation();

    try {
      if (act === "delete") {
        // ✅ DB’den kalıcı sil
        btn.disabled = true;

        if (!window.db && typeof db === "undefined") {
          // db yoksa: hiçbir şey yapma, ama UI da silme (debug için)
          toast?.error?.("db controller yok (DBJobs.create çalışmamış).");
          btn.disabled = false;
          return;
        }

        const controller = (typeof db !== "undefined") ? db : window.db;

        const ok = await controller.deleteJob(id); // <-- /api/jobs/delete
        if (!ok) {
          // delete başarısızsa geri hydrate et ki kart geri gelsin
          try { await controller.hydrate(true); } catch {}
          toast?.error?.("Silinemedi (backend).");
          btn.disabled = false;
        }

        return;
      }

      if (act === "download") {
        const it = state.items.find(x => String(x.id) === String(id));
        const url = it?.playbackUrl || it?.url || getPlaybackUrl(it);
        if (url) window.open(url, "_blank");
        return;
      }

      if (act === "share") {
        const it = state.items.find(x => String(x.id) === String(id));
        const url = it?.playbackUrl || it?.url || getPlaybackUrl(it);
        if (!url) return;

        if (navigator.share) {
          await navigator.share({ title: "AIVO Video", url });
        } else {
          await navigator.clipboard.writeText(url);
          toast?.success?.("Link kopyalandı.");
        }
        return;
      }

      if (act === "fs") {
        // mevcut fullscreen davranışın varsa burada bırak / çağır
        // (bu kısım sende zaten varsa dokunma)
        return;
      }
    } catch (err) {
      try {
        const controller = (typeof db !== "undefined") ? db : window.db;
        await controller?.hydrate?.(true);
      } catch {}
      toast?.error?.("İşlem sırasında hata oluştu.");
      try { btn.disabled = false; } catch {}
    }
  });
}

/* =======================
   Hook: init/mount içine EKLE
   ======================= */

// Panel mount / init fonksiyonunda render’dan sonra çağır:
/// bindActions(host);


  /* =======================
     Actions + events
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

  function attachEvents(host) {
    const grid = findGrid(host);
    if (!grid) return () => {};

    const onPlayCapture = (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement)) return;
      const g = String(v.getAttribute("data-user-gesture") || "0");
      if (g !== "1") {
        try { v.pause(); } catch {}
      }
    };
    grid.addEventListener("play", onPlayCapture, true);

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
        video.setAttribute("data-user-gesture", "1");
        video.play().catch(() => {});
        if (overlay) overlay.style.display = "none";
      } else {
        video.pause();
        video.setAttribute("data-user-gesture", "0");
        if (overlay) overlay.style.display = "";
      }
    };

    grid.addEventListener("click", onClick);

    return () => {
      grid.removeEventListener("click", onClick);
      grid.removeEventListener("play", onPlayCapture, true);
    };
  }

  /* =======================
     PPE bridge (STRICT)
     ======================= */

  function attachPPE(host) {
    if (!window.PPE) return () => {};

    const prev = PPE.onOutput;
    let active = true;

    PPE.onOutput = (job, out) => {
      try { prev && prev(job, out); } catch {}
      if (!active) return;

      if (!out || String(out.type || "").toLowerCase() !== "video") return;

      // STRICT: accept only meta.app === "video" OR job.app === "video"
      const outApp = String(out?.meta?.app || "").trim();
      const jobApp = String(job?.app || job?.meta?.app || "").trim();
      if ((outApp && !isVideoApp(outApp)) || (jobApp && !isVideoApp(jobApp))) {
        // if either explicitly says non-video, ignore
        return;
      }
      // if both missing, also ignore (prevents accidental leaks)
      if (!isVideoApp(outApp) && !isVideoApp(jobApp)) return;

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

        target.status = "Hazır";
        target.title = title;

        if (!target.job_id && jid) target.job_id = jid;
        if (!target.id && jid) target.id = jid;

        target.meta = { ...(target.meta || {}), ...(out.meta || {}), app: "video" };
        target.app = "video";
        target.playbackUrl = getPlaybackUrl(target) || "";
      } else {
        const item = {
          id: jid || uid(),
          job_id: jid || "",
          url: url || "",
          archive_url: archive_url || "",
          status: "Hazır",
          title,
          createdAt: Date.now(),
          meta: { ...(out.meta || {}), app: "video" },
          outputs: [],
          app: "video",
        };
        item.playbackUrl = getPlaybackUrl(item) || "";
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
     Job created bridge (video only)
     ======================= */

  function attachJobCreated(host) {
    const onJob = (e) => {
      const d = e?.detail || {};
      if (!isVideoApp(d.app) || !d.job_id) return;

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
        outputs: [],
        state: "PENDING",
        db_status: "pending",
        app: "video",
      });

      saveItems();
      render(host);

      pollPendingStatuses(host).catch(() => {});
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

      // 3) periodic hydrate (list)
      const tList = setInterval(() => hydrateFromDB(host), 15000);

      // 4) fast status poll for pending items
      const tStatus = setInterval(() => pollPendingStatuses(host).catch(() => {}), STATUS_POLL_EVERY_MS);

      const offEvents = attachEvents(host);
      const offPPE = attachPPE(host);
      const offJobs = attachJobCreated(host);

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
