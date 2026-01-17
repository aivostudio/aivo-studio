// /api/admin/users/delete.js
const { kvGetJson, kvSetJson, kvDel } = require("../../_kv");

// ADMIN_EMAILS: "a@b.com,c@d.com" veya "a@b.com"
function isAdminEmail(email) {
  const adminList = String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
  return adminList.includes(String(email || "").trim().toLowerCase());
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const admin = String(body.admin || "").trim().toLowerCase();
    const email = String(body.email || "").trim().toLowerCase();
    const mode = String(body.mode || "soft").trim().toLowerCase(); // soft | hard

    if (!admin || !isAdminEmail(admin)) return json(res, 403, { ok: false, error: "admin_forbidden" });
    if (!email || !email.includes("@")) return json(res, 400, { ok: false, error: "email_invalid" });

    // Kullanıcı listesi (senin get endpoint’in hangi key’i kullanıyorsa aynı olmalı)
    // Eğer sende farklıysa: admin/users/get.js içinde hangi key okunuyorsa burayı ona göre eşle.
    const LIST_KEY = "users:list";

    const list = (await kvGetJson(LIST_KEY)) || [];
    const idx = list.findIndex(u => String(u.email || "").toLowerCase() === email);

    if (mode === "soft") {
      if (idx === -1) return json(res, 404, { ok: false, error: "user_not_found" });

      const u = list[idx] || {};
      u.disabled = true;
      u.updatedAt = Date.now();
      list[idx] = u;

      await kvSetJson(LIST_KEY, list);
      // user obj varsa onu da işaretleyelim (varsa)
      await kvSetJson("user:" + email, { ...(await kvGetJson("user:" + email) || {}), disabled: true, updatedAt: u.updatedAt });

      return json(res, 200, { ok: true, mode: "soft", email });
    }

    // HARD DELETE (KV’den kaldır)
    // 1) listeden çıkar
    const newList = idx >= 0 ? list.filter(u => String(u.email || "").toLowerCase() !== email) : list;
    await kvSetJson(LIST_KEY, newList);

    // 2) kullanıcı kaydı + ilişkili olası key’ler
    const keysToDelete = [
      "user:" + email,
      "credits:" + email,
      "invoices:" + email,
      "purchases:" + email,
      "reset:" + email,
      "verify:" + email,
      "presence:" + email,
    ];

    for (const k of keysToDelete) {
      try { await kvDel(k); } catch (_) {}
    }

    return json(res, 200, { ok: true, mode: "hard", email, deletedKeys: keysToDelete, totalUsers: newList.length });
  } catch (e) {
    return json(res, 500, { ok: false, error: "delete_failed", message: String(e && e.message || e) });
  }
};
