// /js/panel.atmo.js
(function () {
  if (!window.RightPanel) return;

  const APP_KEY = "atmo";

  const safeStr = (v) => String(v == null ? "" : v).trim();
  const esc = (s) =>
    safeStr(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  // FAL atmo video status endpoint (app param şart)
  const STATUS_URL = (rid) =>
    `/api/providers/fal/video/status?request_id=${encodeURIComponent(rid)}&app=${APP_KEY}`;

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

  function formatTs(ts) {
    try {
      const d = new Date(ts);
      if (Number.isNaN(+d)) return "";
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${dd}.${mm}.${yy} ${hh}:${mi}`;
    } catch {
      return "";
    }
  }

  function bestVideoFromJob(job) {
    const outs = Array.isArray(job?.outputs) ? job.outputs : [];
    const vid = outs.find((o) => (o?.type || "").toLowerCase() === "video") || outs[0];
    return vid?.archive_url || vid?.url || vid?.raw_url || "";
  }

  function acceptAtmoOutput(o) {
    if (!o) return false;
    const t = String(o.type || "").toLowerCase();
    if (t && t !== "video") return false;

    const app =
      String(o?.meta?.app || o?.meta?.module || o?.meta?.routeKey || "")
        .toLowerCase()
        .trim();

    if (!app) return true;
    return app.includes("atmo");
  }

  function ensureStyles() {
    if (document.getElementById("atmoMiniPanelStyles")) return;

    const css = `
      .atmoWrap{display:flex;flex-direction:column;gap:12px;}
      .atmoGrid{
        display:grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap:12px;
      }
      @media (max-width: 980px){ .atmoGrid{grid-template-columns:1fr;} }

      .atmoEmpty{opacity:.7;font-size:12px;padding:4px 2px;}

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
      .atmoThumb:before{content:"";display:block;padding-top:56.25%;} /* 16:9 */
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
      .atmoPromptLine{
        font-size:12px;opacity:.7;
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
    `;

    const style = document.createElement("style");
    style.id = "atmoMiniPanelStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function badgeFor(job) {
    const st = String(job?.status || job?.state || "").toUpperCase();
    if (st.includes("FAIL") || st.includes("ERROR")) return { text: "Hata", kind: "bad" };
    if (st.includes("READY") || st.includes("DONE") || st.includes("COMPLET") || st.includes("SUCC")) return { text: "Hazır", kind: "ok" };
    if (st.includes("RUN") || st.includes("PROC") || st.includes("PEND") || st.includes("QUEUE")) return { text: "İşleniyor", kind: "mid" };
    return { text: st || "Hazır", kind: "mid" };
  }

  function createAtmosPanel(host) {
    ensureStyles();

    let destroyed = false;
    let timer = null;

    const state = {
      items: [],
      // FAL tamamlandı ama DB’ye henüz düşmediyse geçici gösterelim
      ephemerals: [], // { job_id, url, status, created_at, prompt, meta }
    };

    host.innerHTML = `
      <div class="atmoWrap">
        <div class="atmoGrid" data-el="grid"></div>
      </div>
    `;

    const $grid = host.querySelector('[data-el="grid"]');

    const setHeaderMeta = (t) => {
      try {
        if (window.RightPanel && typeof window.RightPanel.setHeader === "function") {
          window.RightPanel.setHeader({ meta: String(t || "") });
        }
      } catch {}
    };

    function isPortrait(job, out) {
      const ar = String(job?.meta?.aspect_ratio || job?.meta?.ratio || out?.meta?.aspect_ratio || "");
      return ar.includes("9:16") || ar.includes("4:5") || ar.includes("2:3");
    }

    function combinedItems() {
      // DB items + ephemerals (DB’de zaten varsa eklemeyelim)
      const dbItems = Array.isArray(state.items) ? state.items : [];
      const have = new Set(dbItems.map((x) => String(x.job_id || "")));
      const eps = (state.ephemerals || []).filter((e) => e && !have.has(String(e.job_id || "")));
      return [...eps, ...dbItems];
    }

    function render() {
      if (destroyed || !$grid) return;

      const items = combinedItems();

      const hasProcessing = items.some((j) => {
        const st = String(j.status || "").toUpperCase();
        return st.includes("PROC") || st.includes("RUN") || st.includes("PEND") || st.includes("QUEUE");
      });
      setHeaderMeta(hasProcessing ? "İşleniyor…" : "Hazır");

      if (!items.length) {
        $grid.innerHTML = `<div class="atmoEmpty">Henüz atmos üretim yok.</div>`;
        return;
      }

      $grid.innerHTML = items.slice(0, 30).map((job) => {
        const badge = badgeFor(job);

        // ephemeral ise: job.url var; db ise: outputs’tan çek
        const outUrl = safeStr(job.url) || bestVideoFromJob(job);
        const hasUrl = !!outUrl;

        const dt = formatTs(job?.created_at || job?.updated_at || Date.now());
        const engine = safeStr(job?.provider || job?.meta?.provider || "Atmos");
        const metaLine = `${engine}${dt ? " • " + dt : ""}`;
        const promptLine = safeStr(job?.prompt || "");

        // kart içi video clamp
        const dummyOut = { meta: { aspect_ratio: job?.meta?.aspect_ratio || "" } };
        const portrait = isPortrait(job, dummyOut);

        const thumbInner = hasUrl
          ? `<video class="atmoThumbVideo" playsinline preload="metadata" controls src="${esc(outUrl)}"></video>`
          : `<div class="atmoThumbPlaceholder">Henüz hazır değil</div>`;

        const disabled = hasUrl ? "" : "disabled";

        return `
          <div class="atmoCard" data-job="${esc(job.job_id || "")}" data-url="${esc(outUrl)}">
            <div class="atmoThumb ${portrait ? "isPortrait" : ""}">
              <div class="atmoPill ${badge.kind}">${esc(badge.text)}</div>
              ${thumbInner}
            </div>

            <div class="atmoFooter">
              <div class="atmoMetaLine">${esc(metaLine)}</div>
              <div class="atmoPromptLine">${esc(promptLine || "—")}</div>

              <div class="atmoActions">
                <button class="atmoIconBtn" type="button" data-act="download" ${disabled}>İndir</button>
                <button class="atmoIconBtn" type="button" data-act="share" ${disabled}>Paylaş</button>
                <button class="atmoIconBtn danger" type="button" data-act="delete">Sil</button>
              </div>
            </div>
          </div>
        `;
      }).join("");
    }

    async function handleAction(cardEl, act) {
      const jobId = safeStr(cardEl?.getAttribute("data-job"));
      const url = safeStr(cardEl?.getAttribute("data-url"));

      if (act === "download") {
        if (!url) return;
        const a = document.createElement("a");
        a.href = url;
        a.download = `atmo-${jobId || "video"}.mp4`;
        a.rel = "noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }

      if (act === "share") {
        if (!url) return;
        try {
          if (navigator.share) await navigator.share({ title: "Atmosfer Video", url });
          else await navigator.clipboard.writeText(url);
        } catch {}
        return;
      }

      if (act === "delete") {
        if (!jobId) return;

        // önce ephemerals’tan sil
        state.ephemerals = (state.ephemerals || []).filter((x) => safeStr(x?.job_id) !== jobId);

        // DB varsa DBJobs delete dene
        if (db && typeof db.deleteJob === "function") {
          const ok = await db.deleteJob(jobId);
          if (!ok) db.hydrate(true);
        } else {
          state.items = (state.items || []).filter((x) => safeStr(x?.job_id) !== jobId);
        }

        render();
        return;
      }
    }

    $grid?.addEventListener("click", (e) => {
      const btn = e.target?.closest?.("[data-act]");
      if (!btn) return;
      const act = btn.getAttribute("data-act");
      const card = btn.closest(".atmoCard");
      if (!act || !card) return;
      if (btn.hasAttribute("disabled")) return;
      handleAction(card, act);
    });

    // --- DB controller ---
    const db = (window.DBJobs && typeof window.DBJobs.create === "function")
      ? window.DBJobs.create({
          app: APP_KEY,
          debug: false,
          pollIntervalMs: 4000,
          hydrateEveryMs: 15000,
          acceptOutput: acceptAtmoOutput,
          onChange(items) {
            state.items = items || [];
            render();
          }
        })
      : null;

    if (db) db.start();

    // --- AIVO_JOBS.upsert hook: create->poll->PPE + DB hydrate ---
    const originalUpsert = window.AIVO_JOBS && window.AIVO_JOBS.upsert;

    if (originalUpsert && !window.__AIVO_ATMO_UPSERT_HOOKED__) {
      window.__AIVO_ATMO_UPSERT_HOOKED__ = true;

      window.AIVO_JOBS.upsert = function (job) {
        try { originalUpsert.call(this, job); } catch {}

        try {
          if (!job) return;

          const key = (
            safeStr(job.routeKey) ||
            safeStr(job.app) ||
            safeStr(job.module) ||
            safeStr(job.type) ||
            safeStr(job.kind)
          ).toLowerCase();

          if (!key.includes("atmo")) return;

          setHeaderMeta("İşleniyor…");

          const rid =
            safeStr(job.request_id) ||
            safeStr(job.requestId) ||
            safeStr(job.fal_request_id) ||
            safeStr(job.provider_request_id);

          if (!rid || rid === "TEST") return;

          if (timer) clearInterval(timer);
          timer = setInterval(() => pollFalOnce(rid, safeStr(job.prompt || "")), 2000);
          pollFalOnce(rid, safeStr(job.prompt || ""));
        } catch {}
      };
    }

     async function pollFalOnce(rid, promptMaybe) {
      if (destroyed) return;
      rid = safeStr(rid);
      if (!rid) return;

      let data;
      try {
        const r = await fetch(STATUS_URL(rid), { credentials: "include" });
        data = await r.json();
      } catch {
        setHeaderMeta("Bağlantı sorunu");
        return;
      }

      const st = safeStr(data?.status || data?.state || data?.result?.status).toLowerCase();

      if (st.includes("fail") || st === "error") {
        setHeaderMeta("Hata");
        return;
      }

      if (st.includes("complete") || st.includes("success") || st === "succeeded") {
        let url = pickVideoUrl(data);

        // ✅ URL normalize: overlay endpoint absolute URL ister (relative/proxy yüzünden parse fail oluyordu)
        const normalizeVideoUrlForOverlay = (u) => {
          u = safeStr(u);
          if (!u) return "";
          // /api/media/proxy?url=<ENCODED_HTTP_URL> ise gerçek url'i çıkar
          if (u.includes("/api/media/proxy?url=")) {
            try {
              const i = u.indexOf("/api/media/proxy?url=");
              const sub = u.slice(i);
              const qs = sub.split("?")[1] || "";
              const p = new URLSearchParams(qs);
              const inner = p.get("url");
              if (inner) return decodeURIComponent(inner);
            } catch {}
          }
          // relative ise absolute yap
          if (u.startsWith("/")) {
            try { return new URL(u, window.location.origin).toString(); } catch {}
          }
          return u;
        };

        // === AUTO LOGO OVERLAY (FAL complete anında) ===
        try {
          const logoUrl = String(
            window.__ATMO_LOGO_PUBLIC_URL__ ||
            window.__ATMO_STATE__?.logo_public_url ||
            ""
          ).trim();

          const overlayVideoUrl = normalizeVideoUrlForOverlay(url);

          if (logoUrl && logoUrl.startsWith("http") && overlayVideoUrl && overlayVideoUrl.startsWith("http")) {
            const res = await fetch("/api/atmo/overlay-logo", {
              method: "POST",
              headers: { "content-type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                app: "atmo",
                request_id: rid,
                video_url: overlayVideoUrl,
                logo_url: logoUrl,
                logo_pos: "br",
                logo_size: "sm",
                logo_opacity: 0.85
              })
            });

            let j = null;
            try { j = await res.json(); } catch {}

            // ✅ overlay başarıyla döndüyse, bundan sonra her yerde overlay url'i kullan
            if (j?.ok && j?.url) {
              url = j.url;
            }
          }
        } catch (e) {
          console.warn("[ATMO overlay] error:", e);
        }

        if (!url) {
          setHeaderMeta("Tamamlandı (url yok)");
          return;
        }

        setHeaderMeta("Tamamlandı");

        // geçici göster (DB’ye düşene kadar)
        const tempId = `tmp_${rid}`;
        state.ephemerals = [
          {
            job_id: tempId,
            url,
            status: "PROCESSING",
            created_at: Date.now(),
            prompt: promptMaybe || "",
            meta: { app: APP_KEY, request_id: rid, aspect_ratio: safeStr(data?.aspect_ratio || "") }
          },
          ...(state.ephemerals || []).filter((x) => safeStr(x?.job_id) !== tempId),
        ];
        render();

        // PPE bridge
        try {
          if (window.PPE && typeof window.PPE.apply === "function") {
            window.PPE.apply({
              outputs: [{ type: "video", url, src: url, meta: { app: APP_KEY } }],
              meta: { app: APP_KEY, request_id: rid },
            });
          }
        } catch {}

        // DB’den yenile
        try { db && db.hydrate(true); } catch {}

        if (timer) clearInterval(timer);
        timer = null;
        return;
      }

      setHeaderMeta("İşleniyor…");
    }

    setHeaderMeta("Hazır");
    render();

    function destroy() {
      destroyed = true;
      if (timer) clearInterval(timer);
      timer = null;
      try { db && db.destroy(); } catch {}
      host.innerHTML = "";
    }

    return { destroy };
  }

  window.RightPanel.register(APP_KEY, {
    header: {
      title: "Atmosfer Video",
      meta: "Hazır",
      searchEnabled: false, // ✅ üstteki Ara... kalkar (manager destekliyorsa)
      resetSearch: true
    },

    mount(host) {
      const panel = createAtmosPanel(host);
      host.__ATMO_PANEL__ = panel;
    },

    destroy(host) {
      try { host.__ATMO_PANEL__ && host.__ATMO_PANEL__.destroy(); } catch {}
      host.__ATMO_PANEL__ = null;
    },
  });
})();
