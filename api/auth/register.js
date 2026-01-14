// api/auth/register.js
// =======================================================
// REGISTER — v0 (No-KV, No-Mail)
// Amaç: endpoint'in kesin response döndüğünü doğrulamak.
// =======================================================

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function validatePassword(pw) {
  const s = String(pw || "");
  if (s.length < 6) return "password_too_short";
  return null;
}

module.exports = async function register(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  let body = req.body || {};
  if (typeof body === "string") {
    try { body = JSON.parse(body); }
    catch { return res.status(400).json({ ok: false, error: "invalid_json" }); }
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!email) return res.status(400).json({ ok: false, error: "email_required" });
  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ ok: false, error: pwErr });

  return res.status(201).json({ ok: true, email });
};
