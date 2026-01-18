// bans-list.js — TEK BLOK (drop-in, scan + parse + cursor loop + key->email, JSON-safe)

export default async function handler(req, res) {
  try {
    // 1) Admin check (sende zaten varsa bunu kendi check'inle değiştir)
    const admin = (req.query.admin || "").toString().trim().toLowerCase();
    if (!admin) return json(res, 403, { ok: false, error: "admin_required" });
    // NOTE: allowlist kontrolün varsa burada yap; yoksa aşağıyı kendi mantığınla değiştir.
    // if (!ADMIN_EMAILS.includes(admin)) return json(res, 403, { ok:false, error:"admin_forbidden" });

    // 2) Robust scanKeys: Upstash/Vercel KV veya ioredis/node-redis her format
    async function scanKeys(redis, pattern) {
      let cursor = "0";
      const out = [];

      for (let guard = 0; guard < 100; guard++) {
        let resScan;

        // Try Upstash/Vercel style
        try {
          resScan = await redis.scan(cursor, { match: pattern, count: 200 });
        } catch (e1) {
          // Fallback ioredis/node-redis style
          resScan = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
        }

        let nextCursor = "0";
        let keys = [];

        if (Array.isArray(resScan)) {
          nextCursor = String(resScan[0] ?? "0");
          keys = Array.isArray(resScan[1]) ? resScan[1] : [];
        } else if (resScan && typeof resScan === "object") {
          nextCursor = String(resScan.cursor ?? "0");
          keys = Array.isArray(resScan.keys) ? resScan.keys : [];
        }

        for (const k of keys) out.push(k);

        cursor = nextCursor;
        if (cursor === "0") break;
      }

      return out;
    }

    function emailFromBanKey(k) {
      if (!k || typeof k !== "string") return null;
      if (!k.startsWith("ban:")) return null;
      const email = k.slice("ban:".length).trim().toLowerCase();
      if (!email || email === "index" || email === "*") return null;
      return email;
    }

    // 3) Fetch keys
    const keysRaw = await scanKeys(redis, "ban:*");

    // 4) Build items from keys (value JSON'a bağımlı değil)
    const items = keysRaw
      .filter((k) => typeof k === "string" && k.startsWith("ban:"))
      .filter((k) => k !== "ban:index")
      .map((k) => ({ key: k, email: emailFromBanKey(k) }))
      .filter((x) => !!x.email);

    // 5) Optional: also enrich with stored ban object if JSON ise (bozulmaz)
    // (Eğer kvGetJson yoksa bu blok zaten çalışmayacak; istersen komple sil.)
    if (typeof kvGetJson === "function") {
      for (let i = 0; i < items.length; i++) {
        try {
          const v = await kvGetJson(items[i].key);
          if (v && typeof v === "object") items[i] = { ...items[i], ...v };
        } catch (_) {}
      }
    }

    return json(res, 200, { ok: true, count: items.length, items });
  } catch (e) {
    return json(res, 500, { ok: false, error: "bans_list_failed", detail: String(e?.message || e) });
  }
}

/* helpers (sende zaten varsa silip kendi json helper'ını kullan) */
function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

/*
  Gereken globals:
  - redis: redis client instance (Upstash/Vercel KV/Redis)
  - (opsiyonel) kvGetJson(key): JSON parse eden getter
*/
