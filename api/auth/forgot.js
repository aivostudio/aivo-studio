// api/auth/forgot.js
const crypto = require("crypto");
const { kv } = require("@vercel/kv");

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function getBaseUrl(req) {
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host) return "";
  return `${proto}://${host}`;
}

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, reason: "method" });
  }

  let body = {};
  try {
    body = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
  } catch (_) {}

  const email = String(body.email || "").trim().toLowerCase();

  // Enumeration riskini azaltmak için
  if (!email || !email.includes("@")) {
    return json(res, 200, { ok: true });
  }

  // Token üret
  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const now = Date.now();
  const ttlSeconds = 30 * 60; // 30 dk
  const expiresAt = now + ttlSeconds * 1000;

  // Redis key
  const key = `aivo:reset:${tokenHash}`;

  // Redis'e yaz
  await kv.set(
    key,
    {
      email,
      expiresAt,
      used: false,
      createdAt: now,
    },
    { ex: ttlSeconds }
  );

  const base = getBaseUrl(req);
  const resetUrl = `${base}/reset.html?token=${encodeURIComponent(token)}`;

  try {
    const { default: sendMail } = await import("../../lib/mail/mailer.js");

    await sendMail({
      to: email,
      subject: "AIVO Şifre Sıfırlama",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
          <h2>AIVO Şifre Sıfırlama</h2>
          <p>Şifreni sıfırlamak için aşağıdaki butona tıkla:</p>
          <p>
            <a href="${resetUrl}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:8px;">
              Şifremi Sıfırla
            </a>
          </p>
          <p>Buton çalışmazsa bu linki tarayıcıya yapıştır:</p>
          <p>${resetUrl}</p>
          <p>Bu link 30 dakika geçerlidir.</p>
        </div>
      `,
      replyTo: "info@aivo.tr",
    });

    return json(res, 200, { ok: true });
  } catch (err) {
    console.error("FORGOT_MAIL_SEND_FAIL:", err);
    return json(res, 500, { ok: false, reason: "mail_send_failed" });
  }
};
