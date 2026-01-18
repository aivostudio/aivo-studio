// /api/admin/users/bans-list.js
// ✅ No scan. ✅ Works with your existing /api/_kv.js whatever it exports.
// Reads ban_index / ban:index via kvGetJson (falls back to raw get).

import kvMod from "../../_kv.js";

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function pickClient(mod) {
  // supports: default export, named export kv/redis/client
  if (!mod) return null;
  if (mod.get || mod.scan) return mod;
  if (mod.default && (mod.default.get || mod.default.scan)) return mod.default;
  if (mod.kv && (mod.kv.get || mod.kv.scan)) return mod.kv;
  if (mod.redis && (mod.redis.get || mod.redis.scan)) return mod.redis;
  if (mod.client && (mod.client.get || mod.client.scan)) return mod.client;
  return null;
}

function normalizeEmails(raw) {
  let v = raw;
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

async function safeGet(client, key) {
  if (!client) return null;

  // 1) prefer kvGetJson if you have it globally
  if (typeof kvGetJson === "function") {
    try { return await kvGetJson(key); } catch (_) {}
  }

  // 2) common patterns
  if (typeof client.get === "function") return await client.get(key);
  if (typeof client.kv?.get === "function") return await client.kv.get(key);
  if (typeof client.redis?.get === "function") return await client.redis.get(key);

  return null;
}

export default async function handler(req, res) {
  try {
    const admin = String(req.query.admin || "").trim().toLowerCase();
    if (!admin) return json(res, 403, { ok: false, error: "admin_required" });

    const client = pickClient(kvMod);
    if (!client) return json(res, 500, { ok: false, error: "kv_client_missing" });

    const raw1 = await safeGet(client, "ban_index");
    const raw2 = raw1 ? null : await safeGet(client, "ban:index");

    const emails = normalizeEmails(raw1 ?? raw2);
    const items = emails.map((email) => ({ email, key: `ban:${email}` }));

    return json(res, 200, { ok: true, count: items.length, items });
  } catch (e) {
    return json(res, 500, { ok: false, error: "bans_list_failed", detail: String(e?.message || e) });
  }
}
