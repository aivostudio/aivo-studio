// /api/stripe/create-checkout-session.js
const Stripe = require("stripe");

// Pack -> (Stripe Price ENV, Credits)
const PACKS = {
  "199":  { priceIdEnv: "STRIPE_PRICE_199",  credits: 25  },
  "399":  { priceIdEnv: "STRIPE_PRICE_399",  credits: 60  },
  "899":  { priceIdEnv: "STRIPE_PRICE_899",  credits: 150 },
  "2999": { priceIdEnv: "STRIPE_PRICE_2999", credits: 500 },
};

function safeJsonBody(req) {
  const b = req && req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (typeof b === "string") {
    try {
      const obj = JSON.parse(b);
      return obj && typeof obj === "object" ? obj : {};
    } catch {
      return {};
    }
  }
  return {};
}

function originFromReq(req) {
  const h = (req && req.headers) ? req.headers : {};
  const proto = String(h["x-forwarded-proto"] || "https").split(",")[0].trim() || "https";
  const xfHost = String(h["x-forwarded-host"] || "").split(",")[0].trim();
  const host = xfHost || String(h.host || "").trim();
  return host ? `${proto}://${host}` : "https://aivo.tr";
}

function pickPackCode(body) {
  const raw = (body && (body.pack ?? body.plan ?? body.amount ?? body.price)) ?? "";
  const s = String(raw).trim();
  if (!s) return "";
  return s.replace(/[^\d]/g, "");
}

function pickUserEmail(body) {
  const raw = (body && (body.user_email ?? body.email ?? body.userEmail)) ?? "";
  const email = String(raw).trim().toLowerCase();
  if (!email || !email.includes("@")) return "";
  return email;
}

function withTimeout(promise, ms, label) {
  let t;
  const timeout = new Promise((_, rej) => {
    t = setTimeout(() => rej(new Error(label || "TIMEOUT")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

module.exports = async (req, res) => {
  try { res.setHeader("Cache-Control", "no-store"); } catch (_) {}
  try { res.setHeader("Content-Type", "application/json; charset=utf-8"); } catch (_) {}

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    const body = safeJsonBody(req);

    const packCode = pickPackCode(body);
    const pack = PACKS[packCode];
    if (!pack) {
      return res.status(400).json({
        ok: false,
        error: "PACK_NOT_ALLOWED",
        detail: `pack=${packCode || "(empty)"}`
      });
    }

    const userEmail = pickUserEmail(body);
    if (!userEmail) {
      return res.status(400).json({ ok: false, error: "USER_EMAIL_REQUIRED" });
    }

    const priceId = String(process.env[pack.priceIdEnv] || "").trim();
    if (!priceId) {
      return res.status(400).json({
        ok: false,
        error: "PRICE_ID_REQUIRED",
        detail: `missing env ${pack.priceIdEnv}`
      });
    }

    const origin = originFromReq(req);

    const successUrl =
      `${origin}/studio.html?page=dashboard&stab=notifications&stripe=success&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      `${origin}/fiyatlandirma.html?status=cancel&pack=${encodeURIComponent(packCode)}#packs`;

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2023-10-16" });

    // ✅ PENDING kırıcı: Stripe create en geç 12sn içinde dönmek zorunda
    const session = await withTimeout(
      stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: userEmail,
        client_reference_id: userEmail,
        metadata: {
          user_email: userEmail,
          pack: packCode,
          credits: String(pack.credits),
          origin,
        },
      }),
      12000,
      "STRIPE_CREATE_TIMEOUT"
    );

    if (!session || !session.url) {
      return res.status(500).json({ ok: false, error: "SESSION_URL_MISSING" });
    }

    return res.status(200).json({
      ok: true,
      url: session.url,
      id: session.id,
      pack: packCode,
      credits: pack.credits,
      email: userEmail,
    });

  } catch (err) {
    const message = err?.raw?.message || err?.message || "UNKNOWN_ERROR";
    const code = err?.raw?.code || err?.code || "ERR";

    // Timeout özel döndür (pending yerine net teşhis)
    if (String(message).includes("STRIPE_CREATE_TIMEOUT")) {
      return res.status(504).json({
        ok: false,
        error: "STRIPE_CREATE_TIMEOUT",
        message: "Stripe create-checkout-session timed out (12s).",
      });
    }

    return res.status(500).json({
      ok: false,
      error: "CHECKOUT_SESSION_CREATE_FAILED",
      code,
      message,
    });
  }
};
