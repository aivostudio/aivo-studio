// /api/auth/logout.js
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvDel = kv.kvDel;

// Cookie adları
const COOKIE_KV = "aivo_sess";
const COOKIE_JWT = "aivo_session";

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

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function expireCookie(name) {
  // Safari uyumlu: Max-Age=0 + Expires geçmiş + Path=/ + SameSite=Lax
  // Secure + HttpOnly ekliyoruz (cookie server-side ise)
  return `${name}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure; HttpOnly`;
}

export default async function handler(req, res) {
  try {
    const cookies = parseCookies(req.headers.cookie);

    // 1) KV session varsa KV'den sil
    const sid = cookies[COOKIE_KV];
    if (sid && typeof kvDel === "function") {
      try { await kvDel(`sess:${sid}`); } catch (_) {}
    }

    // 2) İki cookie'yi de kesin kapat
    res.setHeader("Set-Cookie", [
      expireCookie(COOKIE_KV),
      expireCookie(COOKIE_JWT),
    ]);

    return json(res, 200, { ok: true });
  } catch (e) {
    // Logout asla patlamasın: yine de cookie expire etmeye çalış
    try {
      res.setHeader("Set-Cookie", [
        expireCookie(COOKIE_KV),
        expireCookie(COOKIE_JWT),
      ]);
    } catch (_) {}

    return json(res, 200, { ok: true, soft: true });
  }
}
