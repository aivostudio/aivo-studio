(function () {
  if (!window.RightPanel) return;
  if (!window.DBJobs) {
    console.warn("[PHOTOFX PANEL] DBJobs yok. panel.dbjobs.js yüklenmeli.");
    return;
  }

  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");

  const safeStr = (v) => String(v == null ? "" : v).trim();

  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const isPhotoFxApp = (x) => {
    const a = norm(x);
    return a === "photofx" || a.includes("photofx");
  };

  const getJobApp = (job) =>
    String(
      job?.app ||
      job?.meta?.app ||
      job?.meta?.module ||
      job?.meta?.routeKey ||
      ""
    ).trim();

  const getOutApp = (o) =>
    String(
      o?.meta?.app ||
      o?.meta?.module ||
      o?.meta?.routeKey ||
      ""
    ).trim();

  const isJobPhotoFx = (job) => isPhotoFxApp(getJobApp(job));
  const idOf = (it) => String(it?.job_id || it?.id || "").trim();

  const toMaybeProxyUrl = (url) => {
    const u = safeStr(url);
    if (!u) return "";
    if (
      u.startsWith("/api/media/proxy?url=") ||
      u.includes("/api/media/proxy?url=")
    ) {
      return u;
    }
    if (u.startsWith("http://") || u.startsWith("https://")) {
      return "/api/media/proxy?url=" + encodeURIComponent(u);
    }
    return u;
  };

  const mapBadge = (job) => {
    const a = norm(job?.db_status);
    const b = norm(job?.status);
    const c = norm(job?.state);
    const st = (a || b || c || "").toUpperCase();

    if (st.includes("FAIL") || st.includes("ERROR")) {
      return { text: "Hata", kind: "bad" };
    }
    if (
      st.includes("READY") ||
      st.includes("DONE") ||
      st.includes("COMPLET") ||
      st.includes("SUCC")
    ) {
      return { text: "Hazır", kind: "ok" };
    }
    if (
      st.includes("RUN") ||
      st.includes("PROC") ||
      st.includes("PEND") ||
      st.includes("QUEUE")
    ) {
      return { text: "İşleniyor", kind: "mid" };
    }
    return { text: st ? st.slice(0, 18) : "İşleniyor", kind: "mid" };
  };

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

  function outputVariant(o) {
    return safeStr(o?.meta?.variant).toLowerCase();
  }

  function isVideoOutput(o) {
    const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind);
    return !t || t === "video";
  }

  function filterPhotoFxOutputs(job) {
    const outs = Array.isArray(job?.outputs) ? job.outputs : [];
    return outs.filter((o) => {
      if (!isVideoOutput(o)) return false;
      const oa = getOutApp(o);
      if (oa && !isPhotoFxApp(oa)) return false;
      return true;
    });
  }

  function pickFinalVideoFromJob(job) {
    const meta = job?.meta || {};
    const outs = filterPhotoFxOutputs(job);

    const directFinal =
      safeStr(job?.final) ||
      safeStr(job?.final_url) ||
      safeStr(job?.final_video_url) ||
      safeStr(meta?.final) ||
      safeStr(meta?.final_url) ||
      safeStr(meta?.final_video_url);

    if (directFinal) return directFinal;

    const finalized = outs.find(
      (o) => outputVariant(o) === "finalized" || o?.meta?.is_final === true
    );
    if (finalized) {
      const u = pickOutputUrl(finalized);
      if (u) return u;
    }

    const provider = outs.find(
      (o) => outputVariant(o) === "provider" || outputVariant(o) === "final"
    );
    if (provider) {
      const u = pickOutputUrl(provider);
      if (u) return u;
    }

    const first = outs.find((o) => isVideoOutput(o)) || outs[0];
    return pickOutputUrl(first);
  }

  function pickPreviewVideoFromJob(job) {
    const meta = job?.meta || {};
    const outs = filterPhotoFxOutputs(job);

    const directPreview =
      safeStr(job?.preview) ||
      safeStr(job?.preview_url) ||
      safeStr(job?.preview_video_url) ||
      safeStr(meta?.preview) ||
      safeStr(meta?.preview_url) ||
      safeStr(meta?.preview_video_url);

    if (directPreview) return directPreview;

    const preview = outs.find((o) => outputVariant(o) === "preview");
    if (preview) {
      const u = pickOutputUrl(preview);
      if (u) return u;
    }

    return "";
  }

  function ensureStyles() {
    if (document.getElementById("photofxPanelStyles")) return;

    const css = `
      .photofxPanelWrap{display:flex;flex-direction:column;gap:12px;}
      .photofxPanelGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
      .photofxPanelCard{position:relative;}
      @media (max-width:980px){.photofxPanelGrid{grid-template-columns:1fr;}}
    `;

    const style = document.createElement("style");
    style.id = "photofxPanelStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createPhotoFxPanel(host) {
    ensureStyles();

    let destroyed = false;
    let currentDbItems = [];
    let searchTimer = null;
    let searchInputEl = null;
    let searchRootEl = null;

    const state = {
      query: "",
    };

    const optimistic = new Map();
    const hiddenDeletedIds = new Set();
    const cardCache =
      window.__PHOTOFX_CARD_CACHE__ ||
      (window.__PHOTOFX_CARD_CACHE__ = new Map());

    host.innerHTML = `
      <div class="photofxPanelWrap">
        <div class="photofxPanelGrid" data-grid></div>
      </div>
    `;

    const elGrid = host.querySelector("[data-grid]");
    const elStatus = null;

    const setStatus = (t) => {
      if (elStatus) elStatus.textContent = t;
    };

    const resolvePanelSearchInput = () => {
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
          ) ||
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
    };

    const ensureSearchBinding = () => {
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
    };

    const syncSearchFromInput = () => {
      const input = ensureSearchBinding();
      const nextQuery = safeStr(input?.value || "");
      if (state.query === nextQuery) return;

      if (searchTimer) clearTimeout(searchTimer);

      searchTimer = setTimeout(() => {
        state.query = nextQuery;
        renderCurrent();
      }, 120);
    };

    const onSearchInput = (e) => {
      const input = ensureSearchBinding();
      if (!input) return;

      if (e.target === input) {
        syncSearchFromInput();
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
        syncSearchFromInput();
      }
    };

    document.addEventListener("input", onSearchInput, true);
    document.addEventListener("search", onSearchInput, true);

    setTimeout(() => {
      ensureSearchBinding();
      syncSearchFromInput();
    }, 0);

    const toMs = (v) => {
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
    };

    const getCardTitle = (job) =>
      safeStr(
        job?.meta?.scene_title ||
        job?.meta?.title ||
        job?.title ||
        job?.meta?.prompt ||
        job?.prompt ||
        "PhotoFX Klip"
      );

    const buildSearchHaystack = (job) => {
      return safeStr(
        [
          getCardTitle(job),
          job?.meta?.prompt,
          job?.prompt,
          job?.db_status,
          job?.status,
          job?.state,
        ].join(" ")
      ).toLowerCase();
    };

    const isTerminalState = (job) => {
      const st = norm(job?.db_status || job?.status || job?.state);
      return (
        st.includes("ready") ||
        st.includes("done") ||
        st.includes("complet") ||
        st.includes("succ") ||
        st.includes("error") ||
        st.includes("fail")
      );
    };

    function hasProcessing(items) {
      return (items || []).some((j) => {
        const st = norm(j?.db_status || j?.status || j?.state).toUpperCase();
        return (
          st.includes("PROCESS") ||
          st.includes("RUN") ||
          st.includes("PEND") ||
          st.includes("QUEUE")
        );
      });
    }

    function renderCard(job) {
      const jid = idOf(job);
      const badge = mapBadge(job);
      const isFreshCard = job?._fresh === true;

      const finalUrl = pickFinalVideoFromJob(job);
      const previewUrl = pickPreviewVideoFromJob(job);
      if (!finalUrl && !previewUrl) return "";

      const selectedPlaybackRawUrl = isFreshCard
        ? finalUrl || previewUrl
        : previewUrl || finalUrl;

      const playbackUrl = toMaybeProxyUrl(selectedPlaybackRawUrl);
      const ready = badge.kind === "ok" && !!playbackUrl;

      const previewVideoUrl = ready
        ? playbackUrl.includes("#")
          ? playbackUrl
          : playbackUrl + "#t=0.001"
        : "";

      const ratio = String(
        job?.meta?.ui_state?.aspect_ratio ||
          job?.meta?.aspect_ratio ||
          job?.meta?.ratio ||
          "9:16"
      ).trim();

      const title = getCardTitle(job);
      const sub = "";
      const badgeText = badge.text;
      const badgeKind =
        badge.kind === "ok"
          ? "ready"
          : badge.kind === "bad"
            ? "error"
            : "loading";

      if (window.AIVO_SHARED_VIDEO_CARD?.createCardHtml) {
        return (
          '<div class="photofxPanelCardInner"' +
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

      return "";
    }

    function ensureCardEl(job) {
      const id = idOf(job);
      if (!id) return null;

      let el = cardCache.get(id);
      if (el && el.isConnected) return el;

      el = document.createElement("div");
      el.className = "photofxPanelCard";
      el.setAttribute("data-job", id);

      el.innerHTML = `
        <div style="border-radius:18px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);overflow:hidden;">
          <div style="position:relative;background:#000;">
            <div style="padding-top:140%;"></div>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(80% 80% at 50% 40%, rgba(175,120,255,.18), rgba(0,0,0,.70));">
              <div style="font-size:12px;font-weight:800;padding:8px 12px;border-radius:999px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.10);">Hazırlanıyor…</div>
            </div>
          </div>
        </div>
      `;

      cardCache.set(id, el);
      return el;
    }

    function patchCard(el, job) {
      if (!el || !job) return;

      const html = renderCard(job);
      if (!html) return;

      if (el.__renderedHtml !== html) {
        el.innerHTML = html;
        el.__renderedHtml = html;
      }

      el.setAttribute("data-job", idOf(job));
    }

    function buildMergedItems() {
      const byId = new Map();

      for (const j of currentDbItems) {
        const id = idOf(j);
        if (!id) continue;
        if (hiddenDeletedIds.has(id)) continue;

        byId.set(id, j);

        if (optimistic.has(id) && isTerminalState(j)) {
          optimistic.delete(id);
        }
      }

      for (const [id, j] of optimistic.entries()) {
        if (!id) continue;
        if (hiddenDeletedIds.has(id)) continue;
        if (!byId.has(id)) {
          byId.set(id, j);
        }
      }

      const merged = Array.from(byId.values()).sort((a, b) => {
        const ta =
          toMs(a?.updated_at) || toMs(a?.created_at) || toMs(a?.createdAt) || 0;
        const tb =
          toMs(b?.updated_at) || toMs(b?.created_at) || toMs(b?.createdAt) || 0;

        if (tb !== ta) return tb - ta;

        const ia = idOf(a);
        const ib = idOf(b);
        return ib.localeCompare(ia);
      });

      const q = safeStr(state.query).toLowerCase();
      if (!q) return merged;

      return merged.filter((job) => buildSearchHaystack(job).includes(q));
    }

    function render(items) {
      if (!elGrid) return;

      setStatus(hasProcessing(items) ? "İşleniyor…" : "Hazır");

      const list = Array.isArray(items) ? items : [];
      const EMPTY_ID = "photofxEmptyState";
      let emptyEl = elGrid.querySelector(`#${EMPTY_ID}`);

      if (!list.length) {
        for (const ch of Array.from(elGrid.children)) {
          if (ch.id !== EMPTY_ID) elGrid.removeChild(ch);
        }

        if (!emptyEl) {
          emptyEl = document.createElement("div");
          emptyEl.id = EMPTY_ID;
          emptyEl.style.opacity = ".7";
          emptyEl.style.fontSize = "12px";
          emptyEl.style.padding = "4px 2px";
          elGrid.appendChild(emptyEl);
        }

        emptyEl.textContent = state.query
          ? "Aramana uygun PhotoFX klip bulunamadı."
          : "Henüz PhotoFX üretim yok.";

        return;
      } else if (emptyEl) {
        emptyEl.remove();
      }

      const wanted = new Set();
      let anchor = elGrid.firstChild;

      for (const job of list) {
        const id = idOf(job);
        if (!id) continue;

        wanted.add(id);

        const card = ensureCardEl(job);
        patchCard(card, job);

        if (!card.isConnected) {
          elGrid.insertBefore(card, anchor);
          continue;
        }

        if (card !== anchor) {
          elGrid.insertBefore(card, anchor);
        } else {
          anchor = anchor?.nextSibling || null;
        }
      }

      for (const ch of Array.from(elGrid.children)) {
        if (ch.id === EMPTY_ID) continue;
        const jid = String(ch.getAttribute?.("data-job") || "").trim();
        if (jid && !wanted.has(jid)) {
          elGrid.removeChild(ch);
        }
      }
    }

    function renderCurrent() {
      render(buildMergedItems());
    }

    function download(url, filename = "photofx.mp4") {
      const cleanUrl = String(url || "").trim();
      if (!cleanUrl) return;

      const directUrl = cleanUrl.includes("#")
        ? cleanUrl.split("#")[0]
        : cleanUrl;

      const proxied = directUrl.startsWith("/api/media/proxy?url=")
        ? directUrl
        : `/api/media/proxy?url=${encodeURIComponent(directUrl)}&filename=${encodeURIComponent(filename)}`;

      const a = document.createElement("a");
      a.href = proxied;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }

    function share(url) {
      const cleanUrl = String(url || "").trim();
      if (!cleanUrl) return;

      const directUrl = cleanUrl.includes("#")
        ? cleanUrl.split("#")[0]
        : cleanUrl;

      if (navigator.share) {
        navigator.share({ url: directUrl }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(directUrl).catch(() => {});
      }
    }

    host.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-svc-act], [data-act]");
      if (!btn) return;

      const act = btn.dataset.svcAct || btn.dataset.act;
      const card = btn.closest(".svcCard, .photofxPanelCard");
      const id = String(
        btn.dataset.id ||
          btn.dataset.job ||
          card?.dataset?.svcId ||
          card?.dataset?.job ||
          ""
      ).trim();

      if (!act || !id) return;

      const allItems = [...currentDbItems, ...Array.from(optimistic.values())];
      const job = allItems.find((x) => idOf(x) === id);
      if (!job) return;

      if (act === "play") {
        e.preventDefault();
        e.stopPropagation();

        const video = card?.querySelector("video.svcVideo");
        if (!video) return;

        if (video.paused) video.play().catch(() => {});
        else video.pause();

        return;
      }

      const finalUrl = pickFinalVideoFromJob(job);
      const previewUrl = pickPreviewVideoFromJob(job);
      const sharePlaybackUrl = safeStr(
        job?._fresh === true ? finalUrl || previewUrl : previewUrl || finalUrl
      );

      if (act === "open") {
        e.preventDefault();
        e.stopPropagation();
        if (!sharePlaybackUrl) return;
        window.open(sharePlaybackUrl, "_blank", "noopener");
        return;
      }

      if (act === "download") {
        e.preventDefault();
        e.stopPropagation();
        if (!finalUrl) return;
        download(finalUrl, `photofx-${id}.mp4`);
        return;
      }

      if (act === "share") {
        e.preventDefault();
        e.stopPropagation();
        if (!sharePlaybackUrl) return;
        share(sharePlaybackUrl);
        return;
      }

      if (act === "delete") {
        e.preventDefault();
        e.stopPropagation();

        try {
          hiddenDeletedIds.add(id);
          optimistic.delete(id);
          currentDbItems = currentDbItems.filter((x) => idOf(x) !== id);

          renderCurrent();

          const ok = await controller.deleteJob(id);
          if (!ok) {
            hiddenDeletedIds.delete(id);
            try {
              await controller?.hydrate?.(true);
            } catch {}
            console.error("[PHOTOFX PANEL] delete failed");
            return;
          }

          try {
            await controller?.hydrate?.(true);
          } catch {}
        } catch (err) {
          hiddenDeletedIds.delete(id);
          try {
            await controller?.hydrate?.(true);
          } catch {}
          console.error("[PHOTOFX PANEL] delete failed", err);
        }

        return;
      }
    });

    const controller = window.DBJobs.create({
      app: "photofx",
      debug: false,
      pollIntervalMs: 4000,
      hydrateEveryMs: 15000,

      acceptJob: (job) => {
        if (!job) return false;
        const ja = getJobApp(job);
        if (ja && !isPhotoFxApp(ja)) return false;
        return true;
      },

      acceptOutput: (o) => {
        if (!o) return false;
        if (!isVideoOutput(o)) return false;
        const oa = getOutApp(o);
        if (oa && !isPhotoFxApp(oa)) return false;
        return true;
      },

      onChange: async (items) => {
        if (destroyed) return;

        currentDbItems = (items || [])
          .filter(isJobPhotoFx)
          .filter((j) => {
            const id = idOf(j);
            return id && !hiddenDeletedIds.has(id);
          })
          .map((j) => ({
            ...j,
            _fresh: false,
          }));

        renderCurrent();
      },
    });

const onJobCreated = (e) => {
  const d = e?.detail || {};
  if (!d.job_id) return;
  if (!isPhotoFxApp(d.app || d.meta?.app || "photofx")) return;

  const job_id = String(d.job_id || "").trim();
  if (!job_id) return;
  if (hiddenDeletedIds.has(job_id)) return;

  const existsDb = currentDbItems.some((j) => idOf(j) === job_id);
  if (existsDb) return;

  const meta = d.meta || {};
  const createdAt = d.createdAt || Date.now();

  const optimisticJob = {
    job_id,
    app: "photofx",
    provider: meta.provider || "PhotoFX",
    createdAt,
    created_at: createdAt,
    updated_at: createdAt,
    db_status: "processing",
    status: "PROCESSING",
    state: "PROCESSING",
    _fresh: false,
    meta: {
      ...(meta || {}),
      app: "photofx",
      prompt: meta.prompt || "",
      duration: meta.duration || "",
      ratio: meta.ratio || meta.aspect_ratio || "9:16",
      request_id: meta.request_id || "",
      status_url: meta.status_url || "",
    },
    outputs: [],
  };

  optimistic.set(job_id, optimisticJob);

  try {
    controller.upsert(optimisticJob);
  } catch (err) {
    console.warn("[PHOTOFX PANEL] controller.upsert failed", err);
  }

  renderCurrent();
};

    const onJobReady = (e) => {
      const d = e?.detail || {};
      const job_id = String(d?.job_id || "").trim();
      if (!job_id) return;
      if (hiddenDeletedIds.has(job_id)) return;

      const videoUrl = safeStr(
        d?.video?.url ||
        d?.raw?.video?.url ||
        d?.raw?.video_url ||
        d?.videoUrl ||
        d?.video_url ||
        ""
      );

      const outputs = Array.isArray(d?.outputs) ? d.outputs : [];
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
              meta: { app: "photofx", variant: "provider", is_final: true },
            },
          ];
        }

        if (optimistic.has(job_id)) {
          optimistic.delete(job_id);
        }

        renderCurrent();
        return;
      }

      const optimisticJob = optimistic.get(job_id);
      if (!optimisticJob) return;

      optimistic.set(job_id, {
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
                  meta: { app: "photofx", variant: "provider", is_final: true },
                },
              ]
            : optimisticJob.outputs || [],
      });

      renderCurrent();
    };

    controller.start();
    window.addEventListener("aivo:photofx:job_created", onJobCreated);
    window.addEventListener("aivo:photofx:job_ready", onJobReady);

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
          window.removeEventListener("aivo:photofx:job_created", onJobCreated);
        } catch {}
        try {
          window.removeEventListener("aivo:photofx:job_ready", onJobReady);
        } catch {}
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
    console.log("[PANEL.PHOTOFX] register run");

    if (typeof window.RightPanel.register === "function") {
      window.RightPanel.register("photofx", {
        header: {
          title: "PhotoFX",
          meta: "Hazır",
          searchEnabled: true,
          searchPlaceholder: "PhotoFX kliplerinde ara...",
          resetSearch: true,
        },

        mount(host) {
          const api = createPhotoFxPanel(host);
          return () => {
            try {
              api?.destroy?.();
            } catch {}
          };
        },
      });
    } else {
      console.warn("[PHOTOFX PANEL] RightPanel.register yok.");
    }
  } catch (e) {
    console.warn("[PHOTOFX PANEL] register failed", e);
  }
})();
