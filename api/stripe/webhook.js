import Stripe from "stripe";
import { Redis } from "@upstash/redis";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const redis = Redis.fromEnv();

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
  } catch (err) {
    return res.status(400).send(`Webhook Error`);
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    if (s.payment_status === "paid") {
      const email = s.metadata?.user_email;
      const credits = Number(s.metadata?.credits || 0);
      if (email && credits) {
        await redis.incrby(`credits:${email}`, credits);
      }
    }
  }

  res.json({ received: true });
}
