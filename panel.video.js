// panel.video.js
// RightPanel Video (v2) — with DB hydrate (/api/jobs/list?app=video)

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

  function looksLikeLegacyBrokenR2(url) {
    const u = String(url || "");
    return /https?:\/\/media\.aivo\.tr\/outputs\/video\/[0-9a-f-]{36}\.mp4/i.test(u);
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

  function saveItems() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items.slice(0, MAX_ITEMS)));
    } catch {}
  }

/* =======================
   DB hydrate (/api/jobs/list?app=video)
   ======================= */

function dbStateToStatus(s) {
  const v = String(s || "").trim().toUpperCase();

  // ✅ READY/COMPLETED/DONE varyasyonları
  if (v === "READY" || v === "DONE" || v === "COMPLETED" || v === "SUCCEEDED" || v === "SUCCESS") {
    return "Hazır";
  }

  // ✅ ERROR/FAILED varyasyonları
  if (v === "FAILED" || v === "ERROR" || v === "FAIL" || v === "CANCELED" || v === "CANCELLED") {
    return "Hata";
  }

  // ✅ Queue + processing varyasyonları
  if (
    v === "RUNNING" ||
    v === "PROCESSING" ||
    v === "IN_PROGRESS" ||
    v === "PENDING" ||
    v === "QUEUED" ||
    v === "IN_QUEUE" ||
    v === "IN QUEUE" ||
    v === "STARTING"
  ) {
    return "İşleniyor";
  }

  return "İşleniyor";
}

function pickVideoUrlFromOutputs(outputs) {
  if (!Array.isArray(outputs)) return "";
  const v = outputs.find((o) => o && (o.type === "video" || o.kind === "video") && (o.url || o.archive_url));
  if (!v) return "";
  return String(v.archive_url || v.archiveUrl || v.url || "").trim();
}

function mapDbItemToPanelItem(r) {
  const job_id = String(r.job_id || r.id || "");
  const meta = r.meta || {};
  const outputs = r.outputs || [];

  const archive_url =
    String(r.archive_url || r.archiveUrl || meta.archive_url || "").trim() ||
    ""; // (ileride DB'ye archive_url kolonuyla koyarsan burası direkt çalışır)

  const urlFromOutputs = pickVideoUrlFromOutputs(outputs);
  const providerUrl =
    String(meta?.video?.url || meta?.runway?.video?.url || "").trim();

  const url = String(urlFromOutputs || providerUrl || "").trim();

  const legacyBroken = looksLikeLegacyBrokenR2(archive_url || url);

  const status = legacyBroken
    ? "İşleniyor"
    : (r.state ? dbStateToStatus(r.state) : dbStateToStatus(r.status));

  const title =
    meta?.title ||
    meta?.prompt ||
    r.prompt ||
    "Video";

  const item = {
    id: job_id || uid(),
    job_id: job_id || "",
    title,
    status,
    url: url || "",
    archive_url: archive_url || "",
    createdAt: (r.created_at ? new Date(r.created_at).getTime() : Date.now()),
    meta: {
      ...(meta || {}),
      mode: meta?.mode || "",
      prompt: meta?.prompt || r.prompt || "",
      app: "video",
    },
  };

  // Yeni (çıktı varsa playback ver):
  const pb = getPlaybackUrl(item);
  const hasOutput = !!pb;

  // COMPLETED yazıp URL yoksa "Hazır" deme (kartı kaybetme/yanlış badge verme)
  if (!legacyBroken) {
    const st = String(r.state || r.status || "").toUpperCase();
    const mapped = (st === "FAILED" || st === "ERROR") ? "Hata"
                 : (st === "COMPLETED" || st === "DONE" || st === "READY") ? "Hazır"
                 : "İşleniyor";
    item.status = (mapped === "Hazır" && !hasOutput) ? "İşleniyor" : mapped;
  }

  item.playbackUrl = (!legacyBroken && hasOutput) ? pb : "";
  return item;
}

function mergeByJobId(existing, incoming) {
  const map = new Map();

  // existing first (LS hızlı UI)
  for (const it of (existing || [])) {
    const key = String(it.job_id || it.id || "");
    map.set(key || uid(), it);
  }

  // incoming overwrites where same job_id (DB truth)
  for (const it of (incoming || [])) {
    const key = String(it.job_id || it.id || "");
    if (!key) continue;

    const prev = map.get(key);
    if (!prev) {
      map.set(key, it);
      continue;
    }

    // merge: DB status/url wins; keep local title if DB missing
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

    const incoming = (j.items || [])
      .map(mapDbItemToPanelItem)
      .filter((x) => x && (x.job_id || x.id));

    // DEBUG
    console.table(incoming.map(x => ({
      job_id: x.job_id,
      status: x.status,
      url: (x.url || "").slice(0, 40),
      archive: (x.archive_url || "").slice(0, 40),
      playback: (x.playbackUrl || "").slice(0, 60),
    })));

    // sonra normal akış
    state.items = mergeByJobId(state.items, incoming);

    saveItems();
    render(host);

    console.log("[video.panel] hydrated from DB:", incoming.length);
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

      <!-- ✅ wrapper artık disabled değil; delete her zaman clickable -->
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
        // ✅ SADECE UI + LS delete (çalışan versiyon)
        state.items = state.items.filter(
          x => String(x.id) !== String(id)
        );
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

      if (!out || out.type !== "video") return;

      const url = String(out.url || "").trim();
      const archive_url = String(out.archive_url || out.archiveUrl || out.meta?.archive_url || "").trim();
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

      // 3) optional periodic hydrate (keeps Safari/Chrome in sync)
      const t = setInterval(() => hydrateFromDB(host), 30000);

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
