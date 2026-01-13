import { requireAuth } from "../_lib/auth.js";

let kv = null;
async function getKV() {
  if (kv) return kv;
  try {
    const mod = await import("@vercel/kv");
    kv = mod.kv;
    return kv;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const s = requireAuth(req, res);
  if (!s) return;

  const { cost, reason } = req.body || {};
  const need = Math.max(0, parseInt(cost, 10) || 0);

  const store = await getKV();
  if (!store) return res.status(500).json({ ok: false, error: "kv_missing" });

  const key = `credits:${s.sub}`;

  // atomic değil ama MVP için yeterli (sonra LUA/tx ile güçlendiririz)
  const have = Number(await store.get(key)) || 0;

  if (need <= 0) return res.json({ ok: true, credits: have });

  if (have < need) {
    return res.status(402).json({ ok: false, error: "insufficient_credits", credits: have });
  }

  const next = have - need;
  await store.set(key, next);

  return res.json({ ok: true, credits: next, reason: reason || "unknown" });
}
