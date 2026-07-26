// =========================================================
// ✅ AIVO_APP.generateMusic — SERVICE (CREDITS + JOB + GENERATE)
// File: /js/studio.services.js
// - Kredi tüketir (consume)
// - Üst bar krediyi anında günceller (#topCreditCount)
// - Job create eder
// - /api/music/generate fire-and-forget
// =========================================================

window.AIVO_APP = window.AIVO_APP || {};

(function __AIVO_SERVICES_MUSIC__() {
  if (window.__AIVO_SERVICES_MUSIC__) return;
  window.__AIVO_SERVICES_MUSIC__ = true;

  function setTopCreditsUI(nextCredits) {
    const n = document.querySelector("#topCreditCount");
    if (!n) return;
    n.textContent = String(nextCredits);
  }

  async function consumeCredits(cost, meta) {
    const res = await fetch("/api/credits/consume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        cost: Number(cost) || 0,
        reason: "studio_music_generate",
        meta: meta || {}
      })
    });

    let data = null;
    try { data = await res.json(); } catch (_) {}

    if (!res.ok) {
      return { ok: false, status: res.status, data };
    }

    const credits =
      (data && (data.credits ?? data.remainingCredits ?? data.balance)) ??
      null;

    return { ok: true, status: res.status, data, credits };
  }

  async function createJob(type, extraBody) {
    const jr = await fetch("/api/jobs/create", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, ...(extraBody || {}) })
    });

    let jobData = null;
    try { jobData = await jr.json(); } catch (_) {}

    if (!jr.ok || !jobData?.job_id) {
      throw new Error(jobData?.error || "job_create_failed");
    }
    return jobData.job_id;
  }

  window.AIVO_APP.generateMusic = async function ({ prompt, cost = 5 } = {}) {
    const p = String(prompt || "").trim();
    if (!p) throw new Error("Prompt boş");

    // 1) Credit consume (tek otorite)
    const cr = await consumeCredits(cost, { promptLen: p.length });
    if (!cr.ok) {
      window.toast?.error?.("Yetersiz kredi.");
      const to = encodeURIComponent(location.pathname + location.search + location.hash);
      location.href = "/fiyatlandirma.html?from=studio&reason=insufficient_credit&to=" + to;
      return { ok: false, error: "insufficient_credit" };
    }

    if (typeof cr.credits === "number") {
      setTopCreditsUI(cr.credits);
    }

    // 2) Job create
    const job_id = await createJob("music", { credit_cost: cost });

    // 3) Generate (fire-and-forget)
    fetch("/api/music/generate", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_id, prompt: p })
    }).catch(() => {});

    return { ok: true, job_id, credits: cr.credits ?? null };
  };
})();
/* ============================================================================
   ✅ ATM_CREATE HOOK (SINGLE SOURCE) — studio.services.js (bottom)
   - Atmosfer Üret butonundan gelen payload'ı normalize eder
   - Duration FORCE YOK ✅ (UI seçimi aynen gider)
   - Aspect Ratio: 16:9 / 1:1 / 9:16 (default 16:9)
   - /api/jobs/create-atmo çağırır
   - job_id gelince "aivo:atmo:job_created" event fırlatır (Video hissi)
   - PPE.apply / AIVO_JOBS.upsert ile kart basmaz (dupe biter)
   - ✅ FIX: double click / double fire -> inflight lock (2 video biter)
   - ✅ FIX: Fal daha sonra FAILED dönerse sonucu hook'a taşır; mevcut kredi iade akışı çalışır
   ============================================================================ */

(() => {
  if (window.__ATM_CREATE_BOUND__) return;
  window.__ATM_CREATE_BOUND__ = true;

  const safeJson = async (res) => {
    const txt = await res.text().catch(() => "");
    try { return JSON.parse(txt || "{}"); }
    catch { return { ok:false, error:"bad_json", raw: txt }; }
  };

  const nowISO = () => new Date().toISOString();
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const ALLOWED_DURS = new Set(["4", "6", "8", "10", "12", "15"]);
  const ALLOWED_RATIOS = new Set(["16:9", "1:1", "9:16"]);
  const READY_STATUSES = new Set(["ready", "done", "completed", "complete", "succeeded", "success"]);
  const FAILED_STATUSES = new Set(["error", "failed", "cancelled", "canceled", "timeout"]);

  const normalizeRatio = (raw) => {
    const r = String(raw || "").trim();
    if (ALLOWED_RATIOS.has(r)) return r;

    // toleranslı girişler (16x9, 16/9, 169 vs)
    const n = r.replaceAll(" ", "").replaceAll("/", ":").replaceAll("x", ":").toLowerCase();
    if (n === "16:9" || n === "169") return "16:9";
    if (n === "1:1" || n === "11") return "1:1";
    if (n === "9:16" || n === "916") return "9:16";

    // ürün default
    return "16:9";
  };

  const normalizePayload = (p) => {
    const payload = { ...(p || {}) };

    payload.app = "atmo";
    payload.mode = payload.mode || "basic";

    // duration: UI ne verdiyse o (whitelist + fallback)
    const rawDur = payload.duration ?? payload.proDuration ?? null;
    const dur = String(rawDur || "").trim();
    payload.duration = ALLOWED_DURS.has(dur) ? dur : "8";

    // ✅ aspect_ratio: UI seçimi veya default 16:9
    payload.aspect_ratio = normalizeRatio(payload.aspect_ratio || payload.ratio || payload.aspect || "");

    // bazı wrapper’lar ratio bekliyor, ikisini de koyuyoruz
    payload.ratio = payload.aspect_ratio;

    // defaults
    payload.format = payload.format || "mp4";
    payload.fps = payload.fps || "24";

    // seamFix -> seam_fix
    if (payload.seamFix != null && payload.seam_fix == null) {
      payload.seam_fix = !!payload.seamFix;
      delete payload.seamFix;
    }

    // normalize prompt
    if (payload.text && !payload.prompt) {
      payload.prompt = String(payload.text || "");
      delete payload.text;
    }
    payload.prompt = String(payload.prompt || "").trim();

    return payload;
  };

  const pickVideoUrl = (data) => {
    const direct = String(
      data?.video_url ||
      data?.final_url ||
      data?.url ||
      data?.video?.url ||
      data?.meta?.final_video_url ||
      data?.output?.video?.url ||
      ""
    ).trim();

    if (direct) return direct;

    const outputs = Array.isArray(data?.outputs) ? data.outputs : [];
    const hit = outputs.find((item) => {
      const type = String(item?.type || item?.kind || item?.meta?.type || "").toLowerCase();
      const url = String(item?.url || item?.video_url || item?.archive_url || item?.src || "").trim();
      return type === "video" && !!url;
    });

    return String(hit?.url || hit?.video_url || hit?.archive_url || hit?.src || "").trim();
  };

  const pickStatus = (data) => String(
    data?.status ||
    data?.db_status ||
    data?.state ||
    data?.fal?.status ||
    ""
  ).trim().toLowerCase();

  const waitForAtmoTerminal = async (jobId, timeoutMs = 900000) => {
    const startedAt = Date.now();
    let readyWithoutOutputCount = 0;

    while ((Date.now() - startedAt) < timeoutMs) {
      try {
        const statusRes = await fetch(
          `/api/jobs/status?job_id=${encodeURIComponent(jobId)}`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
            headers: { Accept: "application/json" }
          }
        );

        const statusData = await safeJson(statusRes);

        if (statusRes.ok && statusData?.ok !== false) {
          const status = pickStatus(statusData);
          const videoUrl = pickVideoUrl(statusData);

          if (READY_STATUSES.has(status) && videoUrl) {
            return {
              ok: true,
              status,
              video_url: videoUrl,
              raw: statusData
            };
          }

          if (FAILED_STATUSES.has(status)) {
            return {
              ok: false,
              error: "atmo_provider_failed",
              status,
              raw: statusData
            };
          }

          if (READY_STATUSES.has(status) && !videoUrl) {
            readyWithoutOutputCount += 1;

            // Sonuç yazılırken çok kısa bir yarış olabilir; üç kez doğruladıktan sonra hata say.
            if (readyWithoutOutputCount >= 3) {
              return {
                ok: false,
                error: "atmo_ready_without_output",
                status,
                raw: statusData
              };
            }
          } else {
            readyWithoutOutputCount = 0;
          }
        }
      } catch (pollError) {
        console.warn("[ATM_CREATE] terminal poll failed:", pollError);
      }

      await sleep(3000);
    }

    // Zaman aşımında kesin provider hatası yoktur; yanlış iade yapmamak için pending bırak.
    return {
      ok: true,
      pending: true,
      status: "poll_timeout"
    };
  };

  const dispatchJobCreated = (job_id, request_id, payload) => {
    try {
      const rid = String(request_id || "").trim();

      window.dispatchEvent(new CustomEvent("aivo:atmo:job_created", {
        detail: {
          job_id: String(job_id),
          request_id: rid,
          requestId: rid,
          app: "atmo",
          createdAt: nowISO(),
          meta: {
            app: "atmo",
            request_id: rid,
            requestId: rid,
            mode: payload.mode || "basic",
            duration: payload.duration || "8",
            fps: payload.fps || "24",
            format: payload.format || "mp4",
            aspect_ratio: payload.aspect_ratio || "16:9",
            ratio: payload.aspect_ratio || "16:9",

            // ekstra debug/meta
            prompt: payload.prompt || "",
            scene: payload.scene || "",
            effects: Array.isArray(payload.effects) ? payload.effects.slice() : [],
            camera: payload.camera || ""
          }
        }
      }));
    } catch (e) {
      console.warn("[ATM_CREATE] job_created event fail:", e);
    }
  };
  window.ATM_CREATE = async function ATM_CREATE(inPayload) {
    // ✅ anti-double-submit lock
    if (window.__ATM_CREATE_INFLIGHT__) {
      console.warn("[ATM_CREATE] blocked (inflight)");
      return { ok:false, error:"inflight" };
    }
    window.__ATM_CREATE_INFLIGHT__ = true;

    try {
      const payload = normalizePayload(inPayload);

      console.log("[ATM_CREATE] -> create-atmo", payload);

      let res = null;
      try {
        res = await fetch("/api/jobs/create-atmo", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error("[ATM_CREATE] fetch failed:", e);
        return { ok:false, error:"network_error" };
      }

      const data = await safeJson(res);
      if (!res.ok || data?.ok === false) {
        console.error("[ATM_CREATE] create-atmo failed:", res.status, data);
        return { ok:false, status:res.status, ...data };
      }

      const job_id = data.job_id || data.id || data.jobId;
      console.log("[ATM_CREATE] created job_id =", job_id, data);

      if (!job_id) {
        return { ok:false, error:"missing_job_id", raw:data };
      }

      // ✅ Video hissi: kartı anında çıkar
      dispatchJobCreated(job_id, data.request_id || data.requestId || "", payload);

      // ✅ Paneli atmo'ya çekmek istersen
      window.RightPanel?.force?.("atmo", {});

      // Fal isteği başta kabul edilip daha sonra içerik denetleyicisi tarafından
      // reddedilebilir. Terminal sonucu hook'a taşıyoruz; üst katmandaki mevcut
      // tryRefund() aynı consume transaction üzerinden idempotent iade yapar.
      const terminal = await waitForAtmoTerminal(job_id);

      if (terminal?.ok === false) {
        console.error("[ATM_CREATE] provider terminal failure:", terminal);
        return {
          ok: false,
          error: terminal.error || "atmo_provider_failed",
          provider_status: terminal.status || "error",
          job_id,
          raw: terminal.raw || data
        };
      }

      return {
        ok: true,
        job_id,
        raw: data,
        terminal: terminal?.raw || null,
        pending: !!terminal?.pending
      };
    } finally {
      // küçük debounce: event loop içinde ikinci tık gelmesin
      setTimeout(() => { window.__ATM_CREATE_INFLIGHT__ = false; }, 800);
    }
  };

  console.log("[ATM_CREATE] bound ✅");
})();