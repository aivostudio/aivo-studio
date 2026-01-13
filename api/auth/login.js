import { loadUsersFromEnv, setSessionCookie } from "../_lib/auth.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false });

  const { email, password } = req.body || {};
  const users = loadUsersFromEnv();

  const u = users.find(x =>
    String(x.email || "").toLowerCase() === String(email || "").toLowerCase()
    && String(x.password || "") === String(password || "")
  );

  if (!u) return res.status(401).json({ ok: false, error: "invalid_credentials" });

  // 7 gün
  setSessionCookie(res, {
    sub: u.id || u.email,      // userId
    email: u.email,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7
  });

  return res.json({ ok: true, user: { id: u.id || u.email, email: u.email } });
}
