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
    if (req.method !== "GET") return j(res, 405, { ok: false });

    // auth (consume ile aynı)
    let s = null;
    try {
      s = requireAuth(req, res);
      if (!s) return; // requireAuth zaten response basıyor
    } catch (e) {
      return j(res, 500, { ok: false, error: "auth_crash", detail: String(e?.message || e) });
    }

    const store = await getKV();
    if (!store) return j(res, 500, { ok: false, error: "kv_missing" });

    const key = `credits:${s.sub}`;
    const credits = Number(await store.get(key)) || 0;

    return j(res, 200, { ok: true, sub: s.sub, credits });
  } catch (e) {
    return j(res, 500, { ok: false, error: "server_crash", detail: String(e?.message || e) });
  }
}
