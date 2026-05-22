const crypto = require("crypto");
const kvMod = require("../_kv.js");

const kv = kvMod?.default || kvMod || {};
const kvGet = kv.kvGet;
const kvSet = kv.kvSet;

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || "tr.aivo.app";
const SERVICE_ACCOUNT_JSON = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON || "";

const CREDIT_PACKAGES = {
  "tr.aivo.credits.25": 25,
  "tr.aivo.credits.100": 100,
  "tr.aivo.credits.200": 200,
  "tr.aivo.credits.500": 500,
};

function sha256(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || ""))
    .digest("hex");
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function getServiceAccount() {
  if (!SERVICE_ACCOUNT_JSON) {
    return null;
  }

  try {
    return JSON.parse(SERVICE_ACCOUNT_JSON);
  } catch (err) {
    return null;
  }
}

async function getGoogleAccessToken() {
  const serviceAccount = getServiceAccount();

  if (!serviceAccount || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("google_play_service_account_missing");
  }

  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
  };

  const claim = {
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const unsignedJwt = base64url(JSON.stringify(header)) + "." + base64url(JSON.stringify(claim));

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedJwt);
  signer.end();

  const signature = signer
    .sign(String(serviceAccount.private_key).replace(/\\n/g, "\n"))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  const jwt = unsignedJwt + "." + signature;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }).toString(),
  });

  const tokenData = await tokenRes.json().catch(() => ({}));

  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error("google_access_token_failed");
  }

  return tokenData.access_token;
}

async function verifyGooglePlayPurchase({ productId, purchaseToken }) {
  const accessToken = await getGoogleAccessToken();

  const url =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(PACKAGE_NAME) +
    "/purchases/products/" +
    encodeURIComponent(productId) +
    "/tokens/" +
    encodeURIComponent(purchaseToken);

  const verifyRes = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + accessToken,
    },
  });

  const data = await verifyRes.json().catch(() => ({}));

  if (!verifyRes.ok) {
    return {
      ok: false,
      error: "google_play_verify_failed",
      status: verifyRes.status,
      data,
    };
  }

  if (Number(data.purchaseState) !== 0) {
    return {
      ok: false,
      error: "purchase_not_completed",
      data,
    };
  }

  return {
    ok: true,
    provider: "google_play_billing",
    productId,
    purchaseToken,
    orderId: data.orderId || "",
    purchaseTimeMillis: data.purchaseTimeMillis || "",
    acknowledgementState: Number(data.acknowledgementState || 0),
    raw: data,
  };
}

async function acknowledgeGooglePlayPurchase({ productId, purchaseToken }) {
  const accessToken = await getGoogleAccessToken();

  const url =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(PACKAGE_NAME) +
    "/purchases/products/" +
    encodeURIComponent(productId) +
    "/tokens/" +
    encodeURIComponent(purchaseToken) +
    ":acknowledge";

  const ackRes = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      developerPayload: "aivo_google_play_billing",
    }),
  });

  if (!ackRes.ok) {
    const data = await ackRes.json().catch(() => ({}));

    return {
      ok: false,
      status: ackRes.status,
      data,
    };
  }

  return {
    ok: true,
  };
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
    const purchaseToken = String(body.purchaseToken || body.token || "").trim();
    const orderId = String(body.orderId || body.transactionId || "").trim();

    const userId = String(
      body.userId ||
      body.email ||
      ""
    ).trim().toLowerCase();

    const credits = CREDIT_PACKAGES[productId];

    if (!credits) {
      return res.status(400).json({
        ok: false,
        error: "invalid_product_id",
      });
    }

    if (!purchaseToken) {
      return res.status(400).json({
        ok: false,
        error: "missing_purchase_token",
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

    const tokenHash = sha256(purchaseToken);

    const idempotencyKey = [
      "google_play_billing",
      userId,
      productId,
      tokenHash,
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
        provider: "google_play_billing",
        verified: true,
        deduped: true,
        productId,
        orderId: parsed.orderId || orderId,
        creditsAdded: 0,
        creditsBefore: parsed.creditsBefore,
        creditsAfter: parsed.creditsAfter,
        message: "Purchase already processed.",
      });
    }

    const googleVerifyData = await verifyGooglePlayPurchase({
      productId,
      purchaseToken,
    });

    if (!googleVerifyData.ok) {
      return res.status(400).json({
        ok: false,
        provider: "google_play_billing",
        error: googleVerifyData.error || "google_play_purchase_not_verified",
        detail: googleVerifyData,
      });
    }

    const finalOrderId = googleVerifyData.orderId || orderId || "";

    const creditKey = `credits:${userId}`;
    const currentCredits = Number(await kvGet(creditKey).catch(() => 0)) || 0;
    const nextCredits = currentCredits + credits;

    await kvSet(creditKey, nextCredits);

    let acknowledged = false;

    if (Number(googleVerifyData.acknowledgementState) !== 1) {
      const ackResult = await acknowledgeGooglePlayPurchase({
        productId,
        purchaseToken,
      });

      acknowledged = !!ackResult.ok;
    } else {
      acknowledged = true;
    }

    await kvSet(idempotencyKey, JSON.stringify({
      provider: "google_play_billing",
      productId,
      orderId: finalOrderId,
      purchaseTokenHash: tokenHash,
      creditsAdded: credits,
      creditsBefore: currentCredits,
      creditsAfter: nextCredits,
      acknowledged,
      processedAt: new Date().toISOString(),
    }));

    return res.status(200).json({
      ok: true,
      provider: "google_play_billing",
      verified: true,
      deduped: false,
      productId,
      orderId: finalOrderId,
      creditsAdded: credits,
      creditsBefore: currentCredits,
      creditsAfter: nextCredits,
      acknowledged,
      message: "Credits successfully added.",
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "google_play_billing_verify_failed",
      detail: err && err.message ? err.message : "Unknown error",
    });
  }
}
