// api/auth/register.js
import crypto from "crypto";
import bcrypt from "bcryptjs";

// KV helper (CJS/ESM uyumlu al)
import kvMod from "../_kv.js";
const kv = kvMod?.default || kvMod || {};
const kvSetJson = kv.kvSetJson;
const kvGetJson = kv.kvGetJson;

const env = (k, d = "") => String(process.env[k] || d).trim();
const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

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
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    // KV fonksiyonları yoksa -> fail-fast
    if (typeof kvSetJson !== "function" || typeof kvGetJson !== "function") {
      return sendJson(res, 503, {
        ok: false,
        error: "kv_not_available",
        hint: "kv helpers missing (kvSetJson/kvGetJson undefined). Check api/_kv.js export style.",
      });
    }

    const body = await readJson(req);
    if (!body) return sendJson(res, 400, { ok: false, error: "invalid_json" });

    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const name = String(body.name || "").trim();

    if (!email || !email.includes("@")) {
      return sendJson(res, 400, { ok: false, error: "email_invalid" });
    }
    if (password.length < 6) {
      return sendJson(res, 400, { ok: false, error: "password_too_short" });
    }
    if (!name) {
      return sendJson(res, 400, { ok: false, error: "name_required" });
    }

    // ✅ BAN kontrolü (hard delete sonrası)
    let banned = null;
    try {
      banned = await kvGetJson(`ban:${email}`);
    } catch (e) {
      return sendJson(res, 503, {
        ok: false,
        error: "kv_not_available",
        hint: e?.message || String(e),
      });
    }
    if (banned) {
      return sendJson(res, 403, { ok: false, error: "user_banned" });
    }

    // ✅ verify token + payload (1 saat)
    const token = crypto.randomBytes(32).toString("hex");
    const appBase = env("APP_BASE_URL", "https://aivo.tr");
    const verifyUrl = `${appBase}/api/auth/verify?token=${token}`;

    // ✅ password hash
    const passwordHash = await bcrypt.hash(password, 10);

    // ✅ KV write MUST SUCCEED (yoksa 201 dönme)
    try {
      await kvSetJson(
        `verify:${token}`,
        { email, name, passwordHash, createdAt: Date.now() },
        { ex: 60 * 60 } // 1h
      );
    } catch (e) {
      console.error("[REGISTER_KV_SET_FAIL]", e?.message || e);
      return sendJson(res, 503, {
        ok: false,
        error: "kv_not_available",
        hint: e?.message || String(e),
      });
    }

    // ✅ users:list index (admin panel)
    try {
      const now = Date.now();
      const LIST_KEY = "users:list";
      const list = (await kvGetJson(LIST_KEY)) || [];
      const has =
        Array.isArray(list) &&
        list.some((u) => String(u.email || "").trim().toLowerCase() === email);

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
    } catch (e) {
      console.error("[REGISTER_USERS_LIST_FAIL]", e?.message || e);
      // users:list patlarsa da akışı boz: çünkü KV zaten güvenilir değil
      return sendJson(res, 503, {
        ok: false,
        error: "kv_not_available",
        hint: e?.message || String(e),
      });
    }

    // Mail (opsiyonel: mail gitmese bile kayıt başarılı olabilir)
    const mailResult = await sendVerifyMailResend({ to: email, verifyUrl });
    if (!mailResult.sent) console.error("[REGISTER_RESEND_FAIL]", mailResult);

    return sendJson(res, 201, {
      ok: true,
      email,
      verifyUrl, // prod'da kaldır
      mailSent: !!mailResult.sent,
    });
  } catch (e) {
    console.error("[REGISTER_FATAL]", e);
    return sendJson(res, 500, { ok: false, error: "server_error" });
  }
}
