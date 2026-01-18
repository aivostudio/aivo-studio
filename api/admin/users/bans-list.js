// /api/admin/users/bans-list.js
const { kvGetJson } = require("../../_kv");

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

function toEmail(v) {
  return String(v || "").trim().toLowerCase();
}

const BAN_INDEX_KEY = "ban_index";

module.exports = async (req, res) => {
  if (req.method !== "GET") return json(res, 405, { ok: false, error: "method_not_allowed" });

  try {
    const admin = toEmail((req.query && req.query.admin) || "");
    if (!admin || !isAdminEmail(admin)) return json(res, 403, { ok: false, error: "admin_forbidden" });

    const v = await kvGetJson(BAN_INDEX_KEY);

    let items = [];
    if (Array.isArray(v)) items = v;
    else if (v && Array.isArray(v.items)) items = v.items;

    items = items.map(toEmail).filter(Boolean);

    return json(res, 200, { ok: true, count: items.length, items });
  } catch (e) {
    return json(res, 500, { ok: false, error: "bans_list_failed", message: String((e && e.message) || e) });
  }
};
