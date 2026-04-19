// /api/admin/daily-sold-credits.js
const authModule = require("../_lib/auth.js");
const kvMod = require("../_kv");

const requireAuth =
  authModule?.requireAuth ||
  authModule?.default?.requireAuth;

function safeText(v) {
  return String(v == null ? "" : v).trim();
}

function safeInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function safeJson(res, code, obj) {
  return res.status(code).json(obj);
}

function isValidDateOnly(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));
}

function resolveDate(dateStr) {
  return isValidDateOnly(dateStr)
    ? String(dateStr)
    : new Date().toISOString().slice(0, 10);
}

function dayFromValue(v) {
  const s = safeText(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function normalizeInvoice(raw, email) {
  const item = raw && typeof raw === "object" ? raw : {};
  const status = safeText(item.status).toLowerCase();
  const credits = safeInt(item.credits);
  const date =
    dayFromValue(item.created_at) ||
    dayFromValue(item.ts) ||
    "";

  return {
    id: safeText(item.id) || null,
    email: safeText(item.email) || safeText(email) || null,
    provider: safeText(item.provider) || "unknown",
    status,
    credits,
    pack: safeText(item.pack) || null,
    amount_total: safeInt(item.amount_total),
    currency: safeText(item.currency) || null,
    session_id: safeText(item.session_id) || safeText(item?.stripe?.session_id) || null,
    order_id: safeText(item.order_id) || null,
    date,
    raw: item
  };
}

async function scanKeys(redis, pattern) {
  let cursor = "0";
  const found = [];

  do {
    const reply = await redis.scan(cursor, { match: pattern, count: 200 });
    cursor = String(reply?.[0] ?? reply?.cursor ?? "0");

    const keys =
      Array.isArray(reply?.[1]) ? reply[1] :
      Array.isArray(reply?.keys) ? reply.keys :
      [];

    for (const key of keys) {
      if (key) found.push(String(key));
    }
  } while (cursor !== "0");

  return found;
}

async function readInvoicesForKey(redis, key) {
  const type = safeText(await redis.type(key).catch(() => "none")).toLowerCase();
  const email = String(key || "").replace(/^invoices:/, "").trim().toLowerCase();

  if (type === "list") {
    const rows = await redis.lrange(key, 0, 200).catch(() => []);
    const parsed = [];

    for (const row of Array.isArray(rows) ? rows : []) {
      try {
        const obj = typeof row === "string" ? JSON.parse(row) : row;
        parsed.push(normalizeInvoice(obj, email));
      } catch (_) {}
    }

    return parsed;
  }

  if (type === "string") {
    const raw = await redis.get(key).catch(() => "[]");
    let arr = [];
    try {
      arr = typeof raw === "string" ? JSON.parse(raw || "[]") : (raw || []);
    } catch (_) {
      arr = [];
    }

    return (Array.isArray(arr) ? arr : []).map((item) => normalizeInvoice(item, email));
  }

  return [];
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "GET") {
      return safeJson(res, 405, {
        ok: false,
        error: "method_not_allowed"
      });
    }

    if (typeof requireAuth !== "function") {
      return safeJson(res, 500, {
        ok: false,
        error: "require_auth_missing"
      });
    }

    try {
      await requireAuth(req);
    } catch (e) {
      return safeJson(res, 401, {
        ok: false,
        error: "unauthorized",
        message: String(e?.message || e)
      });
    }

    const kv = kvMod?.default || kvMod || {};
    const redis =
      kv.getRedis?.() ||
      kv.redis ||
      null;

    if (!redis) {
      return safeJson(res, 500, {
        ok: false,
        error: "redis_missing"
      });
    }

    const date = resolveDate(req.query?.date);
    const keys = await scanKeys(redis, "invoices:*");

    let total_credits_sold = 0;
    let total_orders = 0;
    const items = [];
    const providers = {};

    for (const key of keys) {
      const invoices = await readInvoicesForKey(redis, key);

      for (const inv of invoices) {
        if (inv.status !== "paid") continue;
        if (inv.credits <= 0) continue;
        if (inv.date !== date) continue;

        total_credits_sold += inv.credits;
        total_orders += 1;

        providers[inv.provider] = safeInt(providers[inv.provider]) + inv.credits;

        items.push({
          id: inv.id,
          email: inv.email,
          provider: inv.provider,
          credits: inv.credits,
          pack: inv.pack,
          amount_total: inv.amount_total,
          currency: inv.currency,
          order_id: inv.order_id,
          session_id: inv.session_id,
          date: inv.date
        });
      }
    }

    items.sort((a, b) => {
      const av = safeText(a.id);
      const bv = safeText(b.id);
      return bv.localeCompare(av);
    });

    return safeJson(res, 200, {
      ok: true,
      date,
      total_credits_sold,
      total_orders,
      provider_totals: providers,
      items
    });
  } catch (e) {
    console.error("admin/daily-sold-credits failed:", e);
    return safeJson(res, 500, {
      ok: false,
      error: "daily_sold_credits_failed",
      message: String(e?.message || e)
    });
  }
};
