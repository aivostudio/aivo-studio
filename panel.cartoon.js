// panel.cartoon.js (DB source-of-truth + optimistic “video hissi”)
// - Kart anında gelir (aivo:cartoon:job_created)
// - Shimmer “hazırlanıyor”
// - Ready olunca shimmer gider, video görünür
// - Dedupe: job_id tek kart

(function () {
  if (!window.RightPanel) return;
  if (!window.DBJobs) {
    console.warn("[CARTOON PANEL] DBJobs yok. panel.dbjobs.js yüklenmeli.");
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

  const isCartoonApp = (x) => {
    const a = norm(x);
    return a === "cartoon" || a.includes("cartoon");
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

  const isJobCartoon = (job) => isCartoonApp(getJobApp(job));

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
      if (oa && !isCartoonApp(oa)) return false;

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
    if (document.getElementById("cartoonPanelStyles")) return;
    const css = `
      .cartoonPanelWrap{display:flex;flex-direction:column;gap:12px;}
      .cartoonPanelHdr{display:flex;align-items:center;justify-content:space-between;}
      .cartoonPanelTitle{font-weight:900;font-size:14px;}
      .cartoonPanelStatus{font-size:12px;opacity:.7;}

      .cartoonPanelGrid{
        display:grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap:12px;
      }

      .cartoonPanelCard{
        position:relative;
        border-radius:18px;
        background:rgba(255,255,255,0.035);
        border:1px solid rgba(255,255,255,0.07);
        overflow:hidden;
      }

      .cartoonPanelThumb{
        position:relative;
        border-radius:16px;
        overflow:hidden;
        margin:10px;
        background:#000;
        border:1px solid rgba(255,255,255,0.08);
      }

      .cartoonPanelThumb:before{content:"";display:block;padding-top:56.25%;}
      .cartoonPanelThumb.isPortrait:before{padding-top:140%;}

      .cartoonPanelVideo{
        position:absolute;inset:0;width:100%;height:100%;
        object-fit:cover;background:#000;
      }

      .cartoonPanelPill{
        position:absolute;left:14px;top:14px;z-index:3;
        padding:6px 10px;border-radius:999px;
        font-size:12px;font-weight:800;
        background:rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,0.10);
        backdrop-filter: blur(10px);
      }
      .cartoonPanelPill.ok{border-color:rgba(120,255,190,.22);}
      .cartoonPanelPill.mid{border-color:rgba(255,255,255,.10);}
      .cartoonPanelPill.bad{border-color:rgba(255,120,120,.25);}

      .cartoonPanelSkel{
        position:absolute;inset:0;
        display:flex;align-items:center;justify-content:center;
        background:radial-gradient(80% 80% at 50% 40%, rgba(175,120,255,.18), rgba(0,0,0,.70));
        overflow:hidden;
      }
      .cartoonPanelSkel:before{
        content:"";
        position:absolute;inset:-40%;
        background:linear-gradient(90deg,
          rgba(255,255,255,0.00),
          rgba(220,170,255,0.14),
          rgba(255,255,255,0.00)
        );
        transform:rotate(18deg);
        animation: cartoonPanelShimmer 1.4s linear infinite;
      }
      @keyframes cartoonPanelShimmer{
        0%{transform:translateX(-30%) rotate(18deg);}
        100%{transform:translateX(30%) rotate(18deg);}
      }
      .cartoonPanelSkelLabel{
        position:relative;z-index:2;
        font-size:12px;font-weight:800;
        padding:8px 12px;border-radius:999px;
        background:rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,.10);
      }

      .cartoonPanelFooter{
        padding:10px 12px 12px 12px;
        display:flex;flex-direction:column;gap:8px;
      }

      .cartoonPanelMetaLine{
        font-size:12px;opacity:.8;
        white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
      }

      .cartoonPanelActions{
        display:flex;gap:8px;
        padding:10px;border-radius:14px;
        background:rgba(0,0,0,.20);
        border:1px solid rgba(255,255,255,0.06);
      }

      .cartoonPanelBtn{
        flex:1;height:38px;border-radius:12px;
        border:1px solid rgba(255,255,255,0.10);
        background:rgba(255,255,255,0.04);
        color:#fff;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        font-weight:800;font-size:12px;
      }
      .cartoonPanelBtn[disabled]{opacity:.45;cursor:not-allowed;}
      .cartoonPanelBtn.danger{
        border-color:rgba(255,120,120,0.20);
        background:rgba(255,120,120,0.08);
      }

      @media (max-width: 980px){
        .cartoonPanelGrid{grid-template-columns:1fr;}
      }
    `;
    const style = document.createElement("style");
    style.id = "cartoonPanelStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createCartoonPanel(host) {
    ensureStyles();

    let destroyed = false;
    const optimistic = new Map();

   host.innerHTML = `
  <div class="cartoonPanelWrap">
    <div class="cartoonPanelGrid" data-grid></div>
  </div>
`;

const elGrid = host.querySelector('[data-grid]');
const elStatus = null;

    const setStatus = (t) => { if (elStatus) elStatus.textContent = t; };

    const controller = window.DBJobs.create({
      app: "cartoon",
      debug: false,
      pollIntervalMs: 4000,
      hydrateEveryMs: 15000,

      acceptJob: (job) => {
        if (!job) return false;
        const ja = getJobApp(job);
        if (ja && !isCartoonApp(ja)) return false;
        return true;
      },

      acceptOutput: (o) => {
        if (!o) return false;
        const t = norm(o.type || o.kind || o.meta?.type || o.meta?.kind);
        if (t && t !== "video") return false;
        const oa = getOutApp(o);
        if (oa && !isCartoonApp(oa)) return false;
        return true;
      },

      onChange: async (items) => {
        if (destroyed) return;
        console.debug("[CARTOON DEBUG] onChange items:", items);

        const safeItems = (items || []).filter(isJobCartoon);
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

        render(merged);

        function hasProcessing(items) {
          return (items || []).some((j) => {
            const st = norm(j.db_status || j.status || j.state).toUpperCase();
            return (st.includes("PROCESS") || st.includes("RUN") || st.includes("PEND") || st.includes("QUEUE"));
          });
        }

        const __cardCache = (window.__CARTOON_CARD_CACHE__ = window.__CARTOON_CARD_CACHE__ || new Map());

        function ensureCardEl(job) {
          const id = String(job?.job_id || "").trim();
          if (!id) return null;

          let el = __cardCache.get(id);
          if (el && el.isConnected) return el;

          el = document.createElement("div");
          el.className = "cartoonPanelCard";
          el.setAttribute("data-job", id);

          el.innerHTML = `
            <div class="cartoonPanelThumb">
              <div class="cartoonPanelPill mid">İşleniyor</div>
              <div class="cartoonPanelSkel"><div class="cartoonPanelSkelLabel">Hazırlanıyor…</div></div>
            </div>

            <div class="cartoonPanelFooter">
              <div class="cartoonPanelMetaLine"></div>

              <div class="cartoonPanelActions">
                <button class="cartoonPanelBtn" type="button" data-act="download" data-job="${esc(id)}" disabled>İndir</button>
                <button class="cartoonPanelBtn" type="button" data-act="share" data-job="${esc(id)}" disabled>Paylaş</button>
                <button class="cartoonPanelBtn danger" type="button" data-act="delete" data-job="${esc(id)}">Sil</button>
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
          const engine = (job.provider || job.meta?.provider || "Cartoon").toString();

          const dur = String(job.meta?.ui_state?.duration || job.meta?.duration || job.duration || "").trim();
          const durText = dur ? `${dur}sn` : "";
          const metaLine = `${engine}${durText ? " • " + durText : ""}${dt ? " • " + dt : ""}`;

          const ratio = String(
            job.meta?.ui_state?.aspect_ratio ||
            job.meta?.aspect_ratio ||
            job.meta?.ratio ||
            out?.meta?.aspect_ratio ||
            out?.meta?.ratio ||
            ""
          );

          const isPortrait = ratio.includes("9:16") || ratio.includes("4:5") || ratio.includes("2:3");
          const ready = badge.kind === "ok";
          const can = !!(ready && url);

          const thumb = el.querySelector(".cartoonPanelThumb");
          if (thumb) {
            thumb.classList.toggle("isPortrait", !!isPortrait);
            thumb.classList.toggle("is-loading", !can);
          }

          const pill = el.querySelector(".cartoonPanelPill");
          if (pill) {
            pill.textContent = badge.text;
            pill.classList.remove("ok", "mid", "bad");
            pill.classList.add(badge.kind);
          }

          const metaEl = el.querySelector(".cartoonPanelMetaLine");
          if (metaEl) {
            metaEl.textContent = job.meta?.prompt || job.prompt || metaLine;
          }

          const dl = el.querySelector('[data-act="download"]');
          const sh = el.querySelector('[data-act="share"]');
          if (dl) can ? dl.removeAttribute("disabled") : dl.setAttribute("disabled", "");
          if (sh) can ? sh.removeAttribute("disabled") : sh.setAttribute("disabled", "");

          const skel = el.querySelector(".cartoonPanelSkel");
          let vid = el.querySelector("video.cartoonPanelVideo");

          if (can) {
            if (skel) skel.style.display = "none";

            if (!vid) {
              vid = document.createElement("video");
              vid.className = "cartoonPanelVideo";
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

          const EMPTY_ID = "cartoonEmptyState";
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
              emptyEl.textContent = "Henüz çizgifilm üretim yok.";
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
      },
    });

    const onJobCreated = (e) => {
      const d = e?.detail || {};
      if (!d.job_id) return;
      if (!isCartoonApp(d.app || d.meta?.app || "cartoon")) return;

      const job_id = String(d.job_id).trim();
      if (!job_id) return;

      const existsDb = (controller.state.items || []).some((j) => String(j?.job_id) === job_id);
      if (existsDb) return;

      if (optimistic.has(job_id)) return;

      const meta = d.meta || {};
      const createdAt = d.createdAt || Date.now();

          optimistic.set(job_id, {
        job_id,
        app: "cartoon",
        provider: meta.provider || "Cartoon",
        createdAt,
        created_at: createdAt,
        db_status: "processing",
        status: "processing",
        state: "PROCESSING",
        meta: {
          ...(meta || {}),
          app: "cartoon",
          duration: meta.duration || "",
          prompt: meta.prompt || "",
        },
        outputs: []
      });

      host.dispatchEvent(new CustomEvent("cartoon:panel:refresh"));
    };

    window.addEventListener("aivo:cartoon:job_created", onJobCreated);

    return {
      destroy() {
        destroyed = true;
        try { window.removeEventListener("aivo:cartoon:job_created", onJobCreated); } catch {}
        try { controller?.destroy?.(); } catch {}
        try { host.innerHTML = ""; } catch {}
      },
    };
  }
try {
  if (typeof window.RightPanel.register === "function") {
    window.RightPanel.register("cartoon", {
      header: {
        title: "AI Çocuk Çizgifilm",
        meta: "Hazır",
        searchEnabled: true,
        searchPlaceholder: "Çizgifilmlerde ara...",
        resetSearch: true
      },

      mount(host) {
        const api = createCartoonPanel(host);
        return () => {
          try { api?.destroy?.(); } catch {}
        };
      }
    });
  } else {
    console.warn("[CARTOON PANEL] RightPanel.register yok.");
  }
} catch (e) {
  console.warn("[CARTOON PANEL] register failed", e);
}
})();
