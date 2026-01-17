// /api/admin/users/delete.js
const { kvGetJson, kvSetJson, kvDel } = require("../../_kv");

function isAdminEmail(email) {
  const adminList = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return adminList.includes(String(email || "").trim().toLowerCase());
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

const norm = (v) => String(v || "").trim().toLowerCase();

// (opsiyonel) bazı projelerde liste key’i var; varsa temizler
const LIST_KEYS = ["users:list", "users", "users:index", "users:all", "users:items"];

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const admin = norm(body.admin);
    const email = norm(body.email);
    const mode = String(body.mode || "hard").trim().toLowerCase(); // soft | hard

    if (!admin || !isAdminEmail(admin)) return json(res, 403, { ok: false, error: "admin_forbidden" });
    if (!email || !email.includes("@")) return json(res, 400, { ok: false, error: "email_invalid" });

    const USER_KEY = "user:" + email;
    const BAN_KEY = "ban:" + email;

    // ✅ SOFT: kullanıcıyı pasifleştir (login/register bunu engelleyecek)
    if (mode === "soft") {
      const user = (await kvGetJson(USER_KEY)) || { email };
      const updatedAt = Date.now();
      await kvSetJson(USER_KEY, { ...user, disabled: true, updatedAt });
      return json(res, 200, { ok: true, mode: "soft", email, updatedAt });
    }

    // ✅ HARD: önce BAN yaz (artık bu email ile login/register asla olmasın)
    await kvSetJson(BAN_KEY, { email, by: admin, at: Date.now(), reason: "admin_hard_delete" });

    // ✅ sonra tüm olası kayıtları sil (login hangi key’i kullanıyorsa bile temiz olsun)
    const keysToDelete = [
      USER_KEY,
      "auth:" + email,
      "pass:" + email,
      "password:" + email,
      "account:" + email,
      "session:" + email,
      "sessions:" + email,
      "token:" + email,
      "tokens:" + email,
      "credits:" + email,
      "invoices:" + email,
      "purchases:" + email,
      "presence:" + email,
      "reset:" + email,
      "forgot:" + email,
      "verify:" + email,
    ];

    for (const k of keysToDelete) {
      try {
        await kvDel(k);
      } catch (_) {}
    }

    // ✅ liste/index keyleri varsa içinden çıkar
    for (const lk of LIST_KEYS) {
      try {
        const list = (await kvGetJson(lk)) || [];
        if (Array.isArray(list)) {
          const next = list.filter((u) => norm(u && u.email) !== email);
          if (next.length !== list.length) await kvSetJson(lk, next);
        }
      } catch (_) {}
    }

    return json(res, 200, { ok: true, mode: "hard", email, banned: true, deletedKeys: keysToDelete });
  } catch (e) {
    return json(res, 500, { ok: false, error: "delete_failed", message: String((e && e.message) || e) });
  }
};
