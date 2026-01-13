// /api/auth/register.js
// =======================================================
// REGISTER — v1 (KV-backed)
// - Creates user with email+password
// - Stores in KV: user:<email>
// - Optional starter credits
// =======================================================

const crypto = require("crypto");
const { kvGet, kvSet } = require("../_kv"); // ✅ uses your existing /api/_kv.js

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

    const body = req.body || {};
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email) return res.status(400).json({ ok: false, error: "email_required" });
    const pwErr = validatePassword(password);
    if (pwErr) return res.status(400).json({ ok: false, error: pwErr });

    const keyUser = `user:${email}`;

    // existing?
    const existing = await kvGet(keyUser);
    if (existing) {
      return res.status(409).json({ ok: false, error: "user_already_exists" });
    }

    // store
    const now = Date.now();
    const user = {
      email,
      // ✅ simple hash (upgrade to bcrypt later)
      passwordHash: sha256(password),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await kvSet(keyUser, user);

    // Optional starter credits (default: 5)
    const starter = Number.isFinite(Number(process.env.STARTER_CREDITS))
      ? Math.max(0, Math.floor(Number(process.env.STARTER_CREDITS)))
      : 5;

    try {
      await kvSet(`credits:${email}`, { credits: starter, updatedAt: now });
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
