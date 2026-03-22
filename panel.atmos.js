// /panel.atmos.js
(function () {
  const APP_KEY = "atmo";

  const safeStr = (v) => String(v == null ? "" : v).trim();

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

  function resolvePlaybackUrl(rawUrl) {
    rawUrl = safeStr(rawUrl);
    if (!rawUrl) return "";

    if (!/^https?:\/\//i.test(rawUrl)) return rawUrl;

    if (rawUrl.includes("media.aivo.tr/outputs/atmo/")) {
      return rawUrl;
    }

    return "/api/media/proxy?url=" + encodeURIComponent(rawUrl);
  }

  let timer = null;
  const playableUrls = new Set();
  const probingUrls = new Set();

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

  function probePlayableUrl(url) {
    url = safeStr(url);
    if (!url) return Promise.resolve(false);
    if (playableUrls.has(url)) return Promise.resolve(true);
    if (probingUrls.has(url)) return Promise.resolve(false);

    probingUrls.add(url);

    return waitUntilPlayable(url, 12000)
      .then((ok) => {
        if (ok) playableUrls.add(url);
        return ok;
      })
      .finally(() => {
        probingUrls.delete(url);
      });
  }

  async function pollFalOnce(rid, promptMaybe, jobLike) {
    rid = safeStr(rid);
    if (!rid) return;

    let data;
    try {
      const r = await fetch(STATUS_URL(rid), { credentials: "include" });
      data = await r.json();
    } catch {
      return;
    }

    const st = safeStr(
      data?.status || data?.state || data?.result?.status
    ).toLowerCase();

    if (st.includes("fail") || st === "error") {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      return;
    }

    if (
      st.includes("complete") ||
      st.includes("success") ||
      st === "succeeded"
    ) {
      const url = pickVideoUrl(data);
      if (!url) return;

      const playbackResolved = resolvePlaybackUrl(url);
      const playable = await probePlayableUrl(playbackResolved);
      if (!playable) return;

      try {
        window.dispatchEvent(
          new CustomEvent("aivo:atmo:job_ready", {
            detail: {
              app: "atmo",
              job_id: safeStr(jobLike?.job_id || jobLike?.id || data?.job_id),
              request_id: rid,
              status: "completed",
              video: { url },
              outputs: Array.isArray(data?.outputs)
                ? data.outputs
                : [{ type: "video", url, meta: { app: "atmo", is_final: true } }],
              raw: data,
              meta: {
                app: "atmo",
                provider: safeStr(jobLike?.provider || jobLike?.meta?.provider || "Atmos"),
                prompt: safeStr(jobLike?.prompt || jobLike?.meta?.prompt || promptMaybe || ""),
                aspect_ratio: safeStr(
                  data?.aspect_ratio || jobLike?.meta?.aspect_ratio || ""
                ),
              },
            },
          })
        );
      } catch {}

      try {
        if (window.PPE && typeof window.PPE.apply === "function") {
          window.PPE.apply({
            outputs: [{ type: "video", url, src: url, meta: { app: APP_KEY } }],
            meta: { app: APP_KEY, request_id: rid },
          });
        }
      } catch {}

      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  }

  const originalUpsert = window.AIVO_JOBS && window.AIVO_JOBS.upsert;

  if (originalUpsert && !window.__AIVO_ATMOS_UPSERT_HOOKED__) {
    window.__AIVO_ATMOS_UPSERT_HOOKED__ = true;

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

        const rid =
          safeStr(job.request_id) ||
          safeStr(job.requestId) ||
          safeStr(job.fal_request_id) ||
          safeStr(job.provider_request_id);

        const jobId = safeStr(job.job_id || job.id);
        const prompt = safeStr(job.prompt || job?.meta?.prompt || "");

        try {
          window.dispatchEvent(
            new CustomEvent("aivo:atmo:job_created", {
              detail: {
                app: "atmo",
                job_id: jobId,
                request_id: rid,
                prompt,
                provider: safeStr(job.provider || job?.meta?.provider || "Atmos"),
                createdAt: job.createdAt || Date.now(),
                meta: {
                  ...(job.meta || {}),
                  app: "atmo",
                  provider: safeStr(job.provider || job?.meta?.provider || "Atmos"),
                  prompt,
                  aspect_ratio: safeStr(job?.meta?.aspect_ratio || ""),
                },
              },
            })
          );
        } catch {}

        if (!rid || rid === "TEST") return;

        if (timer) clearInterval(timer);
        timer = setInterval(() => {
          pollFalOnce(rid, prompt, job);
        }, 2000);

        pollFalOnce(rid, prompt, job);
      } catch {}
    };
  }
})();
