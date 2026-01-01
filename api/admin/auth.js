// api/admin/auth.js
module.exports = async (req, res) => {
  try {
    const email = String((req.query.email || req.body?.email || "")).trim().toLowerCase();
    const allow = String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const ok = !!email && allow.includes(email);

    return res.status(200).json({ ok, email, allow_count: allow.length });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "auth_failed" });
  }
};
