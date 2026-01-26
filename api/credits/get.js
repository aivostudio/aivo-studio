// /api/credits/get.js
import { kv as vercelKV } from "@vercel/kv";

async function getSession(req) {
  const cookie = req.headers.cookie || "";
  const m = cookie.match(/aivo_sess=([^;]+)/);
  if (!m) return null;

  const sid = m[1];
  if (!sid) return null;

  try {
    const sess = await vercelKV.get(`sess:${sid}`);
    if (!sess || typeof sess !== "object") return null;

    // ✅ sub zorunlu değil; email zorunlu
    if (!sess.email) return null;

    return sess;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const session = await getSession(req);
    if (!session) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const email = String(session.email || "").trim().toLowerCase();
    if (!email.includes("@")) {
      return res.status(401).json({ ok: false, error: "bad_session" });
    }

    // ✅ TEK OTORİTE: email
    const creditsKey = `credits:${email}`;
    const credits = Number(await vercelKV.get(creditsKey)) || 0;

    return res.status(200).json({
      ok: true,
      credits,
      email,
      key: creditsKey, // debug için
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(e?.message || e),
    });
  }
}
