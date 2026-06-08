// api/garanti/apply.js
// GARANTI apply (idempotent + lock)
// TEK SOURCE OF TRUTH: api/_kv.js üzerinden aynı Upstash/Vercel KV client'ı kullanır.

import nodemailer from "nodemailer";
import kvMod from "../_kv.js";

function json(res, code, data) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function safeJsonParse(x) {
  try {
    return JSON.parse(x);
  } catch {
    return null;
  }
}

function normEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function resolveKv() {
  const kv = kvMod?.default || kvMod || {};

  const getRedis = kv.getRedis;
  const kvGet = kv.kvGet;
  const kvDel = kv.kvDel;
  const kvIncr = kv.kvIncr;
  const kvGetJson = kv.kvGetJson;
  const kvSetJson = kv.kvSetJson;

  if (typeof getRedis !== "function") {
    throw new Error("KV_HELPER_MISSING:getRedis");
  }
  if (typeof kvGet !== "function") {
    throw new Error("KV_HELPER_MISSING:kvGet");
  }
  if (typeof kvDel !== "function") {
    throw new Error("KV_HELPER_MISSING:kvDel");
  }
  if (typeof kvIncr !== "function") {
    throw new Error("KV_HELPER_MISSING:kvIncr");
  }
  if (typeof kvGetJson !== "function") {
    throw new Error("KV_HELPER_MISSING:kvGetJson");
  }
  if (typeof kvSetJson !== "function") {
    throw new Error("KV_HELPER_MISSING:kvSetJson");
  }

  return {
    getRedis,
    kvGet,
    kvDel,
    kvIncr,
    kvGetJson,
    kvSetJson,
  };
}

async function kvType(redis, key) {
  try {
    const t = await redis.type(key);
    return typeof t === "string" ? t : null;
  } catch {
    return null;
  }
}

async function safeDelIfWrongType(redis, kvDel, key, allowedTypes) {
  try {
    const type = await kvType(redis, key);
    if (type && type !== "none" && !allowedTypes.includes(type)) {
      await kvDel(key);
    }
  } catch (_) {}
}

async function setNxWithExpire(redis, key, value, ttlSec) {
  try {
    const result = await redis.set(key, value, { nx: true, ex: ttlSec });
    return result === "OK" || result === true;
  } catch {
    return false;
  }
}

async function lpushJson(redis, key, obj) {
  return await redis.lpush(key, JSON.stringify(obj));
}

function getBaseUrl() {
  return String(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.SITE_URL ||
      process.env.APP_URL ||
      "https://aivo.tr"
  ).replace(/\/$/, "");
}

function escapeHtml(v) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatTRY(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return "₺0,00";

  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
  }).format(n);
}

function buildInvoiceMailHtml({ invoice, invoiceUrl }) {
  const invoiceId = escapeHtml(invoice?.id || "-");
  const plan = escapeHtml(invoice?.plan || "AIVO Kredi Paketi");
  const credits = escapeHtml(invoice?.credits || "-");
  const amount = formatTRY(invoice?.amountTRY || invoice?.amount_total || invoice?.amount || 0);
  const safeUrl = escapeHtml(invoiceUrl);

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AIVO Faturanız</title>
</head>
<body style="margin:0;background:#f4f7fb;color:#0f172a;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    AIVO satın alma işleminize ait faturanız hazır.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:34px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="width:100%;max-width:680px;background:#ffffff;border:1px solid #e5eaf3;border-radius:24px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,.08);">
          <tr>
            <td style="padding:28px 30px 20px;background:linear-gradient(135deg,#ffffff 0%,#f8fbff 62%,#eef5ff 100%);border-bottom:1px solid #e8eef7;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://aivo.tr/aivo-logo.png" width="112" alt="AIVO" style="display:block;max-width:112px;height:auto;" />
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <div style="display:inline-block;padding:8px 12px;border-radius:999px;background:#eef2ff;color:#4338ca;font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;">
                      Fatura
                    </div>
                  </td>
                </tr>
              </table>

              <h1 style="margin:26px 0 8px;font-size:30px;line-height:1.15;font-weight:900;color:#0f172a;letter-spacing:-.03em;">
                Faturanız hazır
              </h1>

              <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">
                AIVO satın alma işleminiz başarıyla tamamlandı. Faturanızı aşağıdaki bağlantıdan güvenli şekilde görüntüleyebilirsiniz.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 30px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e7edf6;border-radius:18px;background:#fbfdff;">
                <tr>
                  <td style="padding:18px 20px;border-bottom:1px solid #e7edf6;">
                    <div style="font-size:12px;color:#64748b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">Fatura No</div>
                    <div style="font-size:16px;line-height:1.45;color:#0f172a;font-weight:800;word-break:break-word;">${invoiceId}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td width="33.33%" style="padding:18px 20px;border-right:1px solid #e7edf6;vertical-align:top;">
                          <div style="font-size:12px;color:#64748b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Paket</div>
                          <div style="font-size:15px;line-height:1.45;color:#0f172a;font-weight:800;">${plan}</div>
                        </td>
                        <td width="33.33%" style="padding:18px 20px;border-right:1px solid #e7edf6;vertical-align:top;">
                          <div style="font-size:12px;color:#64748b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Kredi</div>
                          <div style="font-size:15px;line-height:1.45;color:#0f172a;font-weight:800;">${credits}</div>
                        </td>
                        <td width="33.33%" style="padding:18px 20px;vertical-align:top;">
                          <div style="font-size:12px;color:#64748b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Tutar</div>
                          <div style="font-size:18px;line-height:1.35;color:#0f172a;font-weight:900;">${amount}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <div style="height:24px;"></div>

              <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#6d5dfc 0%,#25c6f6 100%);color:#ffffff;text-decoration:none;font-weight:900;border-radius:999px;padding:14px 22px;font-size:14px;box-shadow:0 12px 26px rgba(79,70,229,.22);">
                Faturayı Görüntüle
              </a>

              <div style="height:22px;"></div>

              <div style="border-radius:16px;background:#f8fafc;border:1px solid #e7edf6;padding:14px 16px;color:#64748b;font-size:13px;line-height:1.65;">
                Bu e-posta otomatik gönderilmiştir. Bağlantı çalışmazsa AIVO hesabınızdan <strong style="color:#334155;">Faturalarım</strong> bölümüne girebilirsiniz.
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 30px 26px;color:#94a3b8;font-size:12px;line-height:1.6;">
              © ${new Date().getFullYear()} AIVO • Dijital ürün ve hizmet faturası
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendInvoiceEmailSafe({ email, invoice, invoiceUrl }) {
  try {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host) return { sent: false, error: "SMTP_HOST_MISSING" };
    if (!user) return { sent: false, error: "SMTP_USER_MISSING" };
    if (!pass) return { sent: false, error: "SMTP_PASS_MISSING" };

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const result = await transporter.sendMail({
      from: `AIVO <${user}>`,
      to: email,
      subject: `AIVO Faturanız - ${invoice.id}`,
      text:
        `AIVO satın alma işleminiz başarıyla tamamlandı.\n\n` +
        `Fatura No: ${invoice.id}\n` +
        `Paket: ${invoice.plan || "AIVO Kredi Paketi"}\n` +
        `Kredi: ${invoice.credits || "-"}\n` +
        `Tutar: ${formatTRY(invoice.amountTRY || invoice.amount_total || invoice.amount || 0)}\n\n` +
        `Faturanızı görüntülemek için:\n${invoiceUrl}\n`,
      html: buildInvoiceMailHtml({ invoice, invoiceUrl }),
    });

    return {
      sent: true,
      messageId: result?.messageId || null,
      response: result?.response || null,
    };
  } catch (e) {
    return {
      sent: false,
      error: String(e?.message || e),
    };
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const { getRedis, kvGet, kvDel, kvIncr, kvSetJson } = resolveKv();
    const redis = getRedis();

    const oid =
      (req.method === "GET" ? req.query?.oid : req.body?.oid) ||
      (req.method === "GET" ? req.query?.order_id : req.body?.order_id);

    if (!oid) {
      return json(res, 400, { ok: false, error: "MISSING_OID" });
    }

    const orderKey = `aivo:garanti:order:${oid}`;
    const initKey = `aivo:garanti:order_init:${oid}`;
    const lockKey = `aivo:lock:garanti:apply:${oid}`;
    const processedKey = `processed:garanti:${oid}`;

    const orderRaw = await kvGet(orderKey);
    const order = typeof orderRaw === "string" ? safeJsonParse(orderRaw) : orderRaw;

    if (!order) {
      return json(res, 404, { ok: false, error: "ORDER_NOT_FOUND", oid });
    }

    if (order.status !== "paid") {
      return json(res, 409, {
        ok: false,
        error: "ORDER_NOT_PAID",
        oid,
        status: order.status,
      });
    }

    const initRaw = await kvGet(initKey);
    const init = typeof initRaw === "string" ? safeJsonParse(initRaw) : initRaw;

    const email = normEmail(init?.email || order.email || init?.user_email || null);
    if (!email) {
      return json(res, 409, {
        ok: false,
        error: "EMAIL_BINDING_MISSING",
        message: "garanti init tarafında aivo:garanti:order_init:<oid> içine email yazılmalı.",
        oid,
      });
    }

    const creditsKey = `credits:${email}`;
    const invoicesKey = `invoices:${email}`;

    await safeDelIfWrongType(redis, kvDel, processedKey, ["string"]);
    await safeDelIfWrongType(redis, kvDel, creditsKey, ["string"]);
    await safeDelIfWrongType(redis, kvDel, invoicesKey, ["list"]);

    const firstTime = await setNxWithExpire(redis, processedKey, "1", 60 * 60 * 24 * 30);

    if (!firstTime) {
      const cur = Number(await kvGet(creditsKey)) || 0;
      const existingInvoiceId = `garanti_${oid}`;

      return json(res, 200, {
        ok: true,
        oid,
        email,
        added: 0,
        credits: cur,
        credits_balance: cur,
        invoiceId: existingInvoiceId,
        invoice_id: existingInvoiceId,
        credit_applied: true,
        invoice_created: true,
        already_processed: true,
      });
    }

    const lockVal = `garanti_apply_${Date.now()}`;
    const lockOk = await setNxWithExpire(redis, lockKey, lockVal, 30);

    if (!lockOk) {
      return json(res, 429, { ok: false, error: "APPLY_IN_PROGRESS", oid });
    }

    try {
      const freshRaw = await kvGet(orderKey);
      const fresh = typeof freshRaw === "string" ? safeJsonParse(freshRaw) : freshRaw;

      if (!fresh) {
        return json(res, 404, { ok: false, error: "ORDER_NOT_FOUND_AFTER_LOCK", oid });
      }

      if (fresh.status !== "paid") {
        return json(res, 409, {
          ok: false,
          error: "ORDER_NOT_PAID",
          oid,
          status: fresh.status,
        });
      }

      const creditsToAdd = Number(fresh.credits || init?.credits || 0);
      if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
        return json(res, 409, {
          ok: false,
          error: "INVALID_CREDITS",
          oid,
          credits: fresh.credits,
        });
      }

      const newTotal = await kvIncr(creditsKey, creditsToAdd);

        const invoiceId = `garanti_${oid}`;
      const invoiceUrl = `${getBaseUrl()}/api/invoices/view?email=${encodeURIComponent(
        email
      )}&id=${encodeURIComponent(invoiceId)}`;
      
      const invoice = {
        id: invoiceId,
        provider: "garanti",
        type: "purchase",
        oid,
        email,
        plan: fresh.plan || init?.plan || null,
        credits: creditsToAdd,
        amountTRY: fresh.amount || init?.amount || null,
        amount_total: fresh.amount || init?.amount || null,
        currency: "TRY",
        created_at: new Date().toISOString(),
        status: "paid",
        invoice_url: invoiceUrl,
      };

      await lpushJson(redis, invoicesKey, invoice);

      fresh.credit_applied = true;
      fresh.invoice_created = true;
      fresh.invoice_id = invoiceId;
      fresh.invoice_url = invoiceUrl;
      fresh.invoice_mail_sent = false;
      fresh.invoice_mail_error = null;
      fresh.applied_at = new Date().toISOString();

      await kvSetJson(orderKey, fresh);

      const invoiceMailResult = await sendInvoiceEmailSafe({
        email,
        invoice,
        invoiceUrl,
      });

      fresh.invoice_mail_sent = !!invoiceMailResult?.sent;
      fresh.invoice_mail_error = invoiceMailResult?.sent
        ? null
        : invoiceMailResult?.error || null;
      fresh.invoice_mail_message_id = invoiceMailResult?.messageId || null;

      await kvSetJson(orderKey, fresh);

        return json(res, 200, {
        ok: true,
        oid,
        email,
        added: creditsToAdd,
        credits: Number(newTotal) || 0,
        credits_balance: Number(newTotal) || 0,
        invoiceId,
        invoice_id: invoiceId,
        invoice_url: invoiceUrl,
        invoice_mail_sent: !!invoiceMailResult?.sent,
        invoice_mail_error: invoiceMailResult?.sent
          ? null
          : invoiceMailResult?.error || null,
        credit_applied: true,
        invoice_created: true,
        already_processed: false,
      });
    } catch (e) {
      return json(res, 500, {
        ok: false,
        error: "APPLY_FAILED",
        oid,
        detail: String(e?.message || e),
      });
    } finally {
      await kvDel(lockKey);
    }
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "KV_INIT_FAILED",
      detail: String(e?.message || e),
    });
  }
}
