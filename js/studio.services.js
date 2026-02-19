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
      // yetersiz kredi ise yönlendir (istersen kaldır)
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
   ATM_CREATE HOOK (SINGLE SOURCE) — paste into studio.services.js (bottom)
   Purpose:
   - Make Atmosfer "Üret" button actually call backend
   - Force duration = 4s (cheap test)
   - Create job via /api/jobs/create-atmo
   - Optional: upsert to AIVO_JOBS + PPE.apply processing placeholder
   ============================================================================ */

(() => {
  if (window.__ATM_CREATE_BOUND__) return;
  window.__ATM_CREATE_BOUND__ = true;

  const safeJson = async (res) => {
    const txt = await res.text().catch(() => "");
    try { return JSON.parse(txt || "{}"); } catch { return { ok:false, error:"bad_json", raw: txt }; }
  };

  const nowISO = () => new Date().toISOString();

  // Normalize payload coming from atmosphere.module.js
  const normalizePayload = (p) => {
    const payload = { ...(p || {}) };

    // Always enforce app
    payload.app = "atmo";

    // FORCE cheap test: 4 seconds
    // module sends duration as string ("8") in basic, and maybe proDuration in pro
    if (payload.mode === "pro") {
      payload.duration = "4";
    } else {
      payload.duration = "4";
    }

    // Defensive defaults
    payload.format = payload.format || "mp4";
    payload.fps = payload.fps || "24";

    return payload;
  };

  // (Optional) best-effort: show something instantly in UI while backend works
  const applyProcessingCard = (job_id, payload) => {
    try {
      if (!window.PPE?.apply) return;
      window.PPE.apply({
        state: "PROCESSING",
        job_id,
        app: "atmo",
        createdAt: nowISO(),
        outputs: [],
        meta: {
          app: "atmo",
          mode: payload.mode || "basic",
          duration: payload.duration || "4",
          fps: payload.fps || "24",
          format: payload.format || "mp4",
        }
      });
    } catch (e) {
      console.warn("[ATM_CREATE] PPE.apply failed:", e);
    }
  };

  const upsertJob = (job_id, payload) => {
    try {
      const job = {
        job_id,
        app: "atmo",
        status: "processing",
        createdAt: nowISO(),
        meta: { app: "atmo", ...(payload || {}) }
      };
      window.AIVO_JOBS?.upsert?.(job);
    } catch (e) {
      console.warn("[ATM_CREATE] AIVO_JOBS.upsert failed:", e);
    }
  };

  // MAIN HOOK: atmosphere.module.js will call this
  window.ATM_CREATE = async function ATM_CREATE(inPayload) {
    const payload = normalizePayload(inPayload);

    console.log("[ATM_CREATE] -> create-atmo", payload);

    // If backend supports file upload for image/logo/audio, it should accept multipart.
    // For now (cheap test), we send JSON only.
    // NOTE: If you later want file uploads, we’ll switch this to FormData in one go.
    const res = await fetch("/api/jobs/create-atmo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((e) => {
      console.error("[ATM_CREATE] fetch failed:", e);
      return null;
    });

    if (!res) return { ok:false, error:"network_error" };

    const data = await safeJson(res);
    if (!res.ok || data?.ok === false) {
      console.error("[ATM_CREATE] create-atmo failed:", res.status, data);
      return { ok:false, status:res.status, ...data };
    }

    // Expecting { ok:true, job_id:"..." } (or similar)
    const job_id = data.job_id || data.id || data.jobId;
    console.log("[ATM_CREATE] created job_id =", job_id, data);

    if (job_id) {
      upsertJob(job_id, payload);
      applyProcessingCard(job_id, payload);

      // Optional: If your right panel is mounted, keep it on atmo.
      // (Doesn't break anything if RightPanel isn't ready.)
      window.RightPanel?.force?.("atmo", {});
    }

    return { ok:true, job_id, raw:data };
  };

  console.log("[ATM_CREATE] bound ✅");
})();
