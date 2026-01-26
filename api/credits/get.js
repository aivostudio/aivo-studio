// /api/credits/get.js
import { kv as vercelKV } from "@vercel/kv";

/**
 * Tek otorite session (consume / add ile birebir)
 */
async function getSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/aivo_sess=([^;]+)/);
  if (!match) return null;

  const sid = match[1];
  if (!sid) return null;

  try {
    const session = await vercelKV.get(`sess:${sid}`);
    if (!session || !session.sub) return null;
    return session;
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

    const userId = session.sub;
    const creditsKey = `credits:${userId}`;

    const credits = Number(await vercelKV.get(creditsKey)) || 0;

    return res.json({
      ok: true,
      credits,
      // email UI/debug için opsiyonel
      email: session.email || null,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(e?.message || e),
    });
  }
}
