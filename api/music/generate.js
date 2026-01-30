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
      // "[object Object]" gibi bozuk string gelirse JSON.parse patlar; try/catch içinde yakalayacağız.
      body = JSON.parse(body);
    }

    if (!body || typeof body !== "object") {
      return res.status(400).json({ ok: false, error: "invalid_body" });
    }

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const job_id = typeof body.job_id === "string" ? body.job_id.trim() : "";

    if (!email) return res.status(400).json({ ok: false, error: "email_required" });
    if (!job_id) return res.status(400).json({ ok: false, error: "job_id_required" });

    // Frontend'in yolladıklarını normalize ederek geri döndürelim (debug için)
    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const mode = typeof body.mode === "string" ? body.mode : "";
    const duration_sec =
      Number.isFinite(body.duration_sec) ? body.duration_sec :
      Number.isFinite(body.durationSec) ? body.durationSec :
      null;

    // Minimal başarılı cevap: UI hattı doğrulansın
    return res.status(200).json({
      ok: true,
      received: true,
      job_id,
      email,
      prompt,
      mode,
      duration_sec,
      ts: Date.now(),
    });
  } catch (err) {
    // Buraya düşerse: JSON.parse hatası vb.
    return res.status(200).json({
      ok: false,
      error: "server_error",
      detail: String(err && err.message ? err.message : err),
    });
  }
}
