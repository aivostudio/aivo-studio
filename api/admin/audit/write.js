// /api/admin/audit/write.js
// Writes audit event to KV list: admin:audit (latest first)
// Requires: /api/_kv.js (kvIncr, kvSetJson, kvGetJson)

const { kvIncr, kvSetJson } = require("../../_kv.js");

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

module.exports = async (req, res) => {
  try {
    const admin = normEmail(req.query.admin || req.body?.admin);
    if (!admin) return res.status(403).json({ ok: false, error: "admin_required" });
    if (!isAdmin(admin)) return res.status(403).json({ ok: false, error: "admin_forbidden" });

    const action = String(req.body?.action || "").trim();
    const target = String(req.body?.target || "").trim(); // email or id
    const meta = req.body?.meta && typeof req.body.meta === "object" ? req.body.meta : null;

    if (!action) return res.status(400).json({ ok: false, error: "action_required" });

    const id = await kvIncr("admin:audit:seq", 1);
    const ts = new Date().toISOString();

    const event = {
      id: Number(id) || 0,
      ts,
      admin,
      action,
      target: target || null,
      meta,
    };

    await kvSetJson(`admin:audit:${event.id}`, event);
    return res.status(200).json({ ok: true, id: event.id, event });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "audit_write_failed", detail: String(e?.message || e) });
  }
};
