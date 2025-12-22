// /api/payments/init.js
// Provider-agnostic init (şimdilik mock)
// PayTR geldiğinde burada mode=paytr yapılacak.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    const planCode = String(body.planCode || "");
    const amountTRY = Number(body.amountTRY || 0);
    const email = String(body.email || "");
    const userName = String(body.userName || "");
    const userAddress = String(body.userAddress || "");
    const userPhone = String(body.userPhone || "");

    if (!planCode || !amountTRY) {
      return res.status(400).json({ ok: false, error: "Missing planCode/amountTRY" });
    }

    // Şimdilik mock akış: token/redirect yok, sadece orderId dönüyoruz
    const orderId =
      "mock_" + Date.now() + "_" + Math.random().toString(16).slice(2);

    return res.status(200).json({
      ok: true,
      mode: "mock",
      orderId,
      planCode,
      amountTRY,
      customer: { email, userName, userAddress, userPhone },
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || "Server error" });
  }
}
