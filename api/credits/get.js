// /api/credits/get.js  (SINGLE SOURCE OF TRUTH: requireAuth -> credits:{sub})
import { requireAuth } from "../_lib/auth.js";
import { Redis } from "@upstash/redis";

function json(res, code, obj) {
  res.status(code).setHeader("content-type", "application/json").end(JSON.stringify(obj));
}
function safeStr(v) { return String(v == null ? "" : v).trim(); }
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

export default async function handler(req, res) {
  try {
    // Auth (consume.js ile aynı kaynak)
    const s = requireAuth(req, res);
    if (!s) return;

    const redis = Redis.fromEnv();

    // ✅ Tek anahtar: credits:{sub}  (consume.js ile birebir aynı)
    const key = `credits:${s.sub}`;
    let credits = toInt(await redis.get(key));

    // ------------------------------------------------------------
    // (OPSİYONEL AMA ÖNERİLEN) MIGRATE: credits:{email} -> credits:{sub}
    // Senin eski get.js email bazlı okuduğu için 29770 email altında duruyor olabilir.
    // İlk çağrıda sub 0 ise, email varsa email key'ini oku ve sub'a taşı.
    // ------------------------------------------------------------
    if (credits <= 0 && s.email) {
      const email = safeStr(s.email).toLowerCase();
      const legacyKey = `credits:${email}`;
      const legacyCredits = toInt(await redis.get(legacyKey));

      if (legacyCredits > 0) {
        // sub'a yaz
        await redis.set(key, legacyCredits);
        // legacy'yi sıfırla (istersen sil)
        await redis.set(legacyKey, 0);

        credits = legacyCredits;
      }
    }

    return json(res, 200, { ok: true, sub: s.sub, credits });
  } catch (e) {
    return json(res, 500, { ok: false, error: "server_error", detail: safeStr(e?.message || e) });
  }
}
