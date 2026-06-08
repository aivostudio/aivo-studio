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
  const rawInvoiceId = String(id || "-");
  const displayInvoiceId = rawInvoiceId
    .replace(/^garanti_/i, "")
    .replace(/^GARANTI_/i, "AIVO-");
  const safeId = escapeHtml(displayInvoiceId);
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
                AIVO satın alma işleminize ait fatura bağlantısı aşağıdadır. Faturanızı güvenli şekilde görüntüleyebilirsiniz.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 30px 8px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e7edf6;border-radius:18px;background:#fbfdff;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:12px;color:#64748b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">Fatura No</div>
                    <div style="font-size:16px;line-height:1.45;color:#0f172a;font-weight:800;word-break:break-word;">${safeId}</div>
                  </td>
                </tr>
              </table>

              <div style="height:24px;"></div>

              <a href="${safeUrl}" style="display:inline-block;background:linear-gradient(135deg,#6d5dfc 0%,#25c6f6 100%);color:#ffffff;text-decoration:none;font-weight:900;border-radius:999px;padding:14px 22px;font-size:14px;box-shadow:0 12px 26px rgba(79,70,229,.22);">
                Faturayı Görüntüle
              </a>

              <div style="height:22px;"></div>

              <div style="border-radius:16px;background:#f8fafc;border:1px solid #e7edf6;padding:14px 16px;color:#64748b;font-size:13px;line-height:1.65;">
                Bu test mailidir. Ödeme, kredi veya fatura kaydı değiştirilmemiştir.
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
