// /js/panel.video.js
// RightPanel Video (v3) — DB source-of-truth hydrate (/api/jobs/list?app=video)
// REVISION: Replace per-card <video> with a SINGLE fixed player (like atmo)
// - Cards keep the same visual structure/effects (vpThumb/vpBadge/vpPlay/vpFsBtn)
// - Play now loads into a fixed player viewport (with aspect clamp)
// - Fullscreen acts on the fixed player
// - Keep DB hydrate + status poll + PPE bridge + job_created bridge

(function () {
  if (!window.RightPanel) return;

  const STORAGE_KEY = "aivo.v2.video.items.v3";
  const LEGACY_KEYS = ["aivo.v2.video.items.v2", "aivo.v2.video.items"];
  const MAX_ITEMS = 50;

  // status polling
  const STATUS_POLL_EVERY_MS = 4000;
  const STATUS_POLL_BATCH = 3;
  const STATUS_POLL_TIMEOUT_MS = 15000;

  const state = {
    items: [],
    // fixed player state
    selectedId: "",
    selectedUrl: "",
    selectedMeta: "",
    selectedIsPortrait: false,
  };

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

  // ✅ status/db_status önce, state sonra
  function getStatusText(item) {
    const primary = norm(item?.status || item?.db_status);
    const secondary = norm(item?.state);
    return primary || secondary || "";
  }

  function looksLikeLegacyBrokenR2(url) {
    // şimdilik kapalı
    return false;
  }

  function toMaybeProxyUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.startsWith("/api/media/proxy?url=") || u.includes("/api/media/proxy?url=")) return u;
    if (u.startsWith("http://")) return "/api/media/proxy?url=" + encodeURIComponent(u);
    return u;
  }

  function fmtDT(ts) {
    try {
      const d = new Date(ts || Date.now());
      if (Number.isNaN(+d)) return "";
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${dd}.${mm}.${yy} ${hh}:${mi}`;
    } catch {
      return "";
    }
  }

  /* =======================
     Outputs URL picking (CRITICAL)
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

  // ✅ unified "best url" extractor (top-level + outputs fallback)
  function pickBestUrl(it) {
    if (!it) return "";
    const a = String(it.archive_url || it.archiveUrl || "").trim();
    if (a) return a;
    const u = String(it.url || it.video_url || it.videoUrl || "").trim();
    if (u) return u;

    const outs = it.outputs;
    const uo = pickVideoUrlFromOutputs(outs);
    if (uo) return uo;

    return "";
  }

  function getPlaybackUrl(it) {
    const best = pickBestUrl(it);
    if (!best) return "";
    return toMaybeProxyUrl(best);
  }

  function bestShareUrl(it) {
    // share/download should prefer public-ish url; still ok to return archive_url first
    return String(pickBestUrl(it) || "").trim();
  }

  // ✅ output var mı?
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

  function guessPortrait(it) {
    const ar = String(it?.meta?.aspect_ratio || it?.meta?.ratio || it?.meta?.ar || "").toLowerCase().trim();
    if (ar.includes("9:16") || ar.includes("4:5") || ar.includes("2:3")) return true;
    // fallback: if user picked "portrait" in meta
    const k = String(it?.meta?.orientation || it?.meta?.layout || "").toLowerCase();
    if (k.includes("portrait") || k.includes("vertical") || k.includes("dikey")) return true;
    return false;
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

      // ✅ if top-level missing, derive from outputs
      const outs0 = Array.isArray(it.outputs) ? it.outputs : (Array.isArray(it0?.outputs) ? it0.outputs : []);
      const fromOut = pickVideoUrlFromOutputs(outs0);

      const url = String(it.url || it.video_url || it.videoUrl || fromOut || "").trim();
      const archive_url = String(it.archive_url || it.archiveUrl || it.meta?.archive_url || it.meta?.archiveUrl || "").trim();

      const legacyBroken = looksLikeLegacyBrokenR2(archive_url || url);
      const readyByOutput = !!(!legacyBroken && (archive_url || url));

      const status =
        legacyBroken ? "İşleniyor" :
        (readyByOutput ? "Hazır" : (it.status || it.state || it.db_status || "İşleniyor"));

      const title = it.title || it.meta?.title || it.meta?.prompt || it.prompt || it.text || "Video";

      const pb = (!legacyBroken && (archive_url || url || fromOut))
        ? getPlaybackUrl({ ...it, archive_url, url, outputs: outs0 })
        : "";

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
          app: it.meta?.app || "video",
        },
        outputs: outs0,
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

  function mapDbItemToPanelItem(r) {
    const job_id = String(r?.job_id || r?.id || "").trim();
    const meta = r?.meta || {};
    const outputs = Array.isArray(r?.outputs) ? r.outputs : [];

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

    // ✅ if output exists, it MUST be used
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
      createdAt: (r?.created_at ? new Date(r.created_at).getTime() : (r?.createdAt ? new Date(r.createdAt).getTime() : Date.now())),
      meta: {
        ...(meta || {}),
        mode: meta?.mode || "",
        prompt: meta?.prompt || r?.prompt || "",
        app: "video",
      },
      outputs,
      state: r?.state,
      db_status: r?.db_status,
    };

    const legacyBroken = looksLikeLegacyBrokenR2(item.archive_url || item.url);
    const hasOut = !legacyBroken && hasOutput(item);

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

    if (legacyBroken) {
      item.status = "İşleniyor";
    } else if (isFailed) {
      item.status = "Hata";
    } else if (hasOut) {
      item.status = "Hazır";
    } else {
      if (rawState === "COMPLETED" || rawState === "DONE" || rawState === "READY") item.status = "Hazır";
      else if (rawState === "RUNNING" || rawState === "PROCESSING" || rawState === "PENDING") item.status = "İşleniyor";
      else item.status = "İşleniyor";
    }

    const pb = (!legacyBroken) ? getPlaybackUrl(item) : "";
    item.playbackUrl = pb || "";

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
        // ✅ keep outputs + recompute playbackUrl if missing
        outputs: Array.isArray(it.outputs) && it.outputs.length ? it.outputs : (prev.outputs || []),
        playbackUrl: String(it.playbackUrl || prev.playbackUrl || "").trim() || getPlaybackUrl(it) || getPlaybackUrl(prev) || "",
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

      const incoming = (rows || [])
        .map(mapDbItemToPanelItem)
        .filter((x) => x && (x.job_id || x.id));

      state.items = mergeByJobId(state.items, incoming);

      saveItems();
      render(host);

      // if no selection yet, auto-select first ready
      if (!state.selectedUrl) {
        const first = state.items.find((it) => isReady(it) && getPlaybackUrl(it));
        if (first) {
          const pb = getPlaybackUrl(first);
          if (pb) setMain(host, first.id, pb, buildMetaLine(first), guessPortrait(first));
        }
      }

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

    const outs = j?.outputs;
    const uo = pickVideoUrlFromOutputs(outs);
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

        const legacyBroken = looksLikeLegacyBrokenR2(it.archive_url || it.url);
        const pb = (!legacyBroken) ? getPlaybackUrl(it) : "";
        it.playbackUrl = pb || "";

        saveItems();
        render(host);

        // if selected item becomes ready and selected url missing, refresh player
        if (String(state.selectedId) === String(it.id) && it.playbackUrl) {
          setMain(host, it.id, it.playbackUrl, buildMetaLine(it), guessPortrait(it));
        }
      }
    }
  }

  /* =======================
     Fixed player + fullscreen
     ======================= */

  function ensureStylesOnce() {
    if (document.getElementById("vpFixedPlayerStyles")) return;

    const css = `
      .vpPlayerShell{
        padding:10px;
        border-radius:16px;
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.06);
        margin-bottom:12px;
      }
      .vpPlayerTop{
        display:flex;align-items:center;justify-content:space-between;gap:10px;
        margin-bottom:10px;
      }
      .vpPlayerMeta{
        font-size:12px;opacity:.78;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        min-width:0;flex:1;
      }
      .vpPlayerBtns{display:flex;gap:8px;align-items:center;}
      .vpPlayerBtn{
        width:34px;height:34px;border-radius:999px;
        border:1px solid rgba(255,255,255,0.10);
        background:rgba(0,0,0,.25);color:#fff;cursor:pointer;
        display:inline-flex;align-items:center;justify-content:center;
      }
      .vpPlayerBox{
        position:relative;border-radius:14px;overflow:hidden;
        background:#000;border:1px solid rgba(255,255,255,0.08);
      }
      .vpPlayerBox:before{content:"";display:block;padding-top:56.25%;} /* 16:9 */
      .vpPlayerBox.isPortrait:before{padding-top:140%;} /* clamp for 9:16 */
      .vpPlayerVideo{
        position:absolute;inset:0;width:100%;height:100%;
        object-fit:contain;
        background:#000;
      }
      .vpPlayerHint{
        font-size:12px;opacity:.78;padding:10px 12px;
      }
      .vpPlayerClose{display:none;}
      .vpPlayerShell.hasSel .vpPlayerClose{display:inline-flex;}
    `;

    const style = document.createElement("style");
    style.id = "vpFixedPlayerStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function getPlayerNodes(host) {
    return {
      shell: host.querySelector("[data-vp-player-shell]"),
      meta: host.querySelector("[data-vp-player-meta]"),
      close: host.querySelector("[data-vp-player-close]"),
      fs: host.querySelector("[data-vp-player-fs]"),
      box: host.querySelector("[data-vp-player-box]"),
      hint: host.querySelector("[data-vp-player-hint]"),
      video: host.querySelector("[data-vp-player-video]"),
    };
  }

  function clearPlayer(host) {
    const n = getPlayerNodes(host);
    state.selectedId = "";
    state.selectedUrl = "";
    state.selectedMeta = "";
    state.selectedIsPortrait = false;

    if (n.shell) n.shell.classList.remove("hasSel");
    if (n.box) n.box.classList.remove("isPortrait");
    if (n.meta) n.meta.textContent = "Bir karttan ▶ seçip oynat.";
    if (n.video) {
      try { n.video.pause?.(); } catch {}
      n.video.removeAttribute("src");
      try { n.video.load?.(); } catch {}
      n.video.style.display = "none";
    }
    if (n.hint) n.hint.style.display = "block";
  }

  function setMain(host, id, url, metaText, isPortrait) {
    const n = getPlayerNodes(host);
    const u = String(url || "").trim();

    state.selectedId = String(id || "");
    state.selectedUrl = u;
    state.selectedMeta = String(metaText || "");
    state.selectedIsPortrait = !!isPortrait;

    if (!u) {
      clearPlayer(host);
      return;
    }

    if (n.shell) n.shell.classList.add("hasSel");
    if (n.hint) n.hint.style.display = "none";
    if (n.video) n.video.style.display = "block";

    if (n.meta) n.meta.textContent = state.selectedMeta || "Seçili video";
    if (n.box) n.box.classList.toggle("isPortrait", !!state.selectedIsPortrait);

    if (n.video) {
      const cur = String(n.video.currentSrc || n.video.src || "").trim();
      if (cur !== u) {
        n.video.src = u;
        try { n.video.load?.(); } catch {}
      }
      // autoplay try (safe)
      try { n.video.play?.().catch(() => {}); } catch {}
    }
  }

  function goFullscreenForFixedPlayer(host) {
    const n = getPlayerNodes(host);
    const video = n.video;
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
      if (n.box?.requestFullscreen) {
        n.box.requestFullscreen().catch?.(() => {});
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

  // IMPORTANT: keep existing thumb classes/effects; remove card-video element
  function renderThumb(it) {
    const badge = normalizeBadge(it);

    // ✅ compute playbackUrl if missing
    if (!it.playbackUrl) {
      const pb2 = getPlaybackUrl(it);
      if (pb2) it.playbackUrl = pb2;
    }

    const ready = isReady(it) && !!String(it.playbackUrl || "").trim();

    if (!ready) {
      return `
        <div class="vpThumb is-loading">
          ${renderSkeleton(badge)}
          <button class="vpFsBtn" data-act="fs" title="Büyüt" aria-label="Büyüt">⛶</button>
        </div>
      `;
    }

    // No <video> here anymore — just overlay (poster-like)
    return `
      <div class="vpThumb">
        <div class="vpBadge">${esc(badge)}</div>
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
    const active = (String(state.selectedId) && String(it.id) === String(state.selectedId)) ? " is-active" : "";
    return `
      <div class="vpCard${active}" data-id="${esc(it.id)}" role="button" tabindex="0">
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
      clearPlayer(host);
      return;
    }

    grid.innerHTML = state.items.map(renderCard).join("");

    // keep selection highlight in sync (if selected item deleted etc.)
    if (state.selectedId) {
      const exists = state.items.some((x) => String(x.id) === String(state.selectedId));
      if (!exists) clearPlayer(host);
    }
  }

  function buildMetaLine(it) {
    const kind = formatKind(it);
    const dt = fmtDT(it?.createdAt || it?.created_at || Date.now());
    return `${kind}${dt ? " • " + dt : ""}`;
  }

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

  function attachEvents(host) {
    const grid = findGrid(host);
    if (!grid) return () => {};

    const n = getPlayerNodes(host);

    const onTopClick = (e) => {
      const btn = e.target.closest?.("[data-vp-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-vp-act");
      if (act === "close") { clearPlayer(host); return; }
      if (act === "fs") { goFullscreenForFixedPlayer(host); return; }
      if (act === "toggle") {
        const v = getPlayerNodes(host).video;
        if (!v || !state.selectedUrl) return;
        try { v.paused ? v.play?.() : v.pause?.(); } catch {}
        return;
      }
    };
    n.shell?.addEventListener("click", onTopClick);

    const onClick = (e) => {
      const card = e.target.closest(".vpCard");
      if (!card) return;

      const id = card.getAttribute("data-id");
      const it = state.items.find(x => String(x.id) === String(id));
      if (!it) return;

      const btn = e.target.closest("[data-act]");

      if (btn) {
        e.stopPropagation();
        const act = btn.getAttribute("data-act");

        if (act === "fs") {
          // if fixed player already has selection, fullscreen it; else select then fullscreen
          if (isReady(it) && getPlaybackUrl(it)) {
            const pb = getPlaybackUrl(it);
            setMain(host, it.id, pb, buildMetaLine(it), guessPortrait(it));
            goFullscreenForFixedPlayer(host);
          }
          return;
        }

        if (act === "download") downloadUrl(bestShareUrl(it));
        if (act === "share") shareUrl(bestShareUrl(it));

        if (act === "delete") {
          // UI delete only (backend delete handled elsewhere if exists)
          const wasSelected = String(state.selectedId) === String(it.id);
          state.items = state.items.filter(x => String(x.id) !== String(id));
          saveItems();
          render(host);
          if (wasSelected) clearPlayer(host);
        }
        return;
      }

      // normal click => play in fixed player
      const pb = getPlaybackUrl(it);
      if (!isReady(it) || !pb) return;

      setMain(host, it.id, pb, buildMetaLine(it), guessPortrait(it));
    };

    grid.addEventListener("click", onClick);

    return () => {
      try { n.shell?.removeEventListener("click", onTopClick); } catch {}
      try { grid.removeEventListener("click", onClick); } catch {}
    };
  }

  /* =======================
     PPE bridge
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

        const pb = (!legacyBroken) ? getPlaybackUrl(target) : "";
        target.playbackUrl = pb || "";
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
          outputs: [],
        };
        const pb = (!legacyBroken) ? getPlaybackUrl(item) : "";
        item.playbackUrl = pb || "";
        state.items.unshift(item);
      }

      saveItems();
      render(host);

      // If nothing selected, auto-select new ready output
      const pick = state.items.find((it) => isReady(it) && getPlaybackUrl(it));
      if (pick && !state.selectedUrl) {
        const pb = getPlaybackUrl(pick);
        if (pb) setMain(host, pick.id, pb, buildMetaLine(pick), guessPortrait(pick));
      }

      // If selected matches, refresh player
      if (jid && String(state.selectedId) === String(jid)) {
        const it2 = state.items.find(x => String(x.id) === String(jid));
        if (it2 && it2.playbackUrl) setMain(host, it2.id, it2.playbackUrl, buildMetaLine(it2), guessPortrait(it2));
      }
    };

    return () => {
      active = false;
      PPE.onOutput = prev || null;
    };
  }

  /* =======================
     Job created bridge
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
        outputs: [],
        state: "PENDING",
        db_status: "pending",
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
      ensureStylesOnce();

      host.innerHTML = `
        <div class="videoSide">
          <div class="videoSideCard">

            <!-- FIXED PLAYER -->
            <div class="vpPlayerShell" data-vp-player-shell>
              <div class="vpPlayerTop">
                <div class="vpPlayerMeta" data-vp-player-meta>Bir karttan ▶ seçip oynat.</div>
                <div class="vpPlayerBtns">
                  <button class="vpPlayerBtn" type="button" data-vp-act="toggle" title="Oynat/Duraklat" aria-label="Oynat/Duraklat">▶</button>
                  <button class="vpPlayerBtn" type="button" data-vp-act="fs" title="Büyüt" aria-label="Büyüt">⛶</button>
                  <button class="vpPlayerBtn vpPlayerClose" type="button" data-vp-act="close" title="Kapat" aria-label="Kapat" data-vp-player-close>✕</button>
                </div>
              </div>

              <div class="vpPlayerBox" data-vp-player-box>
                <div class="vpPlayerHint" data-vp-player-hint>Henüz seçili video yok.</div>
                <video
                  class="vpPlayerVideo"
                  data-vp-player-video
                  playsinline
                  webkit-playsinline
                  preload="metadata"
                  controls
                  muted
                  style="display:none;"
                ></video>
              </div>
            </div>

            <!-- GRID -->
            <div class="vpGrid" data-video-grid></div>

          </div>
        </div>
      `;

      // close button node marker
      // (used in getPlayerNodes)
      const n = getPlayerNodes(host);
      if (n.close) n.close.classList.add("vpPlayerClose");

      // 1) instant UI from LS
      state.items = loadItems();
      render(host);

      // if LS has a ready item and no selection, select first
      if (!state.selectedUrl) {
        const first = state.items.find((it) => isReady(it) && getPlaybackUrl(it));
        if (first) {
          const pb = getPlaybackUrl(first);
          if (pb) setMain(host, first.id, pb, buildMetaLine(first), guessPortrait(first));
        } else {
          clearPlayer(host);
        }
      }

      // wire top buttons
      const shell = host.querySelector("[data-vp-player-shell]");
      const closeBtn = host.querySelector("[data-vp-act='close']");
      if (shell && closeBtn) closeBtn.style.display = "none"; // will be shown by .hasSel
      // make close btn appear via css (.hasSel)
      if (closeBtn) closeBtn.classList.add("vpPlayerClose");

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
        try { clearPlayer(host); } catch {}
      };
    },
  });
})();
