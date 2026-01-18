// /api/admin/users/bans-list.js
// Ban keys: ban:<email>
// Returns JSON: { ok, count, items:[{email,key}] }

import redis from "../../_kv.js";

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function emailFromBanKey(k) {
  if (!k || typeof k !== "string" || !k.startsWith("ban:")) return null;
  const email = k.slice(4).trim().toLowerCase();
  if (!email || email === "index" || email === "*") return null;
  return email;
}

async function scanKeys(pattern) {
  let cursor = "0";
  const out = [];

  for (let guard = 0; guard < 100; guard++) {
    let resScan;

    // Upstash/Vercel style
    try {
      resScan = await redis.scan(cursor, { match: pattern, count: 200 });
    } catch (e1) {
      // ioredis/node-redis style
      resScan = await redis.scan(cursor, "MATCH", pattern, "COUNT", 200);
    }

    let nextCursor = "0";
    let keys = [];

    if (Array.isArray(resScan)) {
      nextCursor = String(resScan[0] ?? "0");
      keys = Array.isArray(resScan[1]) ? resScan[1] : [];
    } else if (resScan && typeof resScan === "object") {
      nextCursor = String(resScan.cursor ?? "0");
      keys = Array.isArray(resScan.keys) ? resScan.keys : [];
    }

    for (const k of keys) out.push(k);

    cursor = nextCursor;
    if (cursor === "0") break;
  }

  return out;
}

export default async function handler(req, res) {
  try {
    const admin = String(req.query.admin || "").trim().toLowerCase();
    if (!admin) return json(res, 403, { ok: false, error: "admin_required" });

    const keys = await scanKeys("ban:*");
    const items = keys
      .filter((k) => typeof k === "string" && k.startsWith("ban:") && k !== "ban:index")
      .map((k) => ({ key: k, email: emailFromBanKey(k) }))
      .filter((x) => !!x.email);

    return json(res, 200, { ok: true, count: items.length, items });
  } catch (e) {
    return json(res, 500, { ok: false, error: "bans_list_failed", detail: String(e?.message || e) });
  }
}
