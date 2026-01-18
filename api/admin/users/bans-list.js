// /api/admin/users/bans-list.js
// Works with api/_kv.js (CJS exports): kvGetJson + getRedis (Upstash Redis REST)
// Tries ban_index / ban:index first. If empty, falls back to SCAN ban:* (if available).
// Returns: { ok, source, count, items:[{email,key,raw?}] }

const { kvGetJson, getRedis } = require("../../_kv.js");

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function normEmail(s) {
  return String(s || "").trim().toLowerCase();
}

function normalizeEmails(raw) {
  let v = raw;
  if (v && typeof v === "object" && v._raw) v = v._raw;
  if (typeof v === "string") {
    try { v = JSON.parse(v); } catch (_) {}
  }

  let arr = [];
  if (Array.isArray(v)) arr = v;
  else if (v && typeof v === "object") arr = v.emails || v.items || [];

  return arr.map(normEmail).filter(Boolean);
}

function emailFromBanKey(k) {
  if (!k || typeof k !== "string" || !k.startsWith("ban:")) return null;
  const e = normEmail(k.slice(4));
  if (!e || e === "index" || e === "*") return null;
  return e;
}

async function scanBanKeys() {
  const r = getRedis();
  if (!r || typeof r.scan !== "function") return [];

  let cursor = 0;
  const out = [];

  for (let guard = 0; guard < 100; guard++) {
    const resScan = await r.scan(cursor, { match: "ban:*", count: 200 });

    let nextCursor = 0;
    let keys = [];

    if (Array.isArray(resScan)) {
      nextCursor = Number(resScan[0] || 0);
      keys = Array.isArray(resScan[1]) ? resScan[1] : [];
    } else if (resScan && typeof resScan === "object") {
      nextCursor = Number(resScan.cursor || 0);
      keys = Array.isArray(resScan.keys) ? resScan.keys : [];
    }

    for (const k of keys) {
      if (typeof k === "string" && k.startsWith("ban:") && k !== "ban:index") out.push(k);
    }

    cursor = nextCursor;
    if (!cursor) break;
  }

  return out;
}

module.exports = async function handler(req, res) {
  try {
    const admin = normEmail(req.query.admin);
    if (!admin) return json(res, 403, { ok: false, error: "admin_required" });

    // 1) Prefer index
    const idx1 = await kvGetJson("ban_index");
    const idx2 = idx1 ? null : await kvGetJson("ban:index");
    const emails = normalizeEmails(idx1 || idx2);

    if (emails.length) {
      const items = emails.map((email) => ({ email, key: `ban:${email}` }));
      return json(res, 200, { ok: true, source: "ban_index", count: items.length, items });
    }

    // 2) Fallback: scan keys
    const keys = await scanBanKeys();
    const items = keys
      .map((k) => ({ key: k, email: emailFromBanKey(k) }))
      .filter((x) => !!x.email);

    return json(res, 200, { ok: true, source: "scan", count: items.length, items });
  } catch (e) {
    return json(res, 500, { ok: false, error: "bans_list_failed", detail: String(e?.message || e) });
  }
};
