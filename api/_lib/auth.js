// /api/_lib/auth.js
// Amaç: Cookie (aivo_sess / aivo_session) içindeki SID ile KV'den sess doğrulamak
// Kullanım: const auth = await requireAuth(req, res);  // auth yoksa null döner (401)

const kvMod = require("../_kv.js");
const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;

const COOKIE_PRIMARY = "aivo_sess";
const COOKIE_LEGACY  = "aivo_session";

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function parseCookies(req) {
  const header = req?.headers?.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const p = part.trim();
    if (!p) return;
    const i = p.indexOf("=");
    if (i === -1) return;
    const k = p.slice(0, i).trim();
    const v = decodeURIComponent(p.slice(i + 1));
    out[k] = v;
  });
  return out;
}

function getSidFromCookies(req) {
  const cookies = parseCookies(req);
  return cookies[COOKIE_PRIMARY] || cookies[COOKIE_LEGACY] || null;
}

async function requireAuth(req, res) {
  try {
    if (typeof kvGetJson !== "function") {
      sendJson(res, 503, { ok: false, error: "kv_not_available" });
      return null;
    }

    const sid = getSidFromCookies(req);
    if (!sid) {
      sendJson(res, 401, { ok: false, error: "unauthorized_no_cookie" });
      return null;
    }

    const sess = await kvGetJson(`sess:${sid}`).catch(() => null);
    if (!sess || typeof sess !== "object") {
      sendJson(res, 401, { ok: false, error: "unauthorized_invalid_session" });
      return null;
    }

    // sess örn: { email, createdAt }
    const email = String(sess.email || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      sendJson(res, 401, { ok: false, error: "unauthorized_bad_session" });
      return null;
    }

    // İstersen burada user record da çekebilirsin:
    // const user = await kvGetJson(`user:${email}`) || await kvGetJson(`users:${email}`);
    // return { email, user, sid, sess };

    return { email, sid, sess };
  } catch (e) {
    sendJson(res, 401, { ok: false, error: "unauthorized" });
    return null;
  }
}

module.exports = { requireAuth };
