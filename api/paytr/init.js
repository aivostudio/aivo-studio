import crypto from "crypto";

const PAYTR_TOKEN_URL = "https://www.paytr.com/odeme/api/get-token";

/* ===============================
   HELPERS
   =============================== */
function getBaseUrl(req) {
  // En sağlam: Vercel'de PUBLIC_BASE_URL env ile sabitle
  // Örn: https://www.aivo.tr
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const proto = (req.headers["x-forwarded-proto"] || "https").toString();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString();
  return `${proto}://${host}`;
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  let ip =
    (typeof xf === "string" && xf.split(",")[0].trim()) ||
    (Array.isArray(xf) && xf[0]?.split(",")[0].trim()) ||
    req.socket?.remoteAddress ||
    "127.0.0.1";

  // IPv6/::ffff:IPv4 normalize
  ip = ip.replace("::ffff:", "");
  // PayTR genelde IPv4 bekler; IPv6 geldiyse fallback
  if (ip.includes(":")) ip = "127.0.0.1";
  return ip;
}

function toKurus(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(Math.round(n * 100)); // 399 => "39900"
}

function toTlString(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toFixed(2); // "399.00"
}

/* ===============================
   PAYTR TOKEN
   =============================== */
function generatePaytrToken({
  merchant_id,
  merchant_key,
  merchant_salt,
  user_ip,
  merchant_oid,
  email,
  payment_amount,
  user_basket,
  no_installment,
  max_installment,
  currency,
  test_mode,
}) {
  const hashStr =
    merchant_id +
    user_ip +
    merchant_oid +
    email +
    payment_amount +
    user_basket +
    no_installment +
    max_installment +
    currency +
    test_mode;

  return crypto
    .createHmac("sha256", merchant_key)
    .update(hashStr + merchant_salt)
    .digest("base64");
}

/* ===============================
   API HANDLER
   =============================== */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const { user_id, email, plan, amount } = req.body || {};
    if (!email || !plan || amount == null) {
      return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
    }

    const merchant_id = process.env.PAYTR_MERCHANT_ID;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;

    const test_mode = process.env.PAYTR_TEST_MODE === "true" ? "1" : "0";
    const debug_on = process.env.PAYTR_DEBUG_ON === "false" ? "0" : "1";

    if (!merchant_id || !merchant_key || !merchant_salt) {
      return res.status(500).json({
        ok: false,
        error: "PAYTR_ENV_NOT_SET",
        missing: {
          PAYTR_MERCHANT_ID: !merchant_id,
          PAYTR_MERCHANT_KEY: !merchant_key,
          PAYTR_MERCHANT_SALT: !merchant_salt,
        },
      });
    }

    const baseUrl = getBaseUrl(req);
    const user_ip = getClientIp(req);

    const oid = `AIVO_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

    const payment_amount = toKurus(amount);     // "39900"
    const basketPriceTl = toTlString(amount);   // "399.00"
    if (!payment_amount || !basketPriceTl) {
      return res.status(400).json({ ok: false, error: "INVALID_AMOUNT" });
    }

    // user_basket: base64(JSON([["Ürün", "399.00", 1]]))
    const user_basket = Buffer.from(
      JSON.stringify([[`${plan} Paketi`, basketPriceTl, 1]])
    ).toString("base64");

    const currency = "TL";
    const no_installment = "1";
    const max_installment = "0";

    const paytr_token = generatePaytrToken({
      merchant_id,
      merchant_key,
      merchant_salt,
      user_ip,
      merchant_oid: oid,
      email,
      payment_amount,
      user_basket,
      no_installment,
      max_installment,
      currency,
      test_mode,
    });

    const postVals = {
      merchant_id,
      user_ip,
      merchant_oid: oid,
      email,
      payment_amount,
      currency,
      user_basket,
      no_installment,
      max_installment,
      paytr_token,

      // Zorunlu alanlar (minimum)
      user_name: "AIVO Kullanıcı",
      user_address: "Türkiye",
      user_phone: "0000000000",

      merchant_ok_url: `${baseUrl}/api/paytr/ok`,
      merchant_fail_url: `${baseUrl}/api/paytr/fail`,

      timeout_limit: "30",
      debug_on,
      test_mode,
      lang: "tr",
    };

    const r = await fetch(PAYTR_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(postVals),
    });

    const raw = await r.text();
    let data = null;
    try { data = JSON.parse(raw); } catch { data = null; }

    if (!r.ok || !data || data.status !== "success" || !data.token) {
      return res.status(502).json({
        ok: false,
        error: "PAYTR_GET_TOKEN_FAILED",
        paytr_status: data?.status || null,
        paytr_reason: data?.reason || raw || null,
        debug: {
          baseUrl,
          user_ip,
          oid,
          payment_amount,
          basketPriceTl,
          test_mode,
        },
      });
    }

    const iframe_token = data.token;
    const iframe_url = `https://www.paytr.com/odeme/guvenli/${iframe_token}`;

    return res.status(200).json({
      ok: true,
      oid,
      iframe_token,
      iframe_url,
      meta: { user_id: user_id || null, plan, amount: Number(amount), test_mode },
    });
  } catch (err) {
    console.error("[PAYTR_INIT_ERROR]", err);
    return res.status(500).json({ ok: false, error: "INIT_FAILED" });
  }
}
