import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  // CORS / preflight (gerekirse)
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, message: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const to = body.to || "harunerkezen@gmail.com";

    const { data, error } = await resend.emails.send({
      from: "AIVO <no-reply@mail.aivo.tr>",
      to,
      subject: body.subject || "AIVO ✅ Resend Test",
      text:
        body.text ||
        "Bu bir test mailidir. Resend → Vercel Mail kurulum testi başarılıysa bu maili görüyorsun.",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>AIVO ✅ Resend Test</h2>
        <p>Bu bir test mailidir.</p>
        <p>Gönderim: <b>Resend → Vercel</b> çalışıyor.</p>
      </div>`,
      // replyTo: "support@aivo.tr", // varsa bırak, yoksa kaldır
    });

    if (error) {
      return res.status(500).json({ ok: false, error });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: err?.message || "Unknown error" });
  }
}
