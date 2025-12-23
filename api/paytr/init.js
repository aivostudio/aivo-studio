// /api/paytr/init.js
// Sipariş başlat + KV'ye bağla + PayTR token & form üret (FIXED)

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
  // ZORUNLU STRING DÖNÜŞÜMLER
  const mid = String(merchant_id || "");
  const mkey = String(merchant_key || "");
  const msalt = String(merchant_salt || "");

  if (!mid || !mkey || !msalt) {
    throw new Error("PAYTR_ENV_MISSING");
  }

  const hashStr =
    mid +
    user_ip +
    merchant_oid +
    email +
    payment_amount +
    "card" +
    "0" +
    "TRY" +
    test_mode;

  return crypto
    .createHmac("sha256", mkey + msalt)
    .update(hashStr)
    .digest("base64");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const { user_id, email, plan, credits, amount } = req.body || {};

    if (!email || !plan || credits == null || amount == null) {
      return json(res, 400, {
        ok: false,
        error: "MISSING_FIELDS",
      });
    }

    const numericAmount = Number(amount);
    const numericCredits = Number(credits);

    if (!Number.isFinite(numericAmount) || !Number.isFinite(numericCredits)) {
      return json(res, 400, {
        ok: false,
        error: "INVALID_AMOUNT_OR_CREDITS",
      });
    }

    const oid = createOid();

    // 1️⃣ KV init yaz
    const initData = {
      oid,
      user_id: user_id || null,
      email,
      plan,
      credits: numericCredits,
      amount: numericAmount,
      currency: "TRY",
      created_at: new Date().toISOString(),
    };

    await kvSet(`aivo:order_init:${oid}`, initData);

    // 2️⃣ ENV’ler (STRING ZORUNLU)
    const merchant_id = String(process.env.PAYTR_MERCHANT_ID || "");
    const merchant_key = String(process.env.PAYTR_MERCHANT_KEY || "");
    const merchant_salt = String(process.env.PAYTR_MERCHANT_SALT || "");
    const test_mode = process.env.PAYTR_TEST_MODE === "true" ? "1" : "0";

    if (!merchant_id || !merchant_key || !merchant_salt) {
      return json(res, 500, {
        ok: false,
        error: "PAYTR_ENV_NOT_SET",
      });
    }

    const user_ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0] ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    const payment_amount = Math.round(numericAmount * 100); // KURUŞ

    // 3️⃣ PayTR token
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

    // 4️⃣ Frontend’e dönecek form
    const form = {
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
    };

    return json(res, 200, {
      ok: true,
      oid,
      form,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "INIT_PAYTR_FAILED",
      message: e?.message || "UNKNOWN",
    });
  }
}
