const { getMailer } = require("../lib/mailer");

module.exports = async (req, res) => {
  try {
    const mailer = getMailer();

    await mailer.sendMail({
      from: process.env.MAIL_FROM,
      to: "GERCEK_MAILIN@gmail.com",
      subject: "AIVO SMTP Test",
      text: "Bu mail AIVO Vercel SMTP testidir.",
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("MAIL ERROR:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
};
