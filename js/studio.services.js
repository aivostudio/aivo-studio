// =========================================================
// ✅ AIVO_APP.generateMusic — SERVICE ONLY (MUSIC)
// - UI yok
// - Player yok
// - Panel yok
// - Kredi düşer: /api/credits/consume
// - Job create: /api/jobs/create
// - Generate: /api/music/generate (await + log)
// =========================================================

window.AIVO_APP = window.AIVO_APP || {};

window.AIVO_APP.generateMusic = async function ({ prompt, cost = 5 } = {}) {
  const p = String(prompt || "").trim();
  if (!p) throw new Error("Prompt boş");

  // 0) KREDİ DÜŞ (eski çalışan flow ile aynı mantık)
  const cr = await fetch("/api/credits/consume", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      cost: Number(cost) || 0,
      reason: "studio_music_generate",
      meta: { promptLen: p.length }
    })
  });

  let cData = null;
  try { cData = await cr.json(); } catch (_) {}

  if (!cr.ok) {
    const msg = cData?.error || cData?.message || "credit_consume_failed";
    throw new Error(msg);
  }

  // 1) JOB CREATE
  const jr = await fetch("/api/jobs/create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "music",
      params: { prompt: p } // create.js params'ı kaydediyor, faydalı
    })
  });

  let jobData = null;
  try { jobData = await jr.json(); } catch (_) {}

  if (!jr.ok || !jobData?.job_id) {
    throw new Error(jobData?.error || "Job create failed");
  }

  const job_id = jobData.job_id;

  // 2) BACKEND GENERATE (kör değil: await + okunabilir log)
  const gr = await fetch("/api/music/generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id, prompt: p })
  });

  const gText = await gr.text();
  let gData = null;
  try { gData = JSON.parse(gText); } catch { gData = { _raw: gText }; }

  console.log("[AIVO_APP.generateMusic] generate resp", {
    ok: gr.ok,
    status: gr.status,
    data: gData,
    job_id
  });

  if (!gr.ok || gData?.ok === false) {
    // (varsa) kredi iadesi endpoint'i burada çağrılabilir.
    const msg = gData?.error || gData?.message || "music_generate_failed";
    throw new Error(msg);
  }

  // 3) SADECE SONUÇ DÖN
  return {
    ok: true,
    job_id,
    credits: cData?.credits ?? cData?.remainingCredits ?? cData?.balance
  };
};
