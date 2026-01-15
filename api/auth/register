export const runtime = "nodejs";
// api/auth/register.js
import crypto from "crypto";
import nodemailer from "nodemailer";

// KV (opsiyonel)
let kv = null;
try {
  const mod = await import("@vercel/kv");
  kv = mod.kv;
} catch (_) {}

const env = (k, d = "") => (process.env[k] || d).trim();
const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

function getTransportSafe() {
  const host = env("SMTP_HOST");
  const port = Number(env("SMTP_PORT", "587"));
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");
  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export default async function register(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = await readJson(req);
    if (!body) {
      return res.status(400).json({ ok: false, error: "invalid_json" });
    }

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const name = String(body.name || "").trim();

    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "email_invalid" });
    }
    if (password.length < 6) {
      return res.status(400).json({ ok: false, error: "password_too_short" });
    }

    // verify token
    const token = crypto.randomBytes(32).toString("hex");
    const appBase = env("APP_BASE_URL", "https://aivo.tr");
    const verifyUrl = `${appBase}/api/auth/verify?token=${token}`;

    // KV write (opsiyonel)
    let kvSaved = false;
    if (kv) {
      try {
        await kv.set(`verify:${token}`, { email, name }, { ex: 60 * 15 });
        kvSaved = true;
      } catch {}
    }

    // MAIL (opsiyonel, asla 500 üretmez)
    let verificationSent = false;
    let adminNotified = false;

    const transport = getTransportSafe();
    if (transport) {
      const from = env("MAIL_FROM", "AIVO <noreply@aivo.tr>");

      try {
        await transport.sendMail({
          from,
          to: email,
          subject: "AIVO • Email Doğrulama",
          html: `
            <p>Email doğrulamak için tıkla:</p>
            <a href="${verifyUrl}">${verifyUrl}</a>
          `,
        });
        verificationSent = true;
      } catch {}

      const adminTo = env("ADMIN_NOTIFY_EMAIL");
      if (adminTo) {
        try {
          await transport.sendMail({
            from,
            to: adminTo,
            subject: "AIVO • Yeni Kayıt",
            html: `<p>${email} (${name || "-"})</p>`,
          });
          adminNotified = true;
        } catch {}
      }
    }

    return res.status(201).json({
      ok: true,
      email,
      verificationSent,
      adminNotified,
      kvSaved,
      verifyUrl, // prod’da sonra kaldırırsın
    });

  } catch (err) {
    console.error("[REGISTER_FATAL]", err);
    return res.status(500).json({
      ok: false,
      error: "register_failed",
      message: err?.message || "fatal",
    });
  }
}
