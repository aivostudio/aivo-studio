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

    // Basit validasyon
    if (!email || !message) {
      return res.status(400).json({
        ok: false,
        message: "Missing required fields: email, message",
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    // 1) Admin notification (sana)
    const adminTo = "harunerkezen@gmail.com";

    const adminSubject = `📩 Yeni İletişim Mesajı (${source})`;
    const adminText =
      `Yeni iletişim formu mesajı:\n\n` +
      `İsim: ${name || "-"}\n` +
      `E-posta: ${email}\n` +
      `Kaynak: ${source}\n\n` +
      `Mesaj:\n${message}\n`;

    const { data: adminData, error: adminError } = await resend.emails.send({
      from: "AIVO <no-reply@mail.aivo.tr>",
      to: adminTo,
      subject: adminSubject,
      text: adminText,
      replyTo: email, // cevapla dediğinde kullanıcıya gitsin
    });

    if (adminError) {
      return res.status(500).json({ ok: false, where: "admin", error: adminError });
    }

    // 2) Kullanıcıya otomatik cevap (ack)
    const userSubject = "AIVO — Mesajını aldık ✅";
    const userText =
      `Merhaba${name ? " " + name : ""},\n\n` +
      `Mesajını aldık. En kısa sürede dönüş yapacağız.\n\n` +
      `Gönderdiğin mesaj:\n${message}\n\n` +
      `— AIVO`;

    const { data: userData, error: userError } = await resend.emails.send({
      from: "AIVO <no-reply@mail.aivo.tr>",
      to: email,
      subject: userSubject,
      text: userText,
      replyTo: "support@aivo.tr",
    });

    if (userError) {
      // Admin mail gitti ama user mail patladı: yine de 200 dönüp loglamak isteriz.
      // Burada 207/200 tercih meselesi; ben JSON’da işaretliyorum.
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
