// /api/credits/get.js
import { kv as vercelKV } from "@vercel/kv";

/**
 * Tek otorite session
 * Kaynak: /api/me → aivo_sess (KV)
 * Kimlik: email
 */
async function getSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/aivo_sess=([^;]+)/);
  if (!match) return null;

  const sid = match[1];
  if (!sid) return null;

  try {
    const session = await vercelKV.get(`sess:${sid}`);
    if (!session || !session.email) return null;
    return session; // { email, role, verified, ... }
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false });
    }

    // 🔐 AUTH
    const session = await getSession(req);
    if (!session) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const email = String(session.email).toLowerCase();
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
