// /api/paytr/init.js
// PAYTR (TR) INIT — Altyapı modu (şimdilik KV’ye order yaz, iframe/token şart değil)

function safeJson(res, code, obj) {
  res.status(code).setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

async function kvSet(key, value) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return false;

  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(value),
  });

  return r.ok;
}

function genOid() {
  // basit ve yeterince unique bir order id (dev)
  return (
    "OID" +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 8).toUpperCase()
  );
}

// Senin plan/price/credits tablon (istersen aynı tut)
const AIVO_PLANS = {
  starter: { price: 99, credits: 100 },
  pro: { price: 199, credits: 300 },
  studio: { price: 399, credits: 800 },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return safeJson(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const plan = String(body.plan || "pro").toLowerCase();

    const planDef = AIVO_PLANS[plan] || AIVO_PLANS.pro;

    const oid = genOid();

    // ŞİMDİLİK: “ödeme başlatıldı” altyapı kaydı (pending)
    const order = {
      oid,
      status: "pending",
      plan,
      credits: planDef.credits,
      amountTRY: planDef.price,
      total_amount: planDef.price, // ileride komisyon/kdv vs eklenebilir
      createdAt: Date.now(),
      mode: "infra", // sadece altyapı
    };

    // KV yoksa da 500 verme; sadece log/response ile devam
    const wrote = await kvSet(`aivo:order:${oid}`, order);

    // Şimdilik PayTR token/iframe üretmiyoruz (secret yok)
    return safeJson(res, 200, {
      ok: true,
      infra: true,
      kv: wrote ? "written" : "skipped",
      oid,
      plan,
      credits: order.credits,
      amountTRY: order.amountTRY,
      // ileride gerçek PayTR entegrasyonu açılınca:
      // token: "...",
      // iframeUrl: "https://www.paytr.com/odeme/guvenli/...token..."
    });
  } catch (e) {
    return safeJson(res, 200, {
      ok: false,
      error: "INIT_EXCEPTION",
      message: String(e && e.message ? e.message : e),
    });
  }
}
