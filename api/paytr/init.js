// /api/paytr/init.js
// PayTR ödeme başlatma – SADECE BACKEND

import crypto from "crypto";

function json(res, code, data) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function kvSet(key, value) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return;

  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });
}

function createOid() {
  return (
    "AIVO_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

function generatePaytrToken({
  merchant_id,
  merchant_key,
  merchant_salt,
  user_ip,
  merchant_oid,
  email,
  payment_amount,
  test_mode,
}) {
  const hashStr =
    merchant_id +
    user_ip +
    merchant_oid +
    email +
    payment_amount +
    "card" +
    "0" +
    "TRY" +
    test_mode;

  return crypto
    .createHmac("sha256", merchant_key + merchant_salt)
    .update(hashStr)
    .digest("base64");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const { user_id, email, plan, credits, amount } = req.body || {};
    if (!email || !plan || !amount) {
      return json(res, 400, { ok: false, error: "MISSING_FIELDS" });
    }

    const merchant_id = process.env.PAYTR_MERCHANT_ID;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
    const test_mode = process.env.PAYTR_TEST_MODE === "true" ? "1" : "0";

    if (!merchant_id || !merchant_key || !merchant_salt) {
      return json(res, 500, { ok: false, error: "PAYTR_ENV_NOT_SET" });
    }

    const oid = createOid();

    // KV init kaydı
    await kvSet(`aivo:order_init:${oid}`, {
      oid,
      user_id: user_id || null,
      email,
      plan,
      credits: Number(credits || 0),
      amount: Number(amount),
      currency: "TRY",
      created_at: new Date().toISOString(),
    });

    const user_ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    const payment_amount = Number(amount) * 100; // kuruş

    const paytr_token = generatePaytrToken({
      merchant_id,
      merchant_key,
      merchant_salt,
      user_ip,
      merchant_oid: oid,
      email,
      payment_amount,
      test_mode,
    });

    return json(res, 200, {
      ok: true,
      oid,
      form: {
        merchant_id,
        user_ip,
        merchant_oid: oid,
        email,
        payment_amount,
        currency: "TRY",
        test_mode,
        paytr_token,
        no_installment: 1,
        max_installment: 0,
        merchant_ok_url: "https://www.aivo.tr/ok",
        merchant_fail_url: "https://www.aivo.tr/fail",
      },
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "INIT_PAYTR_FAILED",
      message: e?.message || "UNKNOWN",
    });
  }
}
