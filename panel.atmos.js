(function () {
  if (!window.RightPanel) return;

  const safeStr = (v) => String(v == null ? "" : v).trim();

  // FAL atmo video status endpoint
  // Not: app parametresi gerekiyorsa "atmo" veriyoruz.
  const STATUS_URL = (rid) =>
    `/api/providers/fal/video/status?request_id=${encodeURIComponent(rid)}&app=atmo`;

  function pickVideoUrl(data) {
    return (
      data?.video?.url ||
      data?.video_url ||
      data?.output?.video?.url ||
      data?.output?.url ||
      (Array.isArray(data?.outputs) ? data.outputs?.[0]?.url : null) ||
      (Array.isArray(data?.output) ? data.output?.[0]?.url : null) ||
      data?.result?.url ||
      data?.result?.video?.url ||
      null
    );
  }

  // panel instance factory (RightPanel mount() bunu çağıracak)
  function createAtmosPanel(host) {
    let destroyed = false;
    let timer = null;
    let localJobs = [];

    // UI
    host.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between;">
          <div style="font-weight:800; font-size:14px;">Atmosfer Video</div>
          <div class="rpAtmoStatus" style="font-size:12px; opacity:.7;">Hazır</div>
        </div>

        <div style="opacity:.75; font-size:13px;">
          Atmosfer üretince burada takip edeceğim.
        </div>

        <div style="padding:12px; border-radius:14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.06);">
          <div class="rpAtmoHint" style="opacity:.7; font-size:12px; margin-bottom:8px;">Henüz atmos job yok.</div>
          <video class="rpAtmoVideo" controls playsinline style="display:none;width:100%; border-radius:12px; background:#000;"></video>
        </div>
      </div>
    `;

    const elStatus = host.querySelector(".rpAtmoStatus");
    const elHint = host.querySelector(".rpAtmoHint");
    const elVideo = host.querySelector(".rpAtmoVideo");

    const setStatus = (t) => { if (elStatus) elStatus.textContent = t; };

    // AIVO_JOBS.upsert hook ile atmo job yakala
    const originalUpsert = window.AIVO_JOBS && window.AIVO_JOBS.upsert;

    if (originalUpsert && !window.__AIVO_ATMO_UPSERT_HOOKED__) {
      window.__AIVO_ATMO_UPSERT_HOOKED__ = true;

      window.AIVO_JOBS.upsert = function (job) {
        try { originalUpsert.call(this, job); } catch {}

        try {
          if (!job) return;

          const rid =
            safeStr(job.request_id) ||
            safeStr(job.requestId) ||
            safeStr(job.fal_request_id) ||
            safeStr(job.provider_request_id);

          if (!rid || rid === "TEST") return;

          const key = (
            safeStr(job.routeKey) ||
            safeStr(job.app) ||
            safeStr(job.module) ||
            safeStr(job.type) ||
            safeStr(job.kind)
          ).toLowerCase();

          // atmo filtre
          if (!key.includes("atmo")) return;

          const idx = localJobs.findIndex((x) => x.request_id === rid);
          const item = { request_id: rid, job };
          if (idx >= 0) localJobs[idx] = item;
          else localJobs.unshift(item);
        } catch {}
      };
    }

    async function pollOnce() {
      if (destroyed) return;

      const current = localJobs[0];
      if (!current) {
        setStatus("Hazır");
        if (elHint) { elHint.style.display = "block"; elHint.textContent = "Henüz atmos job yok."; }
        if (elVideo) elVideo.style.display = "none";
        return;
      }

      const rid = safeStr(current.request_id);
      if (!rid || rid === "TEST") return;

      setStatus("İşleniyor…");
      if (elHint) { elHint.style.display = "block"; elHint.textContent = "Üretim devam ediyor…"; }

      let data;
      try {
        const r = await fetch(STATUS_URL(rid), { credentials: "include" });
        data = await r.json();
      } catch {
        setStatus("Bağlantı sorunu");
        return;
      }

      const st = safeStr(data?.status || data?.state || data?.result?.status).toLowerCase();

      if (st.includes("fail") || st === "error") {
        setStatus("Hata");
        if (elHint) elHint.textContent = "Video üretimi hata verdi.";
        return;
      }

      if (st.includes("complete") || st.includes("success") || st === "succeeded") {
        const url = pickVideoUrl(data);
        if (!url) {
          setStatus("Tamamlandı (url yok)");
          return;
        }

        setStatus("Tamamlandı");

        // panel video
        if (elHint) elHint.style.display = "none";
        if (elVideo) {
          elVideo.style.display = "block";
          if (elVideo.src !== url) {
            elVideo.src = url;
            elVideo.load?.();
          }
        }

        // PPE bridge: global outputs/player
        try {
          if (window.PPE && typeof window.PPE.apply === "function") {
            window.PPE.apply({
              outputs: [{ type: "video", url, src: url }],
              meta: { app: "atmo", request_id: rid },
            });
          }
        } catch {}

        return;
      }

      // processing
      setStatus("İşleniyor…");
    }

    // start loop
    pollOnce();
    timer = setInterval(pollOnce, 2000);

    function destroy() {
      destroyed = true;
      if (timer) clearInterval(timer);
      timer = null;
      host.innerHTML = "";
    }

    return { destroy };
  }

  // RightPanel API: object { mount, destroy } bekliyor
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
