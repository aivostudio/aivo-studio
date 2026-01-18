// /api/admin/users/bans-list.js
// SCAN YOK. ban_index / ban:index üzerinden okur.
// ban_index format destekleri:
// - ["a@b.com", "c@d.com"]
// - { emails: ["a@b.com"] }
// - { items: ["a@b.com"] }
// - "JSON string" (yukarıdakilerin string hali)

import kv from "../../_kv.js";

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function normalizeEmails(raw) {
  let v = raw;

  // string ise JSON parse dene
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch (_) {}
  }

  let arr = [];
  if (Array.isArray(v)) arr = v;
  else if (v && typeof v === "object") arr = v.emails || v.items || [];

  return arr
    .filter((x) => typeof x === "string")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
}

export default async function handler(req, res) {
  try {
    const admin = String(req.query.admin || "").trim().toLowerCase();
    if (!admin) return json(res, 403, { ok: false, error: "admin_required" });

    if (!kv || typeof kv.get !== "function") {
      return json(res, 500, { ok: false, error: "kv_not_ready", detail: "kv.get is missing" });
    }

    // hem ban_index hem ban:index destekle
    const raw1 = await kv.get("ban_index");
    const raw2 = raw1 ? null : await kv.get("ban:index");

    const emails = normalizeEmails(raw1 ?? raw2);

    const items = emails.map((email) => ({ email, key: `ban:${email}` }));
    return json(res, 200, { ok: true, count: items.length, items });
  } catch (e) {
    return json(res, 500, { ok: false, error: "bans_list_failed", detail: String(e?.message || e) });
  }
}
