import crypto from "crypto";

const COOKIE_NAME = "aivo_session";

function base64url(input) {
  return Buffer.from(input).toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function sign(payload, secret) {
  const data = JSON.stringify(payload);
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64");
  return base64url(data) + "." + base64url(sig);
}

function verify(token, secret) {
  try {
    const [p1, p2] = token.split(".");
    if (!p1 || !p2) return null;
    const data = Buffer.from(p1.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const sig = Buffer.from(p2.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const expected = crypto.createHmac("sha256", secret).update(data).digest("base64");
    if (sig !== expected) return null;
    const payload = JSON.parse(data);
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildCookie(value, { maxAgeSec = 60 * 60 * 24 * 7, clear = false } = {}) {
  // PROD: .aivo.tr ile hem aivo.tr hem www.aivo.tr çalışır
  const isProd = process.env.VERCEL_ENV === "production";

  const parts = [];
  parts.push(`${COOKIE_NAME}=${clear ? "" : value}`);
  parts.push("Path=/");
  parts.push("HttpOnly");
  parts.push("Secure");
  parts.push("SameSite=Lax");

  if (isProd) parts.push("Domain=.aivo.tr");

  if (clear) {
    parts.push("Max-Age=0");
  } else {
    parts.push(`Max-Age=${maxAgeSec}`);
  }

  return parts.join("; ");
}

export function setSessionCookie(res, sessionPayload) {
  const secret = process.env.AIVO_AUTH_SECRET;
  if (!secret) throw new Error("AIVO_AUTH_SECRET missing");

  const token = sign(sessionPayload, secret);
  res.setHeader("Set-Cookie", buildCookie(token));
}

export function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", buildCookie("", { clear: true }));
}

export function getSession(req) {
  const secret = process.env.AIVO_AUTH_SECRET;
  if (!secret) return null;

  const cookie = req.headers.cookie || "";
  const m = cookie.match(/(?:^|;\s*)aivo_session=([^;]+)/);
  if (!m) return null;

  const token = m[1];
  return verify(token, secret);
}

export function requireAuth(req, res) {
  const s = getSession(req);
  if (!s) {
    res.status(401).json({ ok: false, error: "unauthorized" });
    return null;
  }
  return s;
}

export function loadUsersFromEnv() {
  const raw = process.env.AIVO_USERS_JSON || "[]";
  try { return JSON.parse(raw); } catch { return []; }
}
