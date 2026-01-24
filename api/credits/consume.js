// ===============================
// /api/credits/consume.js
// TEK OTORİTE: requireAuth -> s.sub -> KV credits:{sub}
// (email key varsa sync + migrate)
// ===============================
import { requireAuth } from "../_lib/auth.js";

let kv2 = null;
async function getKV2() {
  if (kv2) return kv2;
  try {
    const mod = await import("@vercel/kv");
    kv2 = mod.kv;
    return kv2;
  } catch {
    return null;
  }
}

function normEmail2(v) {
  const s = String(v || "").trim().toLowerCase();
  return s.includes("@") ? s : "";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false });

    const s = requireAuth(req, res);
    if (!s) return;

    const { cost, reason } = req.body || {};
    const need = Math.max(0, parseInt(cost, 10) || 0);

    const store = await getKV2();
    if (!store) return res.status(500).json({ ok: false, error: "kv_missing" });

    const sub = String(s.sub || "").trim();
    if (!sub) return res.status(401).json({ ok: false, error: "unauthorized" });

    const email = normEmail2(s.email || s.user?.email);

    const keySub = `credits:${sub}`;
    const keyEmail = email ? `credits:${email}` : "";

    // sub key yoksa email key’den migrate
    let haveRaw = await store.get(keySub);
    if ((haveRaw == null || haveRaw === "") && keyEmail) {
      const old = await store.get(keyEmail);
      if (old != null && old !== "") {
        haveRaw = old;
        await store.set(keySub, old);
      }
    }

    const have = Number(haveRaw) || 0;

    if (need <= 0) return res.json({ ok: true, credits: have });

    if (have < need) {
      return res.status(402).json({ ok: false, error: "insufficient_credits", credits: have });
    }

    const next = have - need;

    await store.set(keySub, next);
    if (keyEmail) await store.set(keyEmail, next); // sync (geriye dönük uyum)

    return res.json({ ok: true, credits: next, reason: reason || "unknown" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e?.message || e) });
  }
}
