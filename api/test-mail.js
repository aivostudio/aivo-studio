// api/test-mail.js
let Resend;
try {
  // CJS güvenli import
  ({ Resend } = require("resend"));
} catch (e) {
  // Paket yoksa veya import patlarsa burada düşer
  console.error("[MAIL] resend import failed:", e);
}

module.exports = async (req, res) => {
  try {
    // Method gate
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, message: "Method not allowed" }));
    }

    // Env kontrol
    const key = process.env.RESEND_API_KEY;
    if (!key) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, message: "RESEND_API_KEY missing on server" }));
    }

    if (!Resend) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, message: "Resend package not available (import failed)" }));
    }

    // Body parse (Vercel çoğu zaman req.body verir; yine de garantiye alalım)
    let body = req.body;
    if (!body) {
      const raw = await new Promise((resolve) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => resolve(data));
      });
      body = raw ? JSON.parse(raw) : {};
    }

    const to = body.to || "harunerkezen@gmail.com";
    const subject = body.subject || "AIVO ✅ Resend Test";
    const text = body.text || "Test başarılıysa bu mail ulaşacak.";

    const resend = new Resend(key);

    const { data, error } = await resend.emails.send({
      from: "AIVO <no-reply@mail.aivo.tr>",
      to,
      subject,
      text,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6">
        <h2>AIVO ✅ Resend Test</h2>
        <p>${text}</p>
      </div>`,
    });

    if (error) {
      console.error("[MAIL] resend error:", error);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(JSON.stringify({ ok: false, error }));
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: true, data }));
  } catch (err) {
    console.error("[MAIL] handler crash:", err);
    res.statusCode = 500 attaches;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(JSON.stringify({ ok: false, message: err?.message || "Unknown error" }));
  }
};
