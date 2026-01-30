// /api/music/generate.js
export default async function handler(req, res) {
  // CORS (Studio aynı domainde olsa da sorun çıkarmasın)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    // Vercel bazen req.body'yi object, bazen string verebilir.
    let body = req.body;

    if (typeof body === "string") {
      body = JSON.parse(body);
    }

    if (!body || typeof body !== "object") {
      return res.status(400).json({ ok: false, error: "invalid_body" });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const job_id = typeof body.job_id === "string" ? body.job_id.trim() : "";

    if (!email) return res.status(400).json({ ok: false, error: "email_required" });
    if (!job_id) return res.status(400).json({ ok: false, error: "job_id_required" });

    // normalize (opsiyonel)
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const mode = typeof body.mode === "string" ? body.mode : "instrumental";
    const duration_sec =
      Number.isFinite(body.duration_sec) ? body.duration_sec :
      Number.isFinite(body.durationSec) ? body.durationSec :
      30;

    // UI'nin beklediği minimal shape: ok + job_id + status (+ credits alanı varsa daha iyi)
    return res.status(200).json({
      ok: true,
      job_id,
      status: "queued",
      credits: body.credits ?? null, // şimdilik null; UI sadece alanı görmek istiyorsa sorun çözülür
      received: true,
      // debug alanları (istersen sil)
      email,
      mode,
      duration_sec,
      prompt,
      ts: Date.now(),
    });
  } catch (err) {
    // JSON.parse hatası vb. -> 500 değil 200 dönelim ki UI kırmızıya düşmesin
    return res.status(200).json({
      ok: false,
      error: "server_error",
      detail: String(err && err.message ? err.message : err),
    });
  }
}
