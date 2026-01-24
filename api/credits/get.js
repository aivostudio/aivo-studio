// ===============================
// /api/credits/get.js
// TEK OTORİTE: requireAuth -> s.sub -> KV credits:{sub}
// ===============================
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

function normEmail(v) {
  const s = String(v || "").trim().toLowerCase();
  return s.includes("@") ? s : "";
}

export default async function handler(req, res) {
  try {
    const s = requireAuth(req, res);
    if (!s) return;

    const store = await getKV();
    if (!store) return res.status(500).json({ ok: false, error: "kv_missing" });

    const sub = String(s.sub || "").trim();
    if (!sub) return res.status(401).json({ ok: false, error: "unauthorized" });

    const email = normEmail(s.email || s.user?.email);

    const keySub = `credits:${sub}`;
    const keyEmail = email ? `credits:${email}` : "";

    // 1) Önce sub key
    let have = await store.get(keySub);
    // 2) Yoksa eski email key’den migrate
    if ((have == null || have === "") && keyEmail) {
      const old = await store.get(keyEmail);
      if (old != null && old !== "") {
        have = old;
        await store.set(keySub, old); // migrate
      }
    }

    const credits = Number(have) || 0;
    return res.json({ ok: true, sub, email: email || null, credits });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "server_error", detail: String(e?.message || e) });
  }
}
