import { clearSessionCookie } from "../_lib/auth.js";

export default async function handler(req, res) {
  clearSessionCookie(res);
  res.json({ ok: true });
}
