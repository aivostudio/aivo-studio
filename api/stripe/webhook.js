import Stripe from "stripe";
import { kv as vercelKV } from "@vercel/kv";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Vercel raw body helper (buffer)
async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function normEmail(v) {
  const email = String(v || "").trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function bad(res, status, msg) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(msg);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return bad(res, 405, "Method Not Allowed");

  const sig = req.headers["stripe-signature"];
  if (!sig) return bad(res, 400, "Missing stripe-signature");

  if (!process.env.STRIPE_SECRET_KEY) return bad(res, 500, "STRIPE_SECRET_KEY missing");
  if (!process.env.STRIPE_WEBHOOK_SECRET) return bad(res, 500, "STRIPE_WEBHOOK_SECRET missing");

  let event;

  try {
    const buf = await buffer(req);
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return bad(res, 400, `Webhook Error: ${String(e?.message || e)}`);
  }

  try {
    // ✅ SADECE ödeme tamamlandıysa kredi ekle
    if (event?.type === "checkout.session.completed") {
      const s = event.data?.object || {};
      const paid = s.payment_status === "paid";

      if (paid) {
        const credits = Number(s.metadata?.credits || 0);

        // ✅ TEK OTORİTE: email key
        // 1) metadata.email (sen koyuyorsun)
        // 2) customer_email (Stripe alanı)
        const email = normEmail(s.metadata?.email) || normEmail(s.customer_email);

        if (email && credits > 0) {
          const key = `credits:${email}`;
          await vercelKV.incrby(key, credits);
        }
      }
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ received: true }));
  } catch (e) {
    // webhook asla 500 bırakmasın: Stripe retry loop istemiyoruz
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ received: true, soft: true, err: String(e?.message || e) }));
  }
}
