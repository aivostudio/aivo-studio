// /api/garanti/verify.js
// Garanti return sonrası gerçek doğrulama:
// TEK SOURCE OF TRUTH: api/_kv.js
// KV'de aivo:garanti:order:<oid> varsa ok:true, yoksa ORDER_NOT_FOUND
// PAID ise (credit_applied / invoice_created eksikse) server-side /api/garanti/apply tetikler.

import kvMod from "../_kv.js";

function resolveKv() {
  const kv = kvMod?.default || kvMod || {};

  const kvGet = kv.kvGet;

  if (typeof kvGet !== "function") {
    throw new Error("KV_HELPER_MISSING:kvGet");
  }

  return { kvGet };
}

function tryJsonParse(x) {
  if (x == null) return null;
  if (typeof x === "object") return x;

  try {
    return JSON.parse(String(x));
  } catch (_) {
    return x;
  }
}

async function callApply(oid) {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : String(
          process.env.NEXT_PUBLIC_SITE_URL ||
            process.env.SITE_URL ||
            process.env.APP_URL ||
            "https://aivo.tr"
        ).replace(/\/$/, "");

    if (!base) return null;

    const url = `${base}/api/garanti/apply`;

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

function unwrapOrder(raw) {
  let order = tryJsonParse(raw);

  if (order && typeof order === "object" && "value" in order) {
    order = order.value;
  }
  if (order && typeof order === "object" && "result" in order) {
    order = order.result;
  }

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

    const { kvGet } = resolveKv();

    const orderKey = `aivo:garanti:order:${oid}`;
    const orderRaw = await kvGet(orderKey);

    if (!orderRaw) {
      return res.status(404).json({ ok: false, error: "ORDER_NOT_FOUND", oid });
    }

    const o = unwrapOrder(orderRaw);

    if (!o || typeof o !== "object") {
      return res.status(404).json({ ok: false, error: "ORDER_NOT_FOUND", oid });
    }

    let applyResult = null;
    const shouldApply =
      o?.status === "paid" && (!o?.credit_applied || !o?.invoice_created);

    if (shouldApply) {
      applyResult = await callApply(oid);
    }

    return res.status(200).json({
      ok: true,
      oid,
      provider: o?.provider || "garanti",

      status: o?.status ?? null,
      total_amount: o?.total_amount ?? null,
      currency: o?.currency ?? "TRY",

      plan: o?.plan ?? null,
      credits: o?.credits ?? null,
      amount: o?.amount ?? null,
      email: o?.email ?? null,
      user_id: o?.user_id ?? null,

      credit_applied: !!(applyResult?.credit_applied ?? o?.credit_applied),
      invoice_created: !!(applyResult?.invoice_created ?? o?.invoice_created),

      credits_balance:
        applyResult?.credits_balance ??
        applyResult?.credits ??
        o?.credits_balance ??
        o?.credit_balance_after ??
        null,

    invoice_id: applyResult?.invoice_id ?? o?.invoice_id ?? null,
return_path:
  typeof o?.return_path === "string" && o.return_path.startsWith("/")
    ? o.return_path
    : "/studio.v2.html",

created_at: o?.created_at ?? null,
      updated_at: o?.updated_at ?? null,
      paid_at: o?.paid_at ?? null,

      notify_hash_valid: o?.notify_hash_valid ?? null,
      notify_proc_return_code: o?.notify_proc_return_code ?? null,
      notify_authcode: o?.notify_authcode ?? null,
      notify_errmsg: o?.notify_errmsg ?? null,
      mdstatus:
        o?.notify_payload?.mdstatus ??
        o?.notify_payload?.mdStatus ??
        o?.notify_payload?.MdStatus ??
        null,

      apply_result: applyResult || null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "VERIFY_FAILED",
      message: e?.message || "UNKNOWN",
    });
  }
}
