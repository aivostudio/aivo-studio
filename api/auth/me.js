// /api/auth/me.js
import crypto from "crypto";
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;

// Yeni cookie adı (KV session)
const COOKIE_KV = "aivo_sess";

// Eski cookie adı (JWT legacy)
const COOKIE_JWT = "aivo_session";
const JWT_SECRET = process.env.JWT_SECRET;

function b64urlDecode(str) {
  str = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

function signHS256(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i === -1) return;
    const k = p.slice(0, i).trim();
    const v = p.slice(i + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function verifyJWT(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = signHS256(data, secret);
  if (expected !== s) return null;

  const payload = JSON.parse(b64urlDecode(p));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;

  return payload;
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function resolveUserFromStore(email) {
  try {
    const normalized = normalizeEmail(email);
    if (!normalized) return null;
    if (typeof kvGetJson !== "function") return null;

    const keys = [`user:${normalized}`, `users:${normalized}`];

    for (const k of keys) {
      const u = await kvGetJson(k).catch(() => null);
      if (u && typeof u === "object") {
        return u;
      }
    }
  } catch (_) {}

  return null;
}

export default async function handler(req, res) {
  try {
    const cookies = parseCookies(req.headers.cookie);

    // 1) ✅ NEW FLOW: KV session cookie (aivo_sess)
    const sid = cookies[COOKIE_KV];
    if (sid) {
      if (typeof kvGetJson !== "function") {
        return json(res, 503, { ok: false, error: "kv_not_available" });
      }

      const sess = await kvGetJson(`sess:${sid}`).catch(() => null);
      if (sess && typeof sess === "object" && sess.email) {
        const email = normalizeEmail(sess.email);
        const user = await resolveUserFromStore(email);

        let verified = null;

        if (typeof sess.verified === "boolean") verified = sess.verified;
        else if (typeof sess.email_verified === "boolean") verified = sess.email_verified;
        else if (typeof sess.emailVerified === "boolean") verified = sess.emailVerified;
        else if (user && typeof user.verified === "boolean") verified = user.verified;
        else if (user && typeof user.email_verified === "boolean") verified = user.email_verified;
        else if (user && typeof user.emailVerified === "boolean") verified = user.emailVerified;

        if (verified === null) verified = true;

        return json(res, 200, {
          ok: true,
          email,
          name: (user && (user.name || user.first_name || user.firstName)) || "",
          surname: (user && (user.surname || user.last_name || user.lastName)) || "",
          role: sess.role || (user && user.role) || "user",
          verified,
          session: "kv",
        });
      }

      // sid var ama KV'de yok → invalid_session
      return json(res, 401, { ok: false, error: "invalid_session" });
    }

    // 2) ✅ LEGACY FLOW: JWT cookie (aivo_session) fallback
    const token = cookies[COOKIE_JWT];
    if (!token) return json(res, 401, { ok: false, error: "no_session" });

    if (!JWT_SECRET) {
      return json(res, 401, { ok: false, error: "invalid_session" });
    }

    const payload = verifyJWT(token, JWT_SECRET);
    if (!payload) return json(res, 401, { ok: false, error: "invalid_session" });

    const email = normalizeEmail(payload.email || payload.sub || null);
    const user = await resolveUserFromStore(email);

    let verified = null;
    if (typeof payload.verified === "boolean") verified = payload.verified;
    else if (typeof payload.email_verified === "boolean") verified = payload.email_verified;
    else if (typeof payload.emailVerified === "boolean") verified = payload.emailVerified;
    else if (user && typeof user.verified === "boolean") verified = user.verified;
    else if (user && typeof user.email_verified === "boolean") verified = user.email_verified;
    else if (user && typeof user.emailVerified === "boolean") verified = user.emailVerified;

    if (verified === null) verified = true;

    return json(res, 200, {
      ok: true,
      email,
      name: (user && (user.name || user.first_name || user.firstName)) || "",
      surname: (user && (user.surname || user.last_name || user.lastName)) || "",
      role: payload.role || (user && user.role) || "user",
      exp: payload.exp || null,
      verified,
      session: "jwt",
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
    });
  }
}
