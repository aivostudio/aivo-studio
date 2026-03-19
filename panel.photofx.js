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
    const u = String(url || "").trim();
    if (!u) return "";
    if (
      u.startsWith("/api/media/proxy?url=") ||
      u.includes("/api/media/proxy?url=")
    ) {
      return u;
    }
    if (u.startsWith("http://")) {
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

  const pickBestVideoOutput = (job) => {
    const outs = Array.isArray(job?.outputs) ? job.outputs : [];
    if (!outs.length) return null;

    const outsFiltered = outs.filter((o) => {
      const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind);
      if (t && t !== "video") return false;

      const oa = getOutApp(o);
      if (oa && !isPhotoFxApp(oa)) return false;

      return true;
    });

    const pool = outsFiltered.length ? outsFiltered : outs;
    const videos = pool.filter(
      (o) =>
        norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind) === "video"
    );
    const best = videos[0] || pool[0] || null;
    if (!best) return null;

    const raw =
      best.archive_url ||
      best.archiveUrl ||
      best.url ||
      best.video_url ||
      best.videoUrl ||
      best.raw_url ||
      best.rawUrl ||
      best.meta?.archive_url ||
      best.meta?.archiveUrl ||
      best.meta?.url ||
      best.meta?.video_url ||
      best.meta?.videoUrl ||
      "";

    const url = toMaybeProxyUrl(raw);
    if (!url) return null;

    return { ...best, url };
  };

  function ensureStyles() {
    if (document.getElementById("photofxPanelStyles")) return;

    const css = `
      .photofxPanelWrap{display:flex;flex-direction:column;gap:12px;}
      .photofxPanelGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
      .photofxPanelCard{position:relative;border-radius:18px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);overflow:hidden;}
      .photofxPanelThumb{position:relative;border-radius:16px;overflow:hidden;margin:10px;background:#000;border:1px solid rgba(255,255,255,0.08);}
      .photofxPanelThumb:before{content:"";display:block;padding-top:56.25%;}
      .photofxPanelThumb.isPortrait:before{padding-top:140%;}
      .photofxPanelVideo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;}
      .photofxPanelPill{position:absolute;left:14px;top:14px;z-index:3;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,0.10);backdrop-filter:blur(10px);}
      .photofxPanelPill.ok{border-color:rgba(120,255,190,.22);}
      .photofxPanelPill.mid{border-color:rgba(255,255,255,.10);}
      .photofxPanelPill.bad{border-color:rgba(255,120,120,.25);}
      .photofxPanelSkel{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(80% 80% at 50% 40%, rgba(175,120,255,.18), rgba(0,0,0,.70));overflow:hidden;}
      .photofxPanelSkel:before{content:"";position:absolute;inset:-40%;background:linear-gradient(90deg,rgba(255,255,255,0.00),rgba(220,170,255,0.14),rgba(255,255,255,0.00));transform:rotate(18deg);animation:photofxPanelShimmer 1.4s linear infinite;}
      @keyframes photofxPanelShimmer{0%{transform:translateX(-30%) rotate(18deg);}100%{transform:translateX(30%) rotate(18deg);}}
      .photofxPanelSkelLabel{position:relative;z-index:2;font-size:12px;font-weight:800;padding:8px 12px;border-radius:999px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.10);}
      .photofxPanelFooter{padding:10px 12px 12px 12px;display:flex;flex-direction:column;gap:8px;}
      .photofxPanelMetaLine{font-size:12px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .photofxPanelActions{display:flex;gap:8px;padding:10px;border-radius:14px;background:rgba(0,0,0,.20);border:1px solid rgba(255,255,255,0.06);}
      .photofxPanelBtn{flex:1;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.04);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;}
      .photofxPanelBtn[disabled]{opacity:.45;cursor:not-allowed;}
      .photofxPanelBtn.danger{border-color:rgba(255,120,120,0.20);background:rgba(255,120,120,0.08);}
      @media (max-width: 980px){.photofxPanelGrid{grid-template-columns:1fr;}}
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

    function ensureCardEl(job) {
      const id = idOf(job);
      if (!id) return null;

      let el = cardCache.get(id);
      if (el && el.isConnected) return el;

      el = document.createElement("div");
      el.className = "photofxPanelCard";
      el.setAttribute("data-job", id);

      el.innerHTML = `
        <div class="photofxPanelThumb">
          <div class="photofxPanelPill mid">İşleniyor</div>
          <div class="photofxPanelSkel"><div class="photofxPanelSkelLabel">Hazırlanıyor…</div></div>
        </div>
        <div class="photofxPanelFooter">
          <div class="photofxPanelMetaLine"></div>
          <div class="photofxPanelActions">
            <button class="photofxPanelBtn" type="button" data-act="download" data-job="${esc(id)}" disabled>İndir</button>
            <button class="photofxPanelBtn" type="button" data-act="share" data-job="${esc(id)}" disabled>Paylaş</button>
            <button class="photofxPanelBtn danger" type="button" data-act="delete" data-job="${esc(id)}">Sil</button>
          </div>
        </div>
      `;

      cardCache.set(id, el);
      return el;
    }

    function patchCard(el, job) {
      if (!el || !job) return;

      const badge = mapBadge(job);
      const out = pickBestVideoOutput(job);
      const rawVideoUrl = String(out?.url || "").trim();

      const ready = badge.kind === "ok" && !!rawVideoUrl;
      const ratio = String(
        job?.meta?.aspect_ratio ||
        job?.meta?.ratio ||
        out?.meta?.aspect_ratio ||
        out?.meta?.ratio ||
        "9:16"
      ).trim();

      const isPortrait =
        ratio.includes("9:16") || ratio.includes("4:5") || ratio.includes("2:3");

      const title = String(
        job?.meta?.prompt ||
        job?.prompt ||
        "PhotoFX Klip"
      ).trim();

      const thumb = el.querySelector(".photofxPanelThumb");
      const pill = el.querySelector(".photofxPanelPill");
      const skel = el.querySelector(".photofxPanelSkel");
      const metaEl = el.querySelector(".photofxPanelMetaLine");
      const dl = el.querySelector('[data-act="download"]');
      const sh = el.querySelector('[data-act="share"]');

      if (thumb) thumb.classList.toggle("isPortrait", !!isPortrait);

      if (pill) {
        pill.textContent = badge.text;
        pill.classList.remove("ok", "mid", "bad");
        pill.classList.add(badge.kind);
      }

      if (metaEl) metaEl.textContent = title;

      if (dl) ready ? dl.removeAttribute("disabled") : dl.setAttribute("disabled", "");
      if (sh) ready ? sh.removeAttribute("disabled") : sh.setAttribute("disabled", "");

      let vid = el.querySelector("video.photofxPanelVideo");

      if (ready) {
        if (skel) skel.style.display = "none";

        if (!vid) {
          vid = document.createElement("video");
          vid.className = "photofxPanelVideo";
          vid.setAttribute("playsinline", "");
          vid.setAttribute("webkit-playsinline", "");
          vid.setAttribute("preload", "metadata");
          vid.setAttribute("controls", "");
          vid.muted = true;
          thumb?.appendChild(vid);
        }

        if (vid.getAttribute("data-src") !== rawVideoUrl) {
          vid.setAttribute("data-src", rawVideoUrl);
          vid.src = rawVideoUrl;
        }

        vid.style.display = "";
      } else {
        if (skel) skel.style.display = "";
        if (vid) {
          vid.pause?.();
          vid.style.display = "none";
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

      return Array.from(byId.values()).sort((a, b) => {
        const ta =
          toMs(a?.updated_at) || toMs(a?.created_at) || toMs(a?.createdAt) || 0;
        const tb =
          toMs(b?.updated_at) || toMs(b?.created_at) || toMs(b?.createdAt) || 0;

        if (tb !== ta) return tb - ta;

        const ia = idOf(a);
        const ib = idOf(b);
        return ib.localeCompare(ia);
      });
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
          emptyEl.textContent = "Henüz PhotoFX üretim yok.";
          elGrid.appendChild(emptyEl);
        }
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

    function download(url) {
      const cleanUrl = String(url || "").trim();
      if (!cleanUrl) return;

      const directUrl = cleanUrl.includes("#")
        ? cleanUrl.split("#")[0]
        : cleanUrl;

      const proxied = directUrl.startsWith("/api/media/proxy?url=")
        ? directUrl
        : `/api/media/proxy?url=${encodeURIComponent(directUrl)}&filename=photofx.mp4`;

      const a = document.createElement("a");
      a.href = proxied;
      a.download = "photofx.mp4";
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
      const btn = e.target.closest("[data-act]");
      if (!btn) return;

      const act = btn.dataset.act;
      const card = btn.closest(".photofxPanelCard");
      const id = String(btn.dataset.job || card?.dataset?.job || "").trim();

      if (!act || !id) return;

      const allItems = [...currentDbItems, ...Array.from(optimistic.values())];
      const job = allItems.find((x) => idOf(x) === id);
      if (!job) return;

      const out = pickBestVideoOutput(job);
      const url = String(out?.url || "").trim();
      const directUrl = url.includes("#") ? url.split("#")[0] : url;

      if (act === "download") {
        e.preventDefault();
        e.stopPropagation();
        if (!directUrl) return;
        download(directUrl);
        return;
      }

      if (act === "share") {
        e.preventDefault();
        e.stopPropagation();
        if (!directUrl) return;
        share(directUrl);
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
        const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind);
        if (t && t !== "video") return false;
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
          });

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
      if (optimistic.has(job_id)) return;

      const meta = d.meta || {};
      const createdAt = d.createdAt || Date.now();

      optimistic.set(job_id, {
        job_id,
        app: "photofx",
        provider: meta.provider || "PhotoFX",
        createdAt,
        created_at: createdAt,
        db_status: "processing",
        status: "processing",
        state: "PROCESSING",
        meta: {
          ...(meta || {}),
          app: "photofx",
          prompt: meta.prompt || "",
          duration: meta.duration || "",
          ratio: meta.ratio || "9:16",
        },
        outputs: [],
      });

      renderCurrent();
    };

    const onJobReady = (e) => {
      const d = e?.detail || {};
      const job_id = String(d?.job_id || "").trim();
      if (!job_id) return;
      if (hiddenDeletedIds.has(job_id)) return;

      const videoUrl = String(
        d?.video?.url || d?.raw?.video?.url || d?.raw?.video_url || d?.videoUrl || d?.video_url || ""
      ).trim();

      const outputs = Array.isArray(d?.outputs) ? d.outputs : [];
      const existingDb = currentDbItems.find((j) => idOf(j) === job_id);

      if (existingDb) {
        existingDb.db_status = "ready";
        existingDb.status = "ready";
        existingDb.state = "COMPLETED";

        if (outputs.length) {
          existingDb.outputs = outputs;
        } else if (videoUrl) {
          existingDb.outputs = [
            {
              type: "video",
              url: videoUrl,
              meta: { app: "photofx", is_final: true },
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
                  meta: { app: "photofx", is_final: true },
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
