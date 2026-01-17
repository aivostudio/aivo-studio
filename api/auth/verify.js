// /api/auth/verify.js
import crypto from "crypto";
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;
const kvSetJson = kv.kvSetJson;
const kvDel     = kv.kvDel || kv.kvDelKey || kv.kvDelSafe || kv.kvDelJson || null;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data, null, 2));
}

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

async function delSafe(key){
  try { if (typeof kvDel === "function") return await kvDel(key); } catch(_) {}
  // kvDel yoksa sessiz geç
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return json(res, 405, { ok: false, error: "method_not_allowed" });
    }

    if (typeof kvGetJson !== "function" || typeof kvSetJson !== "function") {
      return json(res, 503, { ok:false, error:"kv_not_available" });
    }

    const token = String(req.query?.token || "").trim();
    if (!token) return json(res, 400, { ok: false, error: "missing_token" });

    const verifyKey = `verify:${token}`;
    const payload = await kvGetJson(verifyKey);

    if (!payload || typeof payload !== "object") {
      return json(res, 400, { ok: false, error: "invalid_or_expired_token" });
    }

    const email = normalizeEmail(payload.email);
    if (!email || !email.includes("@")) {
      return json(res, 400, { ok: false, error: "bad_payload_missing_email" });
    }

    // ✅ ban kontrol
    const banned = await kvGetJson(`ban:${email}`).catch(() => null);
    if (banned) {
      await delSafe(verifyKey);
      return json(res, 403, { ok:false, error:"user_banned" });
    }

    const now = Date.now();

    // ✅ mevcut user varsa çek (OVERWRITE ETME)
    const existing = await kvGetJson(`user:${email}`).catch(() => null);

    const next = {
      id: existing?.id || payload.id || crypto.randomUUID(),
      email,
      name: payload.name || existing?.name || "",
      role: existing?.role || payload.role || "user",
      createdAt: existing?.createdAt || payload.createdAt || now,
      updatedAt: now,
      verified: true,
      disabled: existing?.disabled === true ? true : false,
      // 🔥 kritik: passwordHash varsa yaz, yoksa eskisini KORU
      passwordHash: payload.passwordHash || existing?.passwordHash || undefined,
    };

    Object.keys(next).forEach((k) => next[k] === undefined && delete next[k]);

    await kvSetJson(`user:${email}`, next);

    // verify tokenı temizle
    await delSafe(verifyKey);

    // ✅ VERIFY sonrası beklenen akış:
    // - Index açılır
    // - Login modal açık gelir
    // - Login sonrası Studio’ya gitsin diye from taşırız
    const from = encodeURIComponent("/studio.html?verified=1");
    res.statusCode = 302;
    res.setHeader("Location", "/?open=login&from=" + from);
    res.end();

  } catch (e) {
    return json(res, 500, { ok:false, error:"verify_failed", message:String(e?.message || e) });
  }
}
