// /api/paytr/verify.js
async function kvGet(key) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;

  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });

  if (!r.ok) return null;
  return r.json().catch(() => null);
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const oid = String(req.query?.oid || "");
  if (!oid) {
    return res.status(400).json({ ok: false, error: "OID_REQUIRED" });
  }

  const data = await kvGet(`aivo:order:${oid}`);
  const order = data?.result || data || null;

  if (!order) {
    return res.status(404).json({ ok: false, error: "ORDER_NOT_FOUND" });
  }

  return res.status(200).json({
    ok: true,
    status: order.status || "pending",
    plan: order.plan || null,
    credits: order.credits || 0,
    amountTRY: order.amountTRY || null,
    total_amount: order.total_amount || null,
  });
}
