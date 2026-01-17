// api/auth/register.js
import crypto from "crypto";
import bcrypt from "bcryptjs";

// KV helper
import kvMod from "../_kv.js";
const { kvSetJson, kvGetJson } = kvMod;

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
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, error: "method_not_allowed" }));
    }

    const body = await readJson(req);
    if (!body) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, error: "invalid_json" }));
    }

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const name = String(body.name || "").trim();

    if (!email || !email.includes("@")) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, error: "email_invalid" }));
    }
    if (password.length < 6) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, error: "password_too_short" }));
    }

    // ✅ BAN kontrolü (hard delete sonrası)
    const banned = await kvGetJson(`ban:${email}`).catch(() => null);
    if (banned) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, error: "user_banned" }));
    }

    // ✅ verify token + payload (1 saat)
    const token = crypto.randomBytes(32).toString("hex");
    const appBase = env("APP_BASE_URL", "https://aivo.tr");
    const verifyUrl = `${appBase}/api/auth/verify?token=${token}`;

    // ✅ password hash
    const passwordHash = await bcrypt.hash(password, 10);

    // KV: verify payload -> verify endpoint bunu user kaydına taşıyacak
    await kvSetJson(
      `verify:${token}`,
      { email, name, passwordHash, createdAt: Date.now() },
      { ex: 60 * 60 } // 1h
    );

    // ✅ users:list index (admin panel)
    const now = Date.now();
    const LIST_KEY = "users:list";
    const list = (await kvGetJson(LIST_KEY).catch(() => null)) || [];
    const has = Array.isArray(list) && list.some((u) => String(u.email || "").trim().toLowerCase() === email);

    if (!has) {
      list.unshift({ email, role: "user", disabled: false, createdAt: now, updatedAt: now });
      await kvSetJson(LIST_KEY, list);
    }

    // Mail
    const mailResult = await sendVerifyMailResend({ to: email, verifyUrl });

    res.statusCode = 201;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({
      ok: true,
      email,
      verifyUrl,          // prod’da kaldırırsın
      mailSent: !!mailResult.sent,
    }));
  } catch (e) {
    console.error("[REGISTER_FATAL]", e);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: false, error: "server_error" }));
  }
}
