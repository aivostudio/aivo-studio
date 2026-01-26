import Stripe from "stripe";
import { kv as vercelKV } from "@vercel/kv";

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
   SESSION (TEK OTORİTE)
===================================================== */
async function getSession(req) {
  const r = await fetch("https://aivo.tr/api/me", {
    headers: {
      cookie: req.headers.cookie || "",
    },
  });

  if (!r.ok) return null;

  const data = await r.json();

  // /api/me cevabı: { ok:true, email, role, verified, session:"kv", sub }
  if (!data?.ok || !data?.sub) return null;

  return data; // data.sub = userId
}

/* =====================================================
   YARDIMCILAR
===================================================== */
function originFromReq(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function pickPackCode(body) {
  const raw = body?.pack ?? body?.plan ?? body?.amount ?? body?.price ?? "";
  return String(raw).replace(/[^\d]/g, "");
}

function pickUserEmail(body) {
  const raw = body?.user_email ?? body?.email ?? body?.userEmail ?? "";
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
    /* ---------- METHOD ---------- */
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    /* ---------- CONTENT TYPE ---------- */
    if (!isJson(req)) {
      return res.status(415).json({ ok: false, error: "UNSUPPORTED_CONTENT_TYPE" });
    }

    /* ---------- STRIPE ENV ---------- */
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ ok: false, error: "STRIPE_SECRET_MISSING" });
    }

    /* ---------- AUTH (ZORUNLU) ---------- */
    const sessionAuth = await getSession(req);
    if (!sessionAuth) {
      return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    }

    const userId = sessionAuth.sub;

    /* ---------- BODY ---------- */
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const packCode = pickPackCode(body);
    if (!PACKS[packCode]) {
      return res.status(400).json({ ok: false, error: "PACK_NOT_ALLOWED" });
    }

    const userEmail = pickUserEmail(body);
    if (!userEmail) {
      return res.status(400).json({ ok: false, error: "USER_EMAIL_REQUIRED" });
    }

    const { priceId, credits } = PACKS[packCode];
    if (!priceId) {
      return res.status(400).json({ ok: false, error: "PRICE_ID_MISSING" });
    }

    /* ---------- URLS ---------- */
    const origin = originFromReq(req);

    const successUrl =
      `${origin}/studio.html?stripe=success&session_id={CHECKOUT_SESSION_ID}`;

    const cancelUrl =
      `${origin}/fiyatlandirma.html?status=cancel&pack=${packCode}#packs`;

    /* ---------- STRIPE ---------- */
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2023-10-16",
    });

    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],

      success_url: successUrl,
      cancel_url: cancelUrl,

      // sadece fatura / mail
      customer_email: userEmail,

      // 🔐 ASIL KİMLİK
      client_reference_id: userId,

      metadata: {
        pack: packCode,
        credits: String(credits),
        email: userEmail,
      },
    });

    if (!checkout?.url) {
      return res.status(500).json({ ok: false, error: "CHECKOUT_URL_MISSING" });
    }

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
