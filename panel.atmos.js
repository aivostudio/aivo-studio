// panel.atmos.js
(function () {
  // ---- helpers
  const $ = (sel, el = document) => el.querySelector(sel);

  const safeStr = (v) => String(v == null ? "" : v).trim();

  // Fal video status endpoint (repo tree: /api/providers/fal/video/status.js)
  // app parametresi gerekiyorsa burada veriyoruz:
  const STATUS_URL = (rid) =>
    `/api/providers/fal/video/status?request_id=${encodeURIComponent(rid)}&app=atmo`;

  function pickVideoUrl(data) {
    // farklı provider response şekillerine tolerans
    return (
      data?.video?.url ||
      data?.video_url ||
      data?.output?.video?.url ||
      data?.output?.url ||
      (Array.isArray(data?.output) ? data.output?.[0]?.url : null) ||
      (Array.isArray(data?.outputs) ? data.outputs?.[0]?.url : null) ||
      data?.result?.url ||
      data?.result?.video?.url ||
      null
    );
  }

  // ---- panel factory
  function createAtmosPanel(host) {
    let destroyed = false;
    let timer = null;

    // job store (cover’da yaptığımız gibi localJobs)
    let localJobs = [];

    // upsert hook (AIVO_JOBS array değil, sadece upsert var demiştin)
    const originalUpsert = window.AIVO_JOBS && window.AIVO_JOBS.upsert;
    if (originalUpsert && !window.__AIVO_ATMO_UPSERT_HOOKED__) {
      window.__AIVO_ATMO_UPSERT_HOOKED__ = true;

      window.AIVO_JOBS.upsert = function (job) {
        try {
          // önce orijinal
          originalUpsert.call(this, job);
        } catch (e) {
          // yut
        }

        // sonra bizim capture
        try {
          if (!job) return;
          // Atmos job filtreleme: kendi job formatına göre burayı ufak ayarlayabilirsin.
          // Güvenli yaklaşım: request_id varsa al, ayrıca job.app/module/type alanlarını kontrol et.
          const rid =
            safeStr(job.request_id) ||
            safeStr(job.requestId) ||
            safeStr(job.fal_request_id) ||
            safeStr(job.provider_request_id);

          const app =
            safeStr(job.app) ||
            safeStr(job.module) ||
            safeStr(job.type) ||
            safeStr(job.kind);

          const looksAtmos =
            /atmo|atmos|atmosphere/i.test(app) ||
            /atmo|atmos|atmosphere/i.test(safeStr(job.routeKey));

          if (!rid || rid === "TEST") return;
          if (!looksAtmos) return;

          // upsert local
          const idx = localJobs.findIndex((x) => x.request_id === rid);
          const item = { request_id: rid, job };
          if (idx >= 0) localJobs[idx] = item;
          else localJobs.unshift(item);
        } catch (e) {
          // yut
        }
      };
    }

    // ---- UI
    host.innerHTML = `
      <div class="rp rp-atmo" style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-weight:700;font-size:14px;">Atmosfer Video</div>
          <div class="rpAtmoStatus" style="font-size:12px;opacity:.7;">Hazır</div>
        </div>

        <div class="rpAtmoCard" style="border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px;">
          <div class="rpAtmoHint" style="font-size:12px;opacity:.75;line-height:1.4;">
            Henüz atmos job yok. Atmosfer üretince burada takip edeceğim.
          </div>

          <video class="rpAtmoVideo" style="display:none;width:100%;border-radius:10px;margin-top:10px;" controls playsinline></video>
        </div>
      </div>
    `;

    const elStatus = $(".rpAtmoStatus", host);
    const elHint = $(".rpAtmoHint", host);
    const elVideo = $(".rpAtmoVideo", host);

    function setStatus(txt) {
      if (elStatus) elStatus.textContent = txt;
    }

    async function pollOnce() {
      if (destroyed) return;

      // en güncel job
      const current = localJobs[0];
      if (!current) {
        setStatus("Hazır");
        if (elHint) elHint.style.display = "block";
        if (elVideo) elVideo.style.display = "none";
        return;
      }

      const rid = safeStr(current.request_id);
      if (!rid || rid === "TEST") return;

      setStatus("İşleniyor…");

      let data;
      try {
        const r = await fetch(STATUS_URL(rid), { credentials: "include" });
        data = await r.json();
      } catch (e) {
        setStatus("Bağlantı sorunu");
        return;
      }

      // status normalize
      const st = safeStr(data?.status || data?.state || data?.result?.status).toLowerCase();

      if (st.includes("fail") || st === "error") {
        setStatus("Hata");
        if (elHint) {
          elHint.style.display = "block";
          elHint.textContent = "Video üretimi hata verdi. (status: " + (data?.status || "unknown") + ")";
        }
        return;
      }

      if (st.includes("complete") || st.includes("success") || st === "succeeded") {
        const url = pickVideoUrl(data);
        if (!url) {
          setStatus("Tamamlandı (url yok)");
          return;
        }

        setStatus("Tamamlandı");

        // Panel player
        if (elHint) elHint.style.display = "none";
        if (elVideo) {
          elVideo.style.display = "block";
          if (elVideo.src !== url) elVideo.src = url;
        }

        // PPE bridge (cover gibi)
        try {
          if (window.PPE && typeof window.PPE.apply === "function") {
            window.PPE.apply({
              outputs: [{ type: "video", src: url, url }],
              meta: { app: "atmo", request_id: rid },
            });
          }
        } catch (e) {
          // yut
        }

        return; // completed
      }

      // default: still processing
      setStatus("İşleniyor…");
      if (elHint) {
        elHint.style.display = "block";
        elHint.textContent = "Üretim devam ediyor…";
      }
    }

    function start() {
      // hızlı ilk çek
      pollOnce();
      timer = setInterval(pollOnce, 2000);
    }

    function destroy() {
      destroyed = true;
      if (timer) clearInterval(timer);
      timer = null;
      host.innerHTML = "";
    }

    start();
    return { destroy };
  }

  // ---- register
  // manager API’n farklıysa burayı uydur:
  if (window.RightPanel && typeof window.RightPanel.register === "function") {
   window.RightPanel.register("atmo", createAtmosPanel);

  } else {
    // fallback: debug
    window.__createAtmosPanel = createAtmosPanel;
  }
})();
