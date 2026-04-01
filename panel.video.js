// panel.video.js
// RightPanel Video (v2) — STRICT app filtering (video only)
// Fix: Atmo outputs leaking into Video panel via PPE bridge
// Fix: Hydrate from DB must ignore non-video rows even if endpoint returns mixed data
// Fix: DELETE must hit backend (/api/jobs/delete) and must not “come back”
// UX: Safari-friendly attrs (muted + webkit-playsinline)
// Added: RightPanel search support (Atmos mantığıyla)

(function () {
  if (!window.RightPanel) return;

  // ⛔️ DB tek kaynak (LocalStorage yok)
  const MAX_ITEMS = 50;

  const STATUS_POLL_EVERY_MS = 4000;
  const STATUS_POLL_BATCH = 3;
  const STATUS_POLL_TIMEOUT_MS = 15000;

  const state = { items: [], query: "" };

  // “Silindi ama interval hydrate/poll ile geri geldi” sorununa karşı tombstone
  const deletedIds = new Set(); // string(job_id)

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
    const a = norm(x);
    return a === "video" || a.includes("video");
  }

  function toMaybeProxyUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.startsWith("/api/media/proxy?url=") || u.includes("/api/media/proxy?url=")) return u;
    if (/^https?:\/\//i.test(u)) return "/api/media/proxy?url=" + encodeURIComponent(u);
    return u;
  }

  function idOf(it) {
    return String(it?.job_id || it?.id || "").trim();
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

  function bestVideoFromJob(it) {
    if (!it) return "";

    const meta = it?.meta || {};
    const outs = Array.isArray(it?.outputs) ? it.outputs : [];

    const directFinal =
      String(
        it?.final ||
        it?.final_url ||
        it?.final_video_url ||
        meta?.final ||
        meta?.final_url ||
        meta?.final_video_url ||
        ""
      ).trim();

    if (directFinal) return directFinal;

    const finalized = outs.find(
      (o) =>
        String(o?.type || "").toLowerCase() === "video" &&
        String(o?.meta?.variant || "").toLowerCase().trim() === "finalized"
    );

    if (finalized) {
      const u = String(
        finalized?.archive_url ||
        finalized?.url ||
        finalized?.video_url ||
        finalized?.meta?.archive_url ||
        finalized?.meta?.url ||
        finalized?.meta?.video_url ||
        ""
      ).trim();
      if (u) return u;
    }

    return pickBestUrl(it);
  }

  function previewVideoFromJob(it) {
    if (!it) return "";

    const meta = it?.meta || {};
    const outs = Array.isArray(it?.outputs) ? it.outputs : [];

    const directPreview =
      String(
        it?.preview ||
        it?.preview_url ||
        it?.preview_video_url ||
        meta?.preview ||
        meta?.preview_url ||
        meta?.preview_video_url ||
        ""
      ).trim();

    if (directPreview) return directPreview;

    const preview = outs.find(
      (o) =>
        String(o?.type || "").toLowerCase() === "video" &&
        String(o?.meta?.variant || "").toLowerCase().trim() === "preview"
    );

    if (preview) {
      return String(
        preview?.archive_url ||
        preview?.url ||
        preview?.video_url ||
        preview?.meta?.archive_url ||
        preview?.meta?.url ||
        preview?.meta?.video_url ||
        ""
      ).trim();
    }

    return "";
  }

  function getPlaybackUrl(it) {
    if (!it) return "";

    const finalUrl = String(bestVideoFromJob(it) || "").trim();
    const previewUrl = String(previewVideoFromJob(it) || "").trim();
    const useFreshFinal = it?._fresh === true;

    const chosen = useFreshFinal
      ? (finalUrl || previewUrl)
      : (previewUrl || finalUrl);

    if (!chosen) return "";
    return toMaybeProxyUrl(chosen);
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
     Search
     ======================= */

  function getPanelSearchInput() {
    return document.querySelector(
      'input.rpSearch, [data-right-panel-search], input[type="search"][placeholder*="Ara"]'
    ) || null;
  }

  function bindPanelSearch(host) {
    if (!host || host.__vpSearchBound) return;
    host.__vpSearchBound = true;

    let searchTimer = null;

    const syncSearchFromInput = () => {
      const input = getPanelSearchInput();
      const nextQuery = String(input?.value || "").trim();
      if (state.query === nextQuery) return;

      if (searchTimer) clearTimeout(searchTimer);

      searchTimer = setTimeout(() => {
        state.query = nextQuery;
        render(host);
      }, 120);
    };

    const onSearchInput = (e) => {
      const input = getPanelSearchInput();
      if (!input) return;
      if (e.target !== input) return;
      syncSearchFromInput();
    };

    document.addEventListener("input", onSearchInput, true);
    document.addEventListener("search", onSearchInput, true);

    host.__vpSearchCleanup = () => {
      try { document.removeEventListener("input", onSearchInput, true); } catch {}
      try { document.removeEventListener("search", onSearchInput, true); } catch {}
      try { if (searchTimer) clearTimeout(searchTimer); } catch {}
    };

    setTimeout(syncSearchFromInput, 0);
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
    if (!isVideoApp(appGuess)) return null;

    if (job_id && deletedIds.has(String(job_id))) return null;

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
        .filter(Boolean);

      const byId = new Map();

      for (const it of (state.items || [])) {
        const jid = String(idOf(it));
        if (!jid) continue;
        if (deletedIds.has(jid)) continue;

        if (it?._fresh === true) {
          byId.set(jid, it);
          continue;
        }

        if (isReady(it) || isError(it)) continue;
        byId.set(jid, it);
      }

      for (const it of incoming) {
        const jid = String(idOf(it));
        if (!jid) continue;
        if (deletedIds.has(jid)) continue;

        const prev = byId.get(jid);

        if (prev?._fresh === true) {
          byId.set(jid, {
            ...it,
            _fresh: true,
            playbackUrl: getPlaybackUrl({
              ...it,
              _fresh: true,
            }) || "",
          });
          continue;
        }

        byId.set(jid, it);
      }

      state.items = Array.from(byId.values())
        .sort((a, b) => {
          const ta = Number(a?.createdAt || 0);
          const tb = Number(b?.createdAt || 0);
          if (tb !== ta) return tb - ta;
          return String(idOf(b)).localeCompare(String(idOf(a)));
        })
        .slice(0, MAX_ITEMS);

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

    if (deletedIds.has(jid)) return null;

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
    .filter((it) => it && (it.job_id || it.id))
    .filter((it) => {
      const jid = String(it.job_id || it.id || "").trim();
      return jid && !deletedIds.has(jid);
    })
    .filter((it) => !isReady(it) || !String(it.playbackUrl || "").trim())
    .filter((it) => !isError(it))
    .slice(0, STATUS_POLL_BATCH);

  if (!pending.length) return;

  let changed = false;

  for (const it of pending) {
    const jid = String(it.job_id || it.id || "").trim();
    if (!jid) continue;
    if (deletedIds.has(jid)) continue;

    const s = await fetchStatus(jid);
    if (!s) continue;

    const st = norm(s.status);
    const ready = st === "ready" || st === "done" || st === "completed";
    const url = pickStatusVideoUrl(s);
    const hasUrl = !!String(url || "").trim();

    const nextDbStatus = s.db_status || s.status || it.db_status;
    const nextState = s.state || it.state;

    const err = st === "error" || st === "failed";
    if (err) {
      if (it.status !== "Hata") {
        it.status = "Hata";
        changed = true;
      }
      if (it.db_status !== nextDbStatus) {
        it.db_status = nextDbStatus;
        changed = true;
      }
      if (it.state !== nextState) {
        it.state = nextState;
        changed = true;
      }
      continue;
    }

    if (Array.isArray(s.outputs)) {
      const prev = JSON.stringify(it.outputs || []);
      const next = JSON.stringify(s.outputs || []);
      if (prev !== next) {
        it.outputs = s.outputs;
        changed = true;
      }
    }

    if (hasUrl && it.url !== url) {
      it.url = url;
      changed = true;
    }

    if (it.db_status !== nextDbStatus) {
      it.db_status = nextDbStatus;
      changed = true;
    }

    if (it.state !== nextState) {
      it.state = nextState;
      changed = true;
    }

    if (ready) {
      const nextPlaybackUrl =
        getPlaybackUrl({
          ...it,
          _fresh: true,
        }) || "";

      if (it.status !== "Hazır") {
        it.status = "Hazır";
        changed = true;
      }
      if (it._fresh !== true) {
        it._fresh = true;
        changed = true;
      }
      if (it.playbackUrl !== nextPlaybackUrl) {
        it.playbackUrl = nextPlaybackUrl;
        changed = true;
      }
    } else {
      if (it.status !== "İşleniyor") {
        it.status = "İşleniyor";
        changed = true;
      }
      if (it._fresh !== false) {
        it._fresh = false;
        changed = true;
      }
      if (it.playbackUrl !== "") {
        it.playbackUrl = "";
        changed = true;
      }
    }
  }

  if (changed) {
    render(host);
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
          <button class="vpFsBtn" data-act="fs" data-id="${esc(idOf(it))}" title="Büyüt" aria-label="Büyüt">⛶</button>
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

        <button class="vpFsBtn" data-act="fs" data-id="${esc(idOf(it))}" title="Büyüt" aria-label="Büyüt">⛶</button>
      </div>
    `;
  }

  function renderMeta(it) {
    const kind = formatKind(it);
    const sub = it?.meta?.prompt || it?.meta?.title || it?.title || "";
    const ready = isReady(it);
    const jid = idOf(it);

    return `
      <div class="vpMeta">
        <div class="vpTitle" title="${esc(kind)}">${esc(kind)}</div>
        <div class="vpSub" title="${esc(sub)}">${esc(sub)}</div>

        <div class="vpActions">
          <button class="vpIconBtn" data-act="download" data-id="${esc(jid)}" ${ready ? "" : "disabled"} title="İndir">⬇</button>
          <button class="vpIconBtn" data-act="share" data-id="${esc(jid)}" ${ready ? "" : "disabled"} title="Paylaş">⤴</button>
          <button class="vpIconBtn vpDanger" data-act="delete" data-id="${esc(jid)}" title="Sil">🗑</button>
        </div>
      </div>
    `;
  }
function renderCard(it) {
  const jid = idOf(it) || uid();
  const isFreshCard = it?._fresh === true;

  const finalUrl = String(bestVideoFromJob(it) || "").trim();
  const previewUrl = String(previewVideoFromJob(it) || "").trim();

  const selectedPlaybackRawUrl = isFreshCard
    ? (finalUrl || previewUrl)
    : (previewUrl || finalUrl);

  const playbackUrl = toMaybeProxyUrl(selectedPlaybackRawUrl);
  const ready = isReady(it) && !!playbackUrl;
  const previewVideoUrl = ready
    ? (playbackUrl.includes("#") ? playbackUrl : playbackUrl + "#t=0.001")
    : "";

  const ratio = String(
    it?.meta?.ui_state?.aspect_ratio ||
    it?.meta?.aspect_ratio ||
    it?.meta?.ratio ||
    "16:9"
  ).trim();

  const title = String(it?.meta?.prompt || it?.title || formatKind(it) || "").trim();
  const sub = "";

  const badgeText = normalizeBadge(it);
  const badgeKind = ready ? "ready" : (isError(it) ? "error" : "loading");

  if (window.AIVO_SHARED_VIDEO_CARD?.createCardHtml) {
    return (
      '<div class="videoPanelCardInner"' +
        ' data-job="' + esc(jid) + '"' +
        ' data-url="' + esc(selectedPlaybackRawUrl) + '"' +
        ' data-final-url="' + esc(finalUrl) + '"' +
        ' data-preview-url="' + esc(previewUrl) + '"' +
        ' data-fresh="' + esc(isFreshCard ? "1" : "0") + '"' +
      '>' +
        window.AIVO_SHARED_VIDEO_CARD.createCardHtml({
          id: jid,
          title,
          sub,
          badgeText,
          badgeKind,
          videoUrl: previewVideoUrl,
          posterUrl: "",
          ratio,
          ready,
          canDownload: !!finalUrl,
          canShare: ready,
          canDelete: true,
        }) +
      '</div>'
    );
  }

  return `
    <div class="vpCard" data-id="${esc(jid)}" role="button" tabindex="0">
      ${renderThumb(it)}
      ${renderMeta(it)}
    </div>
  `;
}

  function render(host) {
    const grid = findGrid(host);
    if (!grid) return;

    const q = String(state.query || "").trim().toLowerCase();

    const items = (state.items || [])
      .filter(Boolean)
      .filter((it) => {
        const jid = idOf(it);
        if (!jid) return false;
        if (deletedIds.has(jid)) return false;

        const appGuess = String(it?.app || it?.meta?.app || "").trim();
        if (appGuess && !isVideoApp(appGuess)) return false;

        const hasPlayable = !!String(it?.playbackUrl || getPlaybackUrl(it) || "").trim();
        const hasAnyOutput = hasOutput(it);
        const pending = isProcessing(it);

        if (!hasPlayable && !hasAnyOutput && !pending) return false;

        if (!q) return true;

        const haystack = [
          it?.title,
          it?.meta?.prompt,
          it?.meta?.title,
          it?.status,
          it?.db_status,
          it?.state
        ]
          .map((x) => String(x || "").toLowerCase())
          .join(" ");

        return haystack.includes(q);
      });

    if (!items.length) {
      grid.innerHTML = `<div class="vpEmpty">${
        state.query ? "Aramana uygun video bulunamadı." : "Henüz video yok."
      }</div>`;
      return;
    }

    grid.innerHTML = items.map(renderCard).join("");
  }

  /* =======================
     Actions (tek kaynak)
     ======================= */

  async function apiDeleteJob(job_id) {
    const jid = String(job_id || "").trim();
    if (!jid) return { ok: false, error: "missing_job_id" };

    const r = await fetch("/api/jobs/delete", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({ job_id: jid }),
    });

    const j = await r.json().catch(() => null);
    if (!r.ok || !j || !j.ok) return { ok: false, error: j?.error || ("http_" + r.status), data: j };
    return { ok: true, data: j };
  }

  function downloadUrl(u) {
    const raw = String(u || "").trim();
    if (!raw) return;

    const proxied = `/api/media/proxy?url=${encodeURIComponent(raw)}&filename=video.mp4`;

    const a = document.createElement("a");
    a.href = proxied;
    a.download = "video.mp4";
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
      toast?.success?.("Link kopyalandı.");
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

  function bindActions(host) {
    if (!host || host.__vpActionsBound) return;
    host.__vpActionsBound = true;

    host.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-act], [data-svc-act]");
      if (!btn) return;

      const act = btn.dataset.act || btn.dataset.svcAct;
      const card = btn.closest(".vpCard, .svcCard");
      const id = String(btn.dataset.id || card?.dataset?.id || card?.dataset?.svcId || "").trim();
      if (!id) return;

      e.preventDefault();
      e.stopPropagation();

      if (act === "delete" && deletedIds.has(id)) return;

      const it = state.items.find(x => String(idOf(x)) === id);

      try {
        if (act === "delete") {
          btn.disabled = true;

          deletedIds.add(id);
          state.items = state.items.filter(x => String(idOf(x)) !== id);
          render(host);

          const resp = await apiDeleteJob(id);

          if (!resp.ok) {
            deletedIds.delete(id);
            toast?.error?.("Silinemedi (backend): " + String(resp.error || "error"));
            await hydrateFromDB(host);
            btn.disabled = false;
            return;
          }

          toast?.success?.("Silindi.");
          await hydrateFromDB(host);
          return;
        }

        if (act === "download") {
          if (!it) return;
          const u = bestVideoFromJob(it) || it.url || pickBestUrl(it);
          if (u) downloadUrl(u);
          return;
        }

        if (act === "share") {
          if (!it) return;
          const u = bestVideoFromJob(it) || it.url || pickBestUrl(it);
          if (u) shareUrl(u);
          return;
        }

        if (act === "play") {
          if (!card || !it) return;

          const video = card.querySelector("video");
          if (!video || !isReady(it)) return;

          if (video.paused) {
            video.setAttribute("data-user-gesture", "1");
            video.play().catch(() => {});
          } else {
            video.pause();
            video.setAttribute("data-user-gesture", "0");
          }
          return;
        }

        if (act === "fs") {
          if (card) goFullscreen(card);
          return;
        }
      } catch (err) {
        deletedIds.delete(id);
        try { await hydrateFromDB(host); } catch {}
        toast?.error?.("İşlem sırasında hata oluştu.");
        try { btn.disabled = false; } catch {}
      }
    });
  }

  /* =======================
     Card play/pause
     ======================= */

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
      if (e.target.closest("[data-act]") || e.target.closest("[data-svc-act]")) return;

      const card = e.target.closest(".vpCard, .svcCard");
      if (!card) return;

      const id = String(card.getAttribute("data-id") || "").trim();
      if (!id || deletedIds.has(id)) return;

      const it = state.items.find(x => String(idOf(x)) === id);
      if (!it) return;

      const video = card.querySelector("video");
      const overlay = card.querySelector(".vpPlay");

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
   Video panel (DBJobs + optimistic + keyed render)
   ======================= */

function createVideoPanel(host) {
  if (!window.DBJobs) {
    console.warn("[VIDEO PANEL] DBJobs yok. panel.dbjobs.js yüklenmeli.");
    host.innerHTML = `
      <div class="videoSide">
        <div class="videoSideCard">
          <div class="vpEmpty">DBJobs bulunamadı.</div>
        </div>
      </div>
    `;
    return {
      destroy() {
        try { host.innerHTML = ""; } catch {}
      },
    };
  }

  let destroyed = false;
  let currentDbItems = [];
  let searchTimer = null;
  let searchInputEl = null;
  let searchRootEl = null;

  const localState = {
    query: "",
  };

  const optimistic = new Map();
  const hiddenDeletedIds = new Set();

  const cardCache =
    window.__VIDEO_CARD_CACHE__ ||
    (window.__VIDEO_CARD_CACHE__ = new Map());

  host.innerHTML = `
    <div class="videoSide">
      <div class="videoSideCard">
        <div class="vpGrid" data-video-grid></div>
      </div>
    </div>
  `;

  const grid = findGrid(host);

  function safeStr(v) {
    return String(v == null ? "" : v).trim();
  }

  function toMs(v) {
    if (v == null) return 0;
    if (typeof v === "number" && Number.isFinite(v)) return v;

    const s = String(v).trim();

    if (/^\d{10,13}$/.test(s)) {
      const n = Number(s);
      if (Number.isFinite(n)) return n;
    }

    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(s) && !s.includes("T")) {
      const iso = s.replace(" ", "T") + "Z";
      const tIso = Date.parse(iso);
      if (Number.isFinite(tIso)) return tIso;
    }

    const t = Date.parse(s);
    return Number.isFinite(t) ? t : 0;
  }

  function resolvePanelSearchInput() {
    const candidates = [
      ...document.querySelectorAll("input.rpSearch"),
      ...document.querySelectorAll("[data-right-panel-search]"),
      ...document.querySelectorAll('input[type="search"]'),
    ];

    const panelRoot =
      host.closest('[data-right-panel-root], .rightPanel, .rpShell, .rpWrap, .rpPanel, .RightPanel') ||
      host.parentElement ||
      document;

    for (const input of candidates) {
      if (!(input instanceof HTMLElement)) continue;

      const root =
        input.closest('[data-right-panel-root], .rightPanel, .rpShell, .rpWrap, .rpPanel, .RightPanel') ||
        input.parentElement;

      if (root && panelRoot && root === panelRoot) return input;
    }

    for (const input of candidates) {
      if (!(input instanceof HTMLElement)) continue;

      const ph = safeStr(input.getAttribute("placeholder") || "").toLowerCase();
      const aria = safeStr(input.getAttribute("aria-label") || "").toLowerCase();
      const cls = safeStr(input.className || "").toLowerCase();

      if (
        ph.includes("ara") ||
        ph.includes("search") ||
        aria.includes("ara") ||
        aria.includes("search") ||
        cls.includes("rpsearch")
      ) {
        return input;
      }
    }

    return candidates[0] || null;
  }

  function ensureSearchBinding() {
    const nextInput = resolvePanelSearchInput();
    if (!nextInput) return null;

    if (searchInputEl === nextInput) return searchInputEl;

    searchInputEl = nextInput;
    searchRootEl =
      searchInputEl.closest('[data-right-panel-root], .rightPanel, .rpShell, .rpWrap, .rpPanel, .RightPanel') ||
      searchInputEl.parentElement ||
      null;

    return searchInputEl;
  }

  function renderKeyed(items) {
    if (!grid) return;

    const list = Array.isArray(items) ? items : [];
    const EMPTY_ID = "videoEmptyState";
    let emptyEl = grid.querySelector(`#${EMPTY_ID}`);

    if (!list.length) {
      for (const ch of Array.from(grid.children)) {
        if (ch.id !== EMPTY_ID) grid.removeChild(ch);
      }

      if (!emptyEl) {
        emptyEl = document.createElement("div");
        emptyEl.id = EMPTY_ID;
        emptyEl.className = "vpEmpty";
        grid.appendChild(emptyEl);
      }

      emptyEl.textContent = localState.query
        ? "Aramana uygun video bulunamadı."
        : "Henüz video yok.";

      return;
    } else if (emptyEl) {
      emptyEl.remove();
    }

    const wanted = new Set();
    let anchor = grid.firstChild;

    for (const it of list) {
      const jid = idOf(it);
      if (!jid) continue;

      wanted.add(jid);

      let card = cardCache.get(jid);
      if (!card) {
        card = document.createElement("div");
        card.className = "vpCard";
        card.setAttribute("data-id", jid);
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        cardCache.set(jid, card);
      }

      const html = renderCard(it);
      if (card.__renderedHtml !== html) {
        card.innerHTML = html;
        card.__renderedHtml = html;
      }

      card.setAttribute("data-id", jid);

      if (!card.isConnected) {
        grid.insertBefore(card, anchor);
        continue;
      }

      if (card !== anchor) {
        grid.insertBefore(card, anchor);
      } else {
        anchor = anchor?.nextSibling || null;
      }
    }

    for (const ch of Array.from(grid.children)) {
      if (ch.id === EMPTY_ID) continue;
      const jid = String(ch.getAttribute?.("data-id") || "").trim();
      if (jid && !wanted.has(jid)) {
        grid.removeChild(ch);
      }
    }
  }

  function buildMergedItems() {
    const byId = new Map();

    for (const j of currentDbItems) {
      const id = idOf(j);
      if (!id) continue;
      if (hiddenDeletedIds.has(id)) continue;

      byId.set(id, j);

      if (optimistic.has(id)) {
        const st = norm(j?.db_status || j?.status || j?.state);
        const isTerminal =
          st.includes("ready") ||
          st.includes("done") ||
          st.includes("complet") ||
          st.includes("succ") ||
          st.includes("error") ||
          st.includes("fail");

        if (isTerminal) optimistic.delete(id);
      }
    }

    for (const [id, j] of optimistic.entries()) {
      if (!id) continue;
      if (hiddenDeletedIds.has(id)) continue;
      if (!byId.has(id)) byId.set(id, j);
    }

    const merged = Array.from(byId.values()).sort((a, b) => {
      const ta = toMs(a?.updated_at) || toMs(a?.created_at) || toMs(a?.createdAt) || 0;
      const tb = toMs(b?.updated_at) || toMs(b?.created_at) || toMs(b?.createdAt) || 0;
      if (tb !== ta) return tb - ta;
      return String(idOf(b)).localeCompare(String(idOf(a)));
    });

    const q = safeStr(localState.query).toLowerCase();
    if (!q) return merged;

    return merged.filter((it) => {
      const haystack = [
        it?.title,
        it?.meta?.prompt,
        it?.meta?.title,
        it?.status,
        it?.db_status,
        it?.state,
      ]
        .map((x) => String(x || "").toLowerCase())
        .join(" ");

      return haystack.includes(q);
    });
  }

  function renderCurrent() {
    renderKeyed(buildMergedItems());
  }

  const onSearchInput = (e) => {
    const input = ensureSearchBinding();
    if (!input) return;

    if (e.target === input) {
      const nextQuery = safeStr(input.value || "");
      if (localState.query === nextQuery) return;

      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        localState.query = nextQuery;
        renderCurrent();
      }, 120);
      return;
    }

    const target = e.target;
    if (!(target instanceof HTMLElement)) return;

    if (
      searchRootEl &&
      input.contains &&
      searchRootEl.contains(target) &&
      target === input
    ) {
      const nextQuery = safeStr(input.value || "");
      if (localState.query === nextQuery) return;

      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        localState.query = nextQuery;
        renderCurrent();
      }, 120);
    }
  };

  document.addEventListener("input", onSearchInput, true);
  document.addEventListener("search", onSearchInput, true);

  setTimeout(() => {
    ensureSearchBinding();
    const input = ensureSearchBinding();
    localState.query = safeStr(input?.value || "");
    renderCurrent();
  }, 0);

  bindActions(host);
  const offEvents = attachEvents(host);

  const controller = window.DBJobs.create({
    app: "video",
    debug: false,
    pollIntervalMs: 4000,
    hydrateEveryMs: 15000,

    acceptJob: (job) => {
      if (!job) return false;
      const appGuess = String(job?.app || job?.meta?.app || "").trim();
      if (appGuess && !isVideoApp(appGuess)) return false;
      return true;
    },

    acceptOutput: (o) => {
      if (!o) return false;

      const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind);
      if (t && t !== "video") return false;

      const oa = String(o?.meta?.app || o?.meta?.module || o?.meta?.routeKey || "").trim();
      if (oa && !isVideoApp(oa)) return false;

      return true;
    },

    onChange: async (items) => {
      if (destroyed) return;

      currentDbItems = (items || [])
        .filter((j) => {
          const appGuess = String(j?.app || j?.meta?.app || "").trim();
          if (appGuess && !isVideoApp(appGuess)) return false;
          const id = idOf(j);
          return id && !hiddenDeletedIds.has(id);
        })
        .map((j) => {
          const mapped = mapDbItemToPanelItem(j) || j;
          return {
            ...mapped,
            _fresh: false,
          };
        });

      renderCurrent();
    },
  });

  const onJobCreated = (e) => {
    const d = e?.detail || {};
    if (!d.job_id) return;
    if (!isVideoApp(d.app || d.meta?.app || "video")) return;

    const job_id = String(d.job_id || "").trim();
    if (!job_id) return;
    if (hiddenDeletedIds.has(job_id)) return;

    const existsDb = currentDbItems.some((j) => idOf(j) === job_id);
    if (existsDb) return;
    if (optimistic.has(job_id)) return;

    const modeLabel = d.mode === "image" ? "Image→Video" : "Text→Video";
    const prompt = safeStr(d.prompt || "");
    const title = prompt ? `${modeLabel}: ${prompt}` : modeLabel;
    const createdAt = d.createdAt || Date.now();
    const meta = d.meta || {};

    const optimisticJob = {
      id: job_id,
      job_id,
      app: "video",
      provider: meta.provider || "runway",
      createdAt,
      created_at: createdAt,
      updated_at: createdAt,
      title,
      url: "",
      archive_url: "",
      playbackUrl: "",
      status: "İşleniyor",
      db_status: "processing",
      state: "PROCESSING",
      _fresh: false,
      meta: {
        ...(meta || {}),
        mode: d.mode || meta.mode || "",
        prompt: prompt || meta.prompt || "",
        image_url: d.image_url || meta.image_url || "",
        app: "video",
      },
      outputs: [],
    };

    optimistic.set(job_id, optimisticJob);

    try {
      controller.upsert(optimisticJob);
    } catch (err) {
      console.warn("[VIDEO PANEL] controller.upsert failed", err);
    }

    renderCurrent();
  };

  const onJobReady = (e) => {
    const d = e?.detail || {};
    const job_id = String(d?.job_id || "").trim();
    if (!job_id) return;
    if (hiddenDeletedIds.has(job_id)) return;

    const outputs = Array.isArray(d?.outputs) ? d.outputs : [];
    const videoUrl = safeStr(
      d?.video?.url ||
      d?.raw?.video?.url ||
      d?.raw?.video_url ||
      d?.videoUrl ||
      d?.video_url ||
      ""
    );

    const existingDb = currentDbItems.find((j) => idOf(j) === job_id);

    if (existingDb) {
      existingDb.db_status = "ready";
      existingDb.status = "ready";
      existingDb.state = "COMPLETED";
      existingDb._fresh = true;

      if (outputs.length) {
        existingDb.outputs = outputs;
      } else if (videoUrl) {
        existingDb.outputs = [
          {
            type: "video",
            url: videoUrl,
            meta: { app: "video", variant: "provider", is_final: true },
          },
        ];
      }

      existingDb.playbackUrl = getPlaybackUrl(existingDb) || "";

      if (optimistic.has(job_id)) optimistic.delete(job_id);

      renderCurrent();
      return;
    }

    const optimisticJob = optimistic.get(job_id);
    if (!optimisticJob) return;

    const next = {
      ...optimisticJob,
      _fresh: true,
      db_status: "ready",
      status: "ready",
      state: "COMPLETED",
      outputs: outputs.length
        ? outputs
        : videoUrl
          ? [
              {
                type: "video",
                url: videoUrl,
                meta: { app: "video", variant: "provider", is_final: true },
              },
            ]
          : optimisticJob.outputs || [],
    };

    next.playbackUrl = getPlaybackUrl(next) || "";
    optimistic.set(job_id, next);

    renderCurrent();
  };

  controller.start();
  window.addEventListener("aivo:video:job_created", onJobCreated);
  window.addEventListener("aivo:video:job_ready", onJobReady);

  return {
    destroy() {
      destroyed = true;

      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = null;
      searchInputEl = null;
      searchRootEl = null;

      try { document.removeEventListener("input", onSearchInput, true); } catch {}
      try { document.removeEventListener("search", onSearchInput, true); } catch {}
      try { window.removeEventListener("aivo:video:job_created", onJobCreated); } catch {}
      try { window.removeEventListener("aivo:video:job_ready", onJobReady); } catch {}
      try { controller?.destroy?.(); } catch {}
      try { offEvents?.(); } catch {}
      try { host.innerHTML = ""; } catch {}
    },
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
    const api = createVideoPanel(host);
    return () => {
      try { api?.destroy?.(); } catch {}
    };
  },
});
})();
