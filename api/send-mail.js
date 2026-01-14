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

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    const source = String(body.source || "contact-form").trim();

    // ✅ Validasyon: name zorunlu olsun istiyorsan burada aç
    if (!name || !email || !message) {
      return res.status(400).json({
        ok: false,
        message: "Missing required fields: name, email, message",
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // ✅ Admin adresi artık şirket maili
    const adminTo = "info@aivo.tr";

    // 1) Admin notification (site sahibine)
    const adminSubject = `📩 Yeni İletişim Mesajı (${source})`;
    const adminText =
      `Yeni iletişim formu mesajı:\n\n` +
      `İsim: ${name}\n` +
      `E-posta: ${email}\n` +
      `Kaynak: ${source}\n\n` +
      `Mesaj:\n${message}\n`;

    const { data: adminData, error: adminError } = await resend.emails.send({
      from: "AIVO <no-reply@mail.aivo.tr>",
      to: adminTo,
      subject: adminSubject,
      text: adminText,

      // ✅ Admin maili "Yanıtla" dediğinde kullanıcıya gitsin
      replyTo: email,
    });

    if (adminError) {
      return res.status(500).json({ ok: false, where: "admin", error: adminError });
    }

    // 2) Kullanıcıya otomatik cevap (ack)
    const userSubject = "AIVO — Mesajını aldık ✅";
    const userText =
      `Merhaba ${name},\n\n` +
      `Mesajını aldık. En kısa sürede dönüş yapacağız.\n\n` +
      `Gönderdiğin mesaj:\n${message}\n\n` +
      `— AIVO`;

    const { data: userData, error: userError } = await resend.emails.send({
      from: "AIVO <no-reply@mail.aivo.tr>",
      to: email,
      subject: userSubject,
      text: userText,

      // ✅ Kullanıcı mailine "Yanıtla" derse şirkete gitsin
      replyTo: "info@aivo.tr",
    });

    // User mail patlasa bile admin maili gitti → yine ok dönüyoruz
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
