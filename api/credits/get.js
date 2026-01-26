// /api/credits/get.js
import { kv as vercelKV } from "@vercel/kv";

/**
 * Tek otorite: /api/me
 * userKey = email (sub yok)
 */
async function getEmailFromMe(req) {
  const r = await fetch("https://aivo.tr/api/me", {
    headers: { cookie: req.headers.cookie || "" },
  });

  if (!r.ok) return null;

  const data = await r.json();
  if (!data?.ok || !data?.email) return null;

  return String(data.email).trim().toLowerCase();
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false });
    }

    // 🔐 AUTH
    const email = await getEmailFromMe(req);
    if (!email) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    // ✅ TEK KEY: credits:<email>
    const creditsKey = `credits:${email}`;
    const credits = Number(await vercelKV.get(creditsKey)) || 0;

    return res.json({
      ok: true,
      credits,
      email,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(e?.message || e),
    });
  }
}
