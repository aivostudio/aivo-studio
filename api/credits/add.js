// /api/credits/add.js
import { kv as vercelKV } from "@vercel/kv";

/**
 * Tek otorite session (consume ile birebir)
 */
async function getSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/aivo_sess=([^;]+)/);
  if (!match) return null;

  const sid = match[1];
  if (!sid) return null;

  try {
    const session = await vercelKV.get(`sess:${sid}`);
    if (!session || !session.sub) return null;
    return session;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    // 🔐 AUTH
    const session = await getSession(req);
    if (!session) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const { amount, order_id } = req.body || {};
    const inc = Number(amount || 0);
    const oid = String(order_id || "").trim();

    if (!oid) {
      return res.status(400).json({ ok: false, error: "order_id_required" });
    }
    if (!Number.isFinite(inc) || inc <= 0) {
      return res.status(400).json({ ok: false, error: "amount_invalid" });
    }

    const userId = session.sub;
    const creditKey = `credits:${userId}`;

    // idempotency
    const orderKey = `orders:applied:${oid}`;
    const ORDER_TTL_SECONDS = 90 * 24 * 60 * 60;

    const firstTime = await vercelKV.set(orderKey, "1", {
      nx: true,
      ex: ORDER_TTL_SECONDS,
    });

    if (!firstTime) {
      const current = Number(await vercelKV.get(creditKey)) || 0;
      return res.json({
        ok: true,
        already_applied: true,
        credits: current,
      });
    }

    const newCredits = await vercelKV.incrby(creditKey, inc);

    return res.json({
      ok: true,
      already_applied: false,
      credits: Number(newCredits) || 0,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
