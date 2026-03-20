// api/auth/forgot.js
import crypto from "crypto";
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvSetJson = kv.kvSetJson;

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}

function getBaseUrl(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (!host) return "";
  return `${proto}://${host}`;
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

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method !== "POST") {
      return json(res, 405, { ok: false, reason: "method" });
    }

    if (typeof kvSetJson !== "function") {
      return json(res, 503, { ok: false, reason: "kv_not_available" });
    }

    const body = await readJson(req);
    if (!body) {
      return json(res, 400, { ok: false, reason: "invalid_json" });
    }

    const email = normalizeEmail(body.email);

    if (!email || !email.includes("@")) {
      return json(res, 200, { ok: true });
    }

    const token = crypto.randomBytes(24).toString("hex");
    const now = Date.now();
    const ttlSeconds = 30 * 60;
    const expiresAt = now + ttlSeconds * 1000;

    const key = `reset:${token}`;

    await kvSetJson(
      key,
      {
        email,
        expiresAt,
        createdAt: now,
      },
      { ex: ttlSeconds }
    );

    const base = getBaseUrl(req);
    const resetUrl = `${base}/reset.html?token=${encodeURIComponent(token)}`;

    try {
      const { getMailer } = await import("../../lib/mailer.js");
      const mailer = getMailer();

      await mailer.sendMail({
        to: email,
        from: process.env.SMTP_FROM || "AIVO <info@aivo.tr>",
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
  } catch (e) {
    return json(res, 500, { ok: false, reason: "server_error", message: String(e?.message || e) });
  }
}
