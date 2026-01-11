import Stripe from "stripe";
import { Redis } from "@upstash/redis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

const redis = Redis.fromEnv();

function json(res, status, data) {
  res.status(status).json(data);
}

export default async function handler(req, res) {
  try {
    console.log("[VERIFY] START", {
      method: req.method,
      url: req.url,
    });

    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const sessionId = String(req.body?.session_id || "").trim();
    if (!sessionId) {
      return json(res, 400, { ok: false, error: "MISSING_SESSION_ID" });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    console.log("[VERIFY] SESSION", {
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      metadata: session.metadata,
    });

    if (session.payment_status !== "paid") {
      return json(res, 200, {
        ok: false,
        paid: false,
        reason: "NOT_PAID",
      });
    }

    const email =
      (session.customer_details?.email || session.metadata?.email || "")
        .toLowerCase()
        .trim();

    if (!email) {
      return json(res, 200, {
        ok: false,
        paid: true,
        error: "EMAIL_NOT_FOUND",
      });
    }

    const credits = Number(session.metadata?.credits || 0);
    if (!credits || credits <= 0) {
      return json(res, 200, {
        ok: false,
        paid: true,
        error: "INVALID_CREDITS_METADATA",
      });
    }

    // ✅ V2 — TEMİZ IDENTITY
    const lockKey = `v2:stripe:processed:${sessionId}`;

    const already = await redis.get(lockKey);
    if (already) {
      const current = Number(await redis.get(`credits:${email}`)) || 0;

      return json(res, 200, {
        ok: true,
        alreadyProcessed: true,
        credits: current,
        added: 0,
      });
    }

    // 🔒 lock
    await redis.set(lockKey, "1", { ex: 60 * 60 * 24 * 30 });

    // 💰 credit add
    const newCredits = await redis.incrby(`credits:${email}`, credits);

    return json(res, 200, {
      ok: true,
      added: credits,
      credits: Number(newCredits),
    });
  } catch (err) {
    console.error("[VERIFY] FATAL", err);
    return json(res, 500, {
      ok: false,
      error: "SERVER_ERROR",
      detail: String(err.message || err),
    });
  }
}
