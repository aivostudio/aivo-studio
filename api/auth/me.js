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
        return json(res, 200, {
          ok: true,
          email: sess.email,
          role: sess.role || "user",
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

    return json(res, 200, {
      ok: true,
      email: payload.email || payload.sub || null,
      role: payload.role || "user",
      exp: payload.exp || null,
      session: "jwt",
    });
  } catch (e) {
    return json(res, 500, { ok: false, error: "server_error", message: String(e?.message || e) });
  }
}
