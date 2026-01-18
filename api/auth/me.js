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

async function resolveVerifiedFromUserStore(email) {
  // FAIL-OPEN: herhangi bir hata me'yi bozmamalı
  try {
    if (!email) return null;
    if (typeof kvGetJson !== "function") return null;

    // user key varyantları (geçmişte key farklı olabilir diye)
    const keys = [`user:${email}`, `users:${email}`];

    for (const k of keys) {
      const u = await kvGetJson(k).catch(() => null);
      if (u && typeof u === "object") {
        if (typeof u.verified === "boolean") return u.verified;
        if (typeof u.email_verified === "boolean") return u.email_verified;
        if (typeof u.emailVerified === "boolean") return u.emailVerified;
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
        // verified çözümü: önce session, yoksa user store (fail-open)
        let verified = null;

        if (typeof sess.verified === "boolean") verified = sess.verified;
        else if (typeof sess.email_verified === "boolean") verified = sess.email_verified;
        else if (typeof sess.emailVerified === "boolean") verified = sess.emailVerified;

        if (verified === null) {
          verified = await resolveVerifiedFromUserStore(sess.email);
        }

        // geçiş dönemi: bilinmiyorsa true (Studio kırılmasın)
        if (verified === null) verified = true;

        return json(res, 200, {
          ok: true,
          email: sess.email,
          role: sess.role || "user",
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
      // JWT cookie geldi ama secret yoksa doğrulayamayız
      return json(res, 401, { ok: false, error: "invalid_session" });
    }

    const payload = verifyJWT(token, JWT_SECRET);
    if (!payload) return json(res, 401, { ok: false, error: "invalid_session" });

    const email = payload.email || payload.sub || null;

    // verified çözümü: önce payload, yoksa user store (fail-open)
    let verified = null;
    if (typeof payload.verified === "boolean") verified = payload.verified;
    else if (typeof payload.email_verified === "boolean") verified = payload.email_verified;
    else if (typeof payload.emailVerified === "boolean") verified = payload.emailVerified;

    if (verified === null) {
      verified = await resolveVerifiedFromUserStore(email);
    }

    if (verified === null) verified = true;

    return json(res, 200, {
      ok: true,
      email,
      role: payload.role || "user",
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
