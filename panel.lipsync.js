// panel.lipsync.js
// DB source-of-truth lipsync video cards

(function () {
  if (!window.RightPanel) return;

  function getLipsyncPanelLanguage() {
    try {
      const language = window.AIVO_STUDIO_I18N?.getLanguage?.();
      if (language) {
        return String(language).toLowerCase().startsWith("en") ? "en" : "tr";
      }
    } catch {}

    const language = String(
      window.AIVO_LANG || document.documentElement.lang || "tr"
    ).toLowerCase();

    return language.startsWith("en") ? "en" : "tr";
  }

  function formatLipsyncPanelText(value, parameters) {
    let output = String(value == null ? "" : value);

    if (!parameters || typeof parameters !== "object") return output;

    Object.keys(parameters).forEach((key) => {
      output = output.replace(
        new RegExp(`\\{${key}\\}`, "g"),
        String(parameters[key])
      );
    });

    return output;
  }

  function lipsyncPanelText(key, trText, enText, parameters) {
    try {
      const translated = window.AIVO_STUDIO_I18N?.t?.(key, "", parameters);
      if (translated && translated !== key) {
        return formatLipsyncPanelText(translated, parameters);
      }
    } catch {}

    try {
      const translated = window.studioT?.(key, "", parameters);
      if (translated && translated !== key) {
        return formatLipsyncPanelText(translated, parameters);
      }
    } catch {}

    return formatLipsyncPanelText(
      getLipsyncPanelLanguage() === "en" ? enText : trText,
      parameters
    );
  }

  function showLipsyncPanelToast(type, message) {
    try {
      const api = window.toast;
      if (!api || !message) return;

      if (type === "success" && api.success) return api.success(message);
      if (type === "error" && api.error) return api.error(message);
      if (type === "info" && api.info) return api.info(message);
      if (api.show) return api.show(message);
    } catch {}
  }

  function getLipsyncPanelHeader() {
    return {
      title: lipsyncPanelText(
        "studio.lipsync.panel.title",
        "Dudak Senkron Videolarım",
        "My Lip-Sync Videos"
      ),
      meta: lipsyncPanelText(
        "studio.lipsync.panel.meta.preparing",
        "Hazırlanıyor",
        "Preparing"
      ),
      searchEnabled: true,
      searchPlaceholder: lipsyncPanelText(
        "studio.lipsync.panel.searchPlaceholder",
        "Dudak senkron videolarda ara...",
        "Search lip-sync videos..."
      ),
      resetSearch: true,
    };
  }

  let refreshMountedLipsyncPanel = null;

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

  const isLipsyncApp = (x) =>
    norm(x) === "lipsync" || norm(x).includes("lipsync");

  const isJobLipsync = (job) => isLipsyncApp(getJobApp(job));

  const toMaybeProxyUrl = (url) => {
    const u = safeStr(url);
    if (!u) return "";

    if (
      u.startsWith("/api/media/proxy?url=") ||
      u.includes("/api/media/proxy?url=")
    ) {
      try {
        const encoded = u.split("url=")[1] || "";
        return decodeURIComponent(encoded).split("#")[0];
      } catch {
        return u;
      }
    }

    return u;
  };

  function mapBadge(job) {
    const st = norm(job?.db_status || job?.status || job?.state).toUpperCase();

    if (st.includes("FAIL") || st.includes("ERROR")) {
      return {
        text: lipsyncPanelText(
          "studio.lipsync.panel.status.failed",
          "Hata",
          "Failed"
        ),
        kind: "bad",
      };
    }

    if (
      st.includes("READY") ||
      st.includes("DONE") ||
      st.includes("COMPLET") ||
      st.includes("SUCC")
    ) {
      return {
        text: lipsyncPanelText(
          "studio.lipsync.panel.status.ready",
          "Hazır",
          "Ready"
        ),
        kind: "ok",
      };
    }

    return {
      text: lipsyncPanelText(
        "studio.lipsync.panel.status.processing",
        "İşleniyor",
        "Processing"
      ),
      kind: "mid",
    };
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

    const firstVideoUrl = pickOutputUrl(
      outs.find(
        (o) =>
          String(o?.type || "").toLowerCase() === "video" && pickOutputUrl(o)
      )
    );

    return (
      byVariant("finalized") ||
      byVariant("preview") ||
      byVariant("provider") ||
      firstVideoUrl ||
      safeStr(job?.final_video_url) ||
      safeStr(meta?.final_video_url) ||
      safeStr(job?.final_url) ||
      safeStr(job?.video_url) ||
      safeStr(job?.videoUrl) ||
      safeStr(meta?.final_url) ||
      safeStr(meta?.video_url) ||
      safeStr(meta?.videoUrl)
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
      return shortTitle(
        lipsyncPanelText(
          "studio.lipsync.panel.audioTitle",
          "Ses: {name}",
          "Audio: {name}",
          { name: audioName }
        ),
        46
      );
    }

    const script = safeStr(
      meta.script ||
      meta.text ||
      meta.prompt ||
      job?.prompt ||
      job?.title
    );

    if (script) return shortTitle(script, 46);

    return lipsyncPanelText(
      "studio.lipsync.panel.defaultTitle",
      "Dudak Senkron Video",
      "Lip-Sync Video"
    );
  }

  function localizeCardActions(root) {
    if (!root) return;

    const actionMap = {
      play: [
        "studio.lipsync.panel.action.play",
        "Oynat",
        "Play",
      ],
      "lipsync-play": [
        "studio.lipsync.panel.action.play",
        "Oynat",
        "Play",
      ],
      pause: [
        "studio.lipsync.panel.action.pause",
        "Duraklat",
        "Pause",
      ],
      download: [
        "studio.lipsync.panel.action.download",
        "Videoyu indir",
        "Download video",
      ],
      share: [
        "studio.lipsync.panel.action.share",
        "Videoyu paylaş",
        "Share video",
      ],
      fullscreen: [
        "studio.lipsync.panel.action.fullscreen",
        "Tam ekran aç",
        "Open fullscreen",
      ],
      delete: [
        "studio.lipsync.panel.action.delete",
        "Videoyu sil",
        "Delete video",
      ],
      mute: [
        "studio.lipsync.panel.action.audioOff",
        "Sesi kapat",
        "Turn sound off",
      ],
      unmute: [
        "studio.lipsync.panel.action.audioOn",
        "Sesi aç",
        "Turn sound on",
      ],
      audioOn: [
        "studio.lipsync.panel.action.audioOn",
        "Sesi aç",
        "Turn sound on",
      ],
      audioOff: [
        "studio.lipsync.panel.action.audioOff",
        "Sesi kapat",
        "Turn sound off",
      ],
    };

    root.querySelectorAll("[data-svc-act], [data-act]").forEach((button) => {
      const action = button.dataset.svcAct || button.dataset.act || "";
      const item = actionMap[action];
      if (!item) return;

      const label = lipsyncPanelText(item[0], item[1], item[2]);
      button.setAttribute("title", label);
      button.setAttribute("aria-label", label);
    });
  }

  function createLipsyncPanel(host) {
    let destroyed = false;
    let currentDbItems = [];
    let searchTimer = null;
    let searchInputEl = null;
    let searchRootEl = null;

    const state = { query: "" };
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

    function resolvePanelSearchInput() {
      const candidates = [
        ...document.querySelectorAll("input.rpSearch"),
        ...document.querySelectorAll("[data-right-panel-search]"),
        ...document.querySelectorAll('input[type="search"]'),
      ];

      const panelRoot =
        host.closest(
          '[data-right-panel-root], .rightPanel, .rpShell, .rpWrap, .rpPanel, .RightPanel'
        ) ||
        host.parentElement ||
        document;

      for (const input of candidates) {
        if (!(input instanceof HTMLElement)) continue;

        const root =
          input.closest(
            '[data-right-panel-root], .rightPanel, .rpShell, .rpWrap, .rpPanel, .RightPanel'
          ) || input.parentElement;

        if (root && panelRoot && root === panelRoot) return input;
      }

      return candidates[0] || null;
    }

    function ensureSearchBinding() {
      const nextInput = resolvePanelSearchInput();
      if (!nextInput) return null;
      if (searchInputEl === nextInput) return searchInputEl;

      searchInputEl = nextInput;
      searchRootEl =
        searchInputEl.closest(
          '[data-right-panel-root], .rightPanel, .rpShell, .rpWrap, .rpPanel, .RightPanel'
        ) ||
        searchInputEl.parentElement ||
        null;

      return searchInputEl;
    }

    function syncSearchFromInput() {
      const input = ensureSearchBinding();
      const nextQuery = safeStr(input?.value || "");
      if (state.query === nextQuery) return;

      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.query = nextQuery;
        renderCurrent();
      }, 120);
    }

    const onSearchInput = (event) => {
      const input = ensureSearchBinding();
      if (!input) return;
      if (event.target === input) syncSearchFromInput();
    };

    document.addEventListener("input", onSearchInput, true);
    document.addEventListener("search", onSearchInput, true);

    setTimeout(() => {
      ensureSearchBinding();
      syncSearchFromInput();
    }, 0);

    function buildSearchHaystack(job) {
      return safeStr([
        getLipsyncCardTitle(job),
        job?.meta?.script,
        job?.meta?.prompt,
        job?.prompt,
        job?.db_status,
        job?.status,
        job?.state,
      ].join(" ")).toLowerCase();
    }

    function buildVisibleItems() {
      const list = currentDbItems.filter((job) => {
        const id = idOf(job);
        return id && !hiddenDeletedIds.has(id);
      });

      const query = safeStr(state.query).toLowerCase();
      if (!query) return list;

      return list.filter((job) => buildSearchHaystack(job).includes(query));
    }

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
            badgeKind:
              badge.kind === "ok"
                ? "ready"
                : badge.kind === "bad"
                  ? "error"
                  : "loading",
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
          <div>${esc(
            safeStr(
              job?.meta?.script ||
              job?.prompt ||
              lipsyncPanelText(
                "studio.lipsync.panel.defaultTitle",
                "Dudak Senkron Video",
                "Lip-Sync Video"
              )
            )
          )}</div>
        </div>
      `;
    }

    function render(items) {
      if (!grid) return;

      const list = Array.isArray(items) ? items : [];

      if (!list.length) {
        grid.innerHTML = `
          <div style="opacity:.75;font-size:13px;padding:12px;">
            ${state.query
              ? lipsyncPanelText(
                  "studio.lipsync.panel.noResults",
                  "Aramanızla eşleşen dudak senkron videosu bulunamadı.",
                  "No lip-sync videos match your search."
                )
              : lipsyncPanelText(
                  "studio.lipsync.panel.empty",
                  "Henüz dudak senkron videosu yok.",
                  "No lip-sync videos yet."
                )}
          </div>
        `;
        return;
      }

      grid.innerHTML = list.map(renderCard).join("");

      grid
        .querySelectorAll('[data-svc-act="play"]')
        .forEach((button) => {
          button.dataset.svcAct = "lipsync-play";
        });

      localizeCardActions(grid);
    }

    function renderCurrent() {
      render(buildVisibleItems());
    }

    refreshMountedLipsyncPanel = renderCurrent;

    async function deleteJob(id) {
      const res = await fetch("/api/jobs/delete", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          job_id: id,
          app: "lipsync",
        }),
      });

      const data = await res.json().catch(() => null);
      return !!(res.ok && data && data.ok !== false);
    }

    host.addEventListener("click", async (event) => {
      const btn = event.target.closest("[data-svc-act], [data-act]");
      if (!btn) return;

      const act = btn.dataset.svcAct || btn.dataset.act;
      const card = btn.closest("[data-job], .svcCard");
      const id = safeStr(
        btn.dataset.id ||
        btn.dataset.job ||
        card?.dataset?.job ||
        card?.dataset?.svcId
      );

      if (!act || !id) return;

      const job = currentDbItems.find((item) => idOf(item) === id);
      if (!job) return;

      const videoRaw = pickVideoFromJob(job);

      if (act === "play" || act === "lipsync-play") {
        event.preventDefault();
        event.stopPropagation();

        const serviceCard = btn.closest(".svcCard") || card;
        const video = serviceCard?.querySelector("video.svcVideo, video");
        const poster = serviceCard?.querySelector(".svcPoster");

        if (!video) return;

        const lazyUrl = String(
          video.dataset.videoUrl ||
          video.getAttribute("data-video-url") ||
          toMaybeProxyUrl(videoRaw) ||
          ""
        ).trim();

        if (!video.src && lazyUrl) {
          video.preload = "metadata";
          video.style.display = "block";
          video.src = lazyUrl;

          if (!video.__aivoLipsyncPosterBound) {
            video.__aivoLipsyncPosterBound = true;

            const hidePoster = () => {
              if (poster) poster.style.display = "none";
            };

            video.addEventListener("loadeddata", hidePoster, { once: true });
            video.addEventListener("playing", hidePoster, { once: true });
          }

          try {
            video.load();
          } catch {}
        } else {
          video.style.display = "block";
          if (poster) poster.style.display = "none";
        }

        if (!video.__aivoLipsyncPlaySyncBound) {
          video.__aivoLipsyncPlaySyncBound = true;

          const syncPlayButton = () => {
            btn.textContent = video.paused ? "▶" : "❚❚";
            const label = video.paused
              ? lipsyncPanelText(
                  "studio.lipsync.panel.action.play",
                  "Oynat",
                  "Play"
                )
              : lipsyncPanelText(
                  "studio.lipsync.panel.action.pause",
                  "Duraklat",
                  "Pause"
                );

            btn.setAttribute("title", label);
            btn.setAttribute("aria-label", label);
          };

          video.addEventListener("play", syncPlayButton);
          video.addEventListener("pause", syncPlayButton);
          video.addEventListener("ended", syncPlayButton);
          syncPlayButton();
        }

        try {
          if (video.paused) {
            await video.play();
          } else {
            video.pause();
          }
        } catch (error) {
          console.error("[LIPSYNC PANEL] play failed", error);
        }

        return;
      }

      if (act === "download") {
        event.preventDefault();
        event.stopPropagation();
        if (!videoRaw) return;

        let cleanUrl = toMaybeProxyUrl(videoRaw);
        cleanUrl = String(cleanUrl || "").trim();
        cleanUrl = cleanUrl.includes("#") ? cleanUrl.split("#")[0] : cleanUrl;

        if (
          cleanUrl.startsWith("/api/media/proxy?url=") ||
          cleanUrl.includes("/api/media/proxy?url=")
        ) {
          try {
            const encoded = cleanUrl.split("url=")[1] || "";
            cleanUrl = decodeURIComponent(encoded).split("#")[0];
          } catch {}
        }

        try {
          const response = await fetch(cleanUrl, {
            method: "GET",
            cache: "no-store",
          });

          if (!response.ok) {
            throw new Error("download_fetch_failed_" + response.status);
          }

          const blob = await response.blob();
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");

          link.href = objectUrl;
          link.download = `lipsync-${id}.mp4`;
          link.rel = "noopener";
          document.body.appendChild(link);
          link.click();
          link.remove();

          setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

          showLipsyncPanelToast(
            "success",
            lipsyncPanelText(
              "studio.lipsync.panel.download.success",
              "Dudak senkron videosu indirildi.",
              "The lip-sync video was downloaded."
            )
          );
        } catch (error) {
          console.error("[LIPSYNC PANEL] download failed", error);
          showLipsyncPanelToast(
            "error",
            lipsyncPanelText(
              "studio.lipsync.panel.download.failed",
              "Dudak senkron videosu indirilemedi.",
              "The lip-sync video could not be downloaded."
            )
          );
          window.open(cleanUrl, "_blank", "noopener");
        }

        return;
      }

      if (act === "share") {
        event.preventDefault();
        event.stopPropagation();
        if (!videoRaw) return;

        const shareUrl = toMaybeProxyUrl(videoRaw).split("#")[0];

        if (navigator.share) {
          navigator.share({ url: shareUrl }).catch(() => {});
        } else {
          navigator.clipboard?.writeText(shareUrl).catch(() => {});
          showLipsyncPanelToast(
            "success",
            lipsyncPanelText(
              "studio.lipsync.panel.share.copied",
              "Dudak senkron video bağlantısı kopyalandı.",
              "The lip-sync video link was copied."
            )
          );
        }
        return;
      }

      if (act === "delete") {
        event.preventDefault();
        event.stopPropagation();

        hiddenDeletedIds.add(id);
        renderCurrent();

        try {
          const ok = await deleteJob(id);

          if (!ok) {
            hiddenDeletedIds.delete(id);
            try {
              await controller?.hydrate?.(true);
            } catch {}

            showLipsyncPanelToast(
              "error",
              lipsyncPanelText(
                "studio.lipsync.panel.delete.failed",
                "Dudak senkron videosu silinemedi.",
                "The lip-sync video could not be deleted."
              )
            );
            return;
          }

          currentDbItems = currentDbItems.filter((item) => idOf(item) !== id);
          showLipsyncPanelToast(
            "success",
            lipsyncPanelText(
              "studio.lipsync.panel.delete.success",
              "Dudak senkron videosu silindi.",
              "The lip-sync video was deleted."
            )
          );
          renderCurrent();
        } catch (error) {
          hiddenDeletedIds.delete(id);
          try {
            await controller?.hydrate?.(true);
          } catch {}

          showLipsyncPanelToast(
            "error",
            lipsyncPanelText(
              "studio.lipsync.panel.delete.failed",
              "Dudak senkron videosu silinemedi.",
              "The lip-sync video could not be deleted."
            )
          );
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
          .filter((job) => {
            const id = idOf(job);
            return id && !hiddenDeletedIds.has(id);
          });

        renderCurrent();
      },
    });

    const onJobCreated = (event) => {
      const detail = event?.detail || {};
      const jobId = safeStr(detail.job_id);

      if (!jobId || hiddenDeletedIds.has(jobId)) return;

      const app = safeStr(
        detail.app || detail.meta?.app || "lipsync"
      ).toLowerCase();
      if (!isLipsyncApp(app)) return;

      const exists = currentDbItems.some((job) => idOf(job) === jobId);
      if (exists) return;

      const meta = detail.meta || {};
      const createdAt = detail.createdAt || Date.now();

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

      renderCurrent();
    };

    const onJobReady = (event) => {
      const detail = event?.detail || {};
      const jobId = safeStr(detail.job_id);

      if (!jobId || hiddenDeletedIds.has(jobId)) return;

      const videoUrl = safeStr(
        detail?.video?.url ||
        detail?.raw?.video?.url ||
        detail?.raw?.video_url ||
        detail?.videoUrl ||
        detail?.video_url ||
        ""
      );

      const outputs = Array.isArray(detail?.outputs) && detail.outputs.length
        ? detail.outputs
        : videoUrl
          ? [
              {
                type: "video",
                url: videoUrl,
                meta: {
                  app: "lipsync",
                  variant: "provider",
                  is_final: true,
                },
              },
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
          outputs: outputs.length ? outputs : job.outputs || [],
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
              script: safeStr(
                detail?.raw?.prompt || detail?.raw?.meta?.script || ""
              ),
            },
            outputs,
          },
          ...currentDbItems,
        ];
      }

      try {
        controller?.upsert?.(
          currentDbItems.find((item) => idOf(item) === jobId)
        );
      } catch {}

      renderCurrent();
    };

    controller.start();
    window.addEventListener("aivo:lipsync:job_created", onJobCreated);
    window.addEventListener("aivo:lipsync:job_ready", onJobReady);

    return {
      destroy() {
        destroyed = true;

        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = null;
        searchInputEl = null;
        searchRootEl = null;

        try {
          document.removeEventListener("input", onSearchInput, true);
        } catch {}
        try {
          document.removeEventListener("search", onSearchInput, true);
        } catch {}
        try {
          window.removeEventListener("aivo:lipsync:job_created", onJobCreated);
        } catch {}
        try {
          window.removeEventListener("aivo:lipsync:job_ready", onJobReady);
        } catch {}
        try {
          controller?.destroy?.();
        } catch {}

        if (refreshMountedLipsyncPanel === renderCurrent) {
          refreshMountedLipsyncPanel = null;
        }

        try {
          host.innerHTML = "";
        } catch {}
      },
    };
  }

  function refreshLipsyncPanelLanguage() {
    try {
      if (window.RightPanel?.getCurrentKey?.() === "lipsync") {
        window.RightPanel.setHeader?.(getLipsyncPanelHeader());
      }

      refreshMountedLipsyncPanel?.();
    } catch {}
  }

  try {
    console.log("[PANEL.LIPSYNC] register run");

    if (typeof window.RightPanel.register === "function") {
      window.RightPanel.register("lipsync", {
        getHeader: getLipsyncPanelHeader,

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
  } catch (error) {
    console.warn("[LIPSYNC PANEL] register failed", error);
  }

  document.addEventListener(
    "aivo:language-change",
    refreshLipsyncPanelLanguage
  );
  document.addEventListener(
    "aivo:studio:i18n-applied",
    refreshLipsyncPanelLanguage
  );
})();
