// /js/panel.atmo.js
// DB source-of-truth + optimistic atmosphere video cards
// - job_created gelince kart anında görünür
// - onChange DB item'ları ile merge edilir
// - ready olunca kart yerinde güncellenir
// - fresh kartta final/full önceliklidir
// - DB kartında preview öne geçebilir
// - create/poll/provider parse/PPE burada YOK

(function () {
  if (!window.RightPanel) return;
  if (!window.DBJobs) {
    console.warn("[ATMO PANEL] DBJobs yok. panel.dbjobs.js yüklenmeli.");
    return;
  }

  const APP_KEY = "atmo";
  const MAX_ITEMS = 30;

  const norm = (s) =>
    String(s || "")
      .trim()
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/\s+/g, " ");

  const safeStr = (v) => String(v == null ? "" : v).trim();

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
    return a === "atmo" || a.includes("atmo") || a.includes("atmos");
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

  const isJobAtmo = (job) => isAtmoApp(getJobApp(job));

  function getRequestId(it) {
    return safeStr(
      it?.request_id ||
        it?.requestId ||
        it?.fal_request_id ||
        it?.provider_request_id ||
        it?.meta?.request_id ||
        it?.meta?.requestId ||
        it?.meta?.fal_request_id ||
        it?.meta?.provider_request_id
    );
  }

  function panelKeyOf(it) {
    const explicit = safeStr(it?.panel_key);
    if (explicit) return explicit;

    const jobId = safeStr(it?.job_id || it?.id);
    if (jobId) return `job:${jobId}`;

    const rid = getRequestId(it);
    if (rid) return `req:${rid}`;

    return "";
  }

  function idOf(it) {
    return panelKeyOf(it);
  }

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

  function pickOutputUrl(o) {
    return safeStr(
      o?.archive_url ||
        o?.archiveUrl ||
        o?.url ||
        o?.video_url ||
        o?.videoUrl ||
        o?.raw_url ||
        o?.rawUrl ||
        o?.src ||
        o?.meta?.archive_url ||
        o?.meta?.archiveUrl ||
        o?.meta?.url ||
        o?.meta?.video_url ||
        o?.meta?.videoUrl ||
        ""
    );
  }

  function isVideoOutput(o) {
    return norm(
      o?.type || o?.kind || o?.meta?.type || o?.meta?.kind
    ) === "video";
  }

  function outputVariant(o) {
    return String(o?.meta?.variant || "").toLowerCase().trim();
  }

  function bestVideoFromJob(job) {
    const meta = job?.meta || {};
    const outs = Array.isArray(job?.outputs) ? job.outputs : [];

    const directFinal =
      safeStr(job?.final) ||
      safeStr(job?.final_url) ||
      safeStr(job?.final_video_url) ||
      safeStr(meta?.final) ||
      safeStr(meta?.final_url) ||
      safeStr(meta?.final_video_url);

    if (directFinal) return toMaybeProxyUrl(directFinal);

    const directLogo =
      safeStr(job?.logo) ||
      safeStr(job?.logo_url) ||
      safeStr(job?.logo_overlay_url) ||
      safeStr(meta?.logo) ||
      safeStr(meta?.logo_url) ||
      safeStr(meta?.logo_overlay_url);

    if (directLogo) return toMaybeProxyUrl(directLogo);

    const directMux =
      safeStr(job?.mux) ||
      safeStr(job?.mux_url) ||
      safeStr(job?.muxed_url) ||
      safeStr(meta?.mux) ||
      safeStr(meta?.mux_url) ||
      safeStr(meta?.muxed_url);

    if (directMux) return toMaybeProxyUrl(directMux);

    const fin = outs.find((o) => isVideoOutput(o) && o?.meta?.is_final === true);
    if (fin) {
      const u = pickOutputUrl(fin);
      if (u) return toMaybeProxyUrl(u);
    }

    const ov = outs.find(
      (o) => isVideoOutput(o) && outputVariant(o) === "logo_overlay"
    );
    if (ov) {
      const u = pickOutputUrl(ov);
      if (u) return toMaybeProxyUrl(u);
    }

    const mx = outs.find((o) => isVideoOutput(o) && outputVariant(o) === "mux");
    if (mx) {
      const u = pickOutputUrl(mx);
      if (u) return toMaybeProxyUrl(u);
    }

    const pv = outs.find(
      (o) => isVideoOutput(o) && outputVariant(o) === "provider"
    );
    if (pv) {
      const u = pickOutputUrl(pv);
      if (u) return toMaybeProxyUrl(u);
    }

    const vid = outs.find((o) => isVideoOutput(o)) || outs[0];
    return toMaybeProxyUrl(pickOutputUrl(vid));
  }

  function previewVideoFromJob(job) {
    const meta = job?.meta || {};
    const outs = Array.isArray(job?.outputs) ? job.outputs : [];

    const directPreview =
      safeStr(job?.preview) ||
      safeStr(job?.preview_url) ||
      safeStr(job?.preview_video_url) ||
      safeStr(meta?.preview) ||
      safeStr(meta?.preview_url) ||
      safeStr(meta?.preview_video_url);

    if (directPreview) return toMaybeProxyUrl(directPreview);

    const prev = outs.find(
      (o) => isVideoOutput(o) && outputVariant(o) === "preview"
    );
    if (prev) {
      const u = pickOutputUrl(prev);
      if (u) return toMaybeProxyUrl(u);
    }

    return "";
  }

  function directFinalVideoFromJob(job) {
    return safeStr(
      job?.final_url ||
        job?.final_video_url ||
        job?.meta?.final_url ||
        job?.meta?.final_video_url ||
        bestVideoFromJob(job) ||
        ""
    );
  }

  function directPreviewVideoFromJob(job) {
    return safeStr(
      job?.preview_url ||
        job?.preview_video_url ||
        job?.meta?.preview_url ||
        job?.meta?.preview_video_url ||
        previewVideoFromJob(job) ||
        ""
    );
  }

  function acceptAtmoOutput(o) {
    if (!o) return false;

    const t = norm(o?.type || o?.kind || o?.meta?.type || o?.meta?.kind);
    if (t && t !== "video") return false;

    const oa = getOutApp(o);
    if (oa && !isAtmoApp(oa)) return false;

    return true;
  }

  function mapBadge(job) {
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
  }

  function ensureStyles() {
    if (document.getElementById("atmoPanelStyles")) return;

    const css = `
      .atmoPanelWrap{display:flex;flex-direction:column;gap:12px;}
      .atmoPanelGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}
      .atmoPanelCard{position:relative;border-radius:18px;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.07);overflow:hidden;}
      .atmoPanelThumb{position:relative;border-radius:16px;overflow:hidden;margin:10px;background:#000;border:1px solid rgba(255,255,255,0.08);}
      .atmoPanelThumb:before{content:"";display:block;padding-top:56.25%;}
      .atmoPanelThumb.isPortrait:before{padding-top:140%;}
      .atmoPanelVideo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#000;}
      .atmoPanelPill{position:absolute;left:14px;top:14px;z-index:3;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:800;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,0.10);backdrop-filter:blur(10px);}
      .atmoPanelPill.ok{border-color:rgba(120,255,190,.22);}
      .atmoPanelPill.mid{border-color:rgba(255,255,255,.10);}
      .atmoPanelPill.bad{border-color:rgba(255,120,120,.25);}
      .atmoPanelSkel{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:radial-gradient(80% 80% at 50% 40%, rgba(175,120,255,.18), rgba(0,0,0,.70));overflow:hidden;}
      .atmoPanelSkel:before{content:"";position:absolute;inset:-40%;background:linear-gradient(90deg,rgba(255,255,255,0.00),rgba(220,170,255,0.14),rgba(255,255,255,0.00));transform:rotate(18deg);animation:atmoPanelShimmer 1.4s linear infinite;}
      @keyframes atmoPanelShimmer{0%{transform:translateX(-30%) rotate(18deg);}100%{transform:translateX(30%) rotate(18deg);}}
      .atmoPanelSkelLabel{position:relative;z-index:2;font-size:12px;font-weight:800;padding:8px 12px;border-radius:999px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.10);}
      .atmoPanelFooter{padding:10px 12px 12px 12px;display:flex;flex-direction:column;gap:8px;}
      .atmoPanelMetaLine{font-size:12px;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
      .atmoPanelActions{display:flex;gap:8px;padding:10px;border-radius:14px;background:rgba(0,0,0,.20);border:1px solid rgba(255,255,255,0.06);}
      .atmoPanelBtn{flex:1;height:38px;border-radius:12px;border:1px solid rgba(255,255,255,0.10);background:rgba(255,255,255,0.04);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;}
      .atmoPanelBtn[disabled]{opacity:.45;cursor:not-allowed;}
      .atmoPanelBtn.danger{border-color:rgba(255,120,120,0.20);background:rgba(255,120,120,0.08);}
      @media (max-width: 980px){.atmoPanelGrid{grid-template-columns:1fr;}}
    `;

    const style = document.createElement("style");
    style.id = "atmoPanelStyles";
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createAtmoPanel(host) {
    ensureStyles();

    let destroyed = false;
    let currentDbItems = [];

    const optimistic = new Map();
    const hiddenDeletedIds = new Set();
    const cardCache =
      window.__ATMO_CARD_CACHE__ ||
      (window.__ATMO_CARD_CACHE__ = new Map());

    host.innerHTML = `
      <div class="atmoPanelWrap">
        <div class="atmoPanelGrid" data-grid></div>
      </div>
    `;

    const elGrid = host.querySelector("[data-grid]");
    const elStatus = null;

   const setStatus = (_t) => {};

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

    const isReadyState = (job) => {
      const st = norm(job?.db_status || job?.status || job?.state);
      return (
        st.includes("ready") ||
        st.includes("done") ||
        st.includes("complet") ||
        st.includes("succ")
      );
    };

    const isErrorState = (job) => {
      const st = norm(job?.db_status || job?.status || job?.state);
      return st.includes("error") || st.includes("fail");
    };

    const isTerminalState = (job) => isReadyState(job) || isErrorState(job);

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

    function getMatchMeta(job) {
      const panelKey = panelKeyOf(job);
      const jobId = safeStr(job?.job_id || job?.id);
      const rid = getRequestId(job);
      return { panelKey, jobId, rid };
    }

    function sameJob(a, b) {
      const aa = getMatchMeta(a);
      const bb = getMatchMeta(b);

      if (aa.panelKey && bb.panelKey && aa.panelKey === bb.panelKey) return true;
      if (aa.jobId && bb.jobId && aa.jobId === bb.jobId) return true;
      if (aa.rid && bb.rid && aa.rid === bb.rid) return true;

      return false;
    }

    function isFreshDoneEphemeral(job) {
      return !!job && job._fresh === true && isReadyState(job);
    }

    function tsOf(j) {
      return (
        toMs(j?.updated_at) ||
        toMs(j?.created_at) ||
        toMs(j?.createdAt) ||
        0
      );
    }

    function isPortrait(job, out) {
      const ar = String(
        job?.meta?.aspect_ratio ||
          job?.meta?.ratio ||
          out?.meta?.aspect_ratio ||
          out?.meta?.ratio ||
          ""
      );
      return ar.includes("9:16") || ar.includes("4:5") || ar.includes("2:3");
    }

    function renderCard(job) {
      const jid = idOf(job);
      const badge = mapBadge(job);

      const finalUrl = directFinalVideoFromJob(job);
      const previewUrl = directPreviewVideoFromJob(job);
      const isFreshCard = job?._fresh === true;

      const selectedPlaybackRawUrl = isFreshCard
        ? finalUrl || previewUrl
        : previewUrl || finalUrl;

      const ready = badge.kind === "ok" && !!selectedPlaybackRawUrl;
      const previewVideoUrl = ready
        ? selectedPlaybackRawUrl.includes("#")
          ? selectedPlaybackRawUrl
          : selectedPlaybackRawUrl + "#t=0.001"
        : "";

      const out = { meta: { aspect_ratio: job?.meta?.aspect_ratio || "" } };
      const ratio = isPortrait(job, out) ? "9:16" : "16:9";

      const title = safeStr(job?.prompt || job?.meta?.prompt || "Atmosfer Video");
      const sub = (() => {
        const engine = safeStr(job?.provider || job?.meta?.provider || "Atmos");
        const dt = formatTs(
          job?.created_at || job?.updated_at || job?.createdAt || Date.now()
        );
        return dt ? `${engine} • ${dt}` : engine;
      })();

      const badgeText = badge.text;
      const badgeKind =
        badge.kind === "ok"
          ? "ready"
          : badge.kind === "bad"
            ? "error"
            : "loading";

      if (window.AIVO_SHARED_VIDEO_CARD?.createCardHtml) {
        return window.AIVO_SHARED_VIDEO_CARD.createCardHtml({
          id: jid,
          title: title || "—",
          sub,
          badgeText,
          badgeKind,
          videoUrl: previewVideoUrl,
          posterUrl: "",
          ratio,
          ready,
          canDownload: !!finalUrl,
          canShare: ready,
          canDelete: true,
        });
      }

      return "";
    }

    function ensureCardEl(job) {
      const id = idOf(job);
      if (!id) return null;

      let el = cardCache.get(id);
      if (el && el.isConnected) return el;

      el = document.createElement("div");
      el.className = "atmoPanelCard";
      el.setAttribute("data-job", id);

      el.innerHTML = `
        <div class="atmoPanelThumb">
          <div class="atmoPanelPill mid">İşleniyor</div>
          <div class="atmoPanelSkel"><div class="atmoPanelSkelLabel">Hazırlanıyor…</div></div>
        </div>
        <div class="atmoPanelFooter">
          <div class="atmoPanelMetaLine"></div>
          <div class="atmoPanelActions">
            <button class="atmoPanelBtn" type="button" data-act="download" data-job="${esc(id)}" disabled>İndir</button>
            <button class="atmoPanelBtn" type="button" data-act="share" data-job="${esc(id)}" disabled>Paylaş</button>
            <button class="atmoPanelBtn danger" type="button" data-act="delete" data-job="${esc(id)}">Sil</button>
          </div>
        </div>
      `;

      cardCache.set(id, el);
      return el;
    }

    function patchCard(el, job) {
      if (!el || !job) return;

      const html = renderCard(job);
      if (!html) return;

      const nextId = idOf(job);
      if (nextId) {
        el.setAttribute("data-job", nextId);
      }

      if (el.__renderedHtml !== html) {
        el.innerHTML = html;
        el.__renderedHtml = html;
      }
    }

    function upsertEphemeralProcessing(payload = {}) {
      const job_id = safeStr(payload.job_id);
      const request_id =
        safeStr(payload.request_id) ||
        safeStr(payload.requestId) ||
        safeStr(payload.fal_request_id) ||
        safeStr(payload.provider_request_id);

      if (!job_id && !request_id) return;

      const panel_key = job_id ? `job:${job_id}` : `req:${request_id}`;
      if (job_id && hiddenDeletedIds.has(panel_key)) return;
      if (request_id && hiddenDeletedIds.has(panel_key)) return;

      const prompt = safeStr(payload.prompt || payload?.meta?.prompt);
      const provider = safeStr(
        payload.provider || payload?.meta?.provider || "Atmos"
      );
      const aspect_ratio = safeStr(
        payload?.meta?.aspect_ratio ||
          payload?.aspect_ratio ||
          payload?.meta?.ratio ||
          ""
      );

      const nextItem = {
        panel_key,
        job_id,
        request_id,
        app: APP_KEY,
        provider,
        prompt,
        createdAt: payload?.createdAt || payload?.created_at || Date.now(),
        created_at: payload?.createdAt || payload?.created_at || Date.now(),
        db_status: "processing",
        status: "processing",
        state: "PROCESSING",
        _fresh: false,
        final_url: "",
        preview_url: "",
        meta: {
          ...(payload?.meta || {}),
          app: APP_KEY,
          provider,
          request_id,
          aspect_ratio,
          prompt,
        },
        outputs: [],
      };

      optimistic.set(panel_key, nextItem);
      renderCurrent();
    }

    function upsertEphemeralReady(detail = {}) {
      const job_id = safeStr(detail?.job_id);
      const request_id =
        safeStr(detail?.request_id) ||
        safeStr(detail?.fal_request_id) ||
        safeStr(detail?.meta?.request_id);

      const incoming = {
        panel_key: job_id ? `job:${job_id}` : request_id ? `req:${request_id}` : "",
        job_id,
        request_id,
        meta: detail?.meta || {},
      };

      const existingDb = currentDbItems.find((j) => sameJob(j, incoming));

      const outputs = Array.isArray(detail?.outputs) ? detail.outputs : [];
      const rawOutputs = Array.isArray(detail?.raw?.outputs) ? detail.raw.outputs : [];

      const finalUrl = safeStr(
        detail?.video?.url ||
          detail?.url ||
          bestVideoFromJob({ outputs }) ||
          bestVideoFromJob({ outputs: rawOutputs }) ||
          ""
      );

      const previewUrl = safeStr(
        previewVideoFromJob({ outputs }) ||
          previewVideoFromJob({ outputs: rawOutputs }) ||
          ""
      );

      const mergedOutputs = outputs.length
        ? outputs
        : rawOutputs.length
          ? rawOutputs
          : finalUrl
            ? [
                {
                  type: "video",
                  url: finalUrl,
                  meta: { app: APP_KEY, is_final: true },
                },
              ]
            : [];

      if (existingDb) {
        existingDb.panel_key = panelKeyOf(existingDb) || incoming.panel_key;
        existingDb.db_status = "ready";
        existingDb.status = "ready";
        existingDb.state = "COMPLETED";
        existingDb._fresh = true;

        if (mergedOutputs.length) {
          existingDb.outputs = mergedOutputs;
        }

        if (previewUrl) {
          existingDb.preview_url = previewUrl;
        }

        if (finalUrl) {
          existingDb.final_url = finalUrl;
        }

        for (const [k, v] of optimistic.entries()) {
          if (sameJob(v, existingDb)) {
            optimistic.delete(k);
          }
        }

        renderCurrent();
        return;
      }

      let optimisticEntry = null;
      let optimisticKey = "";

      for (const [k, v] of optimistic.entries()) {
        if (sameJob(v, incoming)) {
          optimisticEntry = v;
          optimisticKey = k;
          break;
        }
      }

      if (!optimisticEntry) return;

      const nextPanelKey = job_id ? `job:${job_id}` : optimisticKey || panelKeyOf(optimisticEntry);

      const nextItem = {
        ...optimisticEntry,
        panel_key: nextPanelKey,
        job_id: job_id || optimisticEntry.job_id || "",
        request_id: request_id || optimisticEntry.request_id || getRequestId(optimisticEntry) || "",
        db_status: "ready",
        status: "ready",
        state: "COMPLETED",
        _fresh: true,
        final_url: finalUrl || optimisticEntry.final_url || "",
        preview_url: previewUrl || optimisticEntry.preview_url || "",
        outputs: mergedOutputs.length ? mergedOutputs : optimisticEntry.outputs || [],
        meta: {
          ...(optimisticEntry.meta || {}),
          ...(detail?.meta || {}),
          app: APP_KEY,
          request_id:
            request_id ||
            optimisticEntry?.request_id ||
            optimisticEntry?.meta?.request_id ||
            "",
          prompt: safeStr(
            detail?.meta?.prompt ||
              optimisticEntry?.meta?.prompt ||
              optimisticEntry?.prompt ||
              ""
          ),
        },
      };

      if (optimisticKey && optimisticKey !== nextPanelKey) {
        optimistic.delete(optimisticKey);
      }

      optimistic.set(nextPanelKey, nextItem);
      renderCurrent();
    }

    function cleanupEphemeralsAgainstDb() {
      const dbItems = Array.isArray(currentDbItems) ? currentDbItems : [];
      const eps = Array.from(optimistic.values());

      if (!dbItems.length || !eps.length) return;

      for (const ep of eps) {
        const dbMatch = dbItems.find((db) => sameJob(ep, db));
        if (!dbMatch) continue;

        if (isFreshDoneEphemeral(ep)) continue;
        if (isTerminalState(dbMatch)) {
          optimistic.delete(idOf(ep));
        }
      }
    }

    function combinedItems() {
      const dbItems = (Array.isArray(currentDbItems) ? currentDbItems : []).filter(
        (x) => {
          const key = idOf(x);
          if (key && hiddenDeletedIds.has(key)) return false;
          return true;
        }
      );

      const eps = Array.from(optimistic.values()).filter((x) => {
        const key = idOf(x);
        if (key && hiddenDeletedIds.has(key)) return false;
        return true;
      });

      const picked = [];
      const usedDbIndexes = new Set();

      for (const ep of eps) {
        const dbIndex = dbItems.findIndex((db) => sameJob(ep, db));
        const dbMatch = dbIndex >= 0 ? dbItems[dbIndex] : null;

        if (!dbMatch) {
          picked.push(ep);
          continue;
        }

        if (isFreshDoneEphemeral(ep)) {
          picked.push(ep);
          usedDbIndexes.add(dbIndex);
          continue;
        }

        if (isTerminalState(dbMatch)) {
          picked.push({
            ...dbMatch,
            panel_key: panelKeyOf(dbMatch) || panelKeyOf(ep),
          });
          usedDbIndexes.add(dbIndex);
          continue;
        }

        picked.push(ep);
        usedDbIndexes.add(dbIndex);
      }

      dbItems.forEach((db, idx) => {
        if (!usedDbIndexes.has(idx)) picked.push(db);
      });

      return picked
        .sort((a, b) => {
          const ap = !isTerminalState(a) ? 0 : isReadyState(a) ? 1 : 2;
          const bp = !isTerminalState(b) ? 0 : isReadyState(b) ? 1 : 2;
          if (ap !== bp) return ap - bp;
          return tsOf(b) - tsOf(a);
        })
        .slice(0, MAX_ITEMS);
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
          emptyEl.textContent = "Henüz atmosfer video yok.";
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
      cleanupEphemeralsAgainstDb();
      render(combinedItems());
    }

    function download(url, filename = "atmo.mp4") {
      const cleanUrl = String(url || "").trim();
      if (!cleanUrl) return;

      const directUrl = cleanUrl.includes("#")
        ? cleanUrl.split("#")[0]
        : cleanUrl;

      const proxied = directUrl.startsWith("/api/media/proxy?url=")
        ? directUrl
        : `/api/media/proxy?url=${encodeURIComponent(directUrl)}&filename=${encodeURIComponent(filename)}`;

      const a = document.createElement("a");
      a.href = proxied;
      a.download = filename;
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

    async function handleAction(cardEl, act) {
      const panelId = safeStr(
        cardEl?.getAttribute("data-job") || cardEl?.dataset?.svcId || ""
      );

      if (!act || !panelId) return;

      const allItems = [...currentDbItems, ...Array.from(optimistic.values())];
      const job = allItems.find((x) => idOf(x) === panelId);
      if (!job) return;

      if (act === "play") {
        const video = cardEl?.querySelector("video.svcVideo, video");
        if (!video) return;

        if (video.paused) video.play().catch(() => {});
        else video.pause();

        return;
      }

      if (act === "fs") {
        const video = cardEl?.querySelector("video.svcVideo, video");
        if (!video) return;

        try {
          if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {});
            return;
          }
          if (video.requestFullscreen) {
            await video.requestFullscreen().catch(() => {});
          }
        } catch {}
        return;
      }

      const finalUrl = directFinalVideoFromJob(job);
      const previewUrl = directPreviewVideoFromJob(job);
      const directUrl = finalUrl || previewUrl;

      if (act === "open") {
        if (!directUrl) return;
        window.open(
          directUrl.includes("#") ? directUrl.split("#")[0] : directUrl,
          "_blank",
          "noopener"
        );
        return;
      }

      if (act === "download") {
        if (!directUrl) return;
        download(directUrl, `atmo-${safeStr(job?.job_id) || "video"}.mp4`);
        return;
      }

      if (act === "share") {
        if (!directUrl) return;
        share(directUrl);
        return;
      }

      if (act === "delete") {
        try {
          hiddenDeletedIds.add(panelId);
          optimistic.delete(panelId);
          currentDbItems = currentDbItems.filter((x) => idOf(x) !== panelId);

          renderCurrent();

          const realJobId = safeStr(job?.job_id || job?.id);
          if (!realJobId) {
            hiddenDeletedIds.delete(panelId);
            renderCurrent();
            return;
          }

          const ok = await controller.deleteJob(realJobId);
          if (!ok) {
            hiddenDeletedIds.delete(panelId);
            try {
              await controller?.hydrate?.(true);
            } catch {}
            console.error("[ATMO PANEL] delete failed");
            return;
          }

          try {
            await controller?.hydrate?.(true);
          } catch {}
        } catch (err) {
          hiddenDeletedIds.delete(panelId);
          try {
            await controller?.hydrate?.(true);
          } catch {}
          console.error("[ATMO PANEL] delete failed", err);
        }
      }
    }

    host.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-svc-act], [data-act]");
      if (!btn) return;

      const act = btn.dataset.svcAct || btn.dataset.act;
      const card = btn.closest(".svcCard, .atmoPanelCard");
      if (!card || !act) return;

      if (btn.hasAttribute("disabled")) return;

      e.preventDefault();
      e.stopPropagation();

      await handleAction(card, act);
    });

    const controller = window.DBJobs.create({
      app: APP_KEY,
      debug: false,
      pollIntervalMs: 4000,
      hydrateEveryMs: 15000,

      acceptJob: (job) => {
        if (!job) return false;
        const ja = getJobApp(job);
        if (ja && !isAtmoApp(ja)) return false;
        return true;
      },

      acceptOutput: acceptAtmoOutput,

      onChange: async (items) => {
        if (destroyed) return;

        currentDbItems = (items || [])
          .filter(isJobAtmo)
          .map((j) => ({
            ...j,
            panel_key: panelKeyOf(j),
          }))
          .filter((j) => {
            const key = idOf(j);
            return key && !hiddenDeletedIds.has(key);
          });

        renderCurrent();
      },
    });

    const onJobCreated = (e) => {
      const d = e?.detail || {};
      if (!d) return;

      const appKey = safeStr(
        d?.app || d?.meta?.app || d?.meta?.module || d?.meta?.routeKey || APP_KEY
      ).toLowerCase();

      if (!isAtmoApp(appKey)) return;

      upsertEphemeralProcessing({
        job_id: d?.job_id,
        request_id: d?.request_id || d?.requestId || d?.meta?.request_id,
        prompt: d?.prompt || d?.meta?.prompt,
        provider: d?.provider || d?.meta?.provider || "Atmos",
        createdAt: d?.createdAt || Date.now(),
        meta: d?.meta || {},
      });
    };

    const onJobReady = (e) => {
      const d = e?.detail || {};
      if (!d) return;

      const appKey = safeStr(
        d?.app || d?.meta?.app || d?.meta?.module || d?.meta?.routeKey || APP_KEY
      ).toLowerCase();

      if (!isAtmoApp(appKey)) return;

      upsertEphemeralReady(d);
    };

    controller.start();
    window.addEventListener("aivo:atmo:job_created", onJobCreated);
    window.addEventListener("aivo:atmo:job_ready", onJobReady);

    return {
      destroy() {
        destroyed = true;
        try {
          window.removeEventListener("aivo:atmo:job_created", onJobCreated);
        } catch {}
        try {
          window.removeEventListener("aivo:atmo:job_ready", onJobReady);
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
    console.log("[PANEL.ATMO] register run");
    if (typeof window.RightPanel.register === "function") {
      window.RightPanel.register(APP_KEY, {
        header: {
          title: "Atmosfer Video",
          meta: "Hazır",
          searchEnabled: false,
          resetSearch: true,
        },

        mount(host) {
          const api = createAtmoPanel(host);
          return () => {
            try {
              api?.destroy?.();
            } catch {}
          };
        },
      });
    } else {
      console.warn("[ATMO PANEL] RightPanel.register yok.");
    }
  } catch (e) {
    console.warn("[ATMO PANEL] register failed", e);
  }
})();
