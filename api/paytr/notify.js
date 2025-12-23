// /api/paytr/notify.js
// PayTR Bildirim URL (callback/notify): hash doğrula + KV'ye order yaz (idempotent)
// Beklenti: PayTR bu endpoint'e POST (form-urlencoded) gönderir ve biz "OK" döneriz.

import crypto from "crypto";
import querystring from "querystring";

/* -------------------------------------------------------
   KV HELPERS (Vercel KV REST style: /get/<key>, /set/<key>)
------------------------------------------------------- */
async function kvGet(key) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;

  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` } });
  if (!r.ok) return null;

  const data = await r.json().catch(() => null);
  return data && typeof data === "object" && "result" in data ? data.result : data;
}

async function kvSet(key, value) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return { ok: false, skipped: true };
  }

  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { ok: false, status: r.status, error: t || "KV_SET_FAILED" };
  }

  const data = await r.json().catch(() => ({}));
  return { ok: true, result: data };
}

/* -------------------------------------------------------
   BODY PARSER
------------------------------------------------------- */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function readPost(req) {
  if (req.body && typeof req.body === "object") return req.body;

  const raw = await readRawBody(req);

  // JSON gelirse parse etmeyi dene
  const ct = String(req.headers["content-type"] || "");
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw || "{}");
    } catch (_) {
      return {};
    }
  }

  // PayTR: application/x-www-form-urlencoded
  return querystring.parse(raw);
}

/* -------------------------------------------------------
   PAYTR HASH VERIFY
   hash_str = merchant_oid + merchant_salt + status + total_amount
   hash = base64( HMAC_SHA256(merchant_key, hash_str) )
------------------------------------------------------- */
function computePaytrNotifyHash({ merchant_oid, status, total_amount }, merchantKey, merchantSalt) {
  const hashStr =
    String(merchant_oid || "") +
    String(merchantSalt || "") +
    String(status || "") +
    String(total_amount || "");
  return crypto.createHmac("sha256", merchantKey).update(hashStr).digest("base64");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  /* =========================================================
     DEV TEST BYPASS (Production dahil)
     - Sadece PAYTR_DEV_TEST=true iken çalışır
     - Header: x-dev-test: 1
     - JSON body ile KV’ye aivo:order:<oid> yazar
     ========================================================= */
  const devTestMode =
    String(process.env.PAYTR_DEV_TEST || "false") === "true" &&
    String(req.headers["x-dev-test"] || "") === "1";

  if (devTestMode) {
    const b = await readPost(req);

    const oid = String(b.oid || "").trim();
    if (!oid) return res.status(400).json({ ok: false, error: "MISSING_OID" });

    const status = String(b.status || "paid"); // paid|failed|pending
    const amount = Number(b.amount ?? 199);
    const currency = String(b.currency || "TRY");
    const plan = String(b.plan || "AIVO_PRO");
    const credits = Number(b.credits ?? 300);

    const now = new Date().toISOString();
    const orderKey = `aivo:order:${oid}`;

    const record = {
      oid,
      provider: "paytr",
      status,
      total_amount: String(amount),
      currency,
      plan,
      credits,
      amount,
      created_at: now,
      updated_at: now,
      paid_at: status === "paid" ? now : null,
      credit_applied: false,
      invoice_created: false,
      _dev: true,
    };

    await kvSet(orderKey, record);

    return res.status(200).json({ ok: true, dev: true, message: "ORDER_WRITTEN_TO_KV", oid });
  }

  // --------- NORMAL PAYTR NOTIFY FLOW ----------
  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

  let post;
  try {
    post = await readPost(req);
  } catch (e) {
    return res.status(400).send("BAD_REQUEST");
  }

  const merchant_oid = post.merchant_oid;
  const status = post.status; // success/failed
  const total_amount = post.total_amount;
  const hash = post.hash;

  if (!merchant_oid || !status || !total_amount || !hash) {
    return res.status(400).send("MISSING_FIELDS");
  }

  if (!merchantKey || !merchantSalt) {
    return res.status(200).send("OK");
  }

  const expected = computePaytrNotifyHash({ merchant_oid, status, total_amount }, merchantKey, merchantSalt);
  if (expected !== String(hash)) {
    return res.status(400).send("BAD_HASH");
  }

  const oid = String(merchant_oid);
  const orderKey = `aivo:order:${oid}`;

  try {
    const existing = await kvGet(orderKey);
    if (existing && typeof existing === "object" && existing.status === "paid") {
      return res.status(200).send("OK");
    }

    const initKey = `aivo:order_init:${oid}`;
    const initData = await kvGet(initKey);

    const now = new Date().toISOString();
    const record = {
      oid,
      provider: "paytr",
      status: status === "success" ? "paid" : "failed",
      total_amount: String(total_amount),
      currency: initData?.currency || "TRY",
      plan: initData?.plan || null,
      credits: initData?.credits || null,
      amount: initData?.amount || null,
      created_at: existing?.created_at || initData?.created_at || now,
      updated_at: now,
      paid_at: status === "success" ? now : existing?.paid_at || null,
      credit_applied: existing?.credit_applied || false,
      invoice_created: existing?.invoice_created || false,
      notify: { status: String(status), total_amount: String(total_amount) },
    };

    await kvSet(orderKey, record);
    return res.status(200).send("OK");
  } catch (e) {
    return res.status(200).send("OK");
  }
}
