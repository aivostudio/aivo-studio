// atmosphere.panel.js (DB source-of-truth + cover-style cards + per-card mini video player)
// - ÜSTTEKİ BÜYÜK PLAYER KALKTI ✅
// - Her kartın içinde mini mp4 <video controls> ✅
// - 9:16 clamp -> panel bozulmaz ✅
(function () {
  if (!window.RightPanel) return;
  if (!window.DBJobs) {
    console.warn("[ATMO PANEL] DBJobs yok. panel.dbjobs.js yüklenmeli.");
    return;
  }

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

  const mapBadge = (job) => {
    const st = String(job?.status || job?.state || "").toUpperCase();
    if (st.includes("FAIL") || st.includes("ERROR")) return { text: "Hata", kind: "bad" };
    if (st.includes("READY") || st.includes("DONE") || st.includes("COMPLET") || st.includes("SUCC")) return { text: "Hazır", kind: "ok" };
    if (st.includes("RUN") || st.includes("PROC") || st.includes("PEND") || st.includes("QUEUE")) return { text: "İşleniyor", kind: "mid" };
    return { text: st || "Hazır", kind: "mid" };
  };

  const pickBestVideoOutput = (job) => {
    const outs = (job && job.outputs) || [];
    if (!outs.length) return null;

    // prefer video outputs
    const videos = outs.filter((o) => String(o.type || "").toLowerCase() === "video");
    const best = (videos[0] || outs[0]) || null;
    if (!best) return null;

    // prefer archive_url (kalıcı) > url > raw_url
    const url = best.archive_url || best.url || best.raw_url || "";
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
        object-fit:cover;
        background:#000;
      }

      .atmoThumbPlaceholder{
        position:absolute;inset:0;
        display:flex;align-items:center;justify-content:center;
        font-size:12px;opacity:.75;
        background:radial-gradient(80% 80% at 50% 40%, rgba(255,255,255,.06), rgba(0,0,0,.65));
      }

      .atmoPill{
        position:absolute;left:14px;top:14px;z-index:3;
        padding:6px 10px;border-radius:999px;
        font-size:12px;font-weight:700;
        background:rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,0.10);
        backdrop-filter: blur(10px);
      }
      .atmoPill.ok{border-color:rgba(120,255,190,.22);}
      .atmoPill.mid{border-color:rgba(255,255,255,.10);}
      .atmoPill.bad{border-color:rgba(255,120,120,.25);}

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
        flex:1;
        height:38px;
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.10);
        background:rgba(255,255,255,0.04);
        color:#fff;
        cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        font-weight:700;font-size:12px;
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
      acceptOutput: (o) => {
        if (!o) return false;
        const t = String(o.type || "").toLowerCase();
        if (t && t !== "video") return false;
        const app = String(o.meta?.app || "").toLowerCase();
        if (app && !app.includes("atmo")) return false;
        return true;
      },
      onChange: (items) => {
        if (destroyed) return;
        render(items || []);
      }
    });

    function render(items) {
      if (!elGrid) return;

      // status summary
      const hasProcessing = (items || []).some(j => {
        const st = String(j.status || "").toUpperCase();
        return (st === "PROCESSING" || st === "RUNNING" || st === "PENDING" || st === "QUEUED");
      });
      setStatus(hasProcessing ? "İşleniyor…" : "Hazır");

      if (!items.length) {
        elGrid.innerHTML = `<div style="opacity:.7;font-size:12px;padding:4px 2px;">Henüz atmos üretim yok.</div>`;
        return;
      }

      elGrid.innerHTML = items.map((job) => {
        const badge = mapBadge(job);
        const out = pickBestVideoOutput(job);
        const url = out?.url || "";
        const dt = fmtDT(job.created_at || job.updated_at);
        const engine = (job.provider || job.meta?.provider || "Atmos").toString();
        const metaLine = `${engine}${dt ? " • " + dt : ""}`;

        const ratio = String(job.meta?.aspect_ratio || job.meta?.ratio || out?.meta?.aspect_ratio || "");
        const isPortrait = ratio.includes("9:16") || ratio.includes("4:5") || ratio.includes("2:3");

        const disabled = url ? "" : `disabled`;

        const thumbInner = url
          ? `<video class="atmoThumbVideo" playsinline preload="metadata" controls src="${url}"></video>`
          : `<div class="atmoThumbPlaceholder">Henüz hazır değil</div>`;

        return `
          <div class="atmoCard" data-job="${job.job_id}">
            <div class="atmoThumb ${isPortrait ? "isPortrait" : ""}">
              <div class="atmoPill ${badge.kind}">${badge.text}</div>
              ${thumbInner}
            </div>

            <div class="atmoFooter">
              <div class="atmoMetaLine">${metaLine}</div>

              <div class="atmoActions">
                <button class="atmoIconBtn" type="button" data-act="download" data-job="${job.job_id}" ${disabled}>İndir</button>
                <button class="atmoIconBtn" type="button" data-act="share" data-job="${job.job_id}" ${disabled}>Paylaş</button>
                <button class="atmoIconBtn danger" type="button" data-act="delete" data-job="${job.job_id}">Sil</button>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    async function handleAction(act, jobId) {
      const items = controller.state.items || [];
      const job = items.find(x => x.job_id === jobId);
      if (!job) return;

      const out = pickBestVideoOutput(job);
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
            console.log("[ATMO] link kopyalandı:", url);
          }
        } catch {}
        return;
      }

      if (act === "delete") {
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

    controller.start();

    function destroy() {
      destroyed = true;
      controller.destroy();
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
