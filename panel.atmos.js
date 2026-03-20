// atmosphere.panel.js (DB source-of-truth + cover-style cards + optimistic “video hissi”)
// - Kart anında gelir (aivo:atmo:job_created)
// - Mor shimmer “hazırlanıyor”
// - Ready olunca shimmer gider, video görünür
// - Dedupe: job_id tek kart (2 video sorunu biter)

(function () {
  if (!window.RightPanel) return;
  if (!window.DBJobs) {
    console.warn("[ATMO PANEL] DBJobs yok. panel.dbjobs.js yüklenmeli.");
    return;
  }

  /* =======================
     Utils
     ======================= */

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

  const isAtmoApp = (x) => {
    const a = norm(x);
    return a === "atmo" || a.includes("atmo");
  };

  const toMaybeProxyUrl = (url) => {
    const u = String(url || "").trim();
    if (!u) return "";
    if (u.startsWith("/api/media/proxy?url=") || u.includes("/api/media/proxy?url=")) return u;
    if (u.startsWith("http://")) return "/api/media/proxy?url=" + encodeURIComponent(u);
    return u;
  };

  const fmtDT = (d) => {
    try {
      const dt = new Date(d || Date.now());
      const dd = String(dt.getDate()).padStart(2, "0");
      const mm = String(dt.getMonth() + 1).padStart(2, "0");
      const yy = dt.getFullYear();
      const hh = String(dt.getHours()).padStart(2, "0");
      const mi = String(dt.getMinutes()).padStart(2, "0");
      return `${dd}.${mm}.${yy} ${hh}:${mi}`;
    } catch {
      return "";
    }
  };

  const getJobApp = (job) =>
    String(job?.app || job?.meta?.app || job?.meta?.module || job?.meta?.routeKey || "").trim();

  const getOutApp = (o) =>
    String(o?.meta?.app || o?.meta?.module || o?.meta?.routeKey || "").trim();

  const isJobAtmo = (job) => isAtmoApp(getJobApp(job));

  const mapBadge = (job) => {
    const a = norm(job?.db_status);
    const b = norm(job?.status);
    const c = norm(job?.state);
    const st = (a || b || c || "").toUpperCase();

    if (st.includes("FAIL") || st.includes("ERROR")) return { text: "Hata", kind: "bad" };
    if (st.includes("READY") || st.includes("DONE") || st.includes("COMPLET") || st.includes("SUCC")) return { text: "Hazır", kind: "ok" };
    if (st.includes("RUN") || st.includes("PROC") || st.includes("PEND") || st.includes("QUEUE")) return { text: "İşleniyor", kind: "mid" };
    return { text: st ? st.slice(0, 18) : "İşleniyor", kind: "mid" };
  };

  const pickBestVideoOutput = (job) => {
    const outs = (job && job.outputs) || [];
    if (!Array.isArray(outs) || !outs.length) return null;

    const outsFiltered = outs.filter((o) => {
      const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind);
      if (t && t !== "video") return false;

      const oa = getOutApp(o);
      if (oa && !isAtmoApp(oa)) return false;

      return true;
    });

    const pool = outsFiltered.length ? outsFiltered : outs;
    const videos = pool.filter((o) => norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind) === "video");
    const best = (videos[0] || pool[0]) || null;
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
    if (document.getElementById("atmoPanelStyles")) return;
    const css = `
      .atmoWrap{display:flex;flex-direction:column;gap:12px;}
      .atmoHdr{display:flex;align-items:center;justify-content:space-between;}
      .atmoTitle{font-weight:900;font-size:14px;}
      .atmoStatus{font-size:12px;opacity:.7;}

      .atmoGrid{
        display:grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap:12px;
      }

      .atmoCard{
        position:relative;
        border-radius:18px;
        background:rgba(255,255,255,0.035);
        border:1px solid rgba(255,255,255,0.07);
        overflow:hidden;
      }

      .atmoThumb{
        position:relative;
        border-radius:16px;
        overflow:hidden;
        margin:10px;
        background:#000;
        border:1px solid rgba(255,255,255,0.08);
      }

      /* clamp: kart içi video asla paneli büyütmez */
      .atmoThumb:before{content:"";display:block;padding-top:56.25%;} /* 16:9 box */
      .atmoThumb.isPortrait:before{padding-top:140%;} /* 9:16 clamp */

      .atmoThumbVideo{
        position:absolute;inset:0;width:100%;height:100%;
        object-fit:cover;background:#000;
      }

      .atmoPill{
        position:absolute;left:14px;top:14px;z-index:3;
        padding:6px 10px;border-radius:999px;
        font-size:12px;font-weight:800;
        background:rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,0.10);
        backdrop-filter: blur(10px);
      }
      .atmoPill.ok{border-color:rgba(120,255,190,.22);}
      .atmoPill.mid{border-color:rgba(255,255,255,.10);}
      .atmoPill.bad{border-color:rgba(255,120,120,.25);}

      /* 🔥 Mor shimmer skeleton */
      .atmoSkel{
        position:absolute;inset:0;
        display:flex;align-items:center;justify-content:center;
        background:radial-gradient(80% 80% at 50% 40%, rgba(175,120,255,.18), rgba(0,0,0,.70));
        overflow:hidden;
      }
      .atmoSkel:before{
        content:"";
        position:absolute;inset:-40%;
        background:linear-gradient(90deg,
          rgba(255,255,255,0.00),
          rgba(220,170,255,0.14),
          rgba(255,255,255,0.00)
        );
        transform:rotate(18deg);
        animation: atmoShimmer 1.4s linear infinite;
      }
      @keyframes atmoShimmer{
        0%{transform:translateX(-30%) rotate(18deg);}
        100%{transform:translateX(30%) rotate(18deg);}
      }
      .atmoSkelLabel{
        position:relative;z-index:2;
        font-size:12px;font-weight:800;
        padding:8px 12px;border-radius:999px;
        background:rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,.10);
      }

      .atmoFooter{
        padding:10px 12px 12px 12px;
        display:flex;flex-direction:column;gap:8px;
      }

      .atmoMetaLine{
        font-size:12px;opacity:.8;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }

      .atmoActions{
        display:flex;gap:8px;
        padding:10px;border-radius:14px;
        background:rgba(0,0,0,.20);
        border:1px solid rgba(255,255,255,0.06);
      }

      .atmoIconBtn{
        flex:1;height:38px;border-radius:12px;
        border:1px solid rgba(255,255,255,0.10);
        background:rgba(255,255,255,0.04);
        color:#fff;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        font-weight:800;font-size:12px;
      }
      .atmoIconBtn[disabled]{opacity:.45;cursor:not-allowed;}
      .atmoIconBtn.danger{
        border-color:rgba(255,120,120,0.20);
        background:rgba(255,120,120,0.08);
      }

      @media (max-width: 980px){
        .atmoGrid{grid-template-columns:1fr;}
      }
    `;
    const style = document.createElement("style");
    style.id = "atmoPanelStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createAtmosPanel(host) {
    ensureStyles();

    let destroyed = false;

    // Optimistic overlay store (job_id -> job-like object)
    const optimistic = new Map(); // key: job_id

    // ============================
    // ✅ AUTO LOGO OVERLAY helpers (READY -> /api/atmo/overlay-logo)
    // ============================

    window.__ATMO_OVERLAY_DONE__ = window.__ATMO_OVERLAY_DONE__ || new Set();
    window.__ATMO_OVERLAY_INFLIGHT__ = window.__ATMO_OVERLAY_INFLIGHT__ || new Set();

    const getLogoUrl = () => {
      const u = String(
        window.__ATMO_LOGO_PUBLIC_URL__ ||
        window.__ATM_V2__?.uploads?.logo?.url ||
        window.__ATMO_STATE__?.logo_public_url ||
        window.__ATMO_STATE__?.logo_url ||
        window.__ATMO_STATE__?.logoUrl ||
        ""
      ).trim();
      return u;
    };

    const isReady = (job) => {
      const st = String(job?.db_status || job?.status || job?.state || "").toUpperCase();
      return st.includes("READY") || st.includes("DONE") || st.includes("COMPLET") || st.includes("SUCC");
    };

    const hasLogoOverlayOutput = (job) => {
      const outs = Array.isArray(job?.outputs) ? job.outputs : [];
      return outs.some((o) => o?.meta?.overlay === "logo");
    };

    const getVideoUrl = (job) => {
      const out = pickBestVideoOutput(job);

      const videoUrl = String(
        out?.url ||
        job?.video_url ||
        job?.videoUrl ||
        job?.video?.url ||
        job?.result?.video_url ||
        ""
      ).trim();

      if (!videoUrl) return "";
      if (!videoUrl.startsWith("http") && !videoUrl.startsWith("/")) return "";
      return videoUrl;
    };

    const maybeOverlayOne = async (job) => {
     const jobId = String(job?.job_id || job?.id || "").trim();
      if (!jobId) return false;

      if (!isReady(job)) return false;

      const logoUrl = getLogoUrl();
      if (!logoUrl || !logoUrl.startsWith("http")) return false;

      if (hasLogoOverlayOutput(job)) return false;

      const videoUrl = getVideoUrl(job);
      if (!videoUrl) return false;

      const key = `${jobId}::logo`;

      if (window.__ATMO_OVERLAY_DONE__.has(key)) return false;
      if (window.__ATMO_OVERLAY_INFLIGHT__.has(key)) return false;

      window.__ATMO_OVERLAY_INFLIGHT__.add(key);

      try {
        const r = await fetch("/api/atmo/overlay-logo", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            app: "atmo",
            job_id: jobId,
            video_url: videoUrl,
            logo_url: logoUrl,
            logo_pos: "br",
            logo_size: "sm",
            logo_opacity: 0.85,
          }),
        });

        let j = null;
        try {
          j = await r.json();
        } catch (e) {
          console.warn("[ATMO][overlay] bad json", e);
        }

        if (!j?.ok || !j?.url) {
          console.warn("[ATMO][overlay] failed", j);
          return false; // fail -> done'a yazma (yeniden denesin)
        }

        // ✅ SADECE başarıdan sonra kilitle (1 kez)
        window.__ATMO_OVERLAY_DONE__.add(key);

        const next = {
          ...job,
          outputs: [
            { type: "video", url: j.url, meta: { app: "atmo", overlay: "logo" } },
            ...(Array.isArray(job.outputs) ? job.outputs : []),
          ],
        };

        optimistic.set(jobId, next);
        return true;
      } catch (e) {
        console.warn("[ATMO] overlay error:", e);
        return false;
      } finally {
        window.__ATMO_OVERLAY_INFLIGHT__.delete(key);
      }
    };

    const applyOverlayToMerged = async (merged) => {
      for (const job of merged) {
        try {
          await maybeOverlayOne(job);
        } catch (e) {
          console.warn("[ATMO] overlay loop error:", e);
        }
      }

      return merged.map((jj) => {
        const id = String(jj?.job_id || "").trim();
        return id && optimistic.has(id) ? optimistic.get(id) : jj;
      });
    };

    host.innerHTML = `
      <div class="atmoWrap">
        <div class="atmoHdr">
          <div class="atmoTitle">Atmosfer Video</div>
          <div class="atmoStatus">Hazır</div>
        </div>
        <div class="atmoGrid" data-grid></div>
      </div>
    `;

    const elStatus = host.querySelector(".atmoStatus");
    const elGrid = host.querySelector('[data-grid]');

    const setStatus = (t) => { if (elStatus) elStatus.textContent = t; };

// --- DB controller (lazy start / stop)
let controller = null;
let controllerStarted = false;
let panelVisible = false;

function hasProcessing(items) {
  return (items || []).some(j => {
    const st = norm(j.db_status || j.status || j.state).toUpperCase();
    return (st.includes("PROCESS") || st.includes("RUN") || st.includes("PEND") || st.includes("QUEUE"));
  });
}

const __cardCache = (window.__ATMO_CARD_CACHE__ = window.__ATMO_CARD_CACHE__ || new Map()); // job_id -> el

function ensureCardEl(job) {
  const id = String(job?.job_id || "").trim();
  if (!id) return null;

  let el = __cardCache.get(id);
  if (el && el.isConnected) return el;

  el = document.createElement("div");
  el.className = "atmoCard";
  el.setAttribute("data-job", id);

  el.innerHTML = `
    <div class="atmoThumb">
      <div class="atmoPill mid">İşleniyor</div>
      <div class="atmoSkel"><div class="atmoSkelLabel">Hazırlanıyor…</div></div>
    </div>

    <div class="atmoFooter">
      <div class="atmoMetaLine"></div>

      <div class="atmoActions">
        <button class="atmoIconBtn" type="button" data-act="download" data-job="${esc(id)}" disabled>İndir</button>
        <button class="atmoIconBtn" type="button" data-act="share" data-job="${esc(id)}" disabled>Paylaş</button>
        <button class="atmoIconBtn danger" type="button" data-act="delete" data-job="${esc(id)}">Sil</button>
      </div>
    </div>
  `;

  __cardCache.set(id, el);
  return el;
}

function patchCard(el, job) {
  if (!el || !job) return;

  const badge = mapBadge(job);
  const out = pickBestVideoOutput(job);
  const url = out?.url || "";

  const dt = fmtDT(job.created_at || job.updated_at || job.createdAt);
  const engine = (job.provider || job.meta?.provider || "Atmos").toString();

  const dur = String(job.meta?.duration || job.duration || "").trim();
  const durText = dur ? `${dur}sn` : "";
  const metaLine = `${engine}${durText ? " • " + durText : ""}${dt ? " • " + dt : ""}`;

  const ratio = String(
    job.meta?.aspect_ratio ||
    job.meta?.ratio ||
    out?.meta?.aspect_ratio ||
    out?.meta?.ratio ||
    ""
  );

  const isPortrait = ratio.includes("9:16") || ratio.includes("4:5") || ratio.includes("2:3");
  const ready = badge.kind === "ok";
  const can = !!(ready && url);

  const thumb = el.querySelector(".atmoThumb");
  if (thumb) {
    thumb.classList.toggle("isPortrait", !!isPortrait);
    thumb.classList.toggle("is-loading", !can);
  }

  const pill = el.querySelector(".atmoPill");
  if (pill) {
    pill.textContent = badge.text;
    pill.classList.remove("ok", "mid", "bad");
    pill.classList.add(badge.kind);
  }

  const metaEl = el.querySelector(".atmoMetaLine");
  if (metaEl) metaEl.textContent = job.meta?.prompt || "";

  const dl = el.querySelector('[data-act="download"]');
  const sh = el.querySelector('[data-act="share"]');
  if (dl) can ? dl.removeAttribute("disabled") : dl.setAttribute("disabled", "");
  if (sh) can ? sh.removeAttribute("disabled") : sh.setAttribute("disabled", "");

  const skel = el.querySelector(".atmoSkel");
  let vid = el.querySelector("video.atmoThumbVideo");

  if (can) {
    if (skel) skel.style.display = "none";

    if (!vid) {
      vid = document.createElement("video");
      vid.className = "atmoThumbVideo";
      vid.setAttribute("playsinline", "");
      vid.setAttribute("webkit-playsinline", "");
      vid.setAttribute("preload", "metadata");
      vid.setAttribute("controls", "");
      vid.muted = true;
      thumb?.appendChild(vid);
    }

    const prev = vid.getAttribute("data-src") || "";
    if (prev !== url) {
      vid.setAttribute("data-src", url);
      vid.src = url;
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

function render(items) {
  if (!elGrid) return;

  setStatus(hasProcessing(items) ? "İşleniyor…" : "Hazır");

  const list = Array.isArray(items) ? items : [];
  const EMPTY_ID = "atmoEmptyState";
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
      emptyEl.textContent = "Henüz atmos üretim yok.";
      elGrid.appendChild(emptyEl);
    }
    return;
  } else {
    if (emptyEl) emptyEl.remove();
  }

  const wanted = new Set();
  let anchor = elGrid.firstChild;

  for (const job of list) {
    const id = String(job?.job_id || "").trim();
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
    const jid = ch.getAttribute?.("data-job");
    if (jid && !wanted.has(jid)) elGrid.removeChild(ch);
  }
}

async function handleControllerChange(items) {
  if (destroyed || !panelVisible) return;
  console.debug("[ATMO DEBUG] onChange items:", items);

  const safeItems = (items || []).filter(isJobAtmo);
  const byId = new Map();

  for (const j of safeItems) {
    const id = String(j?.job_id || "").trim();
    if (!id) continue;
    byId.set(id, j);
    if (optimistic.has(id)) optimistic.delete(id);
  }

  for (const [id, j] of optimistic.entries()) {
    if (!byId.has(id)) byId.set(id, j);
  }

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

  const merged = Array.from(byId.values()).sort((a, b) => {
    const ta = toMs(a?.updated_at) || toMs(a?.created_at) || toMs(a?.createdAt) || 0;
    const tb = toMs(b?.updated_at) || toMs(b?.created_at) || toMs(b?.createdAt) || 0;

    if (tb !== ta) return tb - ta;

    const ia = String(a?.job_id || a?.id || "");
    const ib = String(b?.job_id || b?.id || "");
    return ib.localeCompare(ia);
  });

  const merged2 = await applyOverlayToMerged(merged);
  if (!destroyed && panelVisible) render(merged2);
}

function startController() {
  if (destroyed || controllerStarted) return;

  controller = window.DBJobs.create({
    app: "atmo",
    debug: false,
    pollIntervalMs: 4000,
    hydrateEveryMs: 15000,

    acceptJob: (job) => {
      if (!job) return false;
      const ja = getJobApp(job);
      if (ja && !isAtmoApp(ja)) return false;
      return true;
    },

    acceptOutput: (o) => {
      if (!o) return false;
      const t = norm(o.type || o.kind || o.meta?.type || o.meta?.kind);
      if (t && t !== "video") return false;
      const oa = getOutApp(o);
      if (oa && !isAtmoApp(oa)) return false;
      return true;
    },

    onChange: handleControllerChange,
  });

  controllerStarted = true;
}

function stopController() {
  if (!controllerStarted) return;
  try { controller?.destroy?.(); } catch {}
  controller = null;
  controllerStarted = false;
}

function activatePanel() {
  panelVisible = true;
  startController();
}

function deactivatePanel() {
  panelVisible = false;
  stopController();
}

    // ✅ Optimistic job_created listener (Video hissi)
    const onJobCreated = (e) => {
      const d = e?.detail || {};
      if (!d.job_id) return;
      if (!isAtmoApp(d.app || d.meta?.app || "atmo")) return;

      const job_id = String(d.job_id).trim();
      if (!job_id) return;

      // Dedupe: zaten DB state’te varsa ekleme
      const existsDb = (controller.state.items || []).some(j => String(j?.job_id) === job_id);
      if (existsDb) return;

      // Dedupe: optimistic varsa update et
      if (optimistic.has(job_id)) return;

      const meta = d.meta || {};
      const createdAt = d.createdAt || Date.now();

      // job-like object (DB’ye benzeyen shape)
      optimistic.set(job_id, {
        job_id,
        app: "atmo",
        provider: meta.provider || "Atmos",
        createdAt,
        created_at: createdAt,
        db_status: "processing",
        status: "processing",
        state: "PROCESSING",
        meta: {
          ...(meta || {}),
          app: "atmo",
          duration: meta.duration || "",
          prompt: meta.prompt || "",
        },
        outputs: []
      });

      // NOT: overlay burada YOK. READY yakalama onChange içinde.
      try {
        const safeDb = (controller.state.items || []).filter(isJobAtmo);
        const byId = new Map();
        for (const j of safeDb) {
          const id = String(j?.job_id || "").trim();
          if (!id) continue;
          byId.set(id, j);
        }
        if (!byId.has(job_id)) byId.set(job_id, optimistic.get(job_id));

        const merged = Array.from(byId.values()).sort((a, b) => {
          const ta = new Date(a?.created_at || a?.createdAt || Date.now()).getTime();
          const tb = new Date(b?.created_at || b?.createdAt || Date.now()).getTime();
          return tb - ta;
        });

        // sadece "kart hemen gelsin" hissi
        // (overlay + gerçek video, onChange'de DB READY olunca)
        // render(merged) burada çağırmıyoruz; onChange zaten yakında gelecek.
        // ama istersen anında görmek için aşağıyı aç:
        // render(merged);
      } catch {}
    };

    window.addEventListener("aivo:atmo:job_created", onJobCreated);

  return {
  onShow() {
    panelVisible = true;
    activatePanel();
  },

  onHide() {
    panelVisible = false;
    deactivatePanel();
  },

  destroy() {
    destroyed = true;
    panelVisible = false;
    try { deactivatePanel(); } catch {}
    try { window.removeEventListener("aivo:atmo:job_created", onJobCreated); } catch {}
    try { host.innerHTML = ""; } catch {}
  },
};

// Panel register (varsa)
try {
  if (typeof window.RightPanel.register === "function") {
    let atmoPanelInstance = null;

    window.RightPanel.register("atmo", {
      mount(wrapEl, payload, ctx) {
        atmoPanelInstance = createAtmosPanel(wrapEl) || null;

        return () => {
          try { atmoPanelInstance?.destroy?.(); } catch {}
          atmoPanelInstance = null;
        };
      },

      onShow(payload, ctx) {
        try {
          ctx?.setHeader?.({
            title: "Atmosfer Video",
            meta: "",
            searchEnabled: false
          });
        } catch {}

        try { atmoPanelInstance?.onShow?.(); } catch {}
      },

      onHide(payload, ctx) {
        try { atmoPanelInstance?.onHide?.(); } catch {}
      }
    });
  } else {
    window.RightPanel.panels = window.RightPanel.panels || {};
    window.RightPanel.panels.atmo = createAtmosPanel;
  }
} catch (e) {
  console.warn("[ATMO PANEL] register failed", e);
}
})();
