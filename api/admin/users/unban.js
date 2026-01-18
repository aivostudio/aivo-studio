// /api/admin/users/unban.js
const { kvDel } = require("../../_kv");

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

    if (!admin || !isAdminEmail(admin)) return json(res, 403, { ok: false, error: "admin_forbidden" });
    if (!email || !email.includes("@")) return json(res, 400, { ok: false, error: "email_invalid" });

    const banKey = "ban:" + email;
    try { await kvDel(banKey); } catch (_) {}

    return json(res, 200, { ok: true, email, unbanned: true, deletedKey: banKey });
  } catch (e) {
    return json(res, 500, { ok: false, error: "unban_failed", message: String((e && e.message) || e) });
  }
};
