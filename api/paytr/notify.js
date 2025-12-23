// /api/paytr/notify.js
import crypto from "crypto";

/**
 * PayTR hash doğrulama
 */
function hmacBase64(key, data) {
  return crypto
    .createHmac("sha256", key)
    .update(data)
    .digest("base64");
}

/**
 * KV GET
 */
async function kvGet(key) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
    },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

/**
 * KV SET
 */
async function kvSet(key, value) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return;
  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`;
  await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
    },
    body: JSON.stringify(value),
  }).catch(() => {});
}

export const config = {
  api: { bodyParser: true },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("METHOD_NOT_ALLOWED");
  }

  try {
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;

    const {
      merchant_oid,
      status,
      total_amount,
      hash,
    } = req.body || {};

    if (!merchant_oid || !status || !hash) {
      return res.status(400).send("MISSING_PARAMS");
    }

    // Hash doğrulama
    const hashStr = `${merchant_oid}${merchant_salt}${status}${total_amount}`;
    const expectedHash = hmacBase64(merchant_key, hashStr);

    if (expectedHash !== hash) {
      return res.status(400).send("HASH_MISMATCH");
    }

    // Siparişi KV’den al
    const orderKey = `aivo:order:${merchant_oid}`;
    const orderData = await kvGet(orderKey);
    const order = orderData?.result || orderData;

    if (!order) {
      // Sipariş yoksa bile PayTR OK bekler
      return res.status(200).send("OK");
    }

    if (status === "success") {
      order.status = "success";
      order.paid_at = Date.now();
    } else {
      order.status = "failed";
    }

    await kvSet(orderKey, order);

    // PayTR zorunlu OK cevabı
    return res.status(200).send("OK");
  } catch (err) {
    // Hata olsa bile PayTR tekrar denemesin diye OK
    return res.status(200).send("OK");
  }
}
