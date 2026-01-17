// /api/auth/register.js
import crypto from "crypto";
import kvMod from "../_kv.js";

const kv = kvMod.default || kvMod;
const kvGetJson = kv.kvGetJson || kv.getJson || kv.get || kv.kvGet;
const kvSetJson = kv.kvSetJson || kv.setJson || kv.set || kv.kvSet;

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

async function hashPasswordIfPossible(password) {
  try {
    const bcrypt = await import("bcryptjs").catch(() => null);
    const b = bcrypt?.default || bcrypt;
    if (b?.hash) return await b.hash(password, 10);
  } catch {}
  return ""; // bcrypt yoksa boş dön -> verify.js plain password varsa onu taşır
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

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

    // ✅ BAN kontrolü (silinen mail kayıt başlatamasın)
    const banned = kvGetJson ? await kvGetJson(`ban:${email}`).catch(() => null) : null;
    if (banned) {
      return res.status(403).json({ ok: false, error: "user_banned" });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const appBase = env("APP_BASE_URL", "https://aivo.tr");
    const verifyUrl = `${appBase}/api/auth/verify?token=${token}`;

    const now = Date.now();

    // ✅ passwordHash üret (bcrypt varsa)
    const passwordHash = await hashPasswordIfPossible(password);

    // ✅ verify payload: email + (hash veya plain) + name
    // (verify.js bunu user kaydına taşıyacak)
    await kvSetJson(
      `verify:${token}`,
      {
        email,
        name,
        createdAt: now,
        passwordHash: passwordHash || undefined,
        password: passwordHash ? undefined : password, // bcrypt yoksa plain fallback
      },
      { ex: 60 * 60 } // 1h
    );

    // ✅ user:<email> kaydı (varsa dokunma; yoksa oluştur)
    const existing = kvGetJson ? await kvGetJson(`user:${email}`).catch(() => null) : null;
    if (!existing) {
      await kvSetJson(`user:${email}`, {
        email,
        name,
        role: "user",
        disabled: false,
        verified: false, // verify.js true yapacak
        createdAt: now,
        updatedAt: now,
        passwordHash: passwordHash || undefined,
        password: passwordHash ? undefined : password,
      });
    }

    // ✅ users:list index (admin panel)
    const LIST_KEY = "users:list";
    const list = (kvGetJson ? await kvGetJson(LIST_KEY).catch(() => null) : null) || [];
    const arr = Array.isArray(list) ? list : [];
    const has = arr.some((u) => String(u?.email || "").trim().toLowerCase() === email);

    if (!has) {
      arr.unshift({
        email,
        role: "user",
        disabled: false,
        createdAt: now,
        updatedAt: now,
      });
      await kvSetJson(LIST_KEY, arr);
    }

    // mail
    const mailResult = await sendVerifyMailResend({ to: email, verifyUrl });
    if (!mailResult.sent) console.error("[REGISTER_RESEND_FAIL]", mailResult);

    return res.status(201).json({
      ok: true,
      email,
      mailSent: !!mailResult.sent,
      // debug istersen:
      // verifyUrl,
    });
  } catch (e) {
    console.error("[REGISTER_FATAL]", e);
    return res.status(200).json({ ok: false, error: "register_failed" });
  }
}
