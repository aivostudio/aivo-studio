// /api/garanti/init.js
// Garanti ödeme başlangıcı
// Amaç: checkout'tan gelen POST'u al, order_init KV kaydı yaz, frontend'e Garanti yönlendirme alanları dön

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

async function kvCmd(path, { method = "GET", body } = {}) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;

  const url = `${process.env.KV_REST_API_URL}${path}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  return data && typeof data === "object" && "result" in data ? data.result : data;
}

async function kvSetJson(key, obj, { exSec } = {}) {
  const q = exSec ? `?EX=${encodeURIComponent(String(exSec))}` : "";
  return kvCmd(`/set/${encodeURIComponent(key)}${q}`, {
    method: "POST",
    body: obj,
  });
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function safeNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function getSiteBase() {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SITE_URL ||
    process.env.APP_URL ||
    "";

  return String(raw).replace(/\/$/, "");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  let body = null;
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch (_) {
    return json(res, 400, { ok: false, error: "BODY_JSON_INVALID" });
  }

  const user_id = String(body.user_id || "").trim();
  const email = normEmail(body.email);
  const plan = String(body.plan || "").trim();
  const amount = safeNum(body.amount);

  if (!user_id || !email) {
    return json(res, 400, {
      ok: false,
      error: "BODY_MISSING_FIELDS",
      need: ["user_id", "email"],
    });
  }

  if (!plan || amount <= 0) {
    return json(res, 400, { ok: false, error: "PLAN_OR_AMOUNT_INVALID" });
  }

  const oid = `GARANTI_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  const creditsMap = {
    "199": 25,
    "699": 100,
    "1299": 200,
    "2999": 500,
  };

  const credits =
    Number(body.credits) > 0
      ? Number(body.credits)
      : (creditsMap[String(amount)] || 0);

  const now = new Date().toISOString();
  const siteBase = getSiteBase();

  const okUrl = siteBase
    ? `${siteBase}/api/garanti/ok?oid=${encodeURIComponent(oid)}`
    : `/api/garanti/ok?oid=${encodeURIComponent(oid)}`;

  const failUrl = siteBase
    ? `${siteBase}/api/garanti/fail?oid=${encodeURIComponent(oid)}`
    : `/api/garanti/fail?oid=${encodeURIComponent(oid)}`;

  await kvSetJson(`aivo:garanti:order_init:${oid}`, {
    oid,
    email,
    user_id,
    plan,
    amount,
    credits,
    currency: "TRY",
    provider: "garanti",
    status: "init",
    ok_url: okUrl,
    fail_url: failUrl,
    created_at: now,
  }, { exSec: 60 * 60 * 24 });

  return json(res, 200, {
    ok: true,
    oid,
    provider: "garanti",
    gateway: {
      mode: "3d_form",
      action: "/api/garanti/notify",
      method: "POST",
          fields: {
        oid,
        amount,
        email,
        user_id,
        plan,
        status: "approved",
        notify_secret: String(process.env.GARANTI_NOTIFY_SECRET || ""),
        success_url: okUrl,
        fail_url: failUrl,
      },
    },
  });
}
