// api/auth/register.js
// REGISTER — v1 (Verify Mail + Admin Notify) — ESM + Safe Body Parse
import crypto from "crypto";
import nodemailer from "nodemailer";

// (opsiyonel) Vercel KV varsa kullan
let kv = null;
try {
  // pnpm/yarn ile: @vercel/kv
  const mod = await import("@vercel/kv");
  kv = mod.kv;
} catch (_) {
  kv = null;
}

function env(name, fallback = "") {
  return (process.env[name] || fallback).trim();
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function validatePassword(pw) {
  const s = String(pw || "");
  if (s.length < 6) return "password_too_short";
  return null;
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return JSON.parse(raw); } catch { return null; }
}

function makeTransport() {
  const host = env("SMTP_HOST");
  const port = Number(env("SMTP_PORT", "587"));
  const user = env("SMTP_USER");
  const pass = env("SMTP_PASS");

  if (!host || !port || !user || !pass) {
    throw new Error("SMTP env missing (SMTP_HOST/PORT/USER/PASS)");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function buildVerifyEmailHtml({ appBase, email, verifyUrl }) {
  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto; line-height:1.5">
    <h2>AIVO • Email Doğrulama</h2>
    <p>Merhaba,</p>
    <p><b>${email}</b> ile AIVO hesabını doğrulamak için aşağıdaki butona tıkla:</p>
    <p>
      <a href="${verifyUrl}" style="display:inline-block;padding:12px 16px;border-radius:10px;background:#6d4cff;color:#fff;text-decoration:none">
        Emailimi Doğrula
      </a>
    </p>
    <p style="color:#666">Buton çalışmazsa bu linki aç:</p>
    <p style="word-break:break-all;color:#333">${verifyUrl}</p>
    <hr/>
    <p style="color:#888;font-size:12px">AIVO • ${appBase}</p>
  </div>`;
}

function buildAdminEmailHtml({ email, name }) {
  const now = new Date().toISOString();
  return `
  <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto; line-height:1.5">
    <h2>Yeni Kayıt ✅</h2>
    <p><b>Email:</b> ${email}</p>
    <p><b>Ad Soyad:</b> ${name || "—"}</p>
    <p><b>Zaman:</b> ${now}</p>
  </div>`;
}

export default async function register(req, res) {
  console.log("[register] hit", req.method);

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const body = await readJson(req);
  if (body === null) {
    return res.status(400).json({ ok: false, error: "invalid_json" });
  }

  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const name = String(body.name || "").trim();

  if (!email) return res.status(400).json({ ok: false, error: "email_required" });
  if (!email.includes("@") || !email.includes(".")) {
    return res.status(400).json({ ok: false, error: "email_invalid" });
  }

  const pwErr = validatePassword(password);
  if (pwErr) return res.status(400).json({ ok: false, error: pwErr });

  // ✅ Verify token (random)
  const token = crypto.randomBytes(32).toString("hex");
  const appBase = env("APP_BASE_URL", "https://aivo.tr");
  const verifyUrl = `${appBase}/api/auth/verify?token=${encodeURIComponent(token)}`;

  // ✅ KV’ye yaz (15 dk)
  let kvSaved = false;
  if (kv) {
    try {
      const key = `verify:${token}`;
      await kv.set(key, { email, name }, { ex: 60 * 15 }); // 15 dakika
      kvSaved = true;
    } catch (e) {
      console.warn("[register] kv set failed:", e?.message || e);
      kvSaved = false;
    }
  }

  // ✅ Mail gönder
  let verificationSent = false;
  let adminNotified = false;

  try {
    const transport = makeTransport();
    const from = env("MAIL_FROM", "AIVO <noreply@aivo.tr>");

    // kullanıcıya verify maili
    await transport.sendMail({
      from,
      to: email,
      subject: "AIVO • Email Doğrulama",
      html: buildVerifyEmailHtml({ appBase, email, verifyUrl }),
    });
    verificationSent = true;

    // admin’e bildirim
    const adminTo = env("ADMIN_NOTIFY_EMAIL");
    if (adminTo) {
      await transport.sendMail({
        from,
        to: adminTo,
        subject: "AIVO • Yeni Kayıt",
        html: buildAdminEmailHtml({ email, name }),
      });
      adminNotified = true;
    }
  } catch (e) {
    console.error("[register] mail failed:", e?.message || e);
    // Mail başarısızsa kayıt response'u yine dönebilir; ama ok=false da diyebilirsin.
    // Ben şimdilik ok=true döndürüyorum; frontend tarafında message göstereceğiz.
  }

  return res.status(201).json({
    ok: true,
    email,
    verificationSent,
    adminNotified,
    kvSaved,
    // debug için; prod’da istersen kaldır
    verifyUrl,
  });
}
