const { Resend } = require("resend");

function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function prettySource(source) {
  // teknik slug → human label
  if (source === "kurumsal/iletisim") return "AIVO • İletişim Merkezi";
  if (source === "studio/contact") return "AIVO • Studio İletişim";
  return source || "AIVO • İletişim";
}

function adminHtml({ name, email, message, sourceLabel }) {
  const logoUrl = "https://aivo.tr/aivo-logo.png"; // absolute URL şart
  const safeName = esc(name || "-");
  const safeEmail = esc(email);
  const safeMsg = esc(message).replace(/\n/g, "<br/>");

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Yeni İletişim Mesajı</title>
</head>
<body style="margin:0;background:#070A14;color:#E7ECFF;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Yeni iletişim mesajı geldi (${esc(sourceLabel)})
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070A14;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="680" cellspacing="0" cellpadding="0"
          style="width:100%;max-width:680px;border-radius:18px;overflow:hidden;border:1px solid rgba(120,120,255,.18);background:rgba(12,14,22,.55);box-shadow:0 16px 60px rgba(0,0,0,.35);">
          <tr>
            <td style="padding:18px 18px 10px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${logoUrl}" width="110" alt="AIVO" style="display:block;max-width:110px;height:auto;" />
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="display:inline-block;font-size:12px;letter-spacing:.16em;font-weight:800;opacity:.72;">
                      ${esc(sourceLabel)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 18px 18px;">
              <div style="font-size:22px;font-weight:800;margin:6px 0 10px;">📩 Yeni iletişim formu mesajı</div>

              <div style="border-radius:14px;border:1px solid rgba(120,120,255,.14);background:rgba(10,12,18,.45);padding:14px;">
                <div style="font-size:13px;opacity:.72;margin-bottom:6px;">Gönderen</div>
                <div style="font-size:16px;font-weight:700;margin-bottom:2px;">${safeName}</div>
                <div style="font-size:14px;opacity:.92;">${safeEmail}</div>

                <div style="height:12px;"></div>

                <div style="font-size:13px;opacity:.72;margin-bottom:6px;">Mesaj</div>
                <div style="font-size:14px;line-height:1.65;white-space:normal;">${safeMsg}</div>
              </div>

              <div style="height:14px;"></div>

              <div style="font-size:12px;opacity:.65;">
                İpucu: “Yanıtla” dediğinde kullanıcıya gitsin diye Reply-To kullanıcı e-postası ayarlanmıştır.
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:14px 18px;border-top:1px solid rgba(120,120,255,.12);font-size:12px;opacity:.7;">
              © ${new Date().getFullYear()} AIVO • Otomatik bildirim
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function userHtml({ name, message }) {
  const logoUrl = "https://aivo.tr/aivo-logo.png";
  const safeName = esc(name || "");
  const safeMsg = esc(message).replace(/\n/g, "<br/>");
  const hello = safeName ? `Merhaba ${safeName},` : "Merhaba,";

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>AIVO — Mesajını aldık</title>
</head>
<body style="margin:0;background:#070A14;color:#E7ECFF;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Mesajını aldık. En kısa sürede dönüş yapacağız.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#070A14;padding:28px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="680" cellspacing="0" cellpadding="0"
          style="width:100%;max-width:680px;border-radius:18px;overflow:hidden;border:1px solid rgba(120,120,255,.18);background:rgba(12,14,22,.55);box-shadow:0 16px 60px rgba(0,0,0,.35);">
          <tr>
            <td style="padding:18px;">
              <img src="${logoUrl}" width="110" alt="AIVO" style="display:block;max-width:110px;height:auto;margin-bottom:10px;" />
              <div style="font-size:22px;font-weight:800;margin:0 0 8px;">Mesajını aldık ✅</div>
              <div style="font-size:14px;line-height:1.65;opacity:.92;">
                ${hello}<br/>
                Mesajını aldık. En kısa sürede dönüş yapacağız.
              </div>

              <div style="height:14px;"></div>

              <div style="border-radius:14px;border:1px solid rgba(120,120,255,.14);background:rgba(10,12,18,.45);padding:14px;">
                <div style="font-size:13px;opacity:.72;margin-bottom:6px;">Gönderdiğin mesaj</div>
                <div style="font-size:14px;line-height:1.65;">${safeMsg}</div>
              </div>

              <div style="height:14px;"></div>

              <div style="font-size:12px;opacity:.7;">
                — AIVO<br/>
                Bu e-posta otomatik gönderilmiştir.
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 18px;border-top:1px solid rgba(120,120,255,.12);font-size:12px;opacity:.7;">
              © ${new Date().getFullYear()} AIVO
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, message: "Method not allowed" });
    }

    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ ok: false, message: "RESEND_API_KEY missing" });
    }

    const body = req.body || {};
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

    const resend = new Resend(process.env.RESEND_API_KEY);

    // ✅ Asıl inbox artık info@aivo.tr
    const adminTo = "info@aivo.tr";

    const sourceLabel = prettySource(source);

    // SUBJECT
    const adminSubject = `📩 Yeni İletişim Mesajı — ${sourceLabel}`;
    const userSubject = "AIVO — Mesajını aldık ✅";

    // TEXT fallback (spam riskini de azaltır)
    const adminText =
      `Yeni iletişim formu mesajı:\n\n` +
      `Kaynak: ${sourceLabel}\n` +
      `İsim: ${name || "-"}\n` +
      `E-posta: ${email}\n\n` +
      `Mesaj:\n${message}\n`;

    const userText =
      `Merhaba${name ? " " + name : ""},\n\n` +
      `Mesajını aldık. En kısa sürede dönüş yapacağız.\n\n` +
      `Gönderdiğin mesaj:\n${message}\n\n` +
      `— AIVO`;

    // 1) Admin notification
    const { data: adminData, error: adminError } = await resend.emails.send({
      // Buradaki FROM: Resend’de doğruladığın domain ile aynı olmalı.
      // Şu an sende çalışan: no-reply@mail.aivo.tr
      from: "AIVO <no-reply@mail.aivo.tr>",
      to: adminTo,
      subject: adminSubject,
      text: adminText,
      html: adminHtml({ name, email, message, sourceLabel }),
      replyTo: email, // “Yanıtla” -> kullanıcıya
    });

    if (adminError) {
      return res.status(500).json({ ok: false, where: "admin", error: adminError });
    }

    // 2) User auto-reply
    const { data: userData, error: userError } = await resend.emails.send({
      from: "AIVO <no-reply@mail.aivo.tr>",
      to: email,
      subject: userSubject,
      text: userText,
      html: userHtml({ name, message }),
      replyTo: "info@aivo.tr", // kullanıcı reply yaparsa size dönsün
    });

    if (userError) {
      // Admin gitti ama user ack patladı → yine de ok dön.
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
