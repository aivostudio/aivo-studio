import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const merchant_id = process.env.PAYTR_MERCHANT_ID;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;

    if (!merchant_id || !merchant_key || !merchant_salt) {
      return res.status(500).json({
        ok: false,
        error: "PAYTR_ENV_MISSING"
      });
    }

    const { email, plan, amount } = req.body || {};

    if (!email || !amount) {
      return res.status(400).json({
        ok: false,
        error: "INVALID_BODY"
      });
    }

    // PayTR KURUŞ ister
    const payment_amount = Math.round(Number(amount) * 100);

    const merchant_oid = "AIVO" + Date.now();

    const user_ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress ||
      "127.0.0.1";

    const user_basket = JSON.stringify([
      [plan || "Standart Paket", (payment_amount / 100).toFixed(2), 1]
    ]);

    const no_installment = 0;
    const max_installment = 0;
    const currency = "TL";
    const test_mode = 1;

    // TOKEN
    const hash_str =
      merchant_id +
      user_ip +
      merchant_oid +
      email +
      payment_amount +
      user_basket +
      no_installment +
      max_installment +
      currency +
      test_mode;

    const paytr_token = crypto
      .createHmac("sha256", merchant_key)
      .update(hash_str + merchant_salt)
      .digest("base64");

    return res.status(200).json({
      ok: true,
      form: {
        merchant_id,
        user_ip,
        merchant_oid,
        email,
        payment_amount,
        currency,
        user_basket,
        no_installment,
        max_installment,
        installment_count: 0,
        merchant_ok_url: "https://aivo.tr/payment/success",
        merchant_fail_url: "https://aivo.tr/payment/fail",
        timeout_limit: 30,
        debug_on: 1,
        test_mode,
        lang: "tr",
        paytr_token
      }
    });

  } catch (err) {
    console.error("PAYTR_INIT_ERROR", err);
    return res.status(500).json({
      ok: false,
      error: "INIT_EXCEPTION"
    });
  }
}
