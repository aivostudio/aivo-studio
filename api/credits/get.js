// /api/credits/get.js
import kvMod from "../_kv.js";

/** auth'u tek yerden al: /api/me */
async function getMe(req) {
  const r = await fetch("https://aivo.tr/api/me", {
    headers: { cookie: req.headers.cookie || "" },
  });
  if (!r.ok) return null;
  const data = await r.json();
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

    // ✅ TEK OTORİTE: api/_kv.js (webhook ile aynı KV)
    const kv = kvMod?.default || kvMod || {};
    const kvGet = kv.kvGet;

    if (typeof kvGet !== "function") {
      return res.status(500).json({ ok: false, error: "KV_HELPER_MISSING" });
    }

    const raw = await kvGet(creditsKey);
    const credits = Number(raw) || 0;

    return res.status(200).json({ ok: true, credits, email, key: creditsKey });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(e?.message || e),
    });
  }
}
