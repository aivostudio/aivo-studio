import Stripe from "stripe";
import { kv as vercelKV } from "@vercel/kv";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export default async function handler(req, res) {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(
      buf,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return res.status(400).send("Webhook Error");
  }

  /* =====================================================
     CHECKOUT COMPLETED
  ===================================================== */
  if (event.type === "checkout.session.completed") {
    const s = event.data.object;

    if (s.payment_status === "paid") {
      // 🔐 TEK KİMLİK
      const userId = s.client_reference_id;
      const credits = Number(s.metadata?.credits || 0);

      if (userId && credits > 0) {
        const key = `credits:${userId}`;
        await vercelKV.incrby(key, credits);
      }
    }
  }

  return res.json({ received: true });
}
