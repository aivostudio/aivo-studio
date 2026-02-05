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
