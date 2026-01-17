// /api/admin/users/get.js
import { kv } from "../_kv.js";

// Basit admin allowlist (mevcut admin/auth ile uyumlu)
function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);

  return list.includes(String(email || "").toLowerCase());
}

export default async function handler(req, res) {
  try {
    // Sadece GET
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const admin = String(req.query.admin || "").toLowerCase();
    if (!admin) {
      return res.status(401).json({ ok: false, error: "admin_required" });
    }

    if (!isAdminEmail(admin)) {
      return res.status(403).json({ ok: false, error: "admin_forbidden" });
    }

    // ---- USERS OKUMA ----
    // Varsayım: kullanıcılar "user:{email}" key’leriyle tutuluyor
    // (register.js genelde böyle yapar)
    const keys = await kv.keys("user:*");

    const users = [];
    for (const key of keys) {
      const u = await kv.get(key);
      if (!u) continue;

      users.push({
        email: u.email || key.replace("user:", ""),
        role: u.role || "user",
        createdAt: u.createdAt || u.created || null,
        updatedAt: u.updatedAt || null,
      });
    }

    // Email’e göre sırala (opsiyonel ama hoş)
    users.sort((a, b) => a.email.localeCompare(b.email));

    return res.status(200).json(users);
  } catch (err) {
    // 🔥 KRİTİK: 500 bile olsa JSON dön
    return res.status(500).json({
      ok: false,
      error: "users_get_failed",
      message: err?.message || String(err),
    });
  }
}
