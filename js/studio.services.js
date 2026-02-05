window.AIVO_APP = window.AIVO_APP || {};

window.AIVO_APP.generateMusic = async function ({ prompt, cost = 5 } = {}) {
  const p = String(prompt || "").trim();
  if (!p) throw new Error("Prompt boş");

  // ✅ 0) KREDİ DÜŞ (eski çalışan sistemle aynı)
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
    const msg = cData?.error || "credit_consume_failed";
    throw new Error(msg);
  }

  // 1️⃣ JOB CREATE
  const jr = await fetch("/api/jobs/create", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "music" }) // credit_cost çıkarıldı, backend kullanmıyor
  });

  let jobData = null;
  try { jobData = await jr.json(); } catch (_) {}

  if (!jr.ok || !jobData?.job_id) {
    throw new Error(jobData?.error || "Job create failed");
  }

  const job_id = jobData.job_id;

  // 2️⃣ BACKEND GENERATE (✅ await + log, artık kör değiliz)
  const gr = await fetch("/api/music/generate", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ job_id, prompt: p })
  });

  const gText = await gr.text();
  let gData = null;
  try { gData = JSON.parse(gText); } catch { gData = { _raw: gText }; }

  console.log("[generateMusic] generate resp", { ok: gr.ok, status: gr.status, gData });

  if (!gr.ok || gData?.ok === false) {
    // (opsiyonel) burada kredi iadesi endpoint'in varsa çağırılır
    throw new Error(gData?.error || "music_generate_failed");
  }

  return { ok: true, job_id, credits: cData?.credits ?? cData?.remainingCredits ?? cData?.balance };
};
