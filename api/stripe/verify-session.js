// /api/stripe/verify-session.js
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

export default async function handler(req, res) {
  try {
    const sid =
      (req.method === "POST" && req.body && req.body.session_id) ||
      (req.method === "GET" && req.query && req.query.session_id);

    const session_id = String(sid || "").trim();
    if (!session_id) {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);

    if (!session || session.payment_status !== "paid") {
      return res.status(400).json({ ok: false, error: "NOT_PAID" });
    }

    const pack = session.metadata?.pack;
    if (!pack) {
      return res.status(400).json({ ok: false, error: "PACK_MISSING" });
    }

    // ❗❗❗ SADECE PACK DÖNER
    return res.status(200).json({
      ok: true,
      order_id: session.id,
      pack, // "199" | "399" | "899" | "2999"
    });
  } catch (e) {
    console.error("verify-session error:", e);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
