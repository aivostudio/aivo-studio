// /api/credits/get.js
// TEK OTORİTE: Upstash/Vercel KV helper (api/_kv.js) kullanır.
// NOT: /api/me çağrısı cookie ile çalışır.

import kvMod from "../_kv.js";

/** auth'u tek yerden al: /api/me */
async function getMe(req) {
  const r = await fetch("https://aivo.tr/api/me", {
    headers: { cookie: req.headers.cookie || "" },
  });
  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  if (!data?.ok || !data?.email) return null;
  return data; // { ok:true, email, ... }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const me = await getMe(req);
    if (!me) return res.status(401).json({ ok: false, error: "unauthorized" });

    const email = String(me.email).trim().toLowerCase();
    const creditsKey = `credits:${email}`;

    // ✅ Upstash helper bağla
    const kv = kvMod?.default || kvMod || {};
    const kvGet = kv.kvGet;

    if (typeof kvGet !== "function") {
      return res.status(500).json({
        ok: false,
        error: "KV_HELPER_MISSING",
        detail: "kvGet not found in api/_kv.js",
      });
    }

    const raw = await kvGet(creditsKey).catch(() => null);
    const credits = Number(raw) || 0;

    return res.status(200).json({ ok: true, credits, email });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(e?.message || e),
    });
  }
}
