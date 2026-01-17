// /api/admin/presence/online.js

function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(email || "").trim().toLowerCase());
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const admin = String(req.query.admin || "").trim().toLowerCase();
    if (!admin) return res.status(401).json({ ok: false, error: "admin_required" });
    if (!isAdminEmail(admin)) return res.status(403).json({ ok: false, error: "admin_forbidden" });

    const kvmod = await import("../../_kv.js");
    const kv = kvmod.default || kvmod;
    const redis = kv.getRedis();

    // ✅ hızlı bitirmek için: en fazla 1500 key say + 1.2s timeout
    let cursor = 0;
    const emails = [];
    const MAX_KEYS = 1500;

    while (true) {
      const resp = await withTimeout(
        redis.scan(cursor, { match: "presence:*", count: 300 }),
        1200
      );

      let nextCursor = 0;
      let keys = [];

      if (Array.isArray(resp)) {
        nextCursor = Number(resp[0]) || 0;
        keys = resp[1] || [];
      } else {
        nextCursor = Number(resp.cursor) || 0;
        keys = resp.keys || [];
      }

      for (const k of keys) {
        // presence:email@domain.com -> email’i çek
        const raw = String(k || "");
        const email = raw.startsWith("presence:") ? raw.slice("presence:".length) : "";
        if (email && email.includes("@")) emails.push(email.toLowerCase());
      }

      cursor = nextCursor;

      if (cursor === 0) break;
      if (emails.length >= MAX_KEYS) break; // güvenlik
    }

    // uniq
    const online = Array.from(new Set(emails));

    return res.status(200).json({
      ok: true,
      count: online.length,
      online, // ✅ admin.js bunu bekliyor, pill-online yanacak
    });
  } catch (err) {
    // timeout olursa da sayfa kilitlenmesin
    return res.status(200).json({
      ok: true,
      count: 0,
      online: [],
      warning: "presence_scan_failed",
      message: err?.message || String(err),
    });
  }
}
