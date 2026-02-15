// api/_lib/auth.js
import { kv } from "@vercel/kv";

function parseCookies(req) {
  const header = req?.headers?.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const i = part.indexOf("=");
    if (i === -1) return;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) return;
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  });
  return out;
}

export async function requireAuth(req, res) {
  try {
    const cookies = parseCookies(req);

    const sid = cookies["aivo_sess"];
    if (!sid) {
      res.status(401).json({ ok:false, error:"no_session" });
      return null;
    }

    const sess = await kv.get(`sess:${sid}`);
    if (!sess || typeof sess !== "object" || !sess.email) {
      res.status(401).json({ ok:false, error:"invalid_session" });
      return null;
    }

    return {
      session: "kv",
      email: sess.email,
      user_id: sess.user_id || sess.id || sess.email,
      role: sess.role || "user",
      verified: typeof sess.verified === "boolean" ? sess.verified : true,
    };

  } catch (e) {
    console.error("auth error:", e);
    res.status(401).json({ ok:false, error:"invalid_session" });
    return null;
  }
}
