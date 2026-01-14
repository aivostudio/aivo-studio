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
    const to = body.to || "harunerkezen@gmail.com";

    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: "AIVO <no-reply@mail.aivo.tr>",
      to,
      subject: body.subject || "AIVO ✅ Resend Test",
      text: body.text || "Test başarılıysa bu mail ulaşacak.",
    });

    if (error) return res.status(500).json({ ok: false, error });

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("test-mail crash:", err);
    return res.status(500).json({ ok: false, message: err?.message || "Unknown error" });
  }
};
