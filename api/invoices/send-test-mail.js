// api/invoices/send-test-mail.js
// Güvenli test endpoint'i:
// - Ödeme akışına dokunmaz
// - Krediye dokunmaz
// - Invoice kaydını değiştirmez
// - Sadece mevcut invoice id + email ile test fatura maili gönderir

import { createRequire } from "module";
import kvMod from "../_kv.js";

const require = createRequire(import.meta.url);

function json(res, code, data) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function safeStr(v) {
  return String(v || "").trim();
}

function normEmail(v) {
  const s = safeStr(v).toLowerCase();
  return s.includes("@") ? s : "";
}

function safeJsonParse(v, fallback = null) {
  try {
    if (v == null) return fallback;
    if (typeof v === "object") return v;
    return JSON.parse(String(v));
  } catch {
    return fallback;
  }
}

function resolveKv() {
  const kv = kvMod?.default || kvMod || {};
  const getRedis = kv.getRedis;

  if (typeof getRedis !== "function") {
    throw new Error("KV_HELPER_MISSING:getRedis");
  }

  return { getRedis };
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

async function readInvoicesByEmail(email) {
  const { getRedis } = resolveKv();
  const redis = getRedis();
  const key = `invoices:${email}`;
  const type = await redis.type(key);

  if (type === "list") {
    const rows = await redis.lrange(key, 0, -1);
    return Array.isArray(rows)
      ? rows
          .map((row) => safeJsonParse(row, null))
          .filter((x) => x && typeof x === "object")
      : [];
  }

  if (type === "string") {
    const raw = await redis.get(key);
    const arr = safeJsonParse(raw, []);
    return Array.isArray(arr)
      ? arr.filter((x) => x && typeof x === "object")
      : [];
  }

  if (type === "none") {
    return [];
  }

  throw new Error(`Unexpected Redis type for ${key}: ${type}`);
}

function buildInvoiceMailHtml(invoice, invoiceUrl) {
  const invoiceId = escapeHtml(invoice?.id || "-");
  const amount = formatTRY(invoice?.amountTRY || invoice?.amount_total || invoice?.amount || 0);
  const credits = escapeHtml(invoice?.credits || "-");
  const plan = escapeHtml(invoice?.plan || "AIVO Kredi Paketi");
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
        AIVO satın alma işleminize ait fatura kaydı oluşturuldu. Faturanızı aşağıdaki bağlantıdan görüntüleyebilirsiniz.
      </p>

      <div style="border:1px solid rgba(120,120,255,.14);background:rgba(10,12,18,.55);border-radius:14px;padding:16px;margin:18px 0;">
        <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">Fatura No</div>
        <div style="font-size:16px;font-weight:800;color:#ffffff;margin-bottom:14px;">${invoiceId}</div>

        <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">Paket</div>
        <div style="font-size:16px;font-weight:800;color:#ffffff;margin-bottom:14px;">${plan}</div>

        <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">Kredi</div>
        <div style="font-size:16px;font-weight:800;color:#ffffff;margin-bottom:14px;">${credits}</div>

        <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">Tutar</div>
        <div style="font-size:20px;font-weight:900;color:#ffffff;">${amount}</div>
      </div>

      <a href="${safeUrl}" style="display:inline-block;background:#ffffff;color:#111827;text-decoration:none;font-weight:800;border-radius:999px;padding:12px 18px;">
        Faturayı Görüntüle
      </a>

      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
        Bu test endpoint'i yalnızca mail gönderimini doğrulamak için kullanılmıştır. Ödeme, kredi veya fatura kaydını değiştirmez.
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendInvoiceMail({ email, invoice, invoiceUrl }) {
  const mailerMod = require("../../lib/mailer.js");
  const getMailer = mailerMod?.getMailer;

  if (typeof getMailer !== "function") {
    throw new Error("MAILER_MISSING:getMailer");
  }

  const transporter = getMailer();

  return await transporter.sendMail({
    from:
      process.env.SMTP_FROM ||
      process.env.MAIL_FROM ||
      "AIVO <no-reply@mail.aivo.tr>",
    to: email,
    subject: `AIVO Faturanız - ${invoice.id}`,
    text:
      `AIVO satın alma işleminize ait fatura kaydı oluşturuldu.\n\n` +
      `Fatura No: ${invoice.id}\n` +
      `Paket: ${invoice.plan || "AIVO Kredi Paketi"}\n` +
      `Kredi: ${invoice.credits || "-"}\n` +
      `Tutar: ${formatTRY(invoice.amountTRY || invoice.amount_total || invoice.amount || 0)}\n\n` +
      `Faturanızı görüntülemek için:\n${invoiceUrl}\n`,
    html: buildInvoiceMailHtml(invoice, invoiceUrl),
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const source = req.method === "GET" ? req.query || {} : req.body || {};
    const email = normEmail(source.email);
    const id = safeStr(source.id);

    if (!email) {
      return json(res, 400, { ok: false, error: "EMAIL_REQUIRED" });
    }

    if (!id) {
      return json(res, 400, { ok: false, error: "ID_REQUIRED" });
    }

    const invoices = await readInvoicesByEmail(email);
    const invoice = invoices.find((x) => safeStr(x?.id) === id);

    if (!invoice) {
      return json(res, 404, {
        ok: false,
        error: "INVOICE_NOT_FOUND",
        email,
        id,
      });
    }

    const invoiceUrl = `${getBaseUrl()}/api/invoices/pdf?email=${encodeURIComponent(
      email
    )}&id=${encodeURIComponent(id)}`;

    const result = await sendInvoiceMail({
      email,
      invoice,
      invoiceUrl,
    });

    return json(res, 200, {
      ok: true,
      email,
      id,
      invoice_url: invoiceUrl,
      mail_sent: true,
      message_id: result?.messageId || null,
      response: result?.response || null,
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "SEND_TEST_INVOICE_MAIL_FAILED",
      detail: String(e?.message || e),
    });
  }
}
