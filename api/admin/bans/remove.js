// /api/admin/bans/remove.js
const { kvDel } = require("../../_kv");

function isAdmin(email) {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .includes(String(email || "").toLowerCase());
}

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method !== "POST")
    return json(res, 405, { ok:false, error:"method_not_allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const admin = String(body.admin || "").toLowerCase();
    const email = String(body.email || "").toLowerCase();

    if (!isAdmin(admin)) return json(res, 403, { ok:false, error:"admin_forbidden" });
    if (!email.includes("@")) return json(res, 400, { ok:false, error:"email_invalid" });

    await kvDel("ban:" + email);

    return json(res, 200, { ok:true, email, unbanned:true });
  } catch (e) {
    return json(res, 500, { ok:false, error:"unban_failed", message:String(e.message || e) });
  }
};
