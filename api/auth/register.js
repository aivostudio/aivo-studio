// api/auth/register.js
import crypto from "crypto";
import nodemailer from "nodemailer";

// KV helper (Upstash/Vercel Redis REST)
import kvMod from "../_kv.js";
const { kvSetJson } = kvMod;

const env = (k, d = "") => String(process.env[k] || d).trim();
const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

async function readJson(req) {
  try {
    if (req.body && typeof req.body === "object") return req.body;
    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (!chunks.length) return {};
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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false });
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

    const token = crypto.randomBytes(32).toString("hex");
    const appBase = env("APP_BASE_URL", "https://aivo.tr");
    const verifyUrl = `${appBase}/api/auth/verify?token=${token}`;

    // ✅ KV — Seçenek A için zorunlu (token -> payload)
    // Fail-safe: KV patlasa bile register 201 dönebilir (ama verify çalışmaz)
    try {
      await kvSetJson(
        `verify:${token}`,
        {
          email,
          name,
          // Şimdilik password saklamıyoruz (güvenlik). İleride hash ile saklarız.
          createdAt: Date.now(),
        },
        { ex: 60 * 60 } // 1 saat
      );
    } catch (e) {
      console.error("[REGISTER_KV_SET_FAIL]", e?.message || e);
    }

    // MAIL — opsiyonel, patlasa bile 500 YOK
    const transport = getTransportSafe();
    if (transport) {
      try {
        await transport.sendMail({
          from: env("MAIL_FROM", "AIVO <noreply@aivo.tr>"),
          to: email,
          subject: "AIVO • Email Doğrulama",
          html: `<a href="${verifyUrl}">Doğrula</a>`,
        });
      } catch (e) {
        console.error("[REGISTER_MAIL_FAIL]", e?.message || e);
      }
    }

    return res.status(201).json({
      ok: true,
      email,
      verifyUrl, // test için
    });
  } catch (e) {
    console.error("[REGISTER_FATAL]", e);
    return res.status(500).json({ ok: false });
  }
}
