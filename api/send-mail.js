const { Resend } = require("resend");

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ ok: false, message: "RESEND_API_KEY missing" });
    }

    const body = req.body || {};

    // Contact form alanları
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const message = (body.message || "").trim();
    const source = (body.source || "contact-form").trim();

    if (!email || !message) {
      return res.status(400).json({
        ok: false,
        message: "Missing required fields: email, message",
      });
    }

    // ---- Source label (human readable) ----
    const sourceLabelMap = {
      "kurumsal/iletisim": "AIVO • İletişim Merkezi",
      "contact-form": "AIVO • İletişim Merkezi",
      "studio": "AIVO • Studio",
      "pricing": "AIVO • Fiyatlandırma",
    };
    const sourceLabel = sourceLabelMap[source] || source;

    // ---- Brand bits ----
    const BRAND_NAME = "AIVO";
    const BRAND_EMAIL = "info@aivo.tr";
    const BRAND_FROM = `${BRAND_NAME} <${BRAND_EMAIL}>`;
    const LOGO_URL = "https://aivo.tr/aivo-logo.png"; // gerekirse www ekleyebilirsin
    const SITE_URL = "https://aivo.tr";
    const SUPPORT_EMAIL = "info@aivo.tr";

    const resend = new Resend(process.env.RESEND_API_KEY);

    // ---- Helpers ----
    const esc = (s) =>
      String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

    const baseEmailHtml = ({ title, preheader, innerHtml, footerNote }) => {
      // Preheader (Gmail inbox preview)
      const pre = esc(preheader || "");

      return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${esc(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#070A14;color:#E7ECFF;font-family:ui-sans-serif,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${pre}</div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070A14;padding:24px 0;">
      <tr>
        <td align="center" style="padding:0 14px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:600px;background:rgba(12,14,22,.55);border:1px solid rgba(120,120,255,.18);border-radius:18px;overflow:hidden;box-shadow:0 18px 70px rgba(0,0,0,.45);">
            
            <!-- Header -->
            <tr>
              <td style="padding:18px 18px 14px;background:linear-gradient(135deg, rgba(120,120,255,.28), rgba(90,160,255,.16));border-bottom:1px solid rgba(120,120,255,.16);">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td align="left" style="vertical-align:middle;">
                      <a href="${SITE_URL}" style="text-decoration:none;display:inline-block;">
                        <img src="${LOGO_URL}" width="110" alt="${BRAND_NAME}" style="display:block;border:0;outline:none;text-decoration:none;height:auto;border-radius:10px;" />
                      </a>
                    </td>
                    <td align="right" style="vertical-align:middle;color:rgba(231,236,255,.85);font-size:12px;letter-spacing:.08em;font-weight:700;">
                      ${esc(BRAND_NAME)}
                    </td>
                  </tr>
                </table>

                <div style="margin-top:12px;font-size:18px;font-weight:800;line-height:1.25;color:#F3F5FF;">
                  ${esc(title)}
                </div>
                <div style="margin-top:6px;font-size:13px;line-height:1.5;color:rgba(231,236,255,.75);">
                  ${esc(preheader || "")}
                </div>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:18px;">
                ${innerHtml}
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:14px 18px 18px;border-top:1px solid rgba(120,120,255,.12);color:rgba(231,236,255,.62);font-size:12px;line-height:1.55;">
                <div style="margin-bottom:10px;">
                  ${footerNote ? esc(footerNote) : `${BRAND_NAME} • ${esc(SUPPORT_EMAIL)}`}
                </div>
                <div>
                  <a href="${SITE_URL}" style="color:rgba(170,190,255,.95);text-decoration:none;">${SITE_URL}</a>
                  <span style="opacity:.5;"> • </span>
                  <span style="opacity:.75;">© ${new Date().getFullYear()} ${BRAND_NAME}</span>
                </div>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
    };

    const kvRow = (k, v) => `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(120,120,255,.10);color:rgba(231,236,255,.72);font-size:12px;width:160px;">
          ${esc(k)}
        </td>
        <td style="padding:10px 12px;border-bottom:1px solid rgba(120,120,255,.10);color:#F0F2FF;font-size:13px;">
          ${esc(v)}
        </td>
      </tr>
    `;

    // ---- ADMIN TEMPLATE ----
    const adminHtml = baseEmailHtml({
      title: "Yeni İletişim Mesajı",
      preheader: `Yeni mesaj alındı • ${sourceLabel}`,
      innerHtml: `
        <div style="margin:0 0 12px;color:rgba(231,236,255,.82);font-size:13px;line-height:1.6;">
          Yeni bir iletişim formu mesajı aldın.
        </div>

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid rgba(120,120,255,.14);border-radius:14px;overflow:hidden;background:rgba(10,12,18,.35);">
          ${kvRow("İsim", name || "-")}
          ${kvRow("E-posta", email)}
          ${kvRow("Kaynak", sourceLabel)}
        </table>

        <div style="margin-top:14px;border:1px solid rgba(120,120,255,.14);border-radius:14px;background:rgba(10,12,18,.35);padding:14px;">
          <div style="font-size:12px;color:rgba(231,236,255,.70);font-weight:800;letter-spacing:.12em;margin-bottom:8px;">
            MESAJ
          </div>
          <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:#F3F5FF;">
            ${esc(message)}
          </div>
        </div>

        <div style="margin-top:14px;font-size:12px;color:rgba(231,236,255,.62);">
          Bu maili yanıtladığında (Reply) direkt kullanıcıya gidecek şekilde ayarlandı.
        </div>
      `,
      footerNote: "Bu mesaj AIVO İletişim Merkezi üzerinden gönderildi.",
    });

    // ---- USER TEMPLATE ----
    const userHtml = baseEmailHtml({
      title: "Mesajını Aldık ✅",
      preheader: "En kısa sürede dönüş yapacağız.",
      innerHtml: `
        <div style="margin:0 0 10px;font-size:14px;line-height:1.75;color:#F3F5FF;">
          Merhaba${name ? " " + esc(name) : ""},<br/>
          Mesajını aldık. En kısa sürede dönüş yapacağız.
        </div>

        <div style="margin-top:12px;border:1px solid rgba(120,120,255,.14);border-radius:14px;background:rgba(10,12,18,.35);padding:14px;">
          <div style="font-size:12px;color:rgba(231,236,255,.70);font-weight:800;letter-spacing:.12em;margin-bottom:8px;">
            GÖNDERDİĞİN MESAJ
          </div>
          <div style="white-space:pre-wrap;font-size:14px;line-height:1.7;color:#F3F5FF;">
            ${esc(message)}
          </div>
        </div>

        <div style="margin-top:14px;font-size:12px;color:rgba(231,236,255,.62);">
          Bu e-postayı yanıtlayarak bize ulaşabilirsin: <a href="mailto:${SUPPORT_EMAIL}" style="color:rgba(170,190,255,.95);text-decoration:none;">${SUPPORT_EMAIL}</a>
        </div>
      `,
      footerNote: "AIVO Ekibi",
    });

    // ---- Plain text (fallback) ----
    const adminText =
      `Yeni iletişim formu mesajı:\n\n` +
      `İsim: ${name || "-"}\n` +
      `E-posta: ${email}\n` +
      `Kaynak: ${sourceLabel}\n\n` +
      `Mesaj:\n${message}\n`;

    const userText =
      `Merhaba${name ? " " + name : ""},\n\n` +
      `Mesajını aldık. En kısa sürede dönüş yapacağız.\n\n` +
      `Gönderdiğin mesaj:\n${message}\n\n` +
      `— AIVO\n` +
      `${SITE_URL}\n`;

    // 1) Admin notification
    const adminTo = BRAND_EMAIL; // info@aivo.tr
    const adminSubject = `📩 Yeni İletişim Mesajı (${sourceLabel})`;

    const { data: adminData, error: adminError } = await resend.emails.send({
      from: BRAND_FROM,     // ✅ AIVO <info@aivo.tr>
      to: adminTo,
      subject: adminSubject,
      text: adminText,
      html: adminHtml,
      replyTo: email,       // ✅ Reply -> kullanıcıya
    });

    if (adminError) {
      return res.status(500).json({ ok: false, where: "admin", error: adminError });
    }

    // 2) User auto-reply
    const userSubject = "AIVO — Mesajını aldık ✅";

    const { data: userData, error: userError } = await resend.emails.send({
      from: BRAND_FROM,     // ✅ AIVO <info@aivo.tr>
      to: email,
      subject: userSubject,
      text: userText,
      html: userHtml,
      replyTo: BRAND_EMAIL, // ✅ Reply -> info@aivo.tr
    });

    if (userError) {
      return res.status(200).json({
        ok: true,
        admin: adminData,
        user: null,
        warning: "User ack mail failed",
        userError,
      });
    }

    return res.status(200).json({
      ok: true,
      admin: adminData,
      user: userData,
    });
  } catch (err) {
    console.error("send-mail crash:", err);
    return res.status(500).json({ ok: false, message: err?.message || "Unknown error" });
  }
};
