// /api/paytr/verify.js
// PayTR return sonrası "gerçek doğrulama":
// KV'de aivo:order:<oid> varsa ok:true, yoksa ORDER_NOT_FOUND

async function kvGet(key) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;

  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  if (!r.ok) return null;

  const data = await r.json().catch(() => null);
  if (!data || typeof data !== "object") return data;

  if ("result" in data) return data.result; // Upstash
  if ("value" in data) return data.value;   // Vercel KV

  return data;
}

function tryJsonParse(x) {
  if (typeof x !== "string") return x;
  try {
    return JSON.parse(x);
  } catch (_) {
    return x;
  }
}

// -------- server-side apply çağrısı --------
async function callApply(oid) {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

    const url = `${base}/api/paytr/apply`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oid }),
    });

    return await r.json().catch(() => null);
  } catch {
    return null;
  }
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

    const kvReady = !!(
      process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
    );
    if (!kvReady) {
      return res.status(200).json({
        ok: false,
        error: "KV_NOT_CONFIGURED",
        oid,
      });
    }

    const orderKey = `aivo:order:${oid}`;
    let order = await kvGet(orderKey);

    if (!order) {
      return res.status(404).json({
        ok: false,
        error: "ORDER_NOT_FOUND",
        oid,
      });
    }

    // unwrap + parse
    order = tryJsonParse(order);

    if (order && typeof order === "object" && order.value) {
      order = order.value;
    }

    if (order && typeof order === "object" && order.result) {
      const r = order.result;
      order = r.value && typeof r.value === "object" ? r.value : r;
    }

    const o = order;

    // -------- PAID ise APPLY TETİKLE --------
    let applyResult = null;
    if (
      o?.status === "paid" &&
      (!o?.credit_applied || !o?.invoice_created)
    ) {
      applyResult = await callApply(oid);
    }

    return res.status(200).json({
      ok: true,
      oid,
      provider: o?.provider || "paytr",

      status: o?.status ?? null,
      total_amount: o?.total_amount ?? null,
      currency: o?.currency ?? "TRY",

      plan: o?.plan ?? null,
      credits: o?.credits ?? null,
      amount: o?.amount ?? null,

      credit_applied: !!(
        applyResult?.credit_applied ?? o?.credit_applied
      ),
      invoice_created: !!(
        applyResult?.invoice_created ?? o?.invoice_created
      ),

      credits_balance:
        applyResult?.credits_balance ??
        o?.credit_balance_after ??
        null,

      invoice_id:
        applyResult?.invoice_id ??
        o?.invoice_id ??
        null,

      created_at: o?.created_at ?? null,
      updated_at: o?.updated_at ?? null,
      paid_at: o?.paid_at ?? null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "VERIFY_FAILED",
      message: e?.message || "UNKNOWN",
    });
  }
}
