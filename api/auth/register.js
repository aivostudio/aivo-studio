// api/auth/register.js
import crypto from "crypto";

// KV helper
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

// Resend (fail-safe)
async function sendVerifyMailResend({ to, verifyUrl }) {
  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) return { sent: false, reason: "missing_resend_api_key" };

  const from = env("MAIL_FROM", "AIVO <noreply@aivo.tr>");
  const subject = "AIVO • Email Doğrulama";

  const html = `
    <div style="font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial; line-height:1.5">
      <h2 style="margin:0 0 12px">Email Doğrulama</h2>
      <p style="margin:0 0 16px">Hesabını aktif etmek için aşağıdaki butona tıkla:</p>
      <p style="margin:0 0 16px">
        <a href="${verifyUrl}" style="display:inline-block;background:#6d42ff;color:#fff;text-decoration:none;padding:10px 14px;border-radius:10px">
          Emailimi Doğrula
        </a>
      </p>
      <p style="margin:0;color:#666;font-size:12px">Bu bağlantı 1 saat geçerlidir.</p>
    </div>
  `;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { sent: false, reason: "resend_failed", status: r.status, detail: t };
    }

    return { sent: true };
  } catch (e) {
    return { sent: false, reason: "resend_error", detail: e?.message || String(e) };
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok: false });

    const body = await readJson(req);
    if (!body) return res.status(400).json({ ok: false, error: "invalid_json" });

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

    // KV write (zorunlu)
    try {
      await kvSetJson(
        `verify:${token}`,
        { email, name, createdAt: Date.now() },
        { ex: 60 * 60 } // 1h
      );
    } catch (e) {
      console.error("[REGISTER_KV_SET_FAIL]", e?.message || e);
    }

    // RESEND mail (opsiyonel)
    const mailResult = await sendVerifyMailResend({ to: email, verifyUrl });
    if (!mailResult.sent) {
      console.error("[REGISTER_RESEND_FAIL]", mailResult);
    }

    return res.status(201).json({
      ok: true,
      email,
      // prod'da bunu kaldıracağız; şimdilik debug
      verifyUrl,
      mailSent: !!mailResult.sent,
    });
  } catch (e) {
    console.error("[REGISTER_FATAL]", e);
    return res.status(500).json({ ok: false });
  }
}
// ✅ users index + user kaydı (admin panel görebilsin)
// BUNU: verify KV yazdıktan HEMEN SONRA ekle

// üstte import: const { kvSetJson, kvGetJson } = kvMod; olmalı

const now = Date.now();

// 1) user:<email> yoksa oluştur
const existing = await kvGetJson(`user:${email}`);
if (!existing) {
  await kvSetJson(`user:${email}`, {
    email,
    name,
    role: "user",
    disabled: false,
    verified: false, // verify endpoint'inde true yapılır
    createdAt: now,
    updatedAt: now,
  });
}

// 2) users:list index'e ekle (admin/users/get bunu okuyorsa)
const LIST_KEY = "users:list";
const list = (await kvGetJson(LIST_KEY)) || [];
const has = Array.isArray(list) && list.some((u) => String(u.email || "").trim().toLowerCase() === email);

if (!has) {
  list.unshift({
    email,
    role: "user",
    disabled: false,
    createdAt: now,
    updatedAt: now,
  });
  await kvSetJson(LIST_KEY, list);
}

