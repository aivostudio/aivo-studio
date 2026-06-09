// api/admin/play-orders.js

const GOOGLE_PLAY_ENV_KEY = "GOOGLE_PLAY_ORDERS_SERVICE_ACCOUNT_JSON";
const GOOGLE_PLAY_PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || "tr.aivo.app";
const GOOGLE_PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function parseServiceAccountJson() {
  const raw = process.env[GOOGLE_PLAY_ENV_KEY] || "";

  if (!raw.trim()) {
    throw new Error(`missing_env_${GOOGLE_PLAY_ENV_KEY}`);
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid_json_${GOOGLE_PLAY_ENV_KEY}`);
  }
}

function createGoogleJwt(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: serviceAccount.private_key_id
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: GOOGLE_PLAY_SCOPE,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 60 * 55
  };

  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const crypto = require("crypto");
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();

  const signature = signer
    .sign(serviceAccount.private_key)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${unsigned}.${signature}`;
}

async function getAccessToken() {
  const serviceAccount = parseServiceAccountJson();
  const assertion = createGoogleJwt(serviceAccount);

  const body = new URLSearchParams();
  body.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  body.set("assertion", assertion);

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.access_token) {
    return {
      ok: false,
      status: response.status,
      error: data.error || "google_token_failed",
      details: data.error_description || data
    };
  }

  return {
    ok: true,
    accessToken: data.access_token
  };
}

function normalizeOrderIds(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => String(item || "").split(","))
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function moneyToNumber(money) {
  if (!money) return 0;

  const units = Number(money.units || 0);
  const nanos = Number(money.nanos || 0);

  return units + nanos / 1000000000;
}

function pickCurrency(order) {
  return (
    order?.total?.currencyCode ||
    order?.developerRevenueInBuyerCurrency?.currencyCode ||
    order?.tax?.currencyCode ||
    order?.lineItems?.[0]?.listingPrice?.currencyCode ||
    "TRY"
  );
}

function summarizeOrder(order) {
  const firstItem = Array.isArray(order?.lineItems) ? order.lineItems[0] : null;

  return {
    orderId: order?.orderId || "",
    state: order?.state || "",
    createTime: order?.createTime || "",
    lastEventTime: order?.lastEventTime || "",
    purchaseToken: order?.purchaseToken || "",
    productId: firstItem?.productId || "",
    productTitle: firstItem?.productTitle || "",
    quantity:
      firstItem?.oneTimePurchaseDetails?.quantity ||
      firstItem?.subscriptionDetails?.quantity ||
      1,
    currency: pickCurrency(order),
    customerTotal: moneyToNumber(order?.total),
    developerRevenue: moneyToNumber(order?.developerRevenueInBuyerCurrency),
    tax: moneyToNumber(order?.tax),
    buyerCountry: order?.buyerAddress?.buyerCountry || "",
    refunded: Boolean(order?.orderHistory?.refundEvent),
    canceled: Boolean(order?.orderHistory?.cancellationEvent),
    raw: order
  };
}

function summarizeOrders(orders) {
  const list = Array.isArray(orders) ? orders : [];

  return list.reduce(
    function (acc, order) {
      const item = summarizeOrder(order);

      acc.units += Number(item.quantity || 1);
      acc.customerTotal += Number(item.customerTotal || 0);
      acc.developerRevenue += Number(item.developerRevenue || 0);
      acc.tax += Number(item.tax || 0);

      if (!acc.currency && item.currency) {
        acc.currency = item.currency;
      }

      return acc;
    },
    {
      units: 0,
      customerTotal: 0,
      developerRevenue: 0,
      tax: 0,
      currency: "TRY"
    }
  );
}

async function fetchSingleOrder(accessToken, packageName, orderId) {
  const url =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(packageName) +
    "/orders/" +
    encodeURIComponent(orderId);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      orderId,
      error: data?.error?.message || "google_play_order_fetch_failed",
      details: data
    };
  }

  return {
    ok: true,
    status: response.status,
    order: data
  };
}

async function fetchBatchOrders(accessToken, packageName, orderIds) {
  const params = new URLSearchParams();

  orderIds.forEach((orderId) => {
    params.append("orderIds", orderId);
  });

  const url =
    "https://androidpublisher.googleapis.com/androidpublisher/v3/applications/" +
    encodeURIComponent(packageName) +
    "/orders:batchGet?" +
    params.toString();

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: data?.error?.message || "google_play_orders_batch_fetch_failed",
      details: data
    };
  }

  return {
    ok: true,
    status: response.status,
    orders: Array.isArray(data.orders) ? data.orders : []
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed"
      });
    }

    const body = req.method === "POST" && req.body ? req.body : {};
    const packageName = String(
      req.query.packageName ||
        body.packageName ||
        GOOGLE_PLAY_PACKAGE_NAME ||
        "tr.aivo.app"
    ).trim();

    const orderIds = normalizeOrderIds(
      req.query.orderIds ||
        req.query.orderId ||
        body.orderIds ||
        body.orderId
    );

    if (!packageName) {
      return res.status(400).json({
        ok: false,
        error: "missing_package_name"
      });
    }

    if (!orderIds.length) {
      return res.status(200).json({
        ok: true,
        google_play_connected: true,
        packageName,
        count: 0,
        orders: [],
        rows: [],
        summary: {
          units: 0,
          customerTotal: 0,
          developerRevenue: 0,
          tax: 0,
          currency: "TRY"
        },
        message:
          "Google Play Orders API siparişleri kendiliğinden listelemez. Sipariş detayı çekmek için orderId veya orderIds gönderilmelidir."
      });
    }

    if (orderIds.length > 1000) {
      return res.status(400).json({
        ok: false,
        error: "too_many_order_ids",
        max: 1000
      });
    }

    const tokenResult = await getAccessToken();

    if (!tokenResult.ok) {
      return res.status(500).json({
        ok: false,
        error: tokenResult.error,
        status: tokenResult.status,
        details: tokenResult.details
      });
    }

    let orders = [];

    if (orderIds.length === 1) {
      const single = await fetchSingleOrder(
        tokenResult.accessToken,
        packageName,
        orderIds[0]
      );

      if (!single.ok) {
        return res.status(single.status || 500).json({
          ok: false,
          error: single.error,
          status: single.status,
          orderId: single.orderId,
          details: single.details
        });
      }

      orders = [single.order];
    } else {
      const batch = await fetchBatchOrders(
        tokenResult.accessToken,
        packageName,
        orderIds
      );

      if (!batch.ok) {
        return res.status(batch.status || 500).json({
          ok: false,
          error: batch.error,
          status: batch.status,
          details: batch.details
        });
      }

      orders = batch.orders;
    }

    const rows = orders.map(summarizeOrder);
    const summary = summarizeOrders(orders);

    return res.status(200).json({
      ok: true,
      google_play_connected: true,
      packageName,
      count: orders.length,
      requestedOrderIds: orderIds,
      rows,
      orders,
      summary
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err?.message || "play_orders_failed"
    });
  }
}
