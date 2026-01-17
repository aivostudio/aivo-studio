// api/admin/presence/online.js

function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(email || "").toLowerCase());
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

    let cursor = 0;
    let count = 0;

    do {
      const resp = await redis.scan(cursor, { match: "presence:*", count: 500 });
      if (Array.isArray(resp)) {
        cursor = Number(resp[0]) || 0;
        count += (resp[1] || []).length;
      } else {
        cursor = Number(resp.cursor) || 0;
        count += (resp.keys || []).length;
      }
    } while (cursor !== 0 && count < 20000);

    return res.status(200).json({ ok: true, count });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "presence_online_failed", message: err?.message || String(err) });
  }
}
