// /api/credits/get.js
const crypto = require("crypto");

const COOKIE_NAME = "aivo_session";
const JWT_SECRET = process.env.JWT_SECRET;

function b64urlToJson(str) {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
}

function signHS256(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function readCookie(req, name) {
  const raw = req.headers.cookie || "";
  const parts = raw.split(";").map(s => s.trim());
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i > -1) {
      const k = p.slice(0, i);
      const v = p.slice(i + 1);
      if (k === name) return v;
    }
  }
  return "";
}

function verifyJWT(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = signHS256(data, secret);
  if (expected !== s) return null;

  const payload = b64urlToJson(p);
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;
  return payload;
}

module.exports = async (req, res) => {
  try {
    if (!JWT_SECRET) {
      return res.status(500).json({ ok: false, error: "jwt_secret_missing" });
    }

    // Önce cookie
    const token = readCookie(req, COOKIE_NAME);
    const payload = verifyJWT(token, JWT_SECRET);

    // Cookie yoksa (eski sistemlerden) query email ile fallback (istersen bunu sonra kapatırız)
    const emailFromQuery = String((req.query && req.query.email) || "").trim().toLowerCase();
    const email = (payload && payload.email) || emailFromQuery;

    if (!email) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    // Şimdilik sabit: 0 kredi (sonra DB/store bağlarız)
    return res.status(200).json({ ok: true, email, credits: 0 });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e && e.message ? e.message : e) });
  }
};
