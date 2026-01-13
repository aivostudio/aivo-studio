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
  const s = requireAuth(req, res);
  if (!s) return;

  const store = await getKV();
  if (!store) return res.status(500).json({ ok: false, error: "kv_missing" });

  const key = `credits:${s.sub}`;
  const credits = Number(await store.get(key)) || 0;

  res.json({ ok: true, credits });
}
