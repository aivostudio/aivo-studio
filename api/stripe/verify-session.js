import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// (Opsiyonel) Stripe metadata yoksa fallback eşleşme:
// Yine de asıl doğrusu metadata ile çalışmak.
const PRICE_MAP = {
  [process.env.STRIPE_PRICE_199]:  { pack: "starter", credits: 60  },
  [process.env.STRIPE_PRICE_399]:  { pack: "standart", credits: 250 },
  [process.env.STRIPE_PRICE_899]:  { pack: "pro", credits: 500 },
  [process.env.STRIPE_PRICE_2999]: { pack: "studio", credits: 2500 },
};

export default async function handler(req, res) {
  try {
    // Hem GET (?session_id=) hem POST ({session_id}) kabul et
    const sid =
      String(req.query.session_id || "").trim() ||
      String((req.body || {}).session_id || "").trim();

    if (!sid) return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });

    const session = await stripe.checkout.sessions.retrieve(sid, {
      expand: ["line_items.data.price"],
    });

    // Ödeme tamam mı?
    if (session.payment_status !== "paid") {
      return res.status(400).json({ ok: false, error: "NOT_PAID" });
    }

    // 1) Önce metadata’dan al (en doğru)
    let pack = String((session.metadata || {}).aivo_pack || "").trim();
    let credits = Number((session.metadata || {}).aivo_credits || 0);

    // 2) Metadata yoksa, price_id’den fallback
    if (!pack || !Number.isFinite(credits) || credits <= 0) {
      const priceId =
        session.line_items?.data?.[0]?.price?.id ||
        session.line_items?.data?.[0]?.price ||
        "";

      const mapped = PRICE_MAP[priceId];
      if (mapped) {
        pack = mapped.pack;
        credits = mapped.credits;
      }
    }

    if (!pack || !Number.isFinite(credits) || credits <= 0) {
      return res.status(400).json({ ok: false, error: "CREDITS_NOT_RESOLVED" });
    }

    // order_id olarak session id kullan (idempotency için ideal)
    return res.status(200).json({
      ok: true,
      order_id: `stripe_${sid}`,
      pack,
      credits,
      session_id: sid,
    });
  } catch (e) {
    console.error("verify-session error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
}
