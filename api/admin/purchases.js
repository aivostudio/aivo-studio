// api/admin/purchases.js

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

function normalizeInvoice(raw, email) {
  const item = raw && typeof raw === "object" ? raw : {};

  const credits =
    safeInt(item.credits) ||
    safeInt(item.credit) ||
    safeInt(item.credit_amount);

  const amountTotal =
    safeInt(item.amount_total) ||
    safeInt(item.amount) ||
    safeInt(item.price) ||
    safeInt(item.total);

  let pack = safeText(item.pack) || safeText(item.plan);
  pack = pack.toLowerCase();

  if (pack === "199" || pack === "699" || pack === "1299" || pack === "2999") {
    pack = "";
  }

  if (!pack) {
    if (credits === 25 || amountTotal === 199) pack = "baslangic";
    else if (credits === 100 || amountTotal === 699) pack = "standart";
    else if (credits === 200 || amountTotal === 1299) pack = "pro";
    else if (credits === 500 || amountTotal === 2999) pack = "studyo";
  }

  return {
    id: safeText(item.id),
    email: safeText(item.email) || safeText(email),
    provider: "garanti",
    status: safeText(item.status),
    credits,
    pack,
    amount_total: amountTotal,
    currency: safeText(item.currency),
    created_at: safeText(item.created_at || item.ts),
    order_id: safeText(item.order_id),
    session_id: safeText(item.session_id)
  };
}

async function scanKeys(redis, pattern) {
  let cursor = "0";
  const found = [];

  do {
    const reply = await redis.scan(cursor, { match: pattern, count: 200 });
    cursor = String(reply?.[0] ?? "0");

    const keys = reply?.[1] || [];

    for (const key of keys) {
      if (key) found.push(String(key));
    }
  } while (cursor !== "0");

  return found;
}

async function readInvoices(redis, key) {
  const type = await redis.type(key);
  const email = key.replace("invoices:", "");

if (type === "list") {
  const rows = await redis.lrange(key, 0, 200);
  const items = [];

  for (const row of Array.isArray(rows) ? rows : []) {
    try {
      const parsed = typeof row === "string" ? JSON.parse(row) : row;
      items.push(normalizeInvoice(parsed, email));
    } catch (_) {}
  }

  return items;
}

if (type === "string") {
  const raw = await redis.get(key);
  let arr = [];

  try {
    if (typeof raw === "string") {
      arr = JSON.parse(raw || "[]");
    } else if (Array.isArray(raw)) {
      arr = raw;
    } else if (raw && typeof raw === "object") {
      arr = [raw];
    } else {
      arr = [];
    }
  } catch (_) {
    arr = [];
  }

  return (Array.isArray(arr) ? arr : []).map((i) => normalizeInvoice(i, email));
}

  return [];
}

module.exports = async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return safeJson(res, 405, { ok: false });
    }

    await requireAuth(req);

    const kv = kvMod?.default || kvMod;
    const redis = kv.getRedis?.() || kv.redis;

    const keys = await scanKeys(redis, "invoices:*");

    const items = [];

    for (const key of keys) {
      const invoices = await readInvoices(redis, key);

      for (const inv of invoices) {
        if (inv.status !== "paid") continue;

        items.push({
          id: inv.id,
          email: inv.email,
          provider: inv.provider,
          credits: inv.credits,
          pack: inv.pack,
          amount: inv.amount_total,
          currency: inv.currency,
          order_id: inv.order_id,
          created_at: inv.created_at
        });
      }
    }

    items.sort((a, b) => {
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    return safeJson(res, 200, {
      ok: true,
      total: items.length,
      items
    });

  } catch (e) {
    return safeJson(res, 500, {
      ok: false,
      error: "purchases_failed",
      message: String(e?.message || e)
    });
  }
};
