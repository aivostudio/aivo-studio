// api/admin/users/disable.js

function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(email || "").toLowerCase());
}

function isEmailLike(v) {
  const s = String(v || "").trim().toLowerCase();
  return s.includes("@") && s.includes(".");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.body || {};
    const admin = String(body.admin || "").trim().toLowerCase();
    const email = String(body.email || "").trim().toLowerCase();
    const disabled = Boolean(body.disabled);
    const reason = String(body.reason || "").trim() || (disabled ? "disabled_by_admin" : "enabled_by_admin");

    if (!admin) return res.status(401).json({ ok: false, error: "admin_required" });
    if (!isAdminEmail(admin)) return res.status(403).json({ ok: false, error: "admin_forbidden" });

    if (!isEmailLike(email)) return res.status(400).json({ ok: false, error: "email_invalid" });

    const kvmod = await import("../../_kv.js");
    const kv = kvmod.default || kvmod;

    const key = "user:" + email;
    const u = await kv.kvGetJson(key);

    if (!u) {
      return res.status(404).json({ ok: false, error: "user_not_found", email });
    }

    const now = Date.now();

    const next = {
      ...u,
      email: u.email || email,
      disabled,
      disabledAt: disabled ? now : null,
      disabledReason: disabled ? reason : null,
      updatedAt: now,
      audit: Array.isArray(u.audit) ? u.audit : [],
    };

    // küçük audit izi (son 50 tut)
    next.audit = [
      {
        ts: now,
        action: disabled ? "disable" : "enable",
        admin,
        reason,
      },
      ...next.audit,
    ].slice(0, 50);

    await kv.kvSetJson(key, next);

    return res.status(200).json({
      ok: true,
      email,
      disabled,
      updatedAt: next.updatedAt,
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "users_disable_failed",
      message: err?.message || String(err),
    });
  }
}
