// /api/admin/bans/list.js
const { getRedis, kvGetJson } = require("../../_kv");

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
  try {
    const admin = String(req.query.admin || "").toLowerCase();
    if (!isAdmin(admin)) return json(res, 403, { ok:false, error:"admin_forbidden" });

    const redis = getRedis();

    // ⚠️ scan ban:* (Upstash destekler)
    const { keys } = await redis.scan(0, { match: "ban:*", count: 100 });
    const items = [];

    for (const k of keys || []) {
      const v = await kvGetJson(k);
      if (v && v.email) items.push(v);
    }

    return json(res, 200, { ok:true, count: items.length, items });
  } catch (e) {
    return json(res, 500, { ok:false, error:"list_failed", message:String(e.message || e) });
  }
};
