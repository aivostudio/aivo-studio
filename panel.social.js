(function () {
  if (!window.RightPanel) return;

  const safeStr = (v) => String(v == null ? "" : v).trim();
  const low = (v) => safeStr(v).toLowerCase();

  // Cover'da olduğu gibi: Fal status endpoint app param ister
  const STATUS_URL = (rid) =>
    `/api/providers/fal/predictions/status?request_id=${encodeURIComponent(rid)}&app=social`;

  function pickImages(data) {
    // Fal/SDXL response shape toleranslı:
    // - data.images: [{url}]
    // - data.output.images
    // - data.output: [{url}]
    // - data.image.url
    const a =
      (Array.isArray(data?.images) && data.images) ||
      (Array.isArray(data?.output?.images) && data.output.images) ||
      (Array.isArray(data?.output) && data.output) ||
      (data?.image?.url ? [{ url: data.image.url }] : []) ||
      [];
    // normalize -> urls
    return a
      .map((x) => x?.url || x?.src || x)
      .map((u) => safeStr(u))
      .filter(Boolean);
  }

  function createSocialPanel(host) {
    let destroyed = false;
    let timer = null;

    let localJobs = []; // { request_id, job }

    // UI
    host.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div style="font-weight:800;font-size:14px;">Sosyal Medya Paketi</div>
          <div class="rpSocialStatus" style="opacity:.7;font-size:12px;">Hazır</div>
        </div>

        <div style="opacity:.75;font-size:13px;">
          Social üretince burada 4 görseli otomatik dolduracağım.
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div data-slot="0" style="height:130px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;opacity:.6;font-size:12px;">Slot A</div>
          <div data-slot="1" style="height:130px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;opacity:.6;font-size:12px;">Slot B</div>
          <div data-slot="2" style="height:130px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;opacity:.6;font-size:12px;">Slot C</div>
          <div data-slot="3" style="height:130px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;opacity:.6;font-size:12px;">Slot D</div>
        </div>
      </div>
    `;

    const elStatus = host.querySelector(".rpSocialStatus");
    const slots = [
      host.querySelector('[data-slot="0"]'),
      host.querySelector('[data-slot="1"]'),
      host.querySelector('[data-slot="2"]'),
      host.querySelector('[data-slot="3"]'),
    ];

    const setStatus = (t) => { if (elStatus) elStatus.textContent = t; };

    function setImg(slotEl, url) {
      if (!slotEl || !url) return;
      slotEl.innerHTML = `
        <img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;display:block;" />
      `;
    }

    // AIVO_JOBS.upsert hook: social job'ları yakala (cover’daki gibi)
    const originalUpsert = window.AIVO_JOBS && window.AIVO_JOBS.upsert;
    if (originalUpsert && !window.__AIVO_SOCIAL_UPSERT_HOOKED__) {
      window.__AIVO_SOCIAL_UPSERT_HOOKED__ = true;

      window.AIVO_JOBS.upsert = function (job) {
        try { originalUpsert.call(this, job); } catch {}

        try {
          if (!job) return;

          // request id (Fal)
          const rid =
            safeStr(job.request_id) ||
            safeStr(job.requestId) ||
            safeStr(job.fal_request_id) ||
            safeStr(job.provider_request_id);

          if (!rid || rid === "TEST") return;

          // social filtre
          const key = low(job.routeKey || job.app || job.module || job.type || job.kind || "");
          if (!key.includes("social")) return;

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
        return;
      }

      const rid = safeStr(current.request_id);
      if (!rid || rid === "TEST") return;

      setStatus("İşleniyor…");

      let data;
      try {
        const r = await fetch(STATUS_URL(rid), { credentials: "include" });
        data = await r.json();
      } catch {
        setStatus("Bağlantı sorunu");
        return;
      }

      const st = low(data?.status || data?.state || data?.result?.status);

      if (st.includes("fail") || st === "error") {
        setStatus("Hata");
        return;
      }

      if (st.includes("complete") || st.includes("success") || st === "succeeded") {
        const urls = pickImages(data);
        if (!urls.length) {
          setStatus("Tamamlandı (image yok)");
          return;
        }

        setStatus("Tamamlandı");

        // Slotlara 4 tane bas
        for (let i = 0; i < 4; i++) {
          if (urls[i]) setImg(slots[i], urls[i]);
        }

        // PPE.apply ile global outputs’a bas (slot index meta ile)
        try {
          if (window.PPE && typeof window.PPE.apply === "function") {
            window.PPE.apply({
              outputs: urls.slice(0, 4).map((url, index) => ({
                type: "image",
                url,
                src: url,
                index,
                meta: { app: "social" },
              })),
              meta: { app: "social", request_id: rid },
            });
          }
        } catch {}

        return;
      }

      // processing
      setStatus("İşleniyor…");
    }

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

  // RightPanel API: object { mount, destroy } (senin manager böyle istiyor)
  window.RightPanel.register("social", {
    mount(host) {
      const panel = createSocialPanel(host);
      host.__SOCIAL_PANEL__ = panel;
    },
    destroy(host) {
      try { host.__SOCIAL_PANEL__ && host.__SOCIAL_PANEL__.destroy(); } catch {}
      host.__SOCIAL_PANEL__ = null;
    }
  });
})();
