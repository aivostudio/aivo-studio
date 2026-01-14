const { Resend } = require("resend");

/**
 * Escape helper (XSS-safe for HTML emails)
 */
function esc(s = "") {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * teknik slug → human label
 */
function prettySource(source) {
  if (source === "kurumsal/iletisim") return "AIVO • İletişim Merkezi";
  if (source === "studio/contact") return "AIVO • Studio İletişim";
  return source || "AIVO • İletişim";
}

/**
 * Ticket ID (simple + searchable)
 * Example: AIVO-20260114-9K3F2
 */
function ticketId() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `AIVO-${y}${m}${day}-${rand}`;
}

/**
 * Admin email: reply-friendly (LIGHT) to avoid Apple Mail / Gmail reply text invisibility
 * User email can remain DARK (brand).
 */
function adminHtml({ tid, name, email, message, sourceLabel }) {
  const logoUrl = "https://aivo.tr/aivo-logo.png";
  const safeName = esc(name || "-");
  const safeEmail = esc(email);
  const safeMsg = esc(message).replace(/\n/g, "<br/>");
  const safeSource = esc(sourceLabel);
  const safeTid = esc(tid);

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>Yeni İletişim Mesajı</title>
</head>
<body style="margin:0;background:#ffffff;color:#0b1020;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;">
  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
    Yeni iletişim mesajı geldi (${safeSource}) • ${safeTid}
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;padding:22px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="680" cellspacing="0" cellpadding="0"
          style="width:100%;max-width:680px;border-radius:16px;overflow:hidden;border:1px solid rgba(20,30,60,.12);background:#f6f7fb;box-shadow:0 18px 55px rgba(0,0,0,.12);">
          
          <!-- Header -->
          <tr>
            <td style="padding:16px 16px 10px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="${logoUrl}" width="110" alt="AIVO" style="display:block;max-width:110px;height:auto;" />
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <div style="font-size:12px;letter-spacing:.14em;font-weight:800;color:#2a3553;opacity:.85;">
                      ${safeSource}
                    </div>
                    <div style="margin-top:4px;font-size:12px;font-weight:800;color:#2a3553;opacity:.75;">
                      Ticket: <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">#${safeTid}</span>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:0 16px 16px;">
              <div style="font-size:20px;font-weight:900;margin:8px 0 10px;color:#0b1020;">
                📩 Yeni iletişim formu mesajı
              </div>

              <div style="border-radius:14px;border:1px solid rgba(20,30,60,.12);background:#ffffff;padding:14px;">
                <div style="font-size:12px;color:#5b6785;opacity:.95;margin-bottom:6px;">Gönderen</div>
                <div style="font-size:16px;font-weight:800;margin-bottom:2px;color:#0b1020;">${safeName}</div>
                <div style="font-size:14px;color:#1a2a55;opacity:.9;">${safeEmail}</div>

                <div style="height:12px;"></div>

                <div style="font-size:12px;color:#5b6785;opacity:.95;margin-bottom:6px;">Mesaj</div>
                <div style="font-size:14px;line-height:1.65;color:#0b1020;white-space:normal;">${safeMsg}</div>
              </div>

              <div style="height:12px;"></div>

              <!-- Reply friendly note -->
              <div style="font-size:12px;color:#5b6785;line-height:1.5;">
                İpucu: “Yanıtla” dediğinde mesajın kullanıcıya gitsin diye <b>Reply-To</b> kullanıcı e-postasına ayarlanmıştır.
                Eğer bazı mail uygulamalarında yanıt yazısı görünmezse, yanıtınızı <b>alıntının üstüne</b> yazın.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:12px 16px;border-top:1px solid rgba(20,30,60,.10);font-size:12px;color:#5b6785;">
              © ${new Date().getFullYear()} AIVO • Otomatik bildirim • <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">#${safeTid}</span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function userHtml({ tid, name, message }) {
  const logoUrl = "https://aivo.tr/aivo-logo.png";
  const safeName = esc(name || "");
  const safeMsg = esc(message).replace(/\n/g, "<br/>");
  const safeTid = esc(tid);
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
    Mesajını aldık. En kısa sürede dönüş yapacağız. (Ref: ${safeTid})
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
                Referans: <span style="font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">#${safeTid}</span><br/>
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

    // (Optional but recommended) very light email sanity check
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return res.status(400).json({ ok: false, message: "Invalid email format" });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const adminTo = "info@aivo.tr";
    const sourceLabel = prettySource(source);
    const tid = ticketId();

    // SUBJECTS (searchable workflow)
    const adminSubject = `[#${tid}] 📩 Yeni İletişim Mesajı — ${sourceLabel}`;
    const userSubject = `AIVO — Mesajını aldık ✅ (#${tid})`;

    // TEXT fallback (deliverability + accessibility)
    const adminText =
      `Yeni iletişim formu mesajı:\n\n` +
      `Ticket: ${tid}\n` +
      `Kaynak: ${sourceLabel}\n` +
      `İsim: ${name || "-"}\n` +
      `E-posta: ${email}\n\n` +
      `Mesaj:\n${message}\n`;

    const userText =
      `Merhaba${name ? " " + name : ""},\n\n` +
      `Mesajını aldık. En kısa sürede dönüş yapacağız.\n\n` +
      `Referans: ${tid}\n\n` +
      `Gönderdiğin mesaj:\n${message}\n\n` +
      `— AIVO`;

    // FROM (keep verified sending domain)
    const fromAddr = "AIVO <no-reply@mail.aivo.tr>";

    // 1) Admin notification
    const { data: adminData, error: adminError } = await resend.emails.send({
      from: fromAddr,
      to: adminTo,
      subject: adminSubject,
      text: adminText,
      html: adminHtml({ tid, name, email, message, sourceLabel }),
      replyTo: email, // Reply goes to the user
    });

    if (adminError) {
      return res.status(500).json({ ok: false, where: "admin", error: adminError });
    }

    // 2) User auto-reply
    const { data: userData, error: userError } = await resend.emails.send({
      from: fromAddr,
      to: email,
      subject: userSubject,
      text: userText,
      html: userHtml({ tid, name, message }),
      replyTo: "info@aivo.tr", // User replies go to your inbox
    });

    if (userError) {
      // Admin succeeded, user ack failed -> still ok
      return res.status(200).json({
        ok: true,
        ticket: tid,
        admin: adminData,
        user: null,
        warning: "User ack mail failed",
        userError,
      });
    }

    return res.status(200).json({
      ok: true,
      ticket: tid,
      admin: adminData,
      user: userData,
    });
  } catch (err) {
    console.error("send-mail crash:", err);
    return res.status(500).json({ ok: false, message: err?.message || "Unknown error" });
  }
};
