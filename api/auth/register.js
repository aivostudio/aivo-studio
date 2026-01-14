// api/auth/register.js
// REGISTER — v0 (No-KV, No-Mail) — ESM + Safe Body Parse

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function validatePassword(pw) {
  const s = String(pw || "");
  if (s.length < 6) return "password_too_short";
  return null;
}

async function readJson(req) {
  // Vercel Node function: req.body bazen gelmez, stream'den okuyalım
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return null; }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(raw); } catch { return null; }
}

export default async function register(req, res) {
  console.log("[register] hit", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const body = await readJson(req);
  if (body === null) {
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!email) return res.status(400).json({ ok: false, error: "email_required" });

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ ok: false, error: pwErr });

  return res.status(201).json({ ok: true, email });
}
