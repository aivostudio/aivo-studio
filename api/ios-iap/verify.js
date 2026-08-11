const crypto = require("crypto");
const kvMod = require("../_kv.js");

const kv = kvMod?.default || kvMod || {};
const kvGet = kv.kvGet;
const kvSet = kv.kvSet;

const APPLE_BUNDLE_ID = "tr.aivo.app";
const APPLE_ROOT_URLS = [
  "https://www.apple.com/certificateauthority/AppleRootCA-G2.cer",
  "https://www.apple.com/certificateauthority/AppleRootCA-G3.cer",
];

let appleRootCertificatesPromise = null;

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function base64UrlToBuffer(value) {
  let normalized = clean(value).replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  return Buffer.from(normalized, "base64");
}

function decodeJwsJsonPart(value) {
  return JSON.parse(base64UrlToBuffer(value).toString("utf8"));
}

function certificateIsValidNow(certificate) {
  const now = Date.now();
  const validFrom = Date.parse(certificate.validFrom);
  const validTo = Date.parse(certificate.validTo);
  return Number.isFinite(validFrom) && Number.isFinite(validTo) && now >= validFrom && now <= validTo;
}

async function getAppleRootCertificates() {
  if (!appleRootCertificatesPromise) {
    appleRootCertificatesPromise = Promise.all(
      APPLE_ROOT_URLS.map(async (url) => {
        const response = await fetch(url, { cache: "force-cache" });
        if (!response.ok) {
          throw new Error(`apple_root_fetch_failed_${response.status}`);
        }
        return new crypto.X509Certificate(Buffer.from(await response.arrayBuffer()));
      })
    ).catch((error) => {
      appleRootCertificatesPromise = null;
      throw error;
    });
  }

  return appleRootCertificatesPromise;
}

async function verifyStoreKit2Jws(jwsRepresentation, expectedProductId, expectedTransactionId) {
  const parts = clean(jwsRepresentation).split(".");
  if (parts.length !== 3) throw new Error("invalid_jws_format");

  const header = decodeJwsJsonPart(parts[0]);
  if (!header || header.alg !== "ES256") throw new Error("invalid_jws_algorithm");
  if (!Array.isArray(header.x5c) || header.x5c.length < 1) {
    throw new Error("missing_jws_certificate_chain");
  }

  const certificateChain = header.x5c.map((certificateBase64) => {
    return new crypto.X509Certificate(Buffer.from(clean(certificateBase64), "base64"));
  });

  for (const certificate of certificateChain) {
    if (!certificateIsValidNow(certificate)) {
      throw new Error("expired_jws_certificate");
    }
  }

  for (let index = 0; index < certificateChain.length - 1; index += 1) {
    if (!certificateChain[index].verify(certificateChain[index + 1].publicKey)) {
      throw new Error("invalid_jws_certificate_chain");
    }
  }

  const roots = await getAppleRootCertificates();
  const chainTop = certificateChain[certificateChain.length - 1];
  const trustedRoot = roots.some((root) => {
    if (chainTop.fingerprint256 === root.fingerprint256) return true;
    try {
      return chainTop.verify(root.publicKey);
    } catch (_) {
      return false;
    }
  });

  if (!trustedRoot) throw new Error("untrusted_apple_certificate_chain");

  const signatureValid = crypto.verify(
    "sha256",
    Buffer.from(`${parts[0]}.${parts[1]}`, "utf8"),
    {
      key: certificateChain[0].publicKey,
      dsaEncoding: "ieee-p1363",
    },
    base64UrlToBuffer(parts[2])
  );

  if (!signatureValid) throw new Error("invalid_jws_signature");

  const payload = decodeJwsJsonPart(parts[1]);
  const productId = clean(payload && payload.productId);
  const transactionId = clean(payload && payload.transactionId);
  const bundleId = clean(payload && payload.bundleId);

  if (bundleId !== APPLE_BUNDLE_ID) throw new Error("bundle_id_mismatch");
  if (!productId) throw new Error("missing_verified_product_id");
  if (!transactionId) throw new Error("missing_verified_transaction_id");
  if (expectedProductId && productId !== expectedProductId) throw new Error("product_id_mismatch");
  if (expectedTransactionId && transactionId !== expectedTransactionId) throw new Error("transaction_id_mismatch");
  if (payload && payload.revocationDate) throw new Error("transaction_revoked");

  return payload;
}

async function verifyLegacyAppleReceipt(receipt) {
  const productionUrl = "https://buy.itunes.apple.com/verifyReceipt";
  const sandboxUrl = "https://sandbox.itunes.apple.com/verifyReceipt";

  async function postToApple(url) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "receipt-data": receipt,
        "exclude-old-transactions": true,
      }),
    });
    return response.json();
  }

  let data = await postToApple(productionUrl);
  if (data && data.status === 21007) {
    data = await postToApple(sandboxUrl);
  }
  return data;
}

function findLegacyTransaction(appleVerifyData, productId, transactionId) {
  const receiptTransactions = Array.isArray(appleVerifyData?.receipt?.in_app)
    ? appleVerifyData.receipt.in_app
    : [];
  const latestTransactions = Array.isArray(appleVerifyData?.latest_receipt_info)
    ? appleVerifyData.latest_receipt_info
    : [];

  return [...receiptTransactions, ...latestTransactions].find((item) => {
    const itemProductId = clean(item && item.product_id);
    const itemTransactionId = clean(item && item.transaction_id);
    if (itemProductId !== productId) return false;
    if (transactionId && itemTransactionId !== transactionId) return false;
    return !!itemTransactionId;
  }) || null;
}

function findStoreKit2Jws(body) {
  const rawPayload = body && body.rawPayload ? body.rawPayload : {};
  const rawTransaction = rawPayload.rawTransaction || body.rawTransaction || {};
  const rawReceipt = rawPayload.rawReceipt || body.rawReceipt || {};
  const rawUpdatedItem = rawPayload.rawUpdatedItem || body.rawUpdatedItem || {};

  const direct = clean(
    body.jwsRepresentation ||
    body.signedTransactionInfo ||
    body.jws ||
    rawTransaction.jwsRepresentation
  );
  if (direct) return direct;

  const candidates = [];
  if (Array.isArray(rawReceipt.transactions)) candidates.push(...rawReceipt.transactions);
  if (Array.isArray(rawUpdatedItem.transactions)) candidates.push(...rawUpdatedItem.transactions);

  const requestedProductId = clean(body.productId);
  const requestedTransactionId = clean(body.transactionId);

  const matched = candidates.find((transaction) => {
    const productId = clean(
      transaction && transaction.products && transaction.products[0]
        ? transaction.products[0].id
        : ""
    );
    const transactionId = clean(transaction && transaction.transactionId);
    const jwsRepresentation = clean(transaction && transaction.jwsRepresentation);

    if (!jwsRepresentation) return false;
    if (requestedProductId && productId && productId !== requestedProductId) return false;
    if (requestedTransactionId && transactionId && transactionId !== requestedTransactionId) return false;
    return true;
  });

  return clean(matched && matched.jwsRepresentation);
}

async function readExistingPurchase(keys) {
  for (const key of keys) {
    const existing = await kvGet(key).catch(() => null);
    if (!existing) continue;
    try {
      return typeof existing === "string" ? JSON.parse(existing) : existing;
    } catch (_) {
      return {};
    }
  }
  return null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (typeof kvGet !== "function" || typeof kvSet !== "function") {
      return res.status(500).json({ ok: false, error: "kv_not_ready" });
    }

    const body = req.body || {};
    const requestedProductId = clean(body.productId);
    const requestedTransactionId = clean(body.transactionId);
    const receipt = clean(body.receipt);
    const jwsRepresentation = findStoreKit2Jws(body);
    const userId = normalizeEmail(body.userId || body.email);

    if (!userId) {
      return res.status(400).json({ ok: false, error: "missing_user_id" });
    }

    let productId = requestedProductId;
    let transactionId = requestedTransactionId;
    let purchaseDate = clean(body.purchaseDate);
    let verificationMode = "";

    if (jwsRepresentation) {
      let verifiedPayload;
      try {
        verifiedPayload = await verifyStoreKit2Jws(
          jwsRepresentation,
          requestedProductId,
          requestedTransactionId
        );
      } catch (error) {
        return res.status(400).json({
          ok: false,
          provider: "apple_iap",
          error: "apple_jws_not_verified",
          detail: clean(error && error.message) || "jws_verification_failed",
        });
      }

      productId = clean(verifiedPayload.productId);
      transactionId = clean(verifiedPayload.transactionId);
      purchaseDate = clean(verifiedPayload.purchaseDate || purchaseDate);
      verificationMode = "storekit2_jws";
    } else {
      if (!requestedProductId || !receipt) {
        return res.status(400).json({
          ok: false,
          error: "missing_transaction_verification_data",
        });
      }

      const appleVerifyData = await verifyLegacyAppleReceipt(receipt);
      if (!appleVerifyData || appleVerifyData.status !== 0) {
        return res.status(400).json({
          ok: false,
          provider: "apple_iap",
          error: "apple_receipt_not_verified",
          appleStatus: appleVerifyData && appleVerifyData.status,
        });
      }

      const matched = findLegacyTransaction(
        appleVerifyData,
        requestedProductId,
        requestedTransactionId
      );
      if (!matched) {
        return res.status(400).json({
          ok: false,
          provider: "apple_iap",
          error: "apple_transaction_not_found_in_receipt",
        });
      }

      productId = clean(matched.product_id);
      transactionId = clean(matched.transaction_id);
      purchaseDate = clean(matched.purchase_date_ms || purchaseDate);
      verificationMode = "legacy_receipt";
    }

    const CREDIT_PACKAGES = {
      "tr.aivo.credits.25": 25,
      "tr.aivo.credits.100": 100,
      "tr.aivo.credits.200": 200,
      "tr.aivo.credits.500": 500,
    };

    const credits = CREDIT_PACKAGES[productId];
    if (!credits) {
      return res.status(400).json({ ok: false, error: "invalid_product_id" });
    }
    if (!transactionId) {
      return res.status(400).json({ ok: false, error: "missing_verified_transaction_id" });
    }

    const primaryIdempotencyKey = [
      "ios_iap",
      userId,
      productId,
      `tx:${transactionId}`,
    ].join(":");

    const idempotencyKeys = [primaryIdempotencyKey];
    if (purchaseDate) {
      idempotencyKeys.push([
        "ios_iap",
        userId,
        productId,
        `tx:${transactionId}:${purchaseDate}`,
      ].join(":"));
    }

    const existingPurchase = await readExistingPurchase(idempotencyKeys);
    if (existingPurchase) {
      return res.status(200).json({
        ok: true,
        provider: "apple_iap",
        verified: true,
        verificationMode,
        deduped: true,
        productId,
        transactionId,
        creditsAdded: 0,
        creditsBefore: existingPurchase.creditsBefore,
        creditsAfter: existingPurchase.creditsAfter,
        message: "Purchase already processed.",
      });
    }

    const creditKey = `credits:${userId}`;
    const currentCredits = Number(await kvGet(creditKey).catch(() => 0)) || 0;
    const nextCredits = currentCredits + credits;

    const purchaseRecord = {
      provider: "apple_iap",
      verificationMode,
      productId,
      transactionId,
      purchaseDate,
      creditsAdded: credits,
      creditsBefore: currentCredits,
      creditsAfter: nextCredits,
      processedAt: new Date().toISOString(),
    };

    await kvSet(creditKey, nextCredits);
    await kvSet(primaryIdempotencyKey, JSON.stringify(purchaseRecord));

    return res.status(200).json({
      ok: true,
      provider: "apple_iap",
      verified: true,
      verificationMode,
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
      detail: clean(err && err.message) || "Unknown error",
    });
  }
}
