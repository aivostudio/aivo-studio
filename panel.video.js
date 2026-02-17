// panel.video.js  (DBJobs edition)
// Goal:
// - Keep existing video production flow untouched (this file is ONLY the RightPanel renderer).
// - Fully switch panel to DBJobs controller (hydrate + status poll + outputs accept).
// - outputs-first URL picking (pickBestVideoUrl) so Safari/DB-only path always renders videos.
// - Delete = backend soft-delete + optimistic UI + rehydrate.

(function () {
  /* =======================
     Small helpers
     ======================= */

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtTime(ts) {
    try {
      const d = new Date(ts);
      if (isNaN(+d)) return "";
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch (_) {
      return "";
    }
  }

  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");
  }

  function isDoneStatus(st) {
    const x = String(st || "").toUpperCase();
    return x === "DONE" || x === "READY" || x === "COMPLETED" || x === "SUCCEEDED" || x === "SUCCESS";
  }

  function isProcessingStatus(st) {
    const x = String(st || "").toUpperCase();
    return x === "PROCESSING" || x === "RUNNING" || x === "PENDING" || x === "QUEUED";
  }

  function isErrorStatus(st) {
    const x = String(st || "").toUpperCase();
    return x === "ERROR" || x === "FAILED" || x === "CANCELED" || x === "CANCELLED";
  }

  function toMaybeProxyUrl(url) {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.startsWith("/api/media/proxy?url=") || u.includes("/api/media/proxy?url=")) return u;
    if (u.startsWith("http://")) return "/api/media/proxy?url=" + encodeURIComponent(u);
    return u;
  }

  /* =======================
     outputs-first URL picking (CRITICAL)
     ======================= */

  function pickUrlFromOutput(o) {
    if (!o) return "";
    const u =
      o.archive_url ||
      o.archiveUrl ||
      o.archiveURL ||
      (o.meta && (o.meta.archive_url || o.meta.archiveUrl || o.meta.archiveURL)) ||
      o.url ||
      o.video_url ||
      o.videoUrl ||
      (o.meta && (o.meta.url || o.meta.video_url || o.meta.videoUrl));
    return String(u || "").trim();
  }

  function acceptVideoOutput(o) {
    if (!o) return false;
    const t = String(o.type || o.kind || "").toLowerCase();
    if (t === "video") return true;
    const mt = String(o.meta?.type || o.meta?.kind || "").toLowerCase();
    return mt === "video";
  }

  // outputs-first:
  // 1) outputs[]: prefer video typed, prefer archive_url if present
  // 2) fall back to top-level url fields
  function pickBestVideoUrl(job) {
    if (!job) return "";

    const outs = Array.isArray(job.outputs) ? job.outputs : [];

    // typed video first
    const hit = outs.find((x) => acceptVideoOutput(x) && pickUrlFromOutput(x));
    if (hit) return toMaybeProxyUrl(pickUrlFromOutput(hit));

    // any output url
    const any = outs.find((x) => pickUrlFromOutput(x));
    if (any) return toMaybeProxyUrl(pickUrlFromOutput(any));

    // fallbacks
    const a = String(job.archive_url || job.archiveUrl || job.meta?.archive_url || job.meta?.archiveUrl || "").trim();
    if (a) return toMaybeProxyUrl(a);

    const u = String(job.url || job.video_url || job.videoUrl || job.meta?.url || job.meta?.video_url || job.meta?.videoUrl || "").trim();
    if (u) return toMaybeProxyUrl(u);

    return "";
  }

  /* =======================
     DBJobs + RightPanel plumbing
     ======================= */

  function ensureDBJobs() {
    if (!window.DBJobs || typeof window.DBJobs.create !== "function") {
      console.warn("[panel.video] DBJobs missing. Include panel.dbjobs.js before panel.video.js");
      return null;
    }
    return window.DBJobs;
  }

  function ensureRightPanel() {
    if (!window.RightPanel || typeof window.RightPanel.register !== "function") {
      console.warn("[panel.video] RightPanel missing. Load panel.manager.js before panel.video.js");
      return null;
    }
    return window.RightPanel;
  }

  function renderEmpty(root) {
    root.innerHTML = `
      <div style="padding:10px 0; opacity:.8;">
        <div style="font-weight:700; margin-bottom:6px;">Video yok</div>
        <div style="font-size:13px;">Henüz DB’de video job bulunamadı.</div>
      </div>
    `;
  }

  function renderError(root, msg) {
    root.innerHTML = `
      <div style="padding:10px 0; color:#ffb3b3;">
        <div style="font-weight:700; margin-bottom:6px;">Hata</div>
        <div style="font-size:13px; opacity:.9;"><code>${escapeHtml(msg || "unknown")}</code></div>
      </div>
    `;
  }

  /* =======================
     Rendering
     ======================= */

  function badgeFromJob(job) {
    const st = String(job.status || job.db_status || job.state || "").toUpperCase();
    if (isDoneStatus(st)) return "DONE";
    if (isErrorStatus(st)) return "ERROR";
    if (isProcessingStatus(st)) return "PROCESSING";
    return st || "UNKNOWN";
  }

  function renderCard(job) {
    const id = String(job.job_id || job.id || "").trim();
    const badge = badgeFromJob(job);

    const when = job.created_at || job.createdAt || job.updated_at || job.updatedAt || "";
    const whenTxt = when ? fmtTime(when) : "";

    const provider = String(job.provider || job.meta?.provider || job.meta?.runway?.provider || job.meta?.engine || "").trim();
    const prompt = String(job.prompt || job.meta?.prompt || job.meta?.title || "").trim();

    const url = pickBestVideoUrl(job);
    const isDone = badge === "DONE";
    const isErr = badge === "ERROR";
    const isProc = badge === "PROCESSING";

    // NOTE: Even if isDone but URL missing, show a debug thumb (never blank card)
    const thumb =
      (url && isDone)
        ? `
          <div class="vpThumb">
            <div class="vpBadge">${escapeHtml(badge)}</div>

            <video
              class="vpVideo"
              preload="metadata"
              playsinline
              webkit-playsinline
              muted
              controls
              data-user-gesture="0"
              src="${escapeHtml(url)}"
            ></video>

            <div class="vpPlay"><span class="vpPlayIcon">▶</span></div>
            <button class="vpFsBtn" data-act="fs" title="Büyüt" aria-label="Büyüt">⛶</button>
          </div>
        `
        : `
          <div class="vpThumb is-loading">
            <div class="vpSkel" aria-label="${escapeHtml(badge)}">
              <div class="vpBadge">${escapeHtml(badge)}</div>
              <div class="vpSkelShimmer"></div>
              <div class="vpSkelPlay">
                <div class="vpSkelPlayRing"></div>
                <div class="vpSkelPlayTri"></div>
              </div>
              <div style="padding:10px; font-size:12px; opacity:.85;">
                <div style="font-weight:700; margin-bottom:4px;">
                  ${escapeHtml(isErr ? "Hata" : (isProc ? "İşleniyor" : "Hazır"))}
                </div>
                <div style="opacity:.8;">
                  ${escapeHtml(url ? "Video yükleniyor…" : "URL yok / henüz hazır değil")}
                </div>
              </div>
            </div>
            <button class="vpFsBtn" data-act="fs" title="Büyüt" aria-label="Büyüt">⛶</button>
          </div>
        `;

    return `
      <div class="vpCard" data-job-id="${escapeHtml(id)}" data-status="${escapeHtml(badge)}" role="button" tabindex="0">
        ${thumb}

        <div class="vpMeta">
          <div class="vpTitle" title="${escapeHtml(provider || "video")}">${escapeHtml(provider || "video")}</div>
          <div class="vpSub" title="${escapeHtml(prompt || "")}">
            ${escapeHtml(prompt || "")}
          </div>

          <div class="vpActions">
            <button class="vpIconBtn" data-act="download" ${url ? "" : "disabled"} title="İndir">⬇</button>
            <button class="vpIconBtn" data-act="share" ${url ? "" : "disabled"} title="Paylaş">⤴</button>
            <button class="vpIconBtn vpDanger" data-act="delete" title="Sil">🗑</button>
          </div>

          <div style="opacity:.7; font-size:11px; margin-top:6px;">
            ${escapeHtml(whenTxt)} ${whenTxt ? "•" : ""} ${escapeHtml(badge)}
          </div>
        </div>
      </div>
    `;
  }

  function renderList(root, items) {
    const cards = (items || []).map(renderCard).join("");
    root.innerHTML = `
      <div class="videoSide">
        <div class="videoSideCard">
          <div class="vpGrid" data-video-grid>
            ${cards || ""}
          </div>
        </div>
      </div>
    `;
  }

  /* =======================
     Actions / events
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

  async function shareUrl(u) {
    const url = String(u || "").trim();
    if (!url) return;

    try {
      if (navigator.share) {
        await navigator.share({ url });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        // no alert/toast here to keep quiet
      } else {
        prompt("Link:", url);
      }
    } catch (_) {}
  }

  function goFullscreen(card) {
    const video = card?.querySelector("video");
    if (!video) return;

    try {
      if (video.requestFullscreen) {
        video.requestFullscreen().catch?.(() => {});
        return;
      }
    } catch (_) {}

    try {
      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
        return;
      }
    } catch (_) {}

    try {
      if (card.requestFullscreen) {
        card.requestFullscreen().catch?.(() => {});
      }
    } catch (_) {}
  }

  function attachDelegatedEvents(root, getJobById, ctrl) {
    const grid = root.querySelector("[data-video-grid]");
    if (!grid) return () => {};

    // no-autoplay guard (paranoid)
    const onPlayCapture = (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement)) return;
      const g = String(v.getAttribute("data-user-gesture") || "0");
      if (g !== "1") {
        try { v.pause(); } catch (_) {}
      }
    };
    grid.addEventListener("play", onPlayCapture, true);

    const onClick = async (e) => {
      const btn = e.target?.closest?.("[data-act]");
      const card = e.target?.closest?.(".vpCard");
      if (!card) return;

      const jobId = String(card.getAttribute("data-job-id") || "").trim();
      if (!jobId) return;

      const job = getJobById(jobId);
      const url = pickBestVideoUrl(job);
      const video = card.querySelector("video.vpVideo");
      const overlay = card.querySelector(".vpPlay");

      if (btn) {
        e.preventDefault();
        e.stopPropagation();

        const act = btn.getAttribute("data-act");

        if (act === "fs") {
          goFullscreen(card);
          return;
        }

        if (act === "download") {
          if (url) downloadUrl(url);
          return;
        }

        if (act === "share") {
          if (url) await shareUrl(url);
          return;
        }

        if (act === "delete") {
          const ok = confirm("Bu videoyu silmek istiyor musun?");
          if (!ok) return;

          // ✅ optimistic UI remove + backend delete + rehydrate
          try {
            if (ctrl && typeof ctrl.remove === "function") ctrl.remove(jobId);
          } catch (_) {}

          try {
            if (ctrl && typeof ctrl.deleteJob === "function") {
              await ctrl.deleteJob(jobId); // DBJobs should POST /api/jobs/delete with app=video internally
            }
          } catch (_) {}

          try {
            if (ctrl && typeof ctrl.hydrate === "function") {
              await ctrl.hydrate(true);
            }
          } catch (_) {}

          return;
        }

        return;
      }

      // card click toggles play/pause if video exists
      if (video) {
        try {
          if (video.paused) {
            video.setAttribute("data-user-gesture", "1");
            await video.play().catch(() => {});
            if (overlay) overlay.style.display = "none";
          } else {
            video.pause();
            video.setAttribute("data-user-gesture", "0");
            if (overlay) overlay.style.display = "";
          }
        } catch (_) {}
      }
    };

    grid.addEventListener("click", onClick);

    return () => {
      grid.removeEventListener("click", onClick);
      grid.removeEventListener("play", onPlayCapture, true);
    };
  }

  /* =======================
     Panel impl (DBJobs)
     ======================= */

  const RightPanel = ensureRightPanel();
  if (!RightPanel) return;

  RightPanel.register("video", {
    header: {
      title: "Video",
      meta: "DB source-of-truth",
      searchEnabled: true,
      searchPlaceholder: "Video ara…",
    },

    mount(root, payload, ctx) {
      const DB = ensureDBJobs();
      if (!DB) {
        renderError(root, "DBJobs missing");
        return () => {};
      }

      const state = {
        all: [],
        view: [],
        query: (ctx && typeof ctx.getQuery === "function") ? String(ctx.getQuery() || "") : "",
      };

      function getJobById(id) {
        const key = String(id || "");
        return state.all.find((x) => String(x?.job_id || x?.id || "") === key) || null;
      }

      function applySearch(q) {
        const qq = String(q || "").trim().toLowerCase();
        state.query = qq;

        if (!qq) {
          state.view = state.all.slice();
        } else {
          state.view = state.all.filter((job) => {
            const id = String(job.job_id || job.id || "");
            const st = String(job.status || job.db_status || job.state || "");
            const pr = String(job.provider || job.meta?.provider || "");
            const p = String(job.prompt || job.meta?.prompt || "");
            return (
              id.toLowerCase().includes(qq) ||
              st.toLowerCase().includes(qq) ||
              pr.toLowerCase().includes(qq) ||
              p.toLowerCase().includes(qq)
            );
          });
        }

        if (!state.view.length) {
          renderEmpty(root);
          return;
        }

        renderList(root, state.view);

        // delegated actions + playback toggles
        if (cleanupEvents) cleanupEvents();
        cleanupEvents = attachDelegatedEvents(root, getJobById, ctrl);
      }

      // initial render
      root.innerHTML = `<div style="padding:10px 0; opacity:.8;">Yükleniyor…</div>`;

      let cleanupEvents = null;

      // DBJobs controller
      const ctrl = DB.create({
        app: "video",
        acceptOutput: acceptVideoOutput,
        pollIntervalMs: 4000,
        hydrateEveryMs: 15000,
        debug: false,

        onChange: (items) => {
          state.all = Array.isArray(items) ? items.slice() : [];

          // header meta counts
          const done = state.all.filter((j) => isDoneStatus(j.status)).length;
          const proc = state.all.filter((j) => isProcessingStatus(j.status)).length;
          const err = state.all.filter((j) => isErrorStatus(j.status)).length;

          if (ctx && typeof ctx.setHeader === "function") {
            ctx.setHeader({ title: "Video", meta: `${done} done • ${proc} processing • ${err} error` });
          }

          applySearch(state.query);
        },
      });

      // start DBJobs loops (hydrate + poll)
      try { ctrl.start(); } catch (_) {}

      // manager calls this on search input
      this.onSearch = (q) => applySearch(q);

      return function unmount() {
        try { if (cleanupEvents) cleanupEvents(); } catch (_) {}
        try { ctrl.destroy && ctrl.destroy(); } catch (_) {}
      };
    },

    onSearch(q) {
      // wired in mount
    },
  });
})();
