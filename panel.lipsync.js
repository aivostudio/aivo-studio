// panel.lipsync.js
// DB source-of-truth lipsync video cards

(function () {
  if (!window.RightPanel) return;

  if (!window.DBJobs) {
    console.warn("[LIPSYNC PANEL] DBJobs yok. panel.dbjobs.js yüklenmeli.");
    return;
  }

  const safeStr = (v) => String(v == null ? "" : v).trim();

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");

  const idOf = (it) => String(it?.job_id || it?.id || "").trim();

  const getJobApp = (job) =>
    String(job?.app || job?.meta?.app || job?.meta?.module || "").trim();

  const isLipsyncApp = (x) => norm(x) === "lipsync" || norm(x).includes("lipsync");

  const isJobLipsync = (job) => isLipsyncApp(getJobApp(job));

  const toMaybeProxyUrl = (url) => {
    const u = safeStr(url);
    if (!u) return "";
    if (u.startsWith("/api/media/proxy?url=") || u.includes("/api/media/proxy?url=")) return u;
    if (u.startsWith("http://") || u.startsWith("https://")) {
      return "/api/media/proxy?url=" + encodeURIComponent(u);
    }
    return u;
  };

  function mapBadge(job) {
    const st = norm(job?.db_status || job?.status || job?.state).toUpperCase();

    if (st.includes("FAIL") || st.includes("ERROR")) {
      return { text: "Hata", kind: "bad" };
    }

    if (st.includes("READY") || st.includes("DONE") || st.includes("COMPLET") || st.includes("SUCC")) {
      return { text: "Hazır", kind: "ok" };
    }

    return { text: "İşleniyor", kind: "mid" };
  }

  function pickOutputUrl(o) {
    return safeStr(
      o?.archive_url ||
      o?.archiveUrl ||
      o?.url ||
      o?.video_url ||
      o?.videoUrl ||
      o?.raw_url ||
      o?.rawUrl ||
      o?.meta?.archive_url ||
      o?.meta?.archiveUrl ||
      o?.meta?.url ||
      o?.meta?.video_url ||
      o?.meta?.videoUrl ||
      ""
    );
  }

  function pickVideoFromJob(job) {
    const outs = Array.isArray(job?.outputs) ? job.outputs : [];
    const meta = job?.meta || {};

    const byVariant = (variant) => {
      const wanted = safeStr(variant).toLowerCase();
      const hit = outs.find((o) => {
        const v = safeStr(o?.meta?.variant).toLowerCase();
        return v === wanted && pickOutputUrl(o);
      });

      return pickOutputUrl(hit);
    };

    return (
      safeStr(meta?.final_video_url) ||
      safeStr(job?.final_video_url) ||
      byVariant("provider") ||
      byVariant("finalized") ||
      byVariant("preview") ||
      safeStr(job?.final_url) ||
      safeStr(job?.video_url) ||
      safeStr(job?.videoUrl) ||
      safeStr(meta?.final_url) ||
      safeStr(meta?.video_url) ||
      safeStr(meta?.videoUrl) ||
      pickOutputUrl(outs.find((o) => pickOutputUrl(o)))
    );
  }

  function shortTitle(text, max = 44) {
    const s = safeStr(text).replace(/\s+/g, " ");
    if (!s) return "";
    return s.length > max ? s.slice(0, max - 1).trim() + "…" : s;
  }

  function getLipsyncCardTitle(job) {
    const meta = job?.meta || {};

    const audioName = safeStr(
      meta.audio_file_name ||
      meta.audioFileName ||
      meta.audio_name ||
      meta.audioName ||
      meta.file_name ||
      meta.filename ||
      meta.original_filename ||
      meta.originalFilename
    );

    if (audioName) {
      return shortTitle("Ses: " + audioName, 46);
    }

    const script = safeStr(
      meta.script ||
      meta.text ||
      meta.prompt ||
      job?.prompt ||
      job?.title
    );

    if (script) {
      return shortTitle(script, 46);
    }

    return "Dudak Senkron Video";
  }
  function createLipsyncPanel(host) {
    let destroyed = false;
    let currentDbItems = [];
    const hiddenDeletedIds = new Set();

    host.innerHTML = `
      <div class="lipsyncPanelWrap" style="display:flex;flex-direction:column;gap:12px;">
        <div
          class="lipsyncPanelGrid"
          data-grid
          style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;"
        ></div>
      </div>
    `;

    const grid = host.querySelector("[data-grid]");

    function renderCard(job) {
      const jid = idOf(job);
      const badge = mapBadge(job);
      const videoRaw = pickVideoFromJob(job);
      const videoUrl = toMaybeProxyUrl(videoRaw);
      const ready = badge.kind === "ok" && !!videoUrl;

      if (window.AIVO_SHARED_VIDEO_CARD?.createCardHtml) {
        return (
          '<div class="lipsyncPanelCardInner" data-job="' + esc(jid) + '">' +
          window.AIVO_SHARED_VIDEO_CARD.createCardHtml({
            id: jid,
            title: getLipsyncCardTitle(job),
            sub: safeStr(job?.meta?.script || job?.prompt || ""),
            badgeText: badge.text,
            badgeKind: badge.kind === "ok" ? "ready" : badge.kind === "bad" ? "error" : "loading",
            videoUrl: ready ? videoUrl + "#t=0.001" : "",
           posterUrl: safeStr(
           job?.poster_url ||
           job?.thumbnail_url ||
         job?.thumb_url ||
          job?.meta?.poster_url ||
        job?.meta?.thumbnail_url ||
        job?.meta?.thumb_url ||
        ""
),
            ratio: "9:16",
            ready,
            canDownload: !!videoRaw,
            canShare: ready,
            canDelete: true,
          }) +
          "</div>"
        );
      }

      return `
        <div class="lipsyncFallbackCard" data-job="${esc(jid)}">
          <strong>${esc(badge.text)}</strong>
          <div>${esc(safeStr(job?.meta?.script || job?.prompt || "Dudak senkron video"))}</div>
        </div>
      `;
       }

    function render(items) {
      if (!grid) return;

      const list = Array.isArray(items) ? items : [];

      if (!list.length) {
        grid.innerHTML = `
          <div style="opacity:.75;font-size:13px;padding:12px;">
            Henüz lipsync video yok.
          </div>
        `;
        return;
      }

      grid.innerHTML = list.map(renderCard).join("");
    }

    async function deleteJob(id) {
      const res = await fetch("/api/jobs/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          job_id: id,
          app: "lipsync"
        })
      });

      const data = await res.json().catch(() => null);
      return !!(res.ok && data && data.ok !== false);
    }

    host.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-svc-act], [data-act]");
      if (!btn) return;

      const act = btn.dataset.svcAct || btn.dataset.act;
      const card = btn.closest("[data-job], .svcCard");
      const id = safeStr(btn.dataset.id || btn.dataset.job || card?.dataset?.job || card?.dataset?.svcId);

      if (!act || !id) return;

      const job = currentDbItems.find((x) => idOf(x) === id);
      if (!job) return;

      const videoRaw = pickVideoFromJob(job);

      if (act === "play") {
        const video = card?.querySelector("video");
        if (!video) return;
        if (video.paused) video.play().catch(() => {});
        else video.pause();
        return;
      }

      if (act === "download") {
        if (!videoRaw) return;
        const a = document.createElement("a");
        a.href = toMaybeProxyUrl(videoRaw);
        a.download = `lipsync-${id}.mp4`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }

      if (act === "share") {
        if (!videoRaw) return;
        if (navigator.share) {
          navigator.share({ url: videoRaw }).catch(() => {});
        } else {
          navigator.clipboard?.writeText(videoRaw).catch(() => {});
        }
        return;
      }

      if (act === "delete") {
        hiddenDeletedIds.add(id);
        currentDbItems = currentDbItems.filter((x) => idOf(x) !== id);
        render(currentDbItems);

        const ok = await deleteJob(id);
        if (!ok) {
          hiddenDeletedIds.delete(id);
          controller?.hydrate?.(true);
        }

        return;
      }
    });

    const controller = window.DBJobs.create({
      app: "lipsync",
      debug: false,
      pollIntervalMs: 4000,
      hydrateEveryMs: 12000,

      acceptJob: (job) => {
        if (!job) return false;
        return isJobLipsync(job);
      },

      acceptOutput: () => true,

      onChange: (items) => {
        if (destroyed) return;

        currentDbItems = (items || [])
          .filter(isJobLipsync)
          .filter((j) => {
            const id = idOf(j);
            return id && !hiddenDeletedIds.has(id);
          });

        render(currentDbItems);
      },
    });

      const onJobCreated = (e) => {
      const d = e?.detail || {};
      const jobId = safeStr(d.job_id);

      if (!jobId) return;
      if (hiddenDeletedIds.has(jobId)) return;

      const app = safeStr(d.app || d.meta?.app || "lipsync").toLowerCase();
      if (!isLipsyncApp(app)) return;

      const exists = currentDbItems.some((j) => idOf(j) === jobId);
      if (exists) return;

      const meta = d.meta || {};
      const createdAt = d.createdAt || Date.now();

      currentDbItems = [
        {
          job_id: jobId,
          id: jobId,
          app: "lipsync",
          status: "processing",
          db_status: "processing",
          state: "processing",
          createdAt,
          created_at: createdAt,
          meta: {
            ...(meta || {}),
            app: "lipsync",
            script: meta.script || "",
            resolution: meta.resolution || "",
            duration: meta.duration || "",
            estimatedCredits: meta.estimatedCredits || "",
          },
          outputs: [],
        },
        ...currentDbItems,
      ];

      render(currentDbItems);
    };
      const onJobReady = (e) => {
      const d = e?.detail || {};
      const jobId = safeStr(d.job_id);

      if (!jobId) return;
      if (hiddenDeletedIds.has(jobId)) return;

      const videoUrl = safeStr(
        d?.video?.url ||
        d?.raw?.video?.url ||
        d?.raw?.video_url ||
        d?.videoUrl ||
        d?.video_url ||
        ""
      );

      const outputs = Array.isArray(d?.outputs) && d.outputs.length
        ? d.outputs
        : videoUrl
          ? [
              {
                type: "video",
                url: videoUrl,
                meta: {
                  app: "lipsync",
                  variant: "provider",
                  is_final: true
                }
              }
            ]
          : [];

      let found = false;

      currentDbItems = currentDbItems.map((job) => {
        if (idOf(job) !== jobId) return job;

        found = true;

        return {
          ...job,
          status: "ready",
          db_status: "ready",
          state: "COMPLETED",
          outputs: outputs.length ? outputs : job.outputs || []
        };
      });

      if (!found) {
        currentDbItems = [
          {
            job_id: jobId,
            id: jobId,
            app: "lipsync",
            status: "ready",
            db_status: "ready",
            state: "COMPLETED",
            createdAt: Date.now(),
            created_at: Date.now(),
            meta: {
              app: "lipsync",
              script: safeStr(d?.raw?.prompt || d?.raw?.meta?.script || "")
            },
            outputs
          },
          ...currentDbItems
        ];
      }

      try {
        controller?.upsert?.(currentDbItems.find((x) => idOf(x) === jobId));
      } catch {}

      render(currentDbItems);
    };
       controller.start();
    window.addEventListener("aivo:lipsync:job_created", onJobCreated);
    window.addEventListener("aivo:lipsync:job_ready", onJobReady);

    return {
      destroy() {
        try {
          window.removeEventListener("aivo:lipsync:job_created", onJobCreated);
        } catch {}
        destroyed = true;

        try {
          controller?.destroy?.();
        } catch {}

        try {
          host.innerHTML = "";
        } catch {}
      },
    };
  }

  try {
    console.log("[PANEL.LIPSYNC] register run");

    if (typeof window.RightPanel.register === "function") {
      window.RightPanel.register("lipsync", {
        header: {
          title: "AI Dudak Senkron Video",
          meta: "Hazırlanıyor",
          searchEnabled: true,
          searchPlaceholder: "Dudak senkron videolarda ara...",
          resetSearch: true,
        },

        mount(host) {
          const api = createLipsyncPanel(host);
          return () => {
            try {
              api?.destroy?.();
            } catch {}
          };
        },
      });
    } else {
      console.warn("[LIPSYNC PANEL] RightPanel.register yok.");
    }
  } catch (e) {
    console.warn("[LIPSYNC PANEL] register failed", e);
  }
})();
