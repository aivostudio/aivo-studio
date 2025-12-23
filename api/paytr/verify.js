// /api/paytr/verify.js
// PayTR return sonrası "gerçek doğrulama":
// KV'de aivo:order:<oid> varsa ok:true, yoksa ORDER_NOT_FOUND

async function kvGet(key) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }

  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
    },
  });

  if (!r.ok) return null;

  const data = await r.json().catch(() => null);
  // Upstash/Vercel KV REST genelde { result: ... } döner
  return data && typeof data === "object" && "result" in data ? data.result : data;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const oid = String(req.query?.oid || "").trim();
    if (!oid) {
      return res.status(400).json({ ok: false, error: "MISSING_OID" });
    }

    // KV yoksa: dev modda normal olabilir
    const kvReady = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
    if (!kvReady) {
      return res.status(200).json({
        ok: false,
        error: "KV_NOT_CONFIGURED",
        oid,
      });
    }

    const orderKey = `aivo:order:${oid}`;
    const order = await kvGet(orderKey);

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: "ORDER_NOT_FOUND",
        oid,
      });
    }

    // order string gelirse parse etmeyi dene (bazı KV'ler string saklar)
    let o = order;
    if (typeof o === "string") {
      try {
        o = JSON.parse(o);
      } catch (_) {
        // string olarak kalsın
      }
    }

    // Standart response şeması (frontend hook için)
    return res.status(200).json({
      ok: true,
      oid,
      provider: o?.provider || "paytr",
      status: o?.status || null, // "paid" | "failed" | "pending"
      total_amount: o?.total_amount ?? null,
      currency: o?.currency ?? "TRY",

      // plan/credits initData'dan geliyorsa burada görünür
      plan: o?.plan ?? null,
      credits: o?.credits ?? null,
      amount: o?.amount ?? null,

      // idempotency bayrakları
      credit_applied: !!o?.credit_applied,
      invoice_created: !!o?.invoice_created,

      // zamanlar
      created_at: o?.created_at ?? null,
      updated_at: o?.updated_at ?? null,
      paid_at: o?.paid_at ?? null,

      // debug (istersen kaldırabilirsin)
      _raw: o,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "VERIFY_FAILED",
      message: e?.message || "UNKNOWN",
    });
  }
}
