// /api/admin/users/delete.js

function isAdminEmail(email) {
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(String(email || "").trim().toLowerCase());
}

function toEmail(v) {
  return String(v || "").trim().toLowerCase();
}

const BAN_INDEX_KEY = "ban_index";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

    const admin = toEmail(body.admin);
    const email = toEmail(body.email);
    const mode = String(body.mode || "soft").trim().toLowerCase();
    const banFlag =
      body && Object.prototype.hasOwnProperty.call(body, "ban")
        ? body.ban
        : undefined;
    const shouldBan = banFlag === false ? false : true;

    if (!admin || !isAdminEmail(admin)) {
      return res.status(403).json({ ok: false, error: "admin_forbidden" });
    }

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "email_invalid" });
    }

    const kvmod = await import("../../_kv.js");
    const kv = kvmod.default || kvmod;

    if (
      !kv ||
      typeof kv.kvGetJson !== "function" ||
      typeof kv.kvSetJson !== "function" ||
      typeof kv.kvDel !== "function"
    ) {
      return res.status(500).json({ ok: false, error: "kv_helpers_missing" });
    }

    const USER_KEY = "user:" + email;
    const user = await kv.kvGetJson(USER_KEY);

    async function loadBanIndex() {
      const v = await kv.kvGetJson(BAN_INDEX_KEY);
      if (!v) return [];
      if (Array.isArray(v)) return v.map(toEmail).filter(Boolean);
      if (v && Array.isArray(v.items)) return v.items.map(toEmail).filter(Boolean);
      return [];
    }

    async function addToBanIndex(targetEmail) {
      const e = toEmail(targetEmail);
      if (!e) return [];
      const list = await loadBanIndex();
      if (!list.includes(e)) list.unshift(e);
      const trimmed = list.slice(0, 5000);
      await kv.kvSetJson(BAN_INDEX_KEY, trimmed);
      return trimmed;
    }

    if (mode === "soft") {
      if (!user) {
        return res.status(404).json({ ok: false, error: "user_not_found" });
      }

      const updatedAt = Date.now();
      await kv.kvSetJson(USER_KEY, { ...user, disabled: true, updatedAt });

      return res.status(200).json({
        ok: true,
        mode: "soft",
        email,
        updatedAt
      });
    }

    const keysToDelete = [
      USER_KEY,
      "credits:" + email,
      "invoices:" + email,
      "purchases:" + email,
      "reset:" + email,
      "verify:" + email,
      "presence:" + email
    ];

    const deletedKeys = [];

    for (const key of keysToDelete) {
      try {
        await kv.kvDel(key);
        deletedKeys.push(key);
      } catch (_) {}
    }

    const banKey = "ban:" + email;

    if (shouldBan) {
      try {
        await kv.kvSetJson(banKey, {
          email,
          bannedAt: Date.now(),
          by: admin,
          reason: "hard_delete"
        });
        deletedKeys.push(banKey);
      } catch (_) {}

      try {
        await addToBanIndex(email);
        deletedKeys.push(BAN_INDEX_KEY);
      } catch (_) {}
    }

    return res.status(200).json({
      ok: true,
      mode: "hard",
      email,
      banned: shouldBan,
      userFoundBeforeDelete: !!user,
      deletedKeys
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "delete_failed",
      message: err?.message || String(err)
    });
  }
}
