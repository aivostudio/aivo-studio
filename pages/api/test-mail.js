import { mailer } from "../../lib/mailer";

export default async function handler(req, res) {
  try {
    await mailer.sendMail({
      from: process.env.MAIL_FROM,
      to: "KENDI_GMAILIN@gmail.com", // burayı kendinle değiştir
      subject: "AIVO SMTP Test",
      text: "Bu mail AIVO Vercel SMTP testidir.",
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("MAIL ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
