// /api/garanti/notify.js
// Garanti bildirim/callback endpoint'i
// Geçici güvenlik: gerçek banka imzası bağlanana kadar sadece secret doğrulanan istek paid yazabilir

async function kvGet(key) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;

  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
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
    body: JSON.stringify(value),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { ok: false, status: r.status, error: t || "KV_SET_FAILED" };
  }

  const data = await r.json().catch(() => ({}));
  return { ok: true, result: data };
}

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
  const ct = String(req.headers["content-type"] || "");

  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw || "{}");
    } catch (_) {
      return {};
    }
  }

  const params = new URLSearchParams(raw);
  const out = {};
  for (const [k, v] of params.entries()) out[k] = v;
  return out;
}

function pickOid(post) {
  return String(
    post.oid ||
    post.order_id ||
    post.merchant_oid ||
    post.OrderId ||
    post.orderid ||
    ""
  ).trim();
}

function pickRawStatus(post) {
  return String(
    post.status ||
    post.mdStatus ||
    post.procreturncode ||
    post.Response ||
    ""
  ).trim().toLowerCase();
}

function pickAmount(post, initData) {
  const raw =
    post.txnamount ||
    post.amount ||
    post.toplam ||
    post.total_amount ||
    initData?.amount ||
    null;

  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function redirectToCheckout(res, state, oid) {
  const qs = new URLSearchParams();
  qs.set("garanti", state);
  if (oid) qs.set("oid", oid);
  return res.redirect(`/checkout.html?${qs.toString()}`);
}

function isApprovedStatus(raw) {
  return raw === "approved" || raw === "success" || raw === "paid" || raw === "1" || raw === "00";
}

function hasValidTempSecret(req, post) {
  const secret = String(process.env.GARANTI_NOTIFY_SECRET || "").trim();
  if (!secret) return false;

  const headerSecret = String(req.headers["x-garanti-notify-secret"] || "").trim();
  const bodySecret = String(post.notify_secret || "").trim();

  return headerSecret === secret || bodySecret === secret;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const post = await readPost(req);
    const oid = pickOid(post);

    if (!oid) {
      return res.status(400).send("MISSING_OID");
    }

    const orderKey = `aivo:garanti:order:${oid}`;
    const initKey = `aivo:garanti:order_init:${oid}`;

    const existing = await kvGet(orderKey);
    const initData = await kvGet(initKey);

    const now = new Date().toISOString();
    const rawStatus = pickRawStatus(post);
    const approved = isApprovedStatus(rawStatus);
    const trusted = hasValidTempSecret(req, post);

    const status = approved && trusted ? "paid" : "failed";
    const amount = pickAmount(post, initData);

    const record = {
      oid,
      provider: "garanti",
      status,
      total_amount: amount,
      currency: initData?.currency || "TRY",
      plan: initData?.plan || null,
      credits: initData?.credits || null,
      amount: initData?.amount || amount || null,
      email: initData?.email || null,
      created_at: existing?.created_at || initData?.created_at || now,
      updated_at: now,
      paid_at: status === "paid" ? now : existing?.paid_at || null,
      credit_applied: existing?.credit_applied || false,
      invoice_created: existing?.invoice_created || false,
      notify_payload: post,
      notify_trusted: trusted,
    };

    await kvSet(orderKey, record);

    if (status === "paid") {
      return redirectToCheckout(res, "ok", oid);
    }

    return redirectToCheckout(res, "fail", oid);
  } catch (e) {
    return redirectToCheckout(res, "fail", "");
  }
}
