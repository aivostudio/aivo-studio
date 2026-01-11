// /api/purchases/create.js
const { getRedis } = require("../_kv");

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix = "inv") {
  // basit benzersiz id (order_id zaten var ama UI için ayrı id iyi)
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();

    const body = req.body || {};

    // REQUIRED
    const email = normEmail(body.email || body.user_email);
    const order_id = String(body.order_id || body.oid || "").trim();

    // Optional / recommended
    const provider = String(body.provider || body.source || "unknown").trim(); // "stripe" | "paytr"
    const pack = String(body.pack || body.plan || "").trim();                // örn: "399"
    const credits = safeNumber(body.credits);
    const amount_try = safeNumber(body.amount_try ?? body.amount);
    const currency = String(body.currency || "TRY").trim().toUpperCase();
    const payment_status = String(body.payment_status || "paid").trim();     // paid|pending|refunded...
    const session_id = String(body.session_id || "").trim();                 // stripe
    const raw = body.raw || null;                                            // debug için saklamak istersen

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }
    if (!order_id) {
      return res.status(400).json({ ok: false, error: "order_id_required" });
    }

    // ✅ Purchase idempotency (90 gün)
    const idemKey = `purchases:applied:${order_id}`;
    const ORDER_TTL_SECONDS = 90 * 24 * 60 * 60;

    const firstTime = await redis.set(idemKey, "1", { nx: true, ex: ORDER_TTL_SECONDS });

    // Eğer daha önce yazıldıysa mevcut kaydı döndür
    if (!firstTime) {
      const listKey = `purchases:${email}`;
      const rawList = (await redis.get(listKey)) || "[]";
      let arr = [];
      try { arr = JSON.parse(rawList) || []; } catch (_) { arr = []; }

      const existing = arr.find((x) => x && x.order_id === order_id) || null;

      return res.json({
        ok: true,
        already_applied: true,
        purchase: existing,
        count: arr.length
      });
    }

    // ✅ Yeni purchase objesi
    const purchase = {
      id: makeId("inv"),
      order_id,
      email,
      provider,
      pack,
      credits,
      amount_try,
      currency,
      payment_status,
      session_id,
      created_at: nowIso(),
      // raw: raw,  // istersen aç (çok büyütmesin)
    };

    const listKey = `purchases:${email}`;

    // listeyi oku -> başa ekle -> truncate (örn 200 kayıt)
    const rawList = (await redis.get(listKey)) || "[]";
    let arr = [];
    try { arr = JSON.parse(rawList) || []; } catch (_) { arr = []; }

    arr.unshift(purchase);

    // ✅ Çok büyümeyi engelle
    if (arr.length > 200) arr = arr.slice(0, 200);

    await redis.set(listKey, JSON.stringify(arr));

    return res.json({
      ok: true,
      already_applied: false,
      purchase,
      count: arr.length
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
