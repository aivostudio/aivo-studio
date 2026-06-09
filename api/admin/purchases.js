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

  let amountTotal =
    safeInt(item.amount_total) ||
    safeInt(item.amount) ||
    safeInt(item.price) ||
    safeInt(item.total) ||
    safeInt(item.payment_amount) ||
    safeInt(item.paid_amount);

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

  if (!amountTotal) {
    if (pack === "baslangic") amountTotal = 199;
    else if (pack === "standart") amountTotal = 699;
    else if (pack === "pro") amountTotal = 1299;
    else if (pack === "studyo") amountTotal = 2999;
  }

  const currency =
    safeText(item.currency) ||
    safeText(item.currency_code) ||
    safeText(item.money_currency) ||
    (amountTotal ? "TRY" : "");

  const orderId =
    safeText(item.order_id) ||
    safeText(item.merchant_oid) ||
    safeText(item.oid) ||
    safeText(item.payment_id) ||
    safeText(item.transaction_id) ||
    safeText(item.session_id) ||
    safeText(item.id);

  return {
    id: safeText(item.id),
    email: safeText(item.email) || safeText(email),
    provider: "garanti",
    status: safeText(item.status),
    credits,
    pack,
    amount_total: amountTotal,
    currency,
    created_at: safeText(item.created_at || item.ts),
    order_id: orderId,
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

function normalizeGooglePlayBilling(raw, key) {
  const item = raw && typeof raw === "object" ? raw : {};
  const parts = String(key || "").split(":");

  const email = safeText(parts[1]);
  const productId = safeText(item.productId);
  const credits = safeInt(item.creditsAdded) || safeInt(item.credits);

  let pack = "";
  let amount = 0;

  if (productId === "tr.aivo.credits.25" || credits === 25) {
    pack = "baslangic";
    amount = 199;
  } else if (productId === "tr.aivo.credits.100" || credits === 100) {
    pack = "standart";
    amount = 699;
  } else if (productId === "tr.aivo.credits.200" || credits === 200) {
    pack = "pro";
    amount = 1299;
  } else if (productId === "tr.aivo.credits.500" || credits === 500) {
    pack = "studyo";
    amount = 2999;
  }

  const orderId = safeText(item.orderId || item.order_id);

  return {
    id: orderId || safeText(key),
    email,
    provider: "google_play",
    status: "paid",
    credits,
    pack,
    amount,
    currency: "TRY",
    order_id: orderId,
    created_at: safeText(item.processedAt || item.created_at || item.ts),
    product_id: productId
  };
}

async function readGooglePlayBilling(redis, key) {
  const type = await redis.type(key);

  if (type !== "string") {
    return null;
  }

  const raw = await redis.get(key);
  let parsed = null;

  try {
    parsed = typeof raw === "string" ? JSON.parse(raw || "{}") : raw;
  } catch (_) {
    parsed = null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const item = normalizeGooglePlayBilling(parsed, key);

  if (!item.order_id || !item.order_id.startsWith("GPA.")) {
    return null;
  }

  return item;
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
    const googlePlayKeys = await scanKeys(redis, "google_play_billing:*");

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

    for (const key of googlePlayKeys) {
      const playItem = await readGooglePlayBilling(redis, key);

      if (!playItem) continue;

      items.push({
        id: playItem.id,
        email: playItem.email,
        provider: playItem.provider,
        credits: playItem.credits,
        pack: playItem.pack,
        amount: playItem.amount,
        currency: playItem.currency,
        order_id: playItem.order_id,
        created_at: playItem.created_at
      });
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
