// /api/auth/verify.js
import crypto from "crypto";
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;
const kvSetJson = kv.kvSetJson;
const kvDel =
  kv.kvDel || kv.kvDelKey || kv.kvDelSafe || kv.kvDelJson || null;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data, null, 2));
}

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

async function delSafe(key) {
  try {
    if (typeof kvDel === "function") return await kvDel(key);
  } catch (_) {}
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return json(res, 405, { ok: false, error: "method_not_allowed" });
    }

    if (typeof kvGetJson !== "function" || typeof kvSetJson !== "function") {
      return json(res, 503, { ok: false, error: "kv_not_available" });
    }

    const token = String(req.query?.token || "").trim();
    if (!token) return json(res, 400, { ok: false, error: "missing_token" });

    const verifyKey = `verify:${token}`;
    const payload = await kvGetJson(verifyKey).catch(() => null);

    if (!payload || typeof payload !== "object") {
      return json(res, 400, { ok: false, error: "invalid_or_expired_token" });
    }

    const verifiedEmail = normalizeEmail(payload.email);
    if (!verifiedEmail || !verifiedEmail.includes("@")) {
      return json(res, 400, { ok: false, error: "bad_payload_missing_email" });
    }

    // ✅ ban kontrol
    const banned = await kvGetJson(`ban:${verifiedEmail}`).catch(() => null);
    if (banned) {
      await delSafe(verifyKey);
      return json(res, 403, { ok: false, error: "user_banned" });
    }

    const now = Date.now();

    // ✅ mevcut user varsa çek (OVERWRITE ETME)
    const existing = await kvGetJson(`user:${verifiedEmail}`).catch(() => null);

    const next = {
      id: existing?.id || payload.id || crypto.randomUUID(),
      email: verifiedEmail,
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

    await kvSetJson(`user:${verifiedEmail}`, next);

    // verify tokenı temizle
    await delSafe(verifyKey);

    // ✅ Verify success redirect
    const from = req.query?.from ? String(req.query.from).trim().toLowerCase() : "";
    const returnToRaw = req.query?.returnTo ? String(req.query.returnTo).trim() : "";
    const email = verifiedEmail;

    if (returnToRaw && returnToRaw.startsWith("/")) {
      const joiner = returnToRaw.includes("?") ? "&" : "?";
      const safeLocation =
        `${returnToRaw}${joiner}verified=1&email=${encodeURIComponent(email)}`;

      res.statusCode = 302;
      res.setHeader("Location", safeLocation);
      res.end();
      return;
    }

    let fallbackLocation = "/login.html?returnTo=/studio.v2.html";

    if (from === "ios") {
      fallbackLocation = "/login.ios.html?returnTo=/studio.ios.html";
    } else if (from === "play" || from === "android") {
      fallbackLocation = "/login.play.html?returnTo=/studio.play.html";
    } else if (from === "mobile") {
      fallbackLocation = "/login.mobile.html?returnTo=/studio.mobile.html";
    }

    const joiner = fallbackLocation.includes("?") ? "&" : "?";
    const finalLocation =
      `${fallbackLocation}${joiner}verified=1&email=${encodeURIComponent(email)}`;

    res.statusCode = 302;
    res.setHeader("Location", finalLocation);
    res.end();
    return;
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "verify_failed",
      message: String(e?.message || e),
    });
  }
}
