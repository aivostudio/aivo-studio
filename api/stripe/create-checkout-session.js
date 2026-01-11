// /api/stripe/verify-session.js
import Stripe from "stripe";
import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    const sessionId =
      (req.body && (req.body.session_id || req.body.sessionId)) || "";

    if (!sessionId || typeof sessionId !== "string") {
      return res.status(400).json({ ok: false, error: "SESSION_ID_REQUIRED" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    // Paid kontrolü
    const paid =
      session.payment_status === "paid" ||
      session.status === "complete";

    if (!paid) {
      return res.status(400).json({
        ok: false,
        error: "NOT_PAID",
        status: session.status,
        payment_status: session.payment_status,
      });
    }

    const md = session.metadata || {};
    const userEmail = String(md.user_email || "").trim().toLowerCase();
    const credits = Number(md.credits || 0);

    if (!userEmail || !userEmail.includes("@")) {
      return res.status(400).json({ ok: false, error: "METADATA_USER_EMAIL_MISSING" });
    }
    if (!credits || credits <= 0) {
      return res.status(400).json({ ok: false, error: "METADATA_CREDITS_MISSING" });
    }

    // ✅ Idempotency: aynı session ikinci kez gelirse kredi tekrar yazılmasın
    const lockKey = `aivo:stripe:credited:${sessionId}`;
    const already = await kv.get(lockKey);
    if (already) {
      return res.status(200).json({ ok: true, alreadyCredited: true, creditsAdded: 0 });
    }

    // Burada kendi kredi yazma mekanizmana bağla:
    // Eğer /api/credits/add endpoint’in varsa onu çağırmak en doğru yaklaşım.
    // (Aşağıdaki örnek: KV'de email bazlı kredi tutuyorsun varsayımıyla)
    const balKey = `aivo:credits:${userEmail}`;
    const current = Number((await kv.get(balKey)) || 0);
    const next = current + credits;

    await kv.set(balKey, next);
    await kv.set(lockKey, { at: Date.now(), credits, userEmail });

    return res.status(200).json({ ok: true, alreadyCredited: false, creditsAdded: credits, newBalance: next });
  } catch (err) {
    const message = err?.raw?.message || err?.message || "UNKNOWN_ERROR";
    const code = err?.raw?.code || err?.code || "ERR";
    return res.status(500).json({ ok: false, error: "VERIFY_FAILED", code, message });
  }
}
