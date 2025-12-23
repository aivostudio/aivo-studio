// /api/paytr/init.js
// Vercel Node API Route (pages router style)
// Amaç: Checkout'tan gelen POST'u al -> PayTR form alanlarını üret -> { ok:true, form:{...} } dön

import crypto from "crypto";

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  if (Array.isArray(xf) && xf.length) return String(xf[0]).trim();
  // Vercel'de bazen req.socket.remoteAddress gelir (ipv6 olabilir)
  return (req.socket && req.socket.remoteAddress) ? String(req.socket.remoteAddress) : "127.0.0.1";
}

function toKurus(amountTl) {
  const n = Number(amountTl);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // 399 -> 39900
  return Math.round(n * 100);
}

function b64(str) {
  return Buffer.from(str, "utf8").toString("base64");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const merchant_id = process.env.PAYTR_MERCHANT_ID;
  const merchant_key = process.env.PAYTR_MERCHANT_KEY;
  const merchant_salt = process.env.PAYTR_MERCHANT_SALT;

  if (!merchant_id || !merchant_key || !merchant_salt) {
    return json(res, 500, {
      ok: false,
      error: "PAYTR_ENV_MISSING",
      missing: {
        PAYTR_MERCHANT_ID: !merchant_id,
        PAYTR_MERCHANT_KEY: !merchant_key,
        PAYTR_MERCHANT_SALT: !merchant_salt,
      },
    });
  }

  let body = null;
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch (e) {
    return json(res, 400, { ok: false, error: "BODY_JSON_INVALID" });
  }

  const user_id = String(body.user_id || "").trim();
  const email = String(body.email || "").trim();
  const plan = String(body.plan || "Standart Paket").trim();
  const amountTl = body.amount;

  if (!user_id || !email) {
    return json(res, 400, { ok: false, error: "BODY_MISSING_FIELDS", need: ["user_id", "email"] });
  }

  const payment_amount = toKurus(amountTl); // kuruş
  if (!payment_amount || payment_amount < 1) {
    return json(res, 400, { ok: false, error: "AMOUNT_INVALID" });
  }

  const user_ip = getClientIp(req);

  // Sipariş ID: benzersiz
  const merchant_oid = `AIVO_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  // Sepet: PayTR "user_basket" base64(JSON)
  // Örnek: [["Standart Paket", "399.00", 1]]
  const basket = [[plan, (payment_amount / 100).toFixed(2), 1]];
  const user_basket = b64(JSON.stringify(basket));

  // Zorunlu URL'ler (sende bu sayfalar olmalı)
  // PayTR ödeme sonucu bu URL'lere döner.
  const merchant_ok_url = "https://www.aivo.tr/checkout-success.html";
  const merchant_fail_url = "https://www.aivo.tr/checkout-fail.html";

  // Diğer alanlar (temel)
  const currency = "TRY";
  const lang = "tr";
  const test_mode = "1";         // canlıda "0"
  const debug_on = "1";          // canlıda "0"
  const timeout_limit = "30";    // dakika

  const no_installment = "0";
  const max_installment = "0";

  // İsim/adres/telefon PayTR tarafında önerilir (boş geçme daha iyi)
  // Şimdilik demo:
  const user_name = "AIVO Kullanıcı";
  const user_address = "Türkiye";
  const user_phone = "0000000000";

  // PAYTR TOKEN (iframe /odeme için)
  // Token string'i PayTR dokümanındaki sıraya göre yapılır:
  // merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
  const hash_str =
    merchant_id +
    user_ip +
    merchant_oid +
    email +
    String(payment_amount) +
    user_basket +
    no_installment +
    max_installment +
    currency +
    test_mode;

  const paytr_token = crypto
    .createHmac("sha256", merchant_key)
    .update(hash_str + merchant_salt)
    .digest("base64");

  // Frontend form'a basacağımız alanlar:
  const form = {
    merchant_id,
    user_ip,
    merchant_oid,
    email,
    payment_amount: String(payment_amount),
    currency,
    user_basket,

    no_installment,
    max_installment,
    installment_count: "0",

    user_name,
    user_address,
    user_phone,

    merchant_ok_url,
    merchant_fail_url,

    timeout_limit,
    debug_on,
    test_mode,
    lang,

    paytr_token,
  };

  return json(res, 200, { ok: true, oid: merchant_oid, form });
}
