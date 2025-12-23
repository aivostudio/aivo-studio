import crypto from "crypto";

/* ===============================
   PAYTR TOKEN
   =============================== */
function generatePaytrToken({
  merchant_id,
  merchant_key,
  merchant_salt,
  user_ip,
  merchant_oid,
  email,
  payment_amount,
  user_basket,
  test_mode
}) {
  const hashStr =
    merchant_id +
    user_ip +
    merchant_oid +
    email +
    payment_amount +
    user_basket +
    test_mode +
    merchant_salt;

  return crypto
    .createHmac("sha256", merchant_key)
    .update(hashStr)
    .digest("base64");
}

/* ===============================
   API HANDLER
   =============================== */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const { user_id, email, plan, amount } = req.body || {};
    if (!email || !plan || !amount) {
      return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
    }

    const merchant_id   = process.env.PAYTR_MERCHANT_ID;
    const merchant_key  = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
    const test_mode     = process.env.PAYTR_TEST_MODE === "true" ? "1" : "0";

    if (!merchant_id || !merchant_key || !merchant_salt) {
      return res.status(500).json({ ok: false, error: "PAYTR_ENV_NOT_SET" });
    }

    const user_ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    const oid = "AIVO_" + Date.now();

    const payment_amount = String(Number(amount) * 100);

    const user_basket = Buffer.from(
      JSON.stringify([[plan + " Paketi", Number(amount) * 100, 1]])
    ).toString("base64");

    const paytr_token = generatePaytrToken({
      merchant_id,
      merchant_key,
      merchant_salt,
      user_ip,
      merchant_oid: oid,
      email,
      payment_amount,
      user_basket,
      test_mode
    });

    return res.status(200).json({
      ok: true,
      oid,
      form: {
        merchant_id,
        user_ip,
        merchant_oid: oid,
        email,
        payment_amount,
        currency: "TRY",

        user_basket,

        no_installment: "1",
        max_installment: "0",
        installment_count: "0",

        merchant_ok_url: "https://www.aivo.tr/api/paytr/ok",
        merchant_fail_url: "https://www.aivo.tr/api/paytr/fail",

        timeout_limit: "30",
        debug_on: "1",
        test_mode,
        lang: "tr",

        paytr_token
      }
    });

  } catch (err) {
    console.error("[PAYTR_INIT_ERROR]", err);
    return res.status(500).json({
      ok: false,
      error: "INIT_FAILED"
    });
  }
}
