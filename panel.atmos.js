// atmosphere.panel.js (DB source-of-truth + cover-style cards + single fixed player)
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

  const pickBestVideoOutput = (job) => {
    const outs = (job && job.outputs) || [];
    if (!outs.length) return null;

    // prefer video outputs
    const videos = outs.filter((o) => String(o.type || "").toLowerCase() === "video");
    const best = (videos[0] || outs[0]) || null;

    if (!best) return null;

    const url = best.url || best.archive_url || best.raw_url || "";
    if (!url) return null;

    return { ...best, url };
  };

  const stateLabel = (job) => {
    const st = String(job?.status || job?.state || "").toUpperCase();
    if (st.includes("FAIL") || st.includes("ERROR")) return { text: "Hata", kind: "bad" };
    if (st.includes("READY") || st.includes("DONE") || st.includes("COMPLET") || st.includes("SUCC")) return { text: "Hazır", kind: "ok" };
    if (st.includes("RUN") || st.includes("PROC") || st.includes("PEND") || st.includes("QUEUE")) return { text: "İşleniyor", kind: "mid" };
    return { text: st || "Hazır", kind: "mid" };
  };

  function ensureStyles() {
    if (document.getElementById("atmoPanelStyles")) return;
    const css = `
      .atmoWrap{display:flex;flex-direction:column;gap:12px;}
      .atmoHdr{display:flex;align-items:center;justify-content:space-between;}
      .atmoTitle{font-weight:900;font-size:14px;}
      .atmoStatus{font-size:12px;opacity:.7;}

      .atmoPlayerShell{
        padding:12px;border-radius:16px;
        background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.06);
      }
      .atmoPlayerTop{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
      .atmoPlayerMeta{font-size:12px;opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .atmoPlayerClose{
        width:34px;height:34px;border-radius:999px;border:1px solid rgba(255,255,255,0.10);
        background:rgba(0,0,0,.25);color:#fff;cursor:pointer;
      }
      .atmoPlayerBox{
        position:relative;border-radius:14px;overflow:hidden;
        background:#000;border:1px solid rgba(255,255,255,0.08);
      }
      /* aspect clamp -> panel bozulmasın (9:16) */
      .atmoPlayerBox:before{content:"";display:block;padding-top:56.25%;} /* 16:9 default */
      .atmoPlayerBox.isPortrait:before{padding-top:140%;} /* dikey clamp */
      .atmoPlayerVideo{
        position:absolute;inset:0;width:100%;height:100%;
        object-fit:contain; /* güvenli letterbox */
        background:#000;
      }
      .atmoPlayerHint{font-size:12px;opacity:.7;}

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
      .atmoThumb:before{content:"";display:block;padding-top:56.25%;}
      .atmoThumbImg, .atmoThumbVideo{
        position:absolute;inset:0;width:100%;height:100%;
        object-fit:cover;
        background:#000;
      }

      .atmoPill{
        position:absolute;left:14px;top:14px;
        padding:6px 10px;border-radius:999px;
        font-size:12px;font-weight:700;
        background:rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,0.10);
        backdrop-filter: blur(10px);
      }
      .atmoPill.ok{border-color:rgba(120,255,190,.22);}
      .atmoPill.mid{border-color:rgba(255,255,255,.10);}
      .atmoPill.bad{border-color:rgba(255,120,120,.25);}

      .atmoPlay{
        position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
      }
      .atmoPlayBtn{
        width:58px;height:58px;border-radius:999px;
        background:rgba(0,0,0,.35);
        border:1px solid rgba(255,255,255,0.15);
        backdrop-filter: blur(10px);
        cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        transition:transform .12s ease, filter .12s ease;
      }
      .atmoPlayBtn:hover{transform:translateY(-1px);filter:brightness(1.06);}
      .atmoPlayBtn:active{transform:translateY(0px) scale(.98);}
      .atmoPlayBtn svg{width:22px;height:22px;fill:#fff;opacity:.95;margin-left:2px;}

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

        <div class="atmoPlayerShell">
          <div class="atmoPlayerTop">
            <div class="atmoPlayerMeta">Bir karttan ▶️ seçip oynat.</div>
            <button class="atmoPlayerClose" type="button" title="Kapat" style="display:none;">✕</button>
          </div>

          <div class="atmoPlayerBox" data-player-box>
            <div class="atmoPlayerHint" style="padding:10px 12px;opacity:.75;">
              Henüz seçili video yok.
            </div>
            <video class="atmoPlayerVideo" playsinline controls style="display:none;"></video>
          </div>
        </div>

        <div class="atmoGrid" data-grid></div>
      </div>
    `;

    const elStatus = host.querySelector(".atmoStatus");
    const elGrid = host.querySelector('[data-grid]');
    const elPlayerBox = host.querySelector('[data-player-box]');
    const elPlayerMeta = host.querySelector(".atmoPlayerMeta");
    const elPlayerClose = host.querySelector(".atmoPlayerClose");
    const elPlayerVideo = host.querySelector(".atmoPlayerVideo");
    const elPlayerHint = host.querySelector(".atmoPlayerHint");

    const setStatus = (t) => { if (elStatus) elStatus.textContent = t; };

    function setPlayer(url, metaText, isPortrait) {
      if (!elPlayerVideo) return;
      if (elPlayerHint) elPlayerHint.style.display = "none";

      elPlayerVideo.style.display = "block";
      if (elPlayerClose) elPlayerClose.style.display = "inline-flex";

      if (elPlayerMeta) elPlayerMeta.textContent = metaText || "Seçili video";

      if (elPlayerBox) {
        elPlayerBox.classList.toggle("isPortrait", !!isPortrait);
      }

      if (elPlayerVideo.src !== url) {
        elPlayerVideo.src = url;
        elPlayerVideo.load?.();
      }

      // autoplay try
      elPlayerVideo.play?.().catch(() => {});
    }

    function clearPlayer() {
      if (!elPlayerVideo) return;
      try { elPlayerVideo.pause?.(); } catch {}
      elPlayerVideo.removeAttribute("src");
      elPlayerVideo.load?.();

      elPlayerVideo.style.display = "none";
      if (elPlayerHint) elPlayerHint.style.display = "block";
      if (elPlayerClose) elPlayerClose.style.display = "none";
      if (elPlayerMeta) elPlayerMeta.textContent = "Bir karttan ▶️ seçip oynat.";
      if (elPlayerBox) elPlayerBox.classList.remove("isPortrait");
    }

    elPlayerClose?.addEventListener("click", clearPlayer);

    // --- DB controller
    const controller = window.DBJobs.create({
      app: "atmo",
      debug: false,
      pollIntervalMs: 4000,
      hydrateEveryMs: 15000,
      acceptOutput: (o) => {
        // only video outputs, and only atmo/app match if meta has it
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
        return (st === "PROCESSING" || st === "RUNNING" || st === "PENDING");
      });
      setStatus(hasProcessing ? "İşleniyor…" : "Hazır");

      if (!items.length) {
        elGrid.innerHTML = `<div style="opacity:.7;font-size:12px;padding:4px 2px;">Henüz atmos üretim yok.</div>`;
        return;
      }

      elGrid.innerHTML = items.map((job) => {
        const badge = stateLabel(job);
        const out = pickBestVideoOutput(job);
        const url = out?.url || "";
        const dt = fmtDT(job.created_at || job.updated_at);
        const engine = (job.provider || job.meta?.provider || "Atmos").toString();
        const metaLine = `${engine}${dt ? " • " + dt : ""}`;

        // thumb: video poster yoksa sadece gradient/black olur.
        // (İstersen sonra backend "thumb_url" üretir, burada kullanırız.)
        const thumbHtml = `
          <div class="atmoThumb">
            <div class="atmoPill ${badge.kind}">${badge.text}</div>
            <div class="atmoPlay">
              <button class="atmoPlayBtn" type="button" data-act="play" data-job="${job.job_id}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg>
              </button>
            </div>
          </div>
        `;

        const disabled = url ? "" : `disabled data-no-url="1"`;

        return `
          <div class="atmoCard" data-job="${job.job_id}" data-url="${encodeURIComponent(url)}">
            ${thumbHtml}

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
      const isPortrait = (() => {
        const ar = String(job.meta?.aspect_ratio || job.meta?.ratio || out?.meta?.aspect_ratio || "");
        // kaba tespit: 9:16, 4:5, etc.
        return ar.includes("9:16") || ar.includes("4:5") || ar.includes("2:3");
      })();

      const metaText = `${(job.provider || job.meta?.provider || "Atmos")} • ${fmtDT(job.created_at || job.updated_at)}`;

      if (act === "play") {
        if (!url) return;
        setPlayer(url, metaText, isPortrait);

        // PPE bridge (global outputs)
        try {
          if (window.PPE && typeof window.PPE.apply === "function") {
            window.PPE.apply({
              outputs: [{ type: "video", url, src: url, meta: { app: "atmo" } }],
              meta: { app: "atmo", job_id: jobId }
            });
          }
        } catch {}
        return;
      }

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
        // optimistic
        const ok = await controller.deleteJob(jobId);
        // eğer seçili player bu job ise kapat
        try {
          const src = elPlayerVideo?.getAttribute("src") || "";
          if (src && url && src === url) clearPlayer();
        } catch {}
        if (!ok) {
          // endpoint yoksa bile UI temizlenmiş olur; sonra hydrate geri getirebilir.
          // o yüzden hydrate(true) yapıp DB gerçeğini yenile.
          controller.hydrate(true);
        }
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
      clearPlayer();
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
