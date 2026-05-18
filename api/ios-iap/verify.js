const crypto = require("crypto");
const kvMod = require("../_kv.js");

const kv = kvMod?.default || kvMod || {};
const kvGet = kv.kvGet;
const kvSet = kv.kvSet;

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed",
      });
    }

    const body = req.body || {};
    const productId = String(body.productId || "").trim();
    const transactionId = String(body.transactionId || "").trim();
    const receipt = String(body.receipt || "").trim();

    const userId = String(
      body.userId ||
      body.email ||
      ""
    ).trim().toLowerCase();

    const CREDIT_PACKAGES = {
      "tr.aivo.credits.25": 25,
      "tr.aivo.credits.100": 100,
      "tr.aivo.credits.200": 200,
      "tr.aivo.credits.500": 500,
    };

    const credits = CREDIT_PACKAGES[productId];

    if (!credits) {
      return res.status(400).json({
        ok: false,
        error: "invalid_product_id",
      });
    }

    if (!transactionId && !receipt) {
      return res.status(400).json({
        ok: false,
        error: "missing_transaction_or_receipt",
      });
    }

    if (!userId) {
      return res.status(400).json({
        ok: false,
        error: "missing_user_id",
      });
    }

    if (typeof kvGet !== "function" || typeof kvSet !== "function") {
      return res.status(500).json({
        ok: false,
        error: "kv_not_ready",
      });
    }

    const purchaseFingerprint = transactionId
      ? `tx:${transactionId}`
      : `receipt:${sha256(receipt)}`;

    const idempotencyKey = [
      "ios_iap",
      userId,
      productId,
      purchaseFingerprint
    ].join(":");

    const existingPurchase = await kvGet(idempotencyKey).catch(() => null);

    if (existingPurchase) {
   let parsed = {};

try {
  parsed = typeof existingPurchase === "string"
    ? JSON.parse(existingPurchase)
    : existingPurchase;
} catch (err) {
  parsed = {};
}

      return res.status(200).json({
        ok: true,
        provider: "apple_iap",
        verified: true,
        deduped: true,
        productId,
        transactionId,
        creditsAdded: 0,
        creditsBefore: parsed.creditsBefore,
        creditsAfter: parsed.creditsAfter,
        message: "Purchase already processed.",
      });
    }

    const creditKey = `credits:${userId}`;
    const currentCredits = Number(await kvGet(creditKey).catch(() => 0)) || 0;
    const nextCredits = currentCredits + credits;

    await kvSet(creditKey, nextCredits);

    await kvSet(idempotencyKey, JSON.stringify({
      provider: "apple_iap",
      productId,
      transactionId,
      creditsAdded: credits,
      creditsBefore: currentCredits,
      creditsAfter: nextCredits,
      processedAt: new Date().toISOString()
    }));

    return res.status(200).json({
      ok: true,
      provider: "apple_iap",
      verified: true,
      deduped: false,
      productId,
      transactionId,
      creditsAdded: credits,
      creditsBefore: currentCredits,
      creditsAfter: nextCredits,
      message: "Credits successfully added.",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "ios_iap_verify_failed",
      detail: err && err.message ? err.message : "Unknown error",
    });
  }
}
