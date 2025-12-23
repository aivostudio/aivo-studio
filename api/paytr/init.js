// /api/paytr/init.js
// Amaç: Sipariş başlat + kullanıcıyı order'a bağla

function json(res, code, data) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

async function kvSet(key, value) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
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

  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  return data?.result ?? data;
}

// basit oid üretici
function createOid() {
  return (
    "AIVO_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  ).toUpperCase();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const {
      user_id,
      email,
      plan,
      credits,
      amount,
    } = req.body || {};

    if (!plan || !credits || !amount) {
      return json(res, 400, {
        ok: false,
        error: "MISSING_REQUIRED_FIELDS",
      });
    }

    // oid oluştur
    const oid = createOid();

    // init data
    const initData = {
      oid,
      user_id: user_id || null,
      email: email || null,
      plan,
      credits: Number(credits),
      amount: Number(amount),
      currency: "TRY",
      created_at: new Date().toISOString(),
    };

    // KV'ye yaz
    const key = `aivo:order_init:${oid}`;
    await kvSet(key, initData);

    return json(res, 200, {
      ok: true,
      oid,
      init: initData,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "INIT_FAILED",
      message: e?.message || "UNKNOWN",
    });
  }
}
