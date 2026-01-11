// /api/stripe/verify-session.js
const Stripe = require("stripe");
const { getRedis } = require("../_kv");

function safeEmail(v) {
  const e = String(v || "").trim().toLowerCase();
  if (!e || !e.includes("@")) return "";
  return e;
}

function pickSessionId(req) {
  const q = req?.query?.session_id || req?.query?.sessionId || "";
  const b = req?.body?.session_id || req?.body?.sessionId || "";
  return String(q || b || "").trim();
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "stripe_secret_missing" });
    }

    const sessionId = pickSessionId(req);
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return res.status(400).json({ ok: false, error: "session_id_required" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });
    const redis = getRedis();

    // 1) Stripe session retrieve
    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch (e) {
      const msg = e?.raw?.message || e?.message || "stripe_session_retrieve_failed";
      return res.status(400).json({ ok: false, error: msg });
    }

    const paid = session?.payment_status === "paid";
    if (!paid) {
      return res.json({ ok: false, paid: false, error: "not_paid_yet" });
    }

    const meta = session?.metadata || {};
    const email = safeEmail(meta.user_email || session?.customer_details?.email || session?.customer_email);
    const pack = String(meta.pack || "").trim();
    const creditsToAdd = Number(meta.credits || 0) || 0;

    if (!email) return res.status(400).json({ ok: false, error: "email_missing_on_session" });
    if (!creditsToAdd) return res.status(400).json({ ok: false, error: "credits_missing_on_session" });

    // 2) Idempotency: aynı session iki kez yazmasın
    const processedKey = `stripe_processed:${sessionId}`;
    const already = await redis.get(processedKey);
    if (already) {
      // mevcut krediyi dön (v1/v2)
      let current = 0;
      try {
        current = Number(await redis.get(`credits:${email}`)) || 0;
      } catch (_) {
        current = Number(await redis.get(`credits_v2:${email}`)) || 0;
      }

      return res.json({
        ok: true,
        already_processed: true,
        email,
        pack,
        added: 0,
        credits: current,
        session_id: sessionId,
      });
    }

    // 3) Credits: credits:${email} (string numeric) => INCRBY
    let newCredits = 0;
    try {
      newCredits = Number(await redis.incrby(`credits:${email}`, creditsToAdd)) || 0;
    } catch (e) {
      // WRONGTYPE ise v2’ye geç
      newCredits = Number(await redis.incrby(`credits_v2:${email}`, creditsToAdd)) || 0;
    }

    // 4) Invoice append (JSON array)
    const now = Date.now();
    const invoiceItem = {
      id: `AIVO-${new Date(now).toISOString().slice(0,10).replace(/-/g,"")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`,
      ts: now,
      provider: "stripe",
      type: "purchase",
      status: "paid",
      pack,
      credits: creditsToAdd,
      session_id: sessionId,
      amount_total: session?.amount_total ?? null,
      currency: session?.currency ?? null,
    };

    async function pushInvoice(key) {
      const raw = await redis.get(key);
      let list = [];
      if (raw) {
        try { list = JSON.parse(raw) || []; } catch { list = []; }
      }
      list.unshift(invoiceItem);
      // son 200
      await redis.set(key, JSON.stringify(list.slice(0, 200)));
    }

    try {
      await pushInvoice(`invoices:${email}`);
    } catch (e) {
      // WRONGTYPE ise v2’ye yaz
      await pushInvoice(`invoices_v2:${email}`);
    }

    // 5) processed flag
    await redis.set(processedKey, String(now));

    return res.json({
      ok: true,
      email,
      pack,
      added: creditsToAdd,
      credits: newCredits,
      invoice: invoiceItem,
      session_id: sessionId,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
