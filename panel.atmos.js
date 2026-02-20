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

    // --- DB controller
    const controller = window.DBJobs.create({
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

      onChange: (items) => {
        if (destroyed) return;

        const safeItems = (items || []).filter(isJobAtmo);

      // ✅ Merge: DB (truth) + optimistic (overlay) by job_id
// Rule:
// - DB’de job varsa: optimistic’i drop/replace
// - DB’de yoksa: optimistic’i göster
const byId = new Map();

// 1) DB items first (truth)
for (const j of safeItems) {
  const id = String(j?.job_id || "").trim();
  if (!id) continue;
  byId.set(id, j);
  if (optimistic.has(id)) optimistic.delete(id); // DB geldi -> overlay kalk
}

// 2) Remaining optimistic
for (const [id, j] of optimistic.entries()) {
  if (!byId.has(id)) byId.set(id, j);
}

// ✅ newest first (updated_at > created_at > createdAt) + NaN safe
const merged = Array.from(byId.values()).sort((a, b) => {
  const ta = Date.parse(a?.updated_at || a?.created_at) || Number(a?.createdAt) || 0;
  const tb = Date.parse(b?.updated_at || b?.created_at) || Number(b?.createdAt) || 0;
  return tb - ta;
});

render(merged);

    function hasProcessing(items) {
      return (items || []).some(j => {
        const st = norm(j.db_status || j.status || j.state).toUpperCase();
        return (st.includes("PROCESS") || st.includes("RUN") || st.includes("PEND") || st.includes("QUEUE"));
      });
    }

    function render(items) {
      if (!elGrid) return;

      setStatus(hasProcessing(items) ? "İşleniyor…" : "Hazır");

      if (!items.length) {
        elGrid.innerHTML = `<div style="opacity:.7;font-size:12px;padding:4px 2px;">Henüz atmos üretim yok.</div>`;
        return;
      }

      elGrid.innerHTML = items.map((job) => {
        const badge = mapBadge(job);
        const out = pickBestVideoOutput(job);
        const url = out?.url || "";

        const dt = fmtDT(job.created_at || job.updated_at || job.createdAt);
        const engine = (job.provider || job.meta?.provider || "Atmos").toString();

        // meta line: engine + duration + dt
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
        const disabled = url ? "" : `disabled`;

       const ready = badge.kind === "ok"; // sadece "Hazır" iken video göster
const thumbInner = (ready && url)
  ? `<video class="atmoThumbVideo" playsinline webkit-playsinline preload="metadata" controls muted src="${esc(url)}"></video>`
  : `<div class="atmoSkel"><div class="atmoSkelLabel">Hazırlanıyor…</div></div>`;
        return `
          <div class="atmoCard" data-job="${esc(job.job_id)}">
            <div class="atmoThumb ${isPortrait ? "isPortrait" : ""}">
              <div class="atmoPill ${badge.kind}">${esc(badge.text)}</div>
              ${thumbInner}
            </div>

            <div class="atmoFooter">
              <div class="atmoMetaLine">${esc(metaLine)}</div>

              <div class="atmoActions">
                <button class="atmoIconBtn" type="button" data-act="download" data-job="${esc(job.job_id)}" ${disabled}>İndir</button>
                <button class="atmoIconBtn" type="button" data-act="share" data-job="${esc(job.job_id)}" ${disabled}>Paylaş</button>
                <button class="atmoIconBtn danger" type="button" data-act="delete" data-job="${esc(job.job_id)}">Sil</button>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    async function handleAction(act, jobId) {
      const items = controller.state.items || [];
      const job = items.find(x => String(x.job_id) === String(jobId));

      // DB’de yoksa optimistic olabilir
      const job2 = job || optimistic.get(String(jobId));

      if (!job2) return;
      if (!isJobAtmo(job2)) return;

      const out = pickBestVideoOutput(job2);
      const url = out?.url || "";

      if (act === "download") {
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = `atmo-${jobId}.mp4`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }

      if (act === "share") {
        if (!url) return;
        try {
          if (navigator.share) {
            await navigator.share({ title: "Atmosfer Video", url });
          } else {
            await navigator.clipboard.writeText(url);
          }
        } catch {}
        return;
      }

      if (act === "delete") {
        // optimistic varsa kaldır
        optimistic.delete(String(jobId));
        // DB delete
        const ok = await controller.deleteJob(jobId);
        if (!ok) controller.hydrate(true);
        return;
      }
    }

    elGrid?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-act]");
      if (!btn) return;

      const act = btn.getAttribute("data-act");
      const jobId = btn.getAttribute("data-job");
      if (!act || !jobId) return;

      if (btn.hasAttribute("disabled")) return;
      handleAction(act, jobId);
    });

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

      // render now (overlay görünür)
      controller.hydrate(false); // hızlı tetik: onChange merge eder
      // ekstra: tek başına merge çağırmak için onChange’i manuel tetikleyelim
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
        render(merged);
        setStatus("İşleniyor…");
      } catch {}
    };

    window.addEventListener("aivo:atmo:job_created", onJobCreated);

    controller.start();

    function destroy() {
      destroyed = true;
      try { controller.destroy(); } catch {}
      try { window.removeEventListener("aivo:atmo:job_created", onJobCreated); } catch {}
      optimistic.clear();
      host.innerHTML = "";
    }

    return { destroy };
  }

  window.RightPanel.register("atmo", {
    mount(host) {
      const panel = createAtmosPanel(host);
      host.__ATMO_PANEL__ = panel;
    },
    destroy(host) {
      try { host.__ATMO_PANEL__ && host.__ATMO_PANEL__.destroy(); } catch {}
      host.__ATMO_PANEL__ = null;
    }
  });
})();
