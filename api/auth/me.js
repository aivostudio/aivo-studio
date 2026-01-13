import { getSession } from "../_lib/auth.js";

export default async function handler(req, res) {
  const s = getSession(req);
  if (!s) return res.status(200).json({ ok: true, loggedIn: false });

  res.json({
    ok: true,
    loggedIn: true,
    user: { id: s.sub, email: s.email }
  });
}
