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

function j(res, code, obj) {
  res.status(code).setHeader("content-type", "application/json").end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return j(res, 405, { ok: false });

    let s = null;
    try {
      s = requireAuth(req, res);
      if (!s) return;
    } catch (e) {
      return j(res, 500, { ok: false, error: "auth_crash", detail: String(e?.message || e) });
    }

    const { cost, reason } = req.body || {};
    const need = Math.max(0, parseInt(cost, 10) || 0);

    const store = await getKV();
    if (!store) return j(res, 500, { ok: false, error: "kv_missing" });

    const key = `credits:${s.sub}`;
    const have = Number(await store.get(key)) || 0;

    if (need <= 0) return j(res, 200, { ok: true, credits: have });

    if (have < need) {
      return j(res, 402, { ok: false, error: "insufficient_credits", credits: have });
    }

    const next = have - need;
    await store.set(key, next);

    return j(res, 200, { ok: true, credits: next, reason: reason || "unknown" });
  } catch (e) {
    return j(res, 500, { ok: false, error: "server_crash", detail: String(e?.message || e) });
  }
}
