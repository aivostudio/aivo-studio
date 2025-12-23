// /api/paytr/init.js
const crypto = require("crypto");

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
  test_mode,
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
   SAFE BODY PARSER
   =============================== */
async function readBody(req) {
  // Vercel çoğu zaman req.body verir; yine de garantiye alıyoruz
  if (req.body && typeof req.body === "object") return req.body;

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    // JSON değilse boş döndür
    return {};
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = await readBody(req);

    const user_id = body.user_id || null;
    const email = (body.email || "").trim();
    const plan = (body.plan || "").trim();
    const amount = Number(body.amount);

    if (!email || !plan || !Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        ok: false,
        error: "GEÇERSİZ_ISTEK",
        detail: "post içeriğini kontrol edin",
        got: { user_id: !!user_id, email: !!email, plan: !!plan, amount },
      });
    }

    const merchant_id = process.env.PAYTR_MERCHANT_ID;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
    const test_mode = process.env.PAYTR_TEST_MODE === "true" ? "1" : "0";

    if (!merchant_id || !merchant_key || !merchant_salt) {
      return res.status(500).json({ ok: false, error: "PAYTR_ENV_NOT_SET" });
    }

    const user_ip =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "127.0.0.1";

    const oid = "AIVO_" + Date.now();

    // PayTR kuruş: TRY * 100
    const payment_amount = String(Math.round(amount * 100));

    // sepet: [[urunAdi, fiyatKurus, adet]]
    const user_basket = Buffer.from(
      JSON.stringify([[plan + " Paketi", Math.round(amount * 100), 1]])
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
      test_mode,
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

        // DİKKAT: domainin www ise www kullan
        merchant_ok_url: "https://www.aivo.tr/api/paytr/ok",
        merchant_fail_url: "https://www.aivo.tr/api/paytr/fail",

        timeout_limit: "30",
        debug_on: "1",
        test_mode,
        lang: "tr",

        paytr_token,
      },
    });
  } catch (err) {
    console.error("[PAYTR_INIT_ERROR]", err);
    return res.status(500).json({ ok: false, error: "INIT_FAILED" });
  }
};
