// =========================================================
// AIVO — STRIPE VERIFY SESSION (FAZ-2 FINAL)
// ---------------------------------------------------------
// - Kredi TEK KAYNAK: BACKEND
// - Idempotent (aynı session 2. kez işlenmez)
// - DEBUG AÇIK (Vercel log için)
// =========================================================

import Stripe from "stripe";
import { Redis } from "@upstash/redis";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

const redis = Redis.fromEnv();

function json(res, status, data) {
  res.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function toInt(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

async function readBody(req) {
  return await new Promise((resolve) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch {
        resolve({});
      }
    });
  });
}

export default async function handler(req, res) {
  try {
    /* ================= DEBUG: START ================= */
    console.log("[VERIFY] START", {
      method: req.method,
      url: req.url,
      query: req.query || null,
    });
    /* =============================================== */

    if (!process.env.STRIPE_SECRET_KEY) {
      return json(res, 500, { ok: false, error: "Missing STRIPE_SECRET_KEY" });
    }

    // POST (body) veya GET (query) destekle
    let session_id = "";

    if (req.method === "POST") {
      const body = await readBody(req);
      session_id = String(body?.session_id || "").trim();
    } else if (req.method === "GET") {
      session_id = String(req.query?.session_id || "").trim();
    } else {
      res.setHeader("Allow", "GET, POST");
      return json(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    if (!session_id) {
      return json(res, 400, { ok: false, error: "Missing session_id" });
    }

    const processedKey = `stripe_processed:${session_id}`;
    const lockKey = `stripe_lock:${session_id}`;

    // Daha önce işlendi mi?
    const already = await redis.get(processedKey);
    if (already) {
      console.log("[VERIFY] ALREADY PROCESSED", session_id);

      const parsed = typeof already === "string" ? JSON.parse(already) : already;
      const email = parsed?.email || null;
      let credits = null;

      if (email) {
        const cur = await redis.get(`credits:${email}`);
        credits = toInt(cur, 0);
      }

      return json(res, 200, {
        ok: true,
        paid: true,
        alreadyProcessed: true,
        added: 0,
        credits,
      });
    }

    // Kısa süreli lock (yarış durumunu önler)
    const locked = await redis.set(lockKey, "1", { nx: true, ex: 20 });
    if (!locked) {
      console.warn("[VERIFY] IN PROGRESS (LOCKED)", session_id);
      return json(res, 200, { ok: false, retry: true, error: "IN_PROGRESS" });
    }

    try {
      // Stripe session al
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["customer", "payment_intent"],
      });

      /* ================= DEBUG: SESSION ================= */
      console.log("[VERIFY] SESSION", {
        id: session?.id,
        status: session?.status,
        payment_status: session?.payment_status,
        metadata: session?.metadata,
        amount_total: session?.amount_total,
        currency: session?.currency,
      });
      /* ================================================ */

      const paid =
        session?.payment_status === "paid" ||
        session?.status === "complete";

      if (!paid) {
        return json(res, 200, {
          ok: false,
          paid: false,
          payment_status: session?.payment_status || null,
          status: session?.status || null,
          error: "Payment not completed",
        });
      }

      const email =
        (session?.customer_details?.email || "").trim().toLowerCase() ||
        (session?.metadata?.email || "").trim().toLowerCase() ||
        "";

      if (!email) {
        return json(res, 200, { ok: false, paid: true, error: "Missing customer email" });
      }

      const creditsToAdd = toInt(session?.metadata?.credits, 0);
      const pack = String(session?.metadata?.pack || "").trim();

      if (!creditsToAdd || creditsToAdd <= 0) {
        return json(res, 200, {
          ok: false,
          paid: true,
          email,
          error: "Missing or invalid metadata.credits",
        });
      }

      // ✅ KREDİ EKLE (TEK YER)
      const newCredits = await redis.incrby(`credits:${email}`, creditsToAdd);

      // ✅ FATURA (deterministic id)
      const invoice = {
        id: `inv_stripe_${session_id}`,
        provider: "stripe",
        type: "purchase",
        status: "paid",
        email,
        session_id,
        pack,
        credits: creditsToAdd,
        amount_total: session?.amount_total ?? null,
        currency: session?.currency ?? null,
        ts: new Date().toISOString(),
      };

      await redis.lpush(`invoices:${email}`, JSON.stringify(invoice));
      await redis.ltrim(`invoices:${email}`, 0, 199);

      // ✅ PROCESSED FLAG (EN SON)
      await redis.set(
        processedKey,
        JSON.stringify({
          email,
          credits: creditsToAdd,
          invoice_id: invoice.id,
        }),
        { ex: 60 * 60 * 24 * 30 }
      );

      console.log("[VERIFY] SUCCESS", {
        email,
        added: creditsToAdd,
        totalCredits: newCredits,
      });

      return json(res, 200, {
        ok: true,
        paid: true,
        email,
        added: creditsToAdd,
        credits: toInt(newCredits, 0),
        invoice,
        alreadyProcessed: false,
      });
    } finally {
      await redis.del(lockKey);
    }
  } catch (err) {
    console.error("[VERIFY] ERROR", err);
    return json(res, 500, {
      ok: false,
      error: "Server error",
      detail: String(err?.message || err),
    });
  }
}
