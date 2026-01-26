// /api/credits/consume.js
import { kv as vercelKV } from "@vercel/kv";

/**
 * Tek otorite auth:
 * /api/auth/me ile birebir aynı cookie + KV session okuma mantığı
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
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  // 🔐 AUTH — TEK OTORİTE
  const session = await getSession(req);
  if (!session) {
    return res
      .status(401)
      .json({ ok: false, error: "unauthorized_no_cookie" });
  }

  const { cost, reason } = req.body || {};
  const need = Math.max(0, parseInt(cost, 10) || 0);

  const userId = session.sub;
  const key = `credits:${userId}`;

  const have = Number(await vercelKV.get(key)) || 0;

  if (need <= 0) {
    return res.json({ ok: true, credits: have });
  }

  if (have < need) {
    return res.status(402).json({
      ok: false,
      error: "insufficient_credits",
      credits: have,
    });
  }

  const next = have - need;
  await vercelKV.set(key, next);

  return res.json({
    ok: true,
    credits: next,
    reason: reason || "unknown",
  });
}
