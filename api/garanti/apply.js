// api/garanti/apply.js
// GARANTI apply (idempotent + lock)
// TEK SOURCE OF TRUTH: api/_kv.js üzerinden aynı Upstash/Vercel KV client'ı kullanır.

import { createRequire } from "module";
import kvMod from "../_kv.js";

const require = createRequire(import.meta.url);

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

function buildGarantiInvoiceHtml(invoice) {
  const invoiceId = escapeHtml(invoice?.id || "-");
  const email = escapeHtml(invoice?.email || "-");
  const plan = escapeHtml(invoice?.plan || "AIVO Kredi Paketi");
  const credits = escapeHtml(invoice?.credits || "-");
  const amount = formatTRY(invoice?.amountTRY || invoice?.amount_total || 0);
  const createdAt = escapeHtml(
    invoice?.created_at
      ? new Date(invoice.created_at).toLocaleString("tr-TR")
      : new Date().toLocaleString("tr-TR")
  );

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>AIVO Fatura - ${invoiceId}</title>
</head>
<body style="margin:0;background:#f3f4f6;color:#111827;font-family:Arial,sans-serif;">
  <div style="max-width:760px;margin:0 auto;background:#ffffff;padding:32px;border-radius:18px;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:24px;border-bottom:1px solid #e5e7eb;padding-bottom:20px;">
      <div>
        <div style="font-size:28px;font-weight:800;color:#111827;">AIVO</div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px;">Dijital ürün ve hizmet faturası</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.12em;">Fatura</div>
        <div style="font-size:16px;font-weight:700;margin-top:6px;">${invoiceId}</div>
      </div>
    </div>

    <h1 style="font-size:30px;margin:28px 0 8px;color:#111827;">Satın alma faturanız</h1>
    <p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0 0 24px;">
      AIVO kredi/paket satın alma işleminize ait fatura kaydı aşağıdadır.
    </p>

    <table style="width:100%;border-collapse:collapse;margin-top:18px;">
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Müşteri E-posta</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${email}</td>
      </tr>
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Paket</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${plan}</td>
      </tr>
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Kredi</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${credits}</td>
      </tr>
      <tr>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;color:#6b7280;">Tarih</td>
        <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700;">${createdAt}</td>
      </tr>
      <tr>
        <td style="padding:16px 12px;color:#111827;font-size:18px;font-weight:800;">Ödenen Tutar</td>
        <td style="padding:16px 12px;text-align:right;color:#111827;font-size:22px;font-weight:900;">${amount}</td>
      </tr>
    </table>

    <div style="margin-top:28px;padding:16px;border-radius:14px;background:#f9fafb;color:#6b7280;font-size:13px;line-height:1.6;">
      Bu belge AIVO tarafından dijital ortamda oluşturulmuştur. Ödeme durumu: Ödendi.
    </div>

    <div style="margin-top:28px;border-top:1px solid #e5e7eb;padding-top:16px;font-size:12px;color:#9ca3af;">
      © ${new Date().getFullYear()} AIVO
    </div>
  </div>
</body>
</html>`;
}

function buildGarantiInvoiceMailHtml(invoice, invoiceUrl) {
  const invoiceId = escapeHtml(invoice?.id || "-");
  const amount = formatTRY(invoice?.amountTRY || invoice?.amount_total || 0);
  const credits = escapeHtml(invoice?.credits || "-");
  const safeUrl = escapeHtml(invoiceUrl);

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>AIVO Faturanız</title>
</head>
<body style="margin:0;background:#070a14;color:#e7ecff;font-family:Arial,sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:28px 14px;">
    <div style="border:1px solid rgba(120,120,255,.18);background:rgba(12,14,22,.72);border-radius:18px;padding:22px;">
      <img src="https://aivo.tr/aivo-logo.png" width="110" alt="AIVO" style="display:block;max-width:110px;height:auto;margin-bottom:18px;" />
      <h1 style="margin:0 0 10px;font-size:24px;color:#ffffff;">Faturanız hazır ✅</h1>
      <p style="margin:0 0 18px;font-size:14px;line-height:1.65;color:#cbd5e1;">
        AIVO satın alma işleminiz başarıyla tamamlandı. Faturanızı aşağıdaki bağlantıdan görüntüleyebilirsiniz.
      </p>

      <div style="border:1px solid rgba(120,120,255,.14);background:rgba(10,12,18,.55);border-radius:14px;padding:16px;margin:18px 0;">
        <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">Fatura No</div>
        <div style="font-size:16px;font-weight:800;color:#ffffff;margin-bottom:14px;">${invoiceId}</div>

        <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">Kredi</div>
        <div style="font-size:16px;font-weight:800;color:#ffffff;margin-bottom:14px;">${credits}</div>

        <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">Tutar</div>
        <div style="font-size:20px;font-weight:900;color:#ffffff;">${amount}</div>
      </div>

      <a href="${safeUrl}" style="display:inline-block;background:#ffffff;color:#111827;text-decoration:none;font-weight:800;border-radius:999px;padding:12px 18px;">
        Faturayı Görüntüle
      </a>

      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
        Bu e-posta otomatik gönderilmiştir. Bağlantı çalışmazsa AIVO hesabınızdan Faturalarım bölümüne girebilirsiniz.
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendGarantiInvoiceEmail({ email, invoice, invoiceUrl }) {
  try {
    const mailerMod = require("../../lib/mailer.js");
    const getMailer = mailerMod?.getMailer;

    if (typeof getMailer !== "function") {
      return { sent: false, skipped: "MAILER_MISSING" };
    }

    const transporter = getMailer();

    await transporter.sendMail({
      from:
        process.env.SMTP_FROM ||
        process.env.MAIL_FROM ||
        "AIVO <no-reply@mail.aivo.tr>",
      to: email,
      subject: `AIVO Faturanız - ${invoice.id}`,
      text:
        `AIVO satın alma işleminiz başarıyla tamamlandı.\n\n` +
        `Fatura No: ${invoice.id}\n` +
        `Kredi: ${invoice.credits}\n` +
        `Tutar: ${formatTRY(invoice.amountTRY || invoice.amount_total || 0)}\n\n` +
        `Faturanızı görüntülemek için:\n${invoiceUrl}\n`,
      html: buildGarantiInvoiceMailHtml(invoice, invoiceUrl),
    });

    return { sent: true };
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
      const invoiceUrl = `${getBaseUrl()}/api/invoices/pdf?email=${encodeURIComponent(
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

      invoice.aivo_html = buildGarantiInvoiceHtml(invoice);

      await lpushJson(redis, invoicesKey, invoice);

      fresh.credit_applied = true;
      fresh.invoice_created = true;
      fresh.invoice_id = invoiceId;
      fresh.invoice_url = invoiceUrl;
      fresh.invoice_mail_sent = false;
      fresh.invoice_mail_error = null;
      fresh.applied_at = new Date().toISOString();

      await kvSetJson(orderKey, fresh);

      const invoiceMailResult = await sendGarantiInvoiceEmail({
        email,
        invoice,
        invoiceUrl,
      });

      fresh.invoice_mail_sent = !!invoiceMailResult?.sent;
      fresh.invoice_mail_error = invoiceMailResult?.sent
        ? null
        : invoiceMailResult?.error || invoiceMailResult?.skipped || null;

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
          : invoiceMailResult?.error || invoiceMailResult?.skipped || null,
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
