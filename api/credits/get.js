// /api/credits/get.js
import { kv as vercelKV } from "@vercel/kv";

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

    const credits = Number(await vercelKV.get(creditsKey)) || 0;

    return res.status(200).json({ ok: true, credits, email });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(e?.message || e),
    });
  }
}
