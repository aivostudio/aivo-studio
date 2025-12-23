// /api/paytr/init.js
import crypto from "crypto";

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function getUserIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  if (Array.isArray(xf) && xf.length) return xf[0].trim();
  return req.socket?.remoteAddress || "127.0.0.1";
}

function generatePaytrToken({
  merchant_id,
  merchant_key,
  merchant_salt,
  user_ip,
  merchant_oid,
  email,
  payment_amount,
  user_basket,
  test_mode,
}) {
  const hashStr =
    merchant_id +
    user_ip +
    merchant_oid +
    email +
    payment_amount +
    user_basket +
    test_mode +
    merchant_salt;

  return crypto
    .createHmac("sha256", merchant_key)
    .update(hashStr)
    .digest("base64");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  // ---- ENV ----
  const merchant_id = process.env.PAYTR_MERCHANT_ID;
  const merchant_key = process.env.PAYTR_MERCHANT_KEY;
  const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
  const test_mode = (process.env.PAYTR_TEST_MODE || "1").trim(); // "1" test, "0" live

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

  // ---- BODY ----
  let body = null;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    return json(res, 400, { ok: false, error: "BODY_JSON_INVALID" });
  }

  const plan = String(body?.plan || "Standart Paket").trim();
  const email = String(body?.email || "").trim();
  const amount = Number(body?.amount || 0);

  if (!email || !email.includes("@")) {
    return json(res, 400, { ok: false, error: "EMAIL_INVALID" });
  }
  if (!Number.isFinite(amount) || amount < 1) {
    return json(res, 400, { ok: false, error: "AMOUNT_INVALID" });
  }

  // ---- PayTR required computed fields ----
  const user_ip = getUserIp(req);
  const payment_amount = String(Math.round(amount * 100)); // "39900"

  // user_basket: base64(JSON.stringify([[name, price_kurus, qty]]))
  const user_basket = Buffer.from(
    JSON.stringify([[plan + " Paketi", Math.round(amount * 100), 1]])
  ).toString("base64");

  // merchant_oid: unique order id
  const oid = "AIVO_" + Date.now();

  // callback urls (same domain as request)
  const proto =
    (req.headers["x-forwarded-proto"] || "https").toString().split(",")[0];
  const host = (req.headers.host || "www.aivo.tr").toString();
  const baseUrl = `${proto}://${host}`;

  const merchant_ok_url = `${baseUrl}/api/paytr/ok`;
  const merchant_fail_url = `${baseUrl}/api/paytr/fail`;

  // token
  const paytr_token = generatePaytrToken({
    merchant_id,
    merchant_key,
    merchant_salt,
    user_ip,
    merchant_oid: oid,
    email,
    payment_amount,
    user_basket,
    test_mode,
  });

  // ---- form payload for POST https://www.paytr.com/odeme ----
  const form = {
    merchant_id,
    user_ip,
    merchant_oid: oid,
    email,
    payment_amount,
    currency: "TRY",

    user_basket,

    no_installment: "1",
    max_installment: "0",
    installment_count: "0",

    merchant_ok_url,
    merchant_fail_url,

    timeout_limit: "30",
    debug_on: "1",
    test_mode,
    lang: "tr",

    paytr_token,
  };

  return json(res, 200, { ok: true, oid, form });
}
