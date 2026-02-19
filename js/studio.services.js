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
   ATM_CREATE HOOK (SINGLE SOURCE) — paste into studio.services.js (bottom)
   Purpose:
   - Atmosfer "Üret" button -> backend create
   - duration FORCE KALKTI ✅ (UI ne seçtiyse o gider)
   - Create job via /api/jobs/create-atmo
   - Optional: upsert to AIVO_JOBS + PPE.apply processing placeholder
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

  // Normalize payload coming from atmosphere.module.js
  const normalizePayload = (p) => {
    const payload = { ...(p || {}) };

    // Always enforce app
    payload.app = "atmo";

    // ---- duration: UI seçimini KORU ----
    // basic: atmDuration -> payload.duration
    // pro: atmProDuration -> payload.duration
    const rawDur = payload.duration ?? payload.proDuration ?? null;
    const dur = String(rawDur || "").trim();

    // UI’daki seçeneklerle uyumlu whitelist
    const ALLOWED = new Set(["4", "6", "8", "10", "12", "15"]);

    if (ALLOWED.has(dur)) {
      payload.duration = dur;
    } else {
      // fallback: pro/basic için 8 sn
      payload.duration = "8";
    }

    // Defensive defaults
    payload.format = payload.format || "mp4";
    payload.fps = payload.fps || "24";

    // normalize seam_fix (module seamFix gönderebilir)
    if (payload.seamFix != null && payload.seam_fix == null) {
      payload.seam_fix = !!payload.seamFix;
      delete payload.seamFix;
    }

    // normalize prompt (bazı yerde text gelebilir)
    if (payload.text && !payload.prompt) {
      payload.prompt = String(payload.text || "");
      delete payload.text;
    }

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
          duration: payload.duration || "8",
          fps: payload.fps || "24",
          format: payload.format || "mp4",
          light: payload.light || "",
          mood: payload.mood || ""
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

    // NOTE: Şimdilik JSON. (Dosya upload istersen FormData’ya tek hamlede geçeriz.)
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

    if (job_id) {
      upsertJob(job_id, payload);
      applyProcessingCard(job_id, payload);
      window.RightPanel?.force?.("atmo", {});
    }

    return { ok:true, job_id, raw:data };
  };

  console.log("[ATM_CREATE] bound ✅");
})();
