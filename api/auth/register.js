// api/auth/register/route.js
export const runtime = "nodejs";

import crypto from "crypto";
import nodemailer from "nodemailer";

const env = (k, d = "") => String(process.env[k] ?? d).trim();
const normalizeEmail = (v) => String(v ?? "").trim().toLowerCase();

async function readJson(request) {
  try {
    const text = await request.text();
    if (!text) return {};
    return JSON.parse(text);
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

export async function POST(request) {
  try {
    const body = await readJson(request);
    if (body === null) {
      return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
    }

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const name = String(body.name || "").trim();

    if (!email || !email.includes("@") || !email.includes(".")) {
      return Response.json({ ok: false, error: "email_invalid" }, { status: 400 });
    }
    if (password.length < 6) {
      return Response.json({ ok: false, error: "password_too_short" }, { status: 400 });
    }

    // token
    const token = crypto.randomBytes(32).toString("hex");
    const appBase = env("APP_BASE_URL", "https://aivo.tr");
    const verifyUrl = `${appBase}/api/auth/verify?token=${encodeURIComponent(token)}`;

    // KV (opsiyonel) — top-level await YOK, import içeride
    let kvSaved = false;
    try {
      const mod = await import("@vercel/kv");
      const kv = mod?.kv;
      if (kv) {
        await kv.set(`verify:${token}`, { email, name }, { ex: 60 * 15 }); // 15 dk
        kvSaved = true;
      }
    } catch {
      kvSaved = false;
    }

    // MAIL (opsiyonel) — asla 500 üretmesin
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
            <div style="font-family:system-ui;line-height:1.5">
              <h2>AIVO • Email Doğrulama</h2>
              <p><b>${email}</b> hesabını doğrulamak için link:</p>
              <p><a href="${verifyUrl}">${verifyUrl}</a></p>
            </div>
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

    // ✅ En kritik: endpoint her koşulda 201 dönebilsin (mail/kv patlasa bile)
    return Response.json(
      {
        ok: true,
        email,
        kvSaved,
        verificationSent,
        adminNotified,
        // debug için şimdilik açık; prod’da kaldırırsın
        verifyUrl,
      },
      { status: 201 }
    );
  } catch (err) {
    return Response.json(
      { ok: false, error: "register_failed", message: err?.message || "fatal" },
      { status: 500 }
    );
  }
}
