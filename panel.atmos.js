// /panel.atmos.js
// Atmos workflow only
// - create sonrası request/job yakalar
// - provider status poll yapar
// - ready/error kararını burada verir
// - aivo:atmo:job_created + aivo:atmo:job_ready event üretir
// - PPE.apply burada çalışır
// - RightPanel / DBJobs / panel render burada YOK

(function () {
  if (window.__ATMO_WORKFLOW_BIND__) return;
  window.__ATMO_WORKFLOW_BIND__ = true;

  const APP_KEY = "atmo";

  const safeStr = (v) => String(v == null ? "" : v).trim();

  const STATUS_URL = (rid) =>
    `/api/providers/fal/video/status?request_id=${encodeURIComponent(rid)}&app=${APP_KEY}`;

  const activePolls =
    window.__ATMO_ACTIVE_POLLS__ || (window.__ATMO_ACTIVE_POLLS__ = new Map());

  function pickVideoUrl(data) {
    return safeStr(
      data?.video?.url ||
        data?.video_url ||
        data?.output?.video?.url ||
        data?.output?.url ||
        (Array.isArray(data?.outputs) ? data.outputs?.[0]?.url : "") ||
        (Array.isArray(data?.output) ? data.output?.[0]?.url : "") ||
        data?.result?.url ||
        data?.result?.video?.url ||
        ""
    );
  }

  function resolvePlaybackUrl(rawUrl) {
    const url = safeStr(rawUrl);
    if (!url) return "";

    if (!/^https?:\/\//i.test(url)) return url;

    if (url.includes("media.aivo.tr/outputs/atmo/")) {
      return url;
    }

    return "/api/media/proxy?url=" + encodeURIComponent(url);
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

  function dispatchJobCreated(detail = {}) {
    try {
      window.dispatchEvent(
        new CustomEvent("aivo:atmo:job_created", {
          detail: {
            app: APP_KEY,
            job_id: safeStr(detail.job_id),
            request_id: safeStr(detail.request_id),
            prompt: safeStr(detail.prompt),
            provider: safeStr(detail.provider || "Atmos"),
            createdAt: detail.createdAt || Date.now(),
            meta: {
              ...(detail.meta || {}),
              app: APP_KEY,
              provider: safeStr(
                detail.provider || detail?.meta?.provider || "Atmos"
              ),
              request_id: safeStr(detail.request_id),
              prompt: safeStr(detail.prompt || detail?.meta?.prompt),
              aspect_ratio: safeStr(
                detail?.meta?.aspect_ratio ||
                  detail?.aspect_ratio ||
                  detail?.meta?.ratio ||
                  ""
              ),
            },
          },
        })
      );
    } catch {}
  }

  function dispatchJobReady(detail = {}) {
    try {
      window.dispatchEvent(
        new CustomEvent("aivo:atmo:job_ready", {
          detail: {
            app: APP_KEY,
            job_id: safeStr(detail.job_id),
            request_id: safeStr(detail.request_id),
            status: safeStr(detail.status || "completed"),
            video: detail.video?.url ? { url: safeStr(detail.video.url) } : null,
            outputs: Array.isArray(detail.outputs) ? detail.outputs : [],
            raw: detail.raw || null,
            meta: {
              ...(detail.meta || {}),
              app: APP_KEY,
              provider: safeStr(
                detail?.meta?.provider || detail.provider || "Atmos"
              ),
              request_id: safeStr(detail.request_id),
              prompt: safeStr(detail?.meta?.prompt || detail.prompt),
              aspect_ratio: safeStr(
                detail?.meta?.aspect_ratio || detail?.aspect_ratio || ""
              ),
            },
          },
        })
      );
    } catch {}
  }

  async function pollFalUntilReady(ctx = {}) {
    const requestId = safeStr(ctx.request_id);
    if (!requestId) return;

    if (activePolls.has(requestId)) return;
    activePolls.set(requestId, true);

    let tries = 0;

    try {
      while (tries < 120) {
        tries += 1;

        let data = null;
        try {
          const r = await fetch(STATUS_URL(requestId), {
            credentials: "include",
            cache: "no-store",
          });
          data = await r.json().catch(() => null);
        } catch {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        if (!data || data.ok === false) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        const st = safeStr(
          data?.status || data?.state || data?.result?.status
        ).toLowerCase();

        if (st.includes("fail") || st === "error") {
          return;
        }

        if (
          st.includes("complete") ||
          st.includes("success") ||
          st === "succeeded" ||
          st === "ready"
        ) {
          const url = pickVideoUrl(data);
          if (!url) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }

          const playbackUrl = resolvePlaybackUrl(url);
          const playable = await waitUntilPlayable(playbackUrl, 12000);

          if (!playable) {
            await new Promise((r) => setTimeout(r, 1500));
            continue;
          }

          const outputs =
            Array.isArray(data?.outputs) && data.outputs.length
              ? data.outputs
              : [{ type: "video", url, meta: { app: APP_KEY, is_final: true } }];

          dispatchJobReady({
            job_id: safeStr(ctx.job_id || data?.job_id),
            request_id: requestId,
            status: "completed",
            video: { url },
            outputs,
            raw: data,
            meta: {
              app: APP_KEY,
              provider: safeStr(ctx.provider || ctx?.meta?.provider || "Atmos"),
              prompt: safeStr(ctx.prompt || ctx?.meta?.prompt || ""),
              aspect_ratio: safeStr(
                data?.aspect_ratio ||
                  ctx?.meta?.aspect_ratio ||
                  ctx?.aspect_ratio ||
                  ""
              ),
            },
          });

          try {
            if (window.PPE && typeof window.PPE.apply === "function") {
              window.PPE.apply({
                outputs: [{ type: "video", url, src: url, meta: { app: APP_KEY } }],
                meta: { app: APP_KEY, request_id: requestId },
              });
            }
          } catch {}

          return;
        }

        await new Promise((r) => setTimeout(r, 2000));
      }
    } finally {
      activePolls.delete(requestId);
    }
  }

  function hookAivoJobs() {
    if (!window.AIVO_JOBS || typeof window.AIVO_JOBS.upsert !== "function") return;
    if (window.__AIVO_ATMO_UPSERT_HOOKED__) return;

    window.__AIVO_ATMO_UPSERT_HOOKED__ = true;

    const originalUpsert = window.AIVO_JOBS.upsert;

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

        const request_id =
          safeStr(job.request_id) ||
          safeStr(job.requestId) ||
          safeStr(job.fal_request_id) ||
          safeStr(job.provider_request_id) ||
          safeStr(job?.meta?.request_id);

        const job_id = safeStr(job.job_id || job.id);
        const prompt = safeStr(job.prompt || job?.meta?.prompt || "");
        const provider = safeStr(job.provider || job?.meta?.provider || "Atmos");

        dispatchJobCreated({
          job_id,
          request_id,
          prompt,
          provider,
          createdAt: job?.createdAt || Date.now(),
          meta: {
            ...(job?.meta || {}),
            app: APP_KEY,
            provider,
            request_id,
            prompt,
            aspect_ratio: safeStr(
              job?.meta?.aspect_ratio ||
                job?.aspect_ratio ||
                job?.meta?.ratio ||
                ""
            ),
          },
        });

        if (!request_id || request_id === "TEST") return;

        pollFalUntilReady({
          job_id,
          request_id,
          prompt,
          provider,
          meta: job?.meta || {},
        });
      } catch {}
    };
  }

  hookAivoJobs();
})();
