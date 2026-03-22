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

  const STATUS_URL = (rid) =>
    `/api/providers/fal/video/status?request_id=${encodeURIComponent(
      rid
    )}&app=${APP_KEY}`;

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

  function pickOutputUrl(o) {
    return safeStr(o?.archive_url || o?.url || o?.raw_url || o?.src || "");
  }

  function isVideoOutput(o) {
    return String(o?.type || "").toLowerCase() === "video";
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

    if (directFinal) return directFinal;

    const directLogo =
      safeStr(job?.logo) ||
      safeStr(job?.logo_url) ||
      safeStr(job?.logo_overlay_url) ||
      safeStr(meta?.logo) ||
      safeStr(meta?.logo_url) ||
      safeStr(meta?.logo_overlay_url);

    if (directLogo) return directLogo;

    const directMux =
      safeStr(job?.mux) ||
      safeStr(job?.mux_url) ||
      safeStr(job?.muxed_url) ||
      safeStr(meta?.mux) ||
      safeStr(meta?.mux_url) ||
      safeStr(meta?.muxed_url);

    if (directMux) return directMux;

    const fin = outs.find((o) => isVideoOutput(o) && o?.meta?.is_final === true);
    if (fin) {
      const u = pickOutputUrl(fin);
      if (u) return u;
    }

    const ov = outs.find(
      (o) => isVideoOutput(o) && outputVariant(o) === "logo_overlay"
    );
    if (ov) {
      const u = pickOutputUrl(ov);
      if (u) return u;
    }

    const mx = outs.find((o) => isVideoOutput(o) && outputVariant(o) === "mux");
    if (mx) {
      const u = pickOutputUrl(mx);
      if (u) return u;
    }

    const pv = outs.find(
      (o) => isVideoOutput(o) && outputVariant(o) === "provider"
    );
    if (pv) {
      const u = pickOutputUrl(pv);
      if (u) return u;
    }

    const vid = outs.find((o) => isVideoOutput(o)) || outs[0];
    return pickOutputUrl(vid);
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

    if (directPreview) return directPreview;

    const prev = outs.find(
      (o) => isVideoOutput(o) && outputVariant(o) === "preview"
    );
    if (prev) {
      const u = pickOutputUrl(prev);
      if (u) return u;
    }

    return "";
  }

  function acceptAtmoOutput(o) {
    if (!o) return false;
    const t = String(o?.type || "").toLowerCase();
    if (t && t !== "video") return false;

    const app = String(
      o?.meta?.app || o?.meta?.module || o?.meta?.routeKey || ""
    )
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

      .atmoThumb:before{content:"";display:block;padding-top:56.25%;}
      .atmoThumb.isPortrait:before{padding-top:140%;}

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
    const st = String(job?.db_status || job?.status || job?.state || "").toUpperCase();
    if (st.includes("FAIL") || st.includes("ERROR"))
      return { text: "Hata", kind: "bad" };
    if (
      st.includes("READY") ||
      st.includes("DONE") ||
      st.includes("COMPLET") ||
      st.includes("SUCC")
    )
      return { text: "Hazır", kind: "ok" };
    if (
      st.includes("RUN") ||
      st.includes("PROC") ||
      st.includes("PEND") ||
      st.includes("QUEUE")
    )
      return { text: "İşleniyor", kind: "mid" };
    return { text: st || "Hazır", kind: "mid" };
  }

  function createAtmosPanel(host) {
    ensureStyles();

    let destroyed = false;
    let timer = null;

    const state = {
      items: [],
      ephemerals: [],
    };

    const playableUrls = new Set();
    const probingUrls = new Set();

    host.innerHTML = `
      <div class="atmoWrap">
        <div class="atmoGrid" data-el="grid"></div>
      </div>
    `;

    const $grid = host.querySelector('[data-el="grid"]');

    const setHeaderMeta = (t) => {
      try {
        if (
          window.RightPanel &&
          typeof window.RightPanel.setHeader === "function"
        ) {
          window.RightPanel.setHeader({ meta: String(t || "") });
        }
      } catch {}
    };

    function statusUpper(job) {
      return String(job?.db_status || job?.status || job?.state || "").toUpperCase();
    }

    function isTerminal(job) {
      const st = statusUpper(job);
      return (
        st.includes("READY") ||
        st.includes("DONE") ||
        st.includes("COMPLET") ||
        st.includes("SUCC") ||
        st.includes("FAIL") ||
        st.includes("ERROR")
      );
    }

    function isFreshDoneEphemeral(job) {
      if (!job || job?._fresh !== true) return false;
      const st = statusUpper(job);
      return (
        st.includes("READY") ||
        st.includes("DONE") ||
        st.includes("COMPLET") ||
        st.includes("SUCC")
      );
    }

    function matchKeyOf(job) {
      const jobId = safeStr(job?.job_id);
      const rid = safeStr(job?.meta?.request_id || job?.request_id);
      return {
        jobId,
        rid,
        key: jobId || rid || "",
      };
    }

    function sameJob(a, b) {
      const aa = matchKeyOf(a);
      const bb = matchKeyOf(b);
      if (!aa.key || !bb.key) return false;
      if (aa.jobId && bb.jobId && aa.jobId === bb.jobId) return true;
      if (aa.rid && bb.rid && aa.rid === bb.rid) return true;
      return false;
    }

    function isPortrait(job, out) {
      const ar = String(
        job?.meta?.aspect_ratio ||
          job?.meta?.ratio ||
          out?.meta?.aspect_ratio ||
          ""
      );
      return ar.includes("9:16") || ar.includes("4:5") || ar.includes("2:3");
    }

    function upsertEphemeralProcessing(payload = {}) {
      const jobId = safeStr(payload.job_id);
      const rid =
        safeStr(payload.request_id) ||
        safeStr(payload.requestId) ||
        safeStr(payload.fal_request_id) ||
        safeStr(payload.provider_request_id);
      const prompt = safeStr(payload.prompt || payload?.meta?.prompt);
      const provider = safeStr(
        payload.provider || payload?.meta?.provider || "Atmos"
      );
      const aspectRatio = safeStr(
        payload?.meta?.aspect_ratio ||
          payload?.aspect_ratio ||
          payload?.meta?.ratio ||
          ""
      );

      if (!jobId && !rid) return;

      const id = jobId || `tmp_${rid}`;
      const existsDb = (state.items || []).some((x) => {
        const dbJobId = safeStr(x?.job_id);
        const dbRid = safeStr(x?.meta?.request_id || x?.request_id);
        return (jobId && dbJobId === jobId) || (rid && dbRid === rid);
      });

      if (existsDb) return;

      const nextItem = {
        job_id: id,
        status: "PROCESSING",
        created_at: payload?.createdAt || payload?.created_at || Date.now(),
        prompt,
        _fresh: false,
        meta: {
          app: APP_KEY,
          provider,
          request_id: rid,
          aspect_ratio: aspectRatio,
        },
        outputs: [],
      };

      state.ephemerals = [
        nextItem,
        ...(state.ephemerals || []).filter((x) => {
          const xJobId = safeStr(x?.job_id);
          const xRid = safeStr(x?.meta?.request_id || x?.request_id);
          if (jobId && xJobId === jobId) return false;
          if (rid && xRid === rid) return false;
          return true;
        }),
      ];

      render();
    }

    function cleanupEphemeralsAgainstDb() {
      const dbItems = Array.isArray(state.items) ? state.items : [];
      const eps = Array.isArray(state.ephemerals) ? state.ephemerals : [];

      if (!dbItems.length || !eps.length) return;

      state.ephemerals = eps.filter((ep) => {
        const matchDb = dbItems.find((db) => sameJob(ep, db));
        if (!matchDb) return true;

        if (!isTerminal(matchDb)) return true;

        if (isFreshDoneEphemeral(ep)) return true;

        return false;
      });
    }

    function combinedItems() {
      const dbItems = Array.isArray(state.items) ? state.items : [];
      const eps = Array.isArray(state.ephemerals) ? state.ephemerals : [];

      const picked = [];
      const consumedDb = new Set();

      for (const ep of eps) {
        const matchIndex = dbItems.findIndex((db) => sameJob(ep, db));
        const matchDb = matchIndex >= 0 ? dbItems[matchIndex] : null;

        if (!matchDb) {
          picked.push(ep);
          continue;
        }

        if (isTerminal(matchDb)) {
          if (isFreshDoneEphemeral(ep)) {
            picked.push(ep);
          } else {
            picked.push(matchDb);
            consumedDb.add(matchIndex);
          }
          continue;
        }

        picked.push(ep);
        consumedDb.add(matchIndex);
      }

      dbItems.forEach((db, idx) => {
        if (!consumedDb.has(idx)) picked.push(db);
      });

      const rankStatus = (j) => {
        const st = statusUpper(j);
        if (
          st.includes("PROC") ||
          st.includes("RUN") ||
          st.includes("PEND") ||
          st.includes("QUEUE")
        )
          return 0;
        if (
          st.includes("READY") ||
          st.includes("DONE") ||
          st.includes("COMPLET") ||
          st.includes("SUCC")
        )
          return 1;
        if (st.includes("FAIL") || st.includes("ERROR")) return 2;
        return 1;
      };

      const tsOf = (j) => {
        const t = new Date(
          j?.updated_at || j?.created_at || Date.now()
        ).getTime();
        return Number.isFinite(t) ? t : 0;
      };

      return picked.sort((a, b) => {
        const ra = rankStatus(a);
        const rb = rankStatus(b);
        if (ra !== rb) return ra - rb;
        return tsOf(b) - tsOf(a);
      });
    }

    function resolvePlaybackUrl(rawUrl) {
      rawUrl = safeStr(rawUrl);
      if (!rawUrl) return "";

      if (!/^https?:\/\//i.test(rawUrl)) return rawUrl;

      if (rawUrl.includes("media.aivo.tr/outputs/atmo/")) {
        return rawUrl;
      }

      return "/api/media/proxy?url=" + encodeURIComponent(rawUrl);
    }

    function render() {
      if (destroyed || !$grid) return;

      const items = combinedItems();

      const hasProcessing = items.some((j) => {
        const st = statusUpper(j);
        return (
          st.includes("PROC") ||
          st.includes("RUN") ||
          st.includes("PEND") ||
          st.includes("QUEUE")
        );
      });
      setHeaderMeta(hasProcessing ? "İşleniyor…" : "Hazır");

      if (!items.length) {
        $grid.innerHTML = `<div class="atmoEmpty">Henüz atmos üretim yok.</div>`;
        return;
      }

      $grid.innerHTML = items
        .slice(0, 30)
        .map((job) => {
          const badge = badgeFor(job);
          const isFreshCard = job?._fresh === true;

          const finalUrl = safeStr(job?.url || bestVideoFromJob(job));
          const previewUrlResolved = safeStr(previewVideoFromJob(job));

          const selectedPlaybackRawUrl = isFreshCard
            ? finalUrl || previewUrlResolved
            : previewUrlResolved || finalUrl;

          const hasUrl = !!selectedPlaybackRawUrl;

          const dt = formatTs(job?.created_at || job?.updated_at || Date.now());
          const engine = safeStr(job?.provider || job?.meta?.provider || "Atmos");
          const metaLine = `${engine}${dt ? " • " + dt : ""}`;
          const promptLine = safeStr(job?.prompt || "");

          const dummyOut = {
            meta: { aspect_ratio: job?.meta?.aspect_ratio || "" },
          };
          const portrait = isPortrait(job, dummyOut);

          const playbackUrl = hasUrl
            ? resolvePlaybackUrl(selectedPlaybackRawUrl)
            : "";
          const videoUrl = playbackUrl
            ? playbackUrl.includes("#")
              ? playbackUrl
              : playbackUrl + "#t=0.001"
            : "";

          if (
            playbackUrl &&
            !playableUrls.has(playbackUrl) &&
            !probingUrls.has(playbackUrl)
          ) {
            probePlayableUrl(playbackUrl);
          }

          const isPlayableNow =
            !!playbackUrl &&
            playableUrls.has(playbackUrl) &&
            badge.kind !== "bad";

          return window.AIVO_SHARED_VIDEO_CARD?.createCardHtml
            ? '<div class="atmoCard"' +
                ' data-job="' + esc(job.job_id || "") + '"' +
                ' data-url="' + esc(selectedPlaybackRawUrl) + '"' +
                ' data-final-url="' + esc(finalUrl) + '"' +
                ' data-preview-url="' + esc(previewUrlResolved) + '"' +
                ' data-fresh="' + esc(isFreshCard ? "1" : "0") + '"' +
              ">" +
                window.AIVO_SHARED_VIDEO_CARD.createCardHtml({
                  id: safeStr(job.job_id || ""),
                  title: promptLine || "—",
                  sub: metaLine,
                  badgeText: badge.text,
                  badgeKind: isPlayableNow
                    ? "ready"
                    : badge.kind === "bad"
                      ? "error"
                      : "loading",
                  videoUrl,
                  posterUrl: "",
                  ratio: portrait ? "9:16" : "16:9",
                  ready: isPlayableNow,
                  canDownload: !!finalUrl,
                  canShare: isPlayableNow,
                  canDelete: true,
                }) +
              "</div>"
            : "";
        })
        .join("");
    }

    async function handleAction(cardEl, act) {
      const jobId = safeStr(cardEl?.getAttribute("data-job"));
      const url = safeStr(cardEl?.getAttribute("data-url"));
      const finalUrl = safeStr(cardEl?.getAttribute("data-final-url"));
      const previewUrl = safeStr(cardEl?.getAttribute("data-preview-url"));

      if (act === "play") {
        const video = cardEl?.querySelector("video");
        if (!video) return;

        if (video.paused) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
        return;
      }

      if (act === "fs") {
        const video = cardEl?.querySelector("video");
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

      if (act === "download") {
        const dlUrl = finalUrl || url || previewUrl;
        if (!dlUrl) return;

        const proxied =
          "/api/media/proxy?url=" +
          encodeURIComponent(dlUrl) +
          "&filename=" +
          encodeURIComponent(`atmo-${jobId || "video"}.mp4`);

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.setAttribute("aria-hidden", "true");
        iframe.src = proxied;

        document.body.appendChild(iframe);

        setTimeout(() => {
          try {
            iframe.remove();
          } catch {}
        }, 15000);

        return;
      }

      if (act === "share") {
        const shareUrl = finalUrl || url || previewUrl;
        if (!shareUrl) return;

        try {
          if (navigator.share) {
            await navigator.share({ title: "Atmosfer Video", url: shareUrl });
          } else if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(shareUrl);
          }
        } catch {}
        return;
      }

      if (act === "delete") {
        if (!jobId) return;

        state.ephemerals = (state.ephemerals || []).filter(
          (x) => safeStr(x?.job_id) !== jobId
        );

        if (db && typeof db.deleteJob === "function") {
          const ok = await db.deleteJob(jobId);
          if (!ok) db.hydrate(true);
        } else {
          state.items = (state.items || []).filter(
            (x) => safeStr(x?.job_id) !== jobId
          );
        }

        render();
        return;
      }
    }

    $grid?.addEventListener(
      "click",
      (e) => {
        const btn = e.target?.closest?.("[data-svc-act], [data-act]");
        if (!btn) return;

        const act =
          safeStr(btn.getAttribute("data-svc-act")) ||
          safeStr(btn.getAttribute("data-act"));
        if (!act) return;

        if (btn.hasAttribute("disabled")) return;

        const wrapperCard = btn.closest(".atmoCard");
        const sharedCard = btn.closest(".svcCard");
        const card = wrapperCard || sharedCard;
        if (!card) return;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        handleAction(card, act);
      },
      true
    );

    const db =
      window.DBJobs && typeof window.DBJobs.create === "function"
        ? window.DBJobs.create({
            app: APP_KEY,
            debug: false,
            pollIntervalMs: 4000,
            hydrateEveryMs: 15000,
            acceptOutput: acceptAtmoOutput,
            onChange(items) {
              state.items = items || [];
              cleanupEphemeralsAgainstDb();
              render();
            },
          })
        : null;

    if (db) db.start();

    const onJobCreated = (e) => {
      const d = e?.detail || {};
      if (!d) return;

      const appKey = safeStr(
        d?.app || d?.meta?.app || d?.meta?.module || d?.meta?.routeKey || "atmo"
      ).toLowerCase();
      if (!appKey.includes("atmo")) return;

      upsertEphemeralProcessing({
        job_id: d?.job_id,
        request_id: d?.request_id || d?.requestId || d?.meta?.request_id,
        prompt: d?.prompt || d?.meta?.prompt,
        provider: d?.provider || d?.meta?.provider || "Atmos",
        createdAt: d?.createdAt || Date.now(),
        meta: d?.meta || {},
      });
    };

    window.addEventListener("aivo:atmo:job_created", onJobCreated);

    const originalUpsert = window.AIVO_JOBS && window.AIVO_JOBS.upsert;

    if (originalUpsert && !window.__AIVO_ATMO_UPSERT_HOOKED__) {
      window.__AIVO_ATMO_UPSERT_HOOKED__ = true;

      window.AIVO_JOBS.upsert = function (job) {
        try {
          originalUpsert.call(this, job);
        } catch {}

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

          upsertEphemeralProcessing({
            job_id: job?.job_id || job?.id,
            request_id:
              job?.request_id ||
              job?.requestId ||
              job?.fal_request_id ||
              job?.provider_request_id,
            prompt: job?.prompt || job?.meta?.prompt,
            provider: job?.provider || job?.meta?.provider || "Atmos",
            createdAt: job?.createdAt || Date.now(),
            meta: job?.meta || {},
          });

          const rid =
            safeStr(job.request_id) ||
            safeStr(job.requestId) ||
            safeStr(job.fal_request_id) ||
            safeStr(job.provider_request_id);

          if (!rid || rid === "TEST") return;

          if (timer) clearInterval(timer);
          timer = setInterval(
            () =>
              pollFalOnce(
                rid,
                safeStr(job.prompt || job?.meta?.prompt || "")
              ),
            2000
          );
          pollFalOnce(rid, safeStr(job.prompt || job?.meta?.prompt || ""));
        } catch {}
      };
    }

    function probePlayableUrl(url) {
      url = safeStr(url);
      if (!url) return;
      if (playableUrls.has(url)) return;
      if (probingUrls.has(url)) return;

      probingUrls.add(url);

      waitUntilPlayable(url, 12000)
        .then((ok) => {
          if (ok) {
            playableUrls.add(url);
            render();
          }
        })
        .finally(() => {
          probingUrls.delete(url);
        });
    }

    async function waitUntilPlayable(url, timeoutMs = 12000) {
      url = safeStr(url);
      if (!url) return false;

      return await new Promise((resolve) => {
        const v = document.createElement("video");
        let done = false;

        const finish = (ok) => {
          if (done) return;
          done = true;
          try {
            v.pause();
            v.removeAttribute("src");
            v.load();
          } catch {}
          resolve(!!ok);
        };

        const t = setTimeout(() => finish(false), timeoutMs);

        v.preload = "metadata";
        v.muted = true;
        v.playsInline = true;

        v.addEventListener(
          "loadeddata",
          () => {
            clearTimeout(t);
            finish(true);
          },
          { once: true }
        );

        v.addEventListener(
          "canplay",
          () => {
            clearTimeout(t);
            finish(true);
          },
          { once: true }
        );

        v.addEventListener(
          "error",
          () => {
            clearTimeout(t);
            finish(false);
          },
          { once: true }
        );

        v.src = url;
        try {
          v.load();
        } catch {}
      });
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

      const st = safeStr(
        data?.status || data?.state || data?.result?.status
      ).toLowerCase();

      if (st.includes("fail") || st === "error") {
        const existing = (state.ephemerals || []).find(
          (x) => safeStr(x?.meta?.request_id || x?.request_id) === rid
        );

        if (existing) {
          state.ephemerals = [
            {
              ...existing,
              status: "ERROR",
              state: "ERROR",
            },
            ...(state.ephemerals || []).filter(
              (x) => safeStr(x?.job_id) !== safeStr(existing?.job_id)
            ),
          ];
          render();
        }

        setHeaderMeta("Hata");
        return;
      }

      if (
        st.includes("complete") ||
        st.includes("success") ||
        st === "succeeded"
      ) {
        let url = pickVideoUrl(data);

        if (!url) {
          setHeaderMeta("Tamamlandı (url yok)");
          return;
        }

        const playbackResolved = resolvePlaybackUrl(url);
        const playable = await waitUntilPlayable(playbackResolved, 12000);
        if (playable) playableUrls.add(playbackResolved);
        if (!playable) {
          setHeaderMeta("İşleniyor…");
          return;
        }

        setHeaderMeta("Tamamlandı");

        const existing = (state.ephemerals || []).find(
          (x) => safeStr(x?.meta?.request_id || x?.request_id) === rid
        );

        const tempId = safeStr(existing?.job_id) || `tmp_${rid}`;

        state.ephemerals = [
          {
            job_id: tempId,
            url,
            status: "DONE",
            created_at: existing?.created_at || Date.now(),
            prompt: safeStr(existing?.prompt || promptMaybe || ""),
            _fresh: true,
            meta: {
              app: APP_KEY,
              provider: safeStr(existing?.meta?.provider || "Atmos"),
              request_id: rid,
              aspect_ratio: safeStr(
                data?.aspect_ratio || existing?.meta?.aspect_ratio || ""
              ),
            },
          },
          ...(state.ephemerals || []).filter(
            (x) => safeStr(x?.job_id) !== tempId
          ),
        ];
        render();

        try {
          if (window.PPE && typeof window.PPE.apply === "function") {
            window.PPE.apply({
              outputs: [{ type: "video", url, src: url, meta: { app: APP_KEY } }],
              meta: { app: APP_KEY, request_id: rid },
            });
          }
        } catch {}

        try {
          db && db.hydrate(true);
        } catch {}

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
      try {
        window.removeEventListener("aivo:atmo:job_created", onJobCreated);
      } catch {}
      try {
        db && db.destroy();
      } catch {}
      host.innerHTML = "";
    }

    return { destroy };
  }

  window.RightPanel.register(APP_KEY, {
    header: {
      title: "Atmosfer Video",
      meta: "Hazır",
      searchEnabled: false,
      resetSearch: true,
    },

    mount(host) {
      const panel = createAtmosPanel(host);
      host.__ATMO_PANEL__ = panel;
    },

    destroy(host) {
      try {
        host.__ATMO_PANEL__ && host.__ATMO_PANEL__.destroy();
      } catch {}
      host.__ATMO_PANEL__ = null;
    },
  });
})();
