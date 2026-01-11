// /api/stripe/verify-session.js
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

function toInt(x, fallback = 0) {
  const n = Number(x);
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
    if (!process.env.STRIPE_SECRET_KEY) {
      return json(res, 500, { ok: false, error: "Missing STRIPE_SECRET_KEY" });
    }

    // ✅ GET (query) veya POST (body) ile session_id kabul et
    let session_id = "";

    if (req.method === "GET") {
      session_id = String(req.query?.session_id || "").trim();
    } else if (req.method === "POST") {
      const body = await readBody(req);
      session_id = String(body?.session_id || "").trim();
    } else {
      res.setHeader("Allow", "GET, POST");
      return json(res, 405, { ok: false, error: "Method Not Allowed" });
    }

    if (!session_id) {
      return json(res, 400, { ok: false, error: "Missing session_id" });
    }

    const processedKey = `stripe_processed:${session_id}`;
    const lockKey = `stripe_lock:${session_id}`;

    // ✅ Zaten işlendi mi?
    const already = await redis.get(processedKey);
    if (already) {
      // Email/credit döndürmek için en iyi çaba:
      const email = String(already?.email || already?.customer_email || "").trim().toLowerCase();
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

    // ✅ Yarış durumunu azalt: kısa TTL lock (NX)
    // Upstash set opsiyonları: { nx: true, ex: seconds }
    const locked = await redis.set(lockKey, "1", { nx: true, ex: 20 });
    if (!locked) {
      // Başka bir istek şu an işliyor
      return json(res, 200, { ok: false, retry: true, error: "IN_PROGRESS" });
    }

    try {
      // Stripe session çek
      const session = await stripe.checkout.sessions.retrieve(session_id, {
        expand: ["customer", "payment_intent"],
      });

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

      // Email bul
      const email =
        (session?.customer_details?.email || "").trim().toLowerCase() ||
        (session?.metadata?.email || "").trim().toLowerCase() ||
        "";

      if (!email) {
        return json(res, 200, { ok: false, paid: true, error: "Missing customer email" });
      }

      // Kredi (metadata) — FAZ-2’de tek kaynak
      const pack = String(session?.metadata?.pack || "").trim();
      const creditsToAdd = toInt(session?.metadata?.credits, 0);

      if (!creditsToAdd || creditsToAdd <= 0) {
        return json(res, 200, {
          ok: false,
          paid: true,
          email,
          error: "Missing/invalid credits in session metadata",
        });
      }

      // ✅ Kredi ekle
      const newCredits = await redis.incrby(`credits:${email}`, creditsToAdd);

      // ✅ Invoice — deterministic id (session’a bağlı)
      const inv = {
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

      const invoicesKey = `invoices:${email}`;
      await redis.lpush(invoicesKey, JSON.stringify(inv));
      await redis.ltrim(invoicesKey, 0, 199);

      // ✅ En son processed’ı kalıcıla (kredi+invoice başarıyla yazıldıktan sonra)
      await redis.set(
        processedKey,
        JSON.stringify({ email, session_id, inv_id: inv.id, credits: creditsToAdd }),
        { ex: 60 * 60 * 24 * 30 } // 30 gün
      );

      return json(res, 200, {
        ok: true,
        paid: true,
        email,
        pack,
        added: creditsToAdd,
        credits: toInt(newCredits, 0),
        invoice: inv,
        alreadyProcessed: false,
      });
    } finally {
      // lock’u bırak
      await redis.del(lockKey);
    }
  } catch (err) {
    console.error("[verify-session] error:", err);
    return json(res, 500, {
      ok: false,
      error: "Server error",
      detail: String(err?.message || err),
    });
  }
}
