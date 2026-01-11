// /api/stripe/verify-session.js
import Stripe from "stripe";
import { getRedis } from "../_kv";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { session_id } = req.body || {};
    const sid = String(session_id || "").trim();
    if (!sid) return res.status(400).json({ ok: false, error: "session_id_required" });

    // 1) Stripe session çek (gerekli alanlar için expand)
    const session = await stripe.checkout.sessions.retrieve(sid, {
      expand: ["line_items", "customer"],
    });

    if (!session) return res.status(404).json({ ok: false, error: "session_not_found" });

    // 2) Ödeme kontrolü
    if (session.payment_status !== "paid") {
      return res.status(200).json({
        ok: false,
        paid: false,
        payment_status: session.payment_status,
      });
    }

    // 3) Email bul
    const email =
      normEmail(session.customer_details?.email) ||
      normEmail(session.customer_email) ||
      normEmail(session.customer?.email);

    if (!email) {
      return res.status(400).json({ ok: false, error: "email_missing_on_session" });
    }

    // 4) Krediyi nereden alacağız?
    // En stabil: checkout session oluştururken metadata.credits yazmak.
    // Fallback: line_items üzerinden hesaplamaya girişme (paket mantığı karışıyor).
    const credits = safeNum(session.metadata?.credits);
    if (!credits || credits <= 0) {
      return res.status(400).json({
        ok: false,
        error: "credits_missing_on_session_metadata",
        hint: "create-checkout-session içinde metadata: { credits: '60', pack: 'basic' } set et",
      });
    }

    const pack = String(session.metadata?.pack || "").trim() || "unknown";
    const amount_total = safeNum(session.amount_total); // kuruş
    const currency = String(session.currency || "try").toLowerCase();

    const redis = getRedis();

    // 5) Idempotency (aynı Stripe session 2 kez işlenmesin)
    const orderKey = `orders:applied:${sid}`;
    const ORDER_TTL_SECONDS = 90 * 24 * 60 * 60;

    const firstTime = await redis.set(orderKey, "1", {
      nx: true,
      ex: ORDER_TTL_SECONDS,
    });

    // 6) Daha önce işlendi ise: sadece mevcut kredi + invoice listesi dön
    if (!firstTime) {
      const current = (await redis.get(`credits:${email}`)) ?? 0;
      return res.json({
        ok: true,
        already_applied: true,
        email,
        credits: Number(current) || 0,
      });
    }

    // 7) Krediyi yaz (atomic)
    const newCredits = await redis.incrby(`credits:${email}`, credits);

    // 8) Invoice kaydı yaz (idempotent kayıt için invoice:id anahtarı)
    const invoice = {
      id: `inv_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      provider: "stripe",
      status: "paid",
      email,
      order_id: sid,          // stripe session id’yi order_id olarak kullanıyoruz
      session_id: sid,
      pack,
      credits,
      amount_total,           // kuruş
      currency,
      ts: new Date().toISOString(),
    };

    const invoiceKey = `invoice:${email}:${sid}`;
    await redis.set(invoiceKey, JSON.stringify(invoice), { nx: true, ex: ORDER_TTL_SECONDS });

    const listKey = `invoices:${email}`;
    const rawList = (await redis.get(listKey)) || "[]";

    let items = [];
    try { items = JSON.parse(rawList) || []; } catch (_) { items = []; }

    // aynı session varsa ekleme (ek güvenlik)
    if (!items.some((x) => String(x?.order_id || "") === sid)) {
      items.unshift(invoice);
      // listeyi çok şişirmeyelim (son 200)
      if (items.length > 200) items = items.slice(0, 200);
      await redis.set(listKey, JSON.stringify(items));
    }

    return res.json({
      ok: true,
      already_applied: false,
      email,
      credits: Number(newCredits) || 0,
      invoice,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
