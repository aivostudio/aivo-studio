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

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const admin = String(body.admin || "").trim().toLowerCase();
    const email = String(body.email || "").trim().toLowerCase();
    const mode = String(body.mode || "soft").trim().toLowerCase(); // soft | hard

    // ✅ NEW (geri uyumlu): ban kontrol bayrağı
    // - body.ban === false ise ban yazma
    // - aksi halde (undefined/true/1/"true") eski gibi ban yazar
    const banFlag = (body && Object.prototype.hasOwnProperty.call(body, "ban")) ? body.ban : undefined;
    const shouldBan = (banFlag === false) ? false : true;

    if (!admin || !isAdminEmail(admin)) return json(res, 403, { ok: false, error: "admin_forbidden" });
    if (!email || !email.includes("@")) return json(res, 400, { ok: false, error: "email_invalid" });

    const USER_KEY = "user:" + email;

    // ✅ user var mı (soft için şart)
    const user = await kvGetJson(USER_KEY);

    // SOFT: disabled=true
    if (mode === "soft") {
      if (!user) return json(res, 404, { ok: false, error: "user_not_found" });
      const updatedAt = Date.now();
      await kvSetJson(USER_KEY, { ...user, disabled: true, updatedAt });
      return json(res, 200, { ok: true, mode: "soft", email, updatedAt });
    }

    // HARD: ilişkili key’leri sil + (opsiyonel) BAN yaz
    const keysToDelete = [
      USER_KEY,
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

    // ✅ BAN KEY (login/register engeli) — artık opsiyonel
    const banKey = "ban:" + email;
    if (shouldBan) {
      try {
        await kvSetJson(banKey, { email, bannedAt: Date.now(), by: admin, reason: "hard_delete" });
      } catch (_) {}
    }

    return json(res, 200, {
      ok: true,
      mode: "hard",
      email,
      banned: shouldBan ? true : false,
      deletedKeys: shouldBan ? [...keysToDelete, banKey] : [...keysToDelete],
    });
  } catch (e) {
    return json(res, 500, { ok: false, error: "delete_failed", message: String((e && e.message) || e) });
  }
};
