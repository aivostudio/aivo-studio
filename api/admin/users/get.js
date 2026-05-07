// /api/admin/users/get.js

function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
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

    // ✅ _kv.js CommonJS export ediyor: getRedis + kvGetJson
    const kvmod = await import("../../_kv.js");
    const kv = kvmod.default || kvmod; // CJS uyumu

    if (!kv || typeof kv.getRedis !== "function") {
      return res.status(500).json({ ok: false, error: "kv_helpers_missing" });
    }

 const list = await kv.kvGetJson("users:list").catch(() => []);

const users = Array.isArray(list)
  ? list
      .filter((u) => u && u.email)
      .map((u) => ({
        email: String(u.email || "").trim().toLowerCase(),
        role: u.role || "user",
        createdAt: u.createdAt || u.created || null,
        updatedAt: u.updatedAt || u.updated || null,
      }))
  : [];

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
