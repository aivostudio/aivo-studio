// /api/paytr/verify.js
// PayTR return sonrası "gerçek doğrulama":
// KV'de aivo:order:<oid> varsa ok:true, yoksa ORDER_NOT_FOUND
// PAID ise (credit_applied / invoice_created eksikse) server-side /api/paytr/apply tetikler.

async function kvGet(key) {
  // Vercel KV / Upstash REST
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;

  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  if (!r.ok) return null;

  const data = await r.json().catch(() => null);
  if (!data || typeof data !== "object") return data;

  // Upstash: { result: "..." }  / Vercel KV: { value: "..." }
  if ("result" in data) return data.result;
  if ("value" in data) return data.value;

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
    // Vercel prod URL: VERCEL_URL set olur (domain yoksa preview domain)
    // Alternatif: NEXT_PUBLIC_SITE_URL (https://aivo.tr gibi)
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : String(process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

    if (!base) return null;

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

// -------- unwrap helper (KV response varyantları için) --------
function unwrapKvPayload(order) {
  order = tryJsonParse(order);

  // bazen { value: ... } / { result: ... } wrapper geliyor
  if (order && typeof order === "object" && "value" in order) order = order.value;
  if (order && typeof order === "object" && "result" in order) {
    const r = order.result;
    order = r && typeof r === "object" && "value" in r ? r.value : r;
  }

  // tekrar parse dene
  order = tryJsonParse(order);

  return order;
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

    const kvReady = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
    if (!kvReady) {
      return res.status(200).json({ ok: false, error: "KV_NOT_CONFIGURED", oid });
    }

    const orderKey = `aivo:order:${oid}`;
    let order = await kvGet(orderKey);

    if (!order) {
      return res.status(404).json({ ok: false, error: "ORDER_NOT_FOUND", oid });
    }

    const o = unwrapKvPayload(order);

    // -------- PAID ise APPLY TETİKLE --------
    let applyResult = null;
    const shouldApply =
      o?.status === "paid" && (!o?.credit_applied || !o?.invoice_created);

    if (shouldApply) {
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

      credit_applied: !!(applyResult?.credit_applied ?? o?.credit_applied),
      invoice_created: !!(applyResult?.invoice_created ?? o?.invoice_created),

      credits_balance:
        applyResult?.credits_balance ?? o?.credit_balance_after ?? null,

      invoice_id: applyResult?.invoice_id ?? o?.invoice_id ?? null,

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
