import Stripe from "stripe";
import { kv as vercelKV } from "@vercel/kv";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Vercel raw body helper (buffer)
// Not: projende zaten varsa aynı şekilde kalsın
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function normEmail(v) {
  const email = String(v || "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

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
  } catch (e) {
    return res.status(400).send("Webhook Error");
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;

    if (s.payment_status === "paid") {
      const credits = Number(s.metadata?.credits || 0);

      // ✅ TEK OTORİTE: email key
      // 1) metadata.email (sen koyuyorsun)
      // 2) customer_email (Stripe alanı)
      const email =
        normEmail(s.metadata?.email) ||
        normEmail(s.customer_email);

      if (email && credits > 0) {
        const key = `credits:${email}`;
        await vercelKV.incrby(key, credits);
      }
    }
  }

  return res.json({ received: true });
}
