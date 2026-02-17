// panel.video.js — RightPanel Video (v2) | DBJobs source-of-truth
// - outputs-first pickBestVideoUrl(job)
// - delete: backend (/api/jobs/delete) + rehydrate pattern
// - render + video üretim akışına dokunmaz (sadece list/poll/render)

(function () {
  /* =======================
     Helpers
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

  function fmtTime(ts) {
    try {
      const d = new Date(ts);
      if (isNaN(+d)) return "";
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch {
      return "";
    }
  }

  // ✅ outputs-first (senin istediğin mantık)
  function pickBestVideoUrl(job) {
    if (!job) return "";

    // 1) outputs[] içinde video url (archive_url dahil) varsa onu seç
    const outs = Array.isArray(job.outputs) ? job.outputs : [];
    const pickFromOut = (o) => {
      if (!o) return "";
      const u =
        o.archive_url || o.archiveUrl || o.archiveURL ||
        (o.meta && (o.meta.archive_url || o.meta.archiveUrl || o.meta.archiveURL)) ||
        o.url || o.video_url || o.videoUrl ||
        (o.meta && (o.meta.url || o.meta.video_url || o.meta.videoUrl));
      return String(u || "").trim();
    };
    const isVideoOut = (o) => {
      const t = String(o?.type || o?.kind || "").toLowerCase();
      const mt = String(o?.meta?.type || o?.meta?.kind || "").toLowerCase();
      return t === "video" || mt === "video";
    };

    const hit = outs.find((o) => isVideoOut(o) && pickFromOut(o));
    if (hit) return pickFromOut(hit);

    const any = outs.find((o) => pickFromOut(o));
    if (any) return pickFromOut(any);

    // 2) fallback: job/meta içi olası video url alanları
    const u =
      job.archive_url || job.archiveUrl ||
      job.url || job.video_url || job.videoUrl ||
      job.video?.url ||
      job.meta?.video?.url ||
      job.meta?.runway?.video?.url ||
      job.meta?.provider?.video?.url ||
      job.meta?.output?.url ||
      job.meta?.result?.url;

    return String(u || "").trim();
  }

  function acceptVideoOutput(o) {
    if (!o) return false;
    const t = String(o.type || "").toLowerCase();
    if (t === "video") return true;
    const mt = o.meta && o.meta.type ? String(o.meta.type).toLowerCase() : "";
    return mt === "video";
  }

  function ensureDBJobs() {
    if (!window.DBJobs || typeof window.DBJobs.create !== "function") {
      console.warn("[panel.video] DBJobs missing. panel.dbjobs.js, panel.video.js'den önce yüklenmeli.");
      return null;
    }
    return window.DBJobs;
  }

  function ensureRightPanel() {
    if (!window.RightPanel || typeof window.RightPanel.register !== "function") {
      console.warn("[panel.video] RightPanel missing. panel.manager.js önce gelmeli.");
      return false;
    }
    return true;
  }

  /* =======================
     UI Render (CSS: mod.video.panel.css)
     Expects: vpGrid/vpCard/vpThumb/vpVideo/vpActions/vpIconBtn
     ======================= */

  function renderEmpty(host) {
    host.innerHTML = `
      <div class="videoSide">
        <div class="videoSideCard">
          <div class="vpEmpty">Henüz video yok.</div>
        </div>
      </div>
    `;
  }

  function renderLoading(host) {
    host.innerHTML = `
      <div class="videoSide">
        <div class="videoSideCard">
          <div class="vpEmpty">Yükleniyor…</div>
        </div>
      </div>
    `;
  }

  function normalizeBadge(job) {
    const st = String(job?.status || "").toUpperCase();
    if (["DONE", "READY", "COMPLETED", "SUCCEEDED", "SUCCESS"].includes(st)) return "Hazır";
    if (["ERROR", "FAILED", "CANCELED", "CANCELLED"].includes(st)) return "Hata";
    return "İşleniyor";
  }

  function formatKind(job) {
    const m =
      String(job?.meta?.mode || job?.meta?.kind || job?.mode || job?.kind || "").toLowerCase();
    if (m.includes("image")) return "Image→Video";
    if (m.includes("text")) return "Text→Video";
    return "Video";
  }

  function renderCard(job) {
    const id = String(job?.job_id || job?.id || "");
    const url = pickBestVideoUrl(job);
    const badge = normalizeBadge(job);

    const created = job?.created_at || job?.createdAt || job?.updated_at || job?.updatedAt || "";
    const whenTxt = created ? fmtTime(created) : "";

    const provider = String(job?.provider || job?.meta?.provider || job?.meta?.engine || "video");
    const kind = formatKind(job);
    const sub = String(job?.prompt || job?.meta?.prompt || job?.meta?.title || job?.title || "").trim();

    const isReady = badge === "Hazır" && !!url;

    return `
      <div class="vpCard" data-job-id="${esc(id)}" role="button" tabindex="0">
        <div class="vpThumb ${isReady ? "" : "is-loading"}">
          <div class="vpBadge">${esc(badge)}</div>

          ${
            isReady
              ? `
                <video
                  class="vpVideo"
                  preload="metadata"
                  playsinline
                  controls
                  data-user-gesture="0"
                  src="${esc(url)}"
                ></video>
                <div class="vpPlay"><span class="vpPlayIcon">▶</span></div>
              `
              : `
                <div class="vpSkel" aria-label="İşleniyor">
                  <div class="vpSkelShimmer"></div>
                </div>
              `
          }

          <button class="vpFsBtn" data-act="fs" title="Büyüt" aria-label="Büyüt">⛶</button>
        </div>

        <div class="vpMeta">
          <div class="vpTitle" title="${esc(kind)}">${esc(kind)}</div>
          <div class="vpSub" title="${esc(sub)}">${esc(sub)}</div>
          <div class="vpSub" style="opacity:.75" title="${esc(provider)}">
            ${esc(provider)} ${whenTxt ? "• " + esc(whenTxt) : ""}
          </div>

          <div class="vpActions">
            <button class="vpIconBtn" data-act="download" ${url ? "" : "disabled"} title="İndir">⬇</button>
            <button class="vpIconBtn" data-act="share" ${url ? "" : "disabled"} title="Paylaş">⤴</button>
            <button class="vpIconBtn vpDanger" data-act="delete" title="Sil">🗑</button>
          </div>
        </div>
      </div>
    `;
  }

  function renderList(host, items) {
    host.innerHTML = `
      <div class="videoSide">
        <div class="videoSideCard">
          <div class="vpGrid" data-video-grid>
            ${(items || []).map(renderCard).join("")}
          </div>
        </div>
      </div>
    `;
  }

  /* =======================
     Actions
     ======================= */

  function downloadUrl(url) {
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

  function shareUrl(url) {
    const u = String(url || "").trim();
    if (!u) return;
    if (navigator.share) {
      navigator.share({ url: u }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(u).catch(() => {});
    }
  }

  async function backendDelete(jobId) {
    const job_id = String(jobId || "").trim();
    if (!job_id) return;

    // ✅ backend POST + app zorunlu (missing_app fix)
    await fetch("/api/jobs/delete", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({ job_id, app: "video" }),
    })
      .then((r) => r.json().catch(() => null))
      .catch(() => null);
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

  function attachEvents(host, getJobById, onDelete) {
    const grid = host.querySelector("[data-video-grid]");
    if (!grid) return () => {};

    // no-autoplay guard (edge-case)
    const onPlayCapture = (e) => {
      const v = e.target;
      if (!(v instanceof HTMLVideoElement)) return;
      const g = String(v.getAttribute("data-user-gesture") || "0");
      if (g !== "1") {
        try { v.pause(); } catch {}
      }
    };
    grid.addEventListener("play", onPlayCapture, true);

    const onClick = async (e) => {
      const card = e.target.closest(".vpCard");
      if (!card) return;

      const jobId = card.getAttribute("data-job-id") || "";
      const job = getJobById(jobId);
      const url = pickBestVideoUrl(job);

      const btn = e.target.closest("[data-act]");
      const video = card.querySelector("video.vpVideo");
      const overlay = card.querySelector(".vpPlay");

      if (btn) {
        e.stopPropagation();
        const act = btn.getAttribute("data-act");

        if (act === "fs") { goFullscreen(card); return; }
        if (act === "download") { if (url) downloadUrl(url); return; }
        if (act === "share") { if (url) shareUrl(url); return; }

        if (act === "delete") {
          const ok = confirm("Bu videoyu silmek istiyor musun?");
          if (!ok) return;
          await onDelete(jobId);
        }
        return;
      }

      // card click toggles play/pause (ready ise)
      if (!video || !url) return;

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
      } catch {}
    };

    grid.addEventListener("click", onClick);

    return () => {
      grid.removeEventListener("click", onClick);
      grid.removeEventListener("play", onPlayCapture, true);
    };
  }

  /* =======================
     RightPanel impl (DBJobs)
     ======================= */

  if (!ensureRightPanel()) return;

  const impl = {
    getHeader() {
      return { title: "Videolarım", meta: "DB source-of-truth", searchPlaceholder: "Videolarda ara..." };
    },

    mount(host, payload, ctx) {
      const DB = ensureDBJobs();
      if (!DB) {
        host.innerHTML = `<div class="vpEmpty">DBJobs missing</div>`;
        return () => {};
      }

      const state = {
        all: [],
        view: [],
        query: (ctx && ctx.getQuery) ? String(ctx.getQuery() || "") : ""
      };

      function applySearch(q) {
        const qq = String(q || "").trim().toLowerCase();
        state.query = qq;

        if (!qq) {
          state.view = state.all.slice();
        } else {
          state.view = state.all.filter((job) => {
            const id = String(job?.job_id || job?.id || "").toLowerCase();
            const st = String(job?.status || "").toLowerCase();
            const pr = String(job?.provider || job?.meta?.provider || "").toLowerCase();
            const p  = String(job?.prompt || job?.meta?.prompt || "").toLowerCase();
            return id.includes(qq) || st.includes(qq) || pr.includes(qq) || p.includes(qq);
          });
        }

        if (!state.view.length) renderEmpty(host);
        else renderList(host, state.view);

        // events her render sonrası tazelenecek
        if (offEvents) { try { offEvents(); } catch {} }
        offEvents = attachEvents(
          host,
          (id) => state.all.find((x) => String(x?.job_id || x?.id || "") === String(id)),
          async (id) => {
            // ✅ delete pattern: optimistic remove → backend → rehydrate
            ctrl.remove(id);
            await backendDelete(id);
            ctrl.hydrate(true);
          }
        );
      }

      renderLoading(host);

      let offEvents = null;

      const ctrl = DB.create({
        app: "video",
        acceptOutput: acceptVideoOutput,
        pollIntervalMs: 4000,
        hydrateEveryMs: 15000,
        debug: false,
        onChange: (items) => {
          state.all = Array.isArray(items) ? items.slice() : [];

          // header meta counts
          const up = (x) => String(x || "").toUpperCase();
          const done = state.all.filter((j) => ["DONE","READY","COMPLETED","SUCCEEDED","SUCCESS"].includes(up(j.status))).length;
          const proc = state.all.filter((j) => ["PROCESSING","RUNNING","PENDING","QUEUED"].includes(up(j.status))).length;
          const err  = state.all.filter((j) => ["ERROR","FAILED","CANCELED","CANCELLED"].includes(up(j.status))).length;

          if (ctx && typeof ctx.setHeader === "function") {
            ctx.setHeader({ title: "Videolarım", meta: `${done} hazır • ${proc} işleniyor • ${err} hata` });
          }

          applySearch(state.query);
        }
      });

      ctrl.start();

      // manager search hook
      impl.onSearch = (q) => applySearch(q);

      return function unmount() {
        try { offEvents && offEvents(); } catch {}
        try { ctrl.destroy(); } catch {}
      };
    },

    onSearch(q) { /* wired in mount */ }
  };

  window.RightPanel.register("video", impl);
})();
