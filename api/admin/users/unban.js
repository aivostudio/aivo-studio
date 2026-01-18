// /api/admin/users/unban.js
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

function toEmail(v) {
  return String(v || "").trim().toLowerCase();
}

const BAN_INDEX_KEY = "ban_index";

async function loadBanIndex() {
  const v = await kvGetJson(BAN_INDEX_KEY);
  if (!v) return [];
  if (Array.isArray(v)) return v.map(toEmail).filter(Boolean);
  if (v && Array.isArray(v.items)) return v.items.map(toEmail).filter(Boolean);
  return [];
}

async function removeFromBanIndex(email) {
  const e = toEmail(email);
  if (!e) return;
  const list = await loadBanIndex();
  const next = list.filter((x) => x !== e);
  await kvSetJson(BAN_INDEX_KEY, next);
}

module.exports = async (req, res) => {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "method_not_allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const admin = toEmail(body.admin);
    const email = toEmail(body.email);

    if (!admin || !isAdminEmail(admin)) return json(res, 403, { ok: false, error: "admin_forbidden" });
    if (!email || !email.includes("@")) return json(res, 400, { ok: false, error: "email_invalid" });

    const banKey = "ban:" + email;

    try { await kvDel(banKey); } catch (_) {}
    try { await removeFromBanIndex(email); } catch (_) {}

    return json(res, 200, { ok: true, email, unbanned: true, deletedKey: banKey, indexKey: BAN_INDEX_KEY });
  } catch (e) {
    return json(res, 500, { ok: false, error: "unban_failed", message: String((e && e.message) || e) });
  }
};
