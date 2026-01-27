import Stripe from "stripe";
import kvMod from "../_kv.js";

/* =====================================================
   PACK TANIMLARI
===================================================== */
const PACKS = {
  "199":  { priceId: process.env.STRIPE_PRICE_199  || "", credits: 25  },
  "399":  { priceId: process.env.STRIPE_PRICE_399  || "", credits: 60  },
  "899":  { priceId: process.env.STRIPE_PRICE_899  || "", credits: 150 },
  "2999": { priceId: process.env.STRIPE_PRICE_2999 || "", credits: 500 },
};

/* =====================================================
   SABİT ORIGIN (TEK OTORİTE)
===================================================== */
const ORIGIN = "https://aivo.tr";

/* =====================================================
   SESSION (TEK OTORİTE – KV)
===================================================== */
const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;

async function getSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/aivo_sess=([^;]+)/);
  if (!match) return null;

  const sid = match[1];
  if (!sid || typeof kvGetJson !== "function") return null;

  const sess = await kvGetJson(`sess:${sid}`).catch(() => null);
  if (!sess || !sess.email) return null;

  return { email: sess.email };
}

/* =====================================================
   YARDIMCILAR
===================================================== */
function pickPackCode(body) {
  const raw = body?.pack ?? body?.plan ?? body?.amount ?? body?.price ?? "";
  return String(raw).replace(/[^\d]/g, "");
}

function pickUserEmail(body, fallbackEmail) {
  const raw =
    body?.user_email ??
    body?.email ??
    body?.userEmail ??
    fallbackEmail ??
    "";
  const email = String(raw).trim().toLowerCase();
  return email.includes("@") ? email : "";
}

function isJson(req) {
  return String(req.headers["content-type"] || "")
    .toLowerCase()
    .includes("application/json");
}

/* =====================================================
   HANDLER
===================================================== */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    if (!isJson(req)) {
      return res.status(415).json({ ok: false, error: "UNSUPPORTED_CONTENT_TYPE" });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    const sessionAuth = await getSession(req);
    if (!sessionAuth) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const packCode = pickPackCode(body);
    if (!PACKS[packCode]) {
      return res.status(400).json({ ok: false, error: "PACK_NOT_ALLOWED" });
    }

    const userEmail = pickUserEmail(body, sessionAuth.email);
    if (!userEmail) {
      return res.status(400).json({ ok: false, error: "USER_EMAIL_REQUIRED" });
    }

    const { priceId, credits } = PACKS[packCode];
    if (!priceId) {
      return res.status(400).json({ ok: false, error: "PRICE_ID_MISSING" });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],

      success_url: `${ORIGIN}/studio.html?verified=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/fiyatlandirma.html?canceled=1`,

      customer_email: userEmail,

      client_reference_id: userEmail,

      metadata: {
        pack: packCode,
        credits: String(credits),
        email: userEmail,
      },
    });

    return res.status(200).json({
      ok: true,
      url: checkout.url,
      id: checkout.id,
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "CHECKOUT_CREATE_FAILED",
      message: err?.message || "UNKNOWN_ERROR",
    });
  }
}
