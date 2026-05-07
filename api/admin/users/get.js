// /api/admin/users/get.js

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

    const admin = String(req.query.admin || "").toLowerCase();
    if (!admin) return res.status(401).json({ ok: false, error: "admin_required" });
    if (!isAdminEmail(admin)) return res.status(403).json({ ok: false, error: "admin_forbidden" });

    const kvmod = await import("../../_kv.js");
    const kv = kvmod.default || kvmod;

    if (!kv || typeof kv.getRedis !== "function" || typeof kv.kvGetJson !== "function") {
      return res.status(500).json({ ok: false, error: "kv_helpers_missing" });
    }

    const redis = kv.getRedis();
    const byEmail = new Map();

    function addUser(u, fallbackEmail = "") {
      const email = String(u?.email || fallbackEmail || "").trim().toLowerCase();
      if (!email || !email.includes("@")) return;

      const prev = byEmail.get(email) || {};
      byEmail.set(email, {
        ...prev,
        ...u,
        email,
        role: u?.role || prev.role || "user",
        createdAt: u?.createdAt || u?.created || prev.createdAt || prev.created || null,
        updatedAt: u?.updatedAt || u?.updated || prev.updatedAt || prev.updated || null,
      });
    }

    const list = await kv.kvGetJson("users:list").catch(() => []);
    if (Array.isArray(list)) {
      for (const u of list) addUser(u);
    }

    async function scanPattern(pattern) {
      let cursor = 0;

      do {
        const resp = await redis.scan(cursor, { match: pattern, count: 1000 });

        let nextCursor = 0;
        let keys = [];

        if (Array.isArray(resp)) {
          nextCursor = Number(resp[0]) || 0;
          keys = Array.isArray(resp[1]) ? resp[1] : [];
        } else {
          nextCursor = Number(resp?.cursor) || 0;
          keys = Array.isArray(resp?.keys) ? resp.keys : [];
        }

        for (const key of keys) {
          const u = await kv.kvGetJson(key).catch(() => null);
          if (!u) continue;

          const fallbackEmail = String(key)
            .replace(/^user:/, "")
            .replace(/^users:/, "");

          addUser(u, fallbackEmail);
        }

        cursor = nextCursor;
      } while (cursor !== 0 && byEmail.size < 10000);
    }

    await scanPattern("user:*");
    await scanPattern("users:*");

    const users = Array.from(byEmail.values()).map((u) => ({
      email: String(u.email || "").trim().toLowerCase(),
      role: u.role || "user",
      createdAt: u.createdAt || u.created || null,
      updatedAt: u.updatedAt || u.updated || null,
    }));

    users.sort((a, b) => String(a.email).localeCompare(String(b.email)));
    return res.status(200).json(users);
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "users_get_failed",
      message: err?.message || String(err),
    });
  }
}
