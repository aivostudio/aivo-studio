// /api/music/generate.js
import crypto from "crypto";

// Session'dan email çek (cookie forward)
async function getEmailFromSession(req) {
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers.host;
    const origin = `${proto}://${host}`;

    const r = await fetch(`${origin}/api/auth/me`, {
      method: "GET",
      headers: { cookie: req.headers.cookie || "" },
    });

    if (!r.ok) return null;
    const me = await r.json().catch(() => ({}));
    return (me?.email || me?.user?.email || "").trim().toLowerCase() || null;
  } catch {
    return null;
  }
}

function newJobId() {
  return "job_" + crypto.randomBytes(12).toString("hex");
}

export default async function handler(req, res) {
  // Aynı origin’de CORS gereksiz; yine de OPTIONS’a cevap verelim
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    let body = req.body;
    if (typeof body === "string") body = JSON.parse(body);

    if (!body || typeof body !== "object") {
      return res.status(400).json({ ok: false, error: "invalid_body" });
    }

    // 1) email body’den, yoksa session’dan
    let email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email) email = (await getEmailFromSession(req)) || "";

    // 2) job_id body’den, yoksa üret
    let job_id = typeof body.job_id === "string" ? body.job_id.trim() : "";
    if (!job_id) job_id = newJobId();

    if (!email) {
      return res.status(401).json({ ok: false, error: "auth_required" });
    }

    const prompt = typeof body.prompt === "string" ? body.prompt : "";
    const mode = typeof body.mode === "string" ? body.mode : "instrumental";

    const duration_raw = body.duration_sec ?? body.durationSec ?? 30;
    const duration_sec = Number.isFinite(Number(duration_raw)) ? Number(duration_raw) : 30;

    // Şimdilik stub response (UI kuyruğa aldı sansın)
    return res.status(200).json({
      ok: true,
      job_id,
      status: "queued",
      received: true,
      email,
      mode,
      duration_sec,
      prompt,
      ts: Date.now(),
    });
  } catch (err) {
    console.error("music/generate error:", err);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(err?.message || err),
    });
  }
}
