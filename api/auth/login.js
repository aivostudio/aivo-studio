// /api/auth/login.js
import bcrypt from "bcryptjs";
import crypto from "crypto";
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;
const kvSetJson = kv.kvSetJson;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

async function readJson(req) {
  try {
    if (req.body && typeof req.body === "object") return req.body;
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (!chunks.length) return {};
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "method_not_allowed" });
    }

    if (typeof kvGetJson !== "function" || typeof kvSetJson !== "function") {
      return json(res, 503, { ok: false, error: "kv_not_available" });
    }

    const body = await readJson(req);
    if (!body) {
      return json(res, 400, { ok: false, error: "invalid_json" });
    }

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");

    if (!email || !email.includes("@") || password.length < 1) {
      return json(res, 400, { ok: false, error: "bad_request" });
    }

    // ✅ USER READ (user: + users: fallback)
    const u1 = await kvGetJson(`user:${email}`).catch(() => null);
    const u2 = await kvGetJson(`users:${email}`).catch(() => null);
    const user =
      (u1 && typeof u1 === "object")
        ? u1
        : ((u2 && typeof u2 === "object") ? u2 : null);

    if (!user) {
      return json(res, 401, { ok: false, error: "user_not_found" });
    }

    if (user.disabled === true) {
      return json(res, 403, { ok: false, error: "user_disabled" });
    }

    if (user.verified === false) {
      return json(res, 403, { ok: false, error: "email_not_verified" });
    }

    const hash = user.passwordHash || user.passHash || user.hash || "";
    if (!hash) {
      return json(res, 401, { ok: false, error: "missing_password_hash" });
    }

    const ok = await bcrypt.compare(password, hash).catch(() => false);
    if (!ok) {
      return json(res, 401, { ok: false, error: "invalid_credentials" });
    }

    // ✅ SESSION
    const sid = crypto.randomBytes(24).toString("hex");
    await kvSetJson(
      `sess:${sid}`,
      { email, createdAt: Date.now() },
      { ex: 60 * 60 * 24 * 7 } // 7 gün
    );

   const maxAge = 60 * 60 * 24 * 7;

res.setHeader("Set-Cookie", [
  `aivo_sess=${sid}; Path=/; Domain=.aivo.tr; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`,
  `aivo_session=${sid}; Path=/; Domain=.aivo.tr; HttpOnly; SameSite=Lax; Secure; Max-Age=${maxAge}`, // legacy
]);



    return json(res, 200, {
      ok: true,
      user: {
        email,
        name: user.name || "",
        role: user.role || "user",
      },
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
    });
  }
}
