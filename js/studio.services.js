// =========================================================
// ✅ AIVO_APP.generateMusic — SERVICE ONLY (COVER MODEL)
// - UI yok
// - Player yok
// - Panel yok
// - Sadece iş yapar ve sonucu döner
// =========================================================

window.AIVO_APP = window.AIVO_APP || {};

window.AIVO_APP.generateMusic = async function ({ prompt, cost = 5 } = {}) {
  const p = String(prompt || "").trim();
  if (!p) throw new Error("Prompt boş");

  // 1️⃣ JOB CREATE
  const jr = await fetch("/api/jobs/create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "music", credit_cost: cost })
  });

  let jobData = null;
  try { jobData = await jr.json(); } catch (_) {}

  if (!jr.ok || !jobData?.job_id) {
    throw new Error(jobData?.error || "Job create failed");
  }

  const job_id = jobData.job_id;

  // 2️⃣ BACKEND GENERATE (fire-and-forget)
  fetch("/api/music/generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id, prompt: p })
  }).catch(() => {});

  // 3️⃣ SADECE SONUÇ DÖN
  return { ok: true, job_id };
};
