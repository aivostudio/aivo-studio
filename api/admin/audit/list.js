// /api/admin/audit/list.js
// Lists latest audit events from KV keys admin:audit:<id>
// Uses seq counter to page backwards; no SCAN needed.

const { kvGetJson } = require("../../_kv.js");

function normEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function parseAllowlist() {
  return String(process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(email) {
  const allow = parseAllowlist();
  return !!email && allow.includes(email);
}

async function kvGetNumber(key) {
  const v = await kvGetJson(key);
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v._raw) return Number(v._raw) || 0;
  return Number(v) || 0;
}

module.exports = async (req, res) => {
  try {
    const admin = normEmail(req.query.admin);
    if (!admin) return res.status(403).json({ ok: false, error: "admin_required" });
    if (!isAdmin(admin)) return res.status(403).json({ ok: false, error: "admin_forbidden" });

    const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);

    const seq = await kvGetNumber("admin:audit:seq");
    const items = [];

    for (let id = seq; id > 0 && items.length < limit; id--) {
      const ev = await kvGetJson(`admin:audit:${id}`);
      if (ev) items.push(ev);
    }

    return res.status(200).json({ ok: true, count: items.length, items });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "audit_list_failed", detail: String(e?.message || e) });
  }
};
