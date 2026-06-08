// api/invoices/send-test-mail.js
// Güvenli test endpoint'i:
// - Ödeme akışına dokunmaz
// - Krediye dokunmaz
// - Invoice kaydını değiştirmez
// - Sadece SMTP ile test fatura maili gönderir

import nodemailer from "nodemailer";

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

function buildMailHtml({ id, invoiceUrl }) {
  const safeId = escapeHtml(id);
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
        AIVO satın alma işleminize ait fatura bağlantısı aşağıdadır.
      </p>

      <div style="border:1px solid rgba(120,120,255,.14);background:rgba(10,12,18,.55);border-radius:14px;padding:16px;margin:18px 0;">
        <div style="font-size:13px;color:#94a3b8;margin-bottom:8px;">Fatura No</div>
        <div style="font-size:16px;font-weight:800;color:#ffffff;">${safeId}</div>
      </div>

      <a href="${safeUrl}" style="display:inline-block;background:#ffffff;color:#111827;text-decoration:none;font-weight:800;border-radius:999px;padding:12px 18px;">
        Faturayı Görüntüle
      </a>

      <p style="margin:18px 0 0;font-size:12px;line-height:1.6;color:#94a3b8;">
        Bu test mailidir. Ödeme, kredi veya fatura kaydı değiştirilmemiştir.
      </p>
    </div>
  </div>
</body>
</html>`;
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true";
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host) throw new Error("SMTP_HOST_MISSING");
  if (!user) throw new Error("SMTP_USER_MISSING");
  if (!pass) throw new Error("SMTP_PASS_MISSING");

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
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

     const invoiceUrl = `${getBaseUrl()}/api/invoices/view?email=${encodeURIComponent(
      email
    )}&id=${encodeURIComponent(id)}`;

    const transporter = getTransporter();

      const fromAddress = process.env.SMTP_USER;

    if (!fromAddress) {
      return json(res, 500, {
        ok: false,
        error: "SMTP_USER_MISSING",
      });
    }

    const result = await transporter.sendMail({
      from: `AIVO <${fromAddress}>`,
      to: email,
      subject: `AIVO Faturanız - ${id}`,
      text:
        `AIVO fatura bağlantınız hazır.\n\n` +
        `Fatura No: ${id}\n\n` +
        `Faturanızı görüntülemek için:\n${invoiceUrl}\n\n` +
        `Bu test mailidir. Ödeme, kredi veya fatura kaydı değiştirilmemiştir.\n`,
      html: buildMailHtml({ id, invoiceUrl }),
    });

    return json(res, 200, {
      ok: true,
      mail_sent: true,
      email,
      id,
      invoice_url: invoiceUrl,
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
