// api/auth/register.js
// =======================================================
// REGISTER — v2 (Clean, KV-safe, no hanging)
// - Email + password ile kullanıcı oluşturur
// - KV write/read timeout korumalı
// - Mail YOK (bilerek, sonra eklenecek)
// =======================================================

const crypto = require("crypto");
const { kvGetJson, kvSetJson } = require("../_kv");

// ---------------- helpers ----------------
function sha256(input) {
  return crypto.createHash("sha256").update(String(input)).digest("hex");
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function validatePassword(pw) {
  const s = String(pw || "");
  if (s.length < 6) return "password_too_short";
  return null;
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label || "timeout")), ms)
    ),
  ]);
}

// ---------------- handler ----------------
module.exports = async function register(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // Body normalize
  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ ok: false, error: "invalid_json" });
    }
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!email) {
    return res.status(400).json({ ok: false, error: "email_required" });
  }

  const pwErr = validatePassword(password);
  if (pwErr) {
    return res.status(400).json({ ok: false, error: pwErr });
  }

  const userKey = `user:${email}`;
  const now = Date.now();

  try {
    // ---- check existing (timeout protected)
    const existing = await withTimeout(
      kvGetJson(userKey),
      3000,
      "kv_get_user_timeout"
    );

    if (existing) {
      return res
        .status(409)
        .json({ ok: false, error: "user_already_exists" });
    }

    // ---- create user
    const user = {
      email,
      passwordHash: sha256(password),
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    await withTimeout(
      kvSetJson(userKey, user),
      3000,
      "kv_set_user_timeout"
    );

    // ---- starter credits (non-blocking)
    const starterCredits = Number.isFinite(+process.env.STARTER_CREDITS)
      ? Math.max(0, Math.floor(+process.env.STARTER_CREDITS))
      : 5;

    withTimeout(
      kvSetJson(`credits:${email}`, {
        credits: starterCredits,
        updatedAt: now,
      }),
      3000,
      "kv_set_credits_timeout"
    ).catch(() => {});

    // ---- SUCCESS
    return res.status(201).json({
      ok: true,
      email,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message || "register_failed",
    });
  }
};
