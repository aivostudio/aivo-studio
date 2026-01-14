// api/auth/register.js
// =======================================================
// REGISTER — v1 (KV-backed)
// - Creates user with email+password
// - Stores in KV: user:<email> (JSON string)
// - Creates starter credits: credits:<email> (JSON string)
// =======================================================
if (req.method === "POST") {
  return res.status(200).json({ ok: true, debug: "register reached (no KV)" });
}

const crypto = require("crypto");
const { kvGetJson, kvSetJson } = require("../_kv"); // JSON-safe

function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

// Very basic password policy (adjust later)
function validatePassword(pw) {
  const s = String(pw || "");
  if (s.length < 6) return "password_too_short";
  return null;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // body can be an object or a JSON string depending on runtime/client
    let body = req.body || {};
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (_) {
        return res.status(400).json({ ok: false, error: "invalid_json_body" });
      }
    }

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email) return res.status(400).json({ ok: false, error: "email_required" });
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ ok: false, error: pwErr });

    const keyUser = `user:${email}`;

    // existing? (kvGetJson parse edemese bile _raw döndürür -> null değilse var say)
    const existing = await kvGetJson(keyUser);
    if (existing !== null) {
      return res.status(409).json({ ok: false, error: "user_already_exists" });
    }

    // store user
    const now = Date.now();
    const user = {
      email,
      passwordHash: sha256(password), // (bcrypt later)
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await kvSetJson(keyUser, user);

    // starter credits
    const starter = Number.isFinite(Number(process.env.STARTER_CREDITS))
      ? Math.max(0, Math.floor(Number(process.env.STARTER_CREDITS)))
      : 5;

    try {
      await kvSetJson(`credits:${email}`, { credits: starter, updatedAt: now });
    } catch (_) {
      // credits failure should not block registration
    }

    return res.status(201).json({ ok: true, email });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e && e.message ? e.message : e),
    });
  }
};
