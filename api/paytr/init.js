import crypto from "crypto";

/* =========================================================
   PAYTR iFrame API — /api/paytr/init.js
   - Server-side: PayTR get-token çağrısı yapar
   - Response: iframe_token + iframe_url döner
   ========================================================= */

const PAYTR_TOKEN_URL = "https://www.paytr.com/odeme/api/get-token";

/* ===============================
   HELPERS
   =============================== */
function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").toString();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").toString();
  return `${proto}://${host}`;
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  if (Array.isArray(xf) && xf.length) return xf[0].split(",")[0].trim();
  return req.socket?.remoteAddress || "127.0.0.1";
}

function toKurus(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  // 34.56 => 3456 (PayTR docs)
  return String(Math.round(n * 100));
}

function formatTl(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  // user_basket için örneklerde "18.00" gibi string kullanılıyor
  return n.toFixed(2);
}

/* ===============================
   PAYTR TOKEN (HMAC)
   Docs: hash_str = merchant_id + user_ip + merchant_oid + email +
                 payment_amount + user_basket + no_installment +
                 max_installment + currency + test_mode
   paytr_token = base64(hmac_sha256(hash_str + merchant_salt, merchant_key))
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
    const { user_id, email, plan, amount, user_name, user_address, user_phone } = req.body || {};
    if (!email || !plan || amount == null) {
      return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
    }

    const merchant_id = process.env.PAYTR_MERCHANT_ID;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;

    // 0/1 string
    const test_mode = process.env.PAYTR_TEST_MODE === "true" ? "1" : "0";
    const debug_on = process.env.PAYTR_DEBUG_ON === "false" ? "0" : "1"; // default 1
    const iframe_v2 = process.env.PAYTR_IFRAME_V2 === "true" ? "1" : undefined; // opsiyonel
    const iframe_v2_dark = process.env.PAYTR_IFRAME_V2_DARK === "true" ? "1" : undefined; // opsiyonel

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

    const baseUrl = process.env.PUBLIC_BASE_URL || getBaseUrl(req);

    const user_ip = getClientIp(req);

    // OID: benzersiz olmalı (64 char altında)
    const oid = `AIVO_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;

    const payment_amount = toKurus(amount);
    if (!payment_amount) {
      return res.status(400).json({ ok: false, error: "INVALID_AMOUNT" });
    }

    const tlPrice = formatTl(amount);
    if (!tlPrice) {
      return res.status(400).json({ ok: false, error: "INVALID_AMOUNT" });
    }

    // user_basket: base64(JSON([["Ürün", "18.00", 1], ...]))
    const user_basket = Buffer.from(
      JSON.stringify([[`${plan} Paketi`, tlPrice, 1]])
    ).toString("base64");

    const currency = "TL";
    const no_installment = "1";
    const max_installment = "0";
    const timeout_limit = "30";
    const lang = "tr";

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

    // PayTR get-token POST fields
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

      user_name: user_name || "AIVO Kullanıcı",
      user_address: user_address || "Türkiye",
      user_phone: user_phone || "0000000000",

      merchant_ok_url: `${baseUrl}/api/paytr/ok`,
      merchant_fail_url: `${baseUrl}/api/paytr/fail`,

      timeout_limit,
      debug_on,
      test_mode,
      lang,
    };

    // iFrame V2 opsiyonel parametreler
    if (iframe_v2) postVals.iframe_v2 = iframe_v2;
    if (iframe_v2_dark) postVals.iframe_v2_dark = iframe_v2_dark;

    const body = new URLSearchParams(postVals);

    const r = await fetch(PAYTR_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    const raw = await r.text();
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      data = null;
    }

    if (!r.ok || !data || data.status !== "success" || !data.token) {
      return res.status(502).json({
        ok: false,
        error: "PAYTR_GET_TOKEN_FAILED",
        paytr_status: data?.status || null,
        paytr_reason: data?.reason || raw || null,
      });
    }

    const iframe_token = data.token;
    const iframe_url = `https://www.paytr.com/odeme/guvenli/${iframe_token}`;

    // İstersen burada KV'ye "order pending" yazarsın (notify.js için)
    // user_id / plan / amount / oid mapping'i

    return res.status(200).json({
      ok: true,
      oid,
      iframe_token,
      iframe_url,
      meta: {
        user_id: user_id || null,
        plan,
        amount: Number(amount),
        currency: "TRY",
        test_mode,
      },
    });
  } catch (err) {
    console.error("[PAYTR_INIT_ERROR]", err);
    return res.status(500).json({ ok: false, error: "INIT_FAILED" });
  }
}
