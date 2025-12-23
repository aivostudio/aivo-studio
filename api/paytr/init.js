// /api/paytr/init.js
import crypto from "crypto";

/* ===============================
   HELPERS
   =============================== */
function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function getUserIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.length) return xf.split(",")[0].trim();
  const ra = req.socket?.remoteAddress || "";
  return ra || "127.0.0.1";
}

function parseAmountToKurus(amount) {
  // 399 / "399" / "399,00" / "₺399" -> "39900"
  const s = String(amount ?? "")
    .trim()
    .replace(/[^\d.,]/g, "")
    .replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return String(Math.round(n * 100));
}

async function readJsonBody(req) {
  // 1) Vercel/Next bazen req.body objesi verir
  if (req.body && typeof req.body === "object") return req.body;

  // 2) Bazen string gelebilir
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return null;
    }
  }

  // 3) Hiç gelmezse stream’den oku
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

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

  return crypto.createHmac("sha256", merchant_key).update(hashStr).digest("base64");
}

/* ===============================
   HANDLER
   =============================== */
export default async function handler(req, res) {
  // CORS (gerekirse)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.end();

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  try {
    const body = await readJsonBody(req);

    const user_id = body?.user_id ?? "guest";
    const email = String(body?.email ?? "").trim();
    const plan = String(body?.plan ?? "").trim();
    const amountRaw = body?.amount;

    if (!email || !plan || amountRaw == null) {
      return json(res, 400, {
        ok: false,
        status: "failed",
        reason: "Gecersiz istek, post icerigini kontrol edin",
        debug: {
          got_body: !!body,
          email: !!email,
          plan: !!plan,
          amount_present: amountRaw != null,
        },
      });
    }

    const merchant_id = process.env.PAYTR_MERCHANT_ID;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
    const test_mode = process.env.PAYTR_TEST_MODE === "true" ? "1" : "0";

    if (!merchant_id || !merchant_key || !merchant_salt) {
      return json(res, 500, { ok: false, error: "PAYTR_ENV_NOT_SET" });
    }

    const user_ip = getUserIp(req);

    const payment_amount = parseAmountToKurus(amountRaw);
    if (!payment_amount) {
      return json(res, 400, {
        ok: false,
        status: "failed",
        reason: "Gecersiz tutar",
      });
    }

    // Sipariş id
    const oid = "AIVO_" + Date.now() + "_" + Math.floor(Math.random() * 1000);

    // PayTR basket: [["Ürün adı", birim_fiyat(KURUŞ), adet]]
    // Not: birim fiyat KURUŞ olmalı (örn 39900)
    const basketUnit = Number(payment_amount); // kuruş
    const user_basket = Buffer.from(
      JSON.stringify([[`${plan} Paketi`, basketUnit, 1]])
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

    // DİKKAT: domain’in kesin doğru olmalı
    const baseUrl = "https://www.aivo.tr";

    return json(res, 200, {
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

        // taksit ayarları
        no_installment: "1",
        max_installment: "0",

        // dönüş URL’leri
        merchant_ok_url: `${baseUrl}/api/paytr/ok`,
        merchant_fail_url: `${baseUrl}/api/paytr/fail`,

        // diğer
        timeout_limit: "30",
        debug_on: "1",
        test_mode,
        lang: "tr",

        // token
        paytr_token,

        // İstersen notify.js için takip amaçlı:
        // user_id'yi server tarafında KV'ye yazacaksan,
        // init response içine ayrıca ekleyebilirsin:
        // aivo_user_id: String(user_id)
      },
    });
  } catch (err) {
    console.error("[PAYTR_INIT_ERROR]", err);
    return json(res, 500, { ok: false, error: "INIT_FAILED" });
  }
}
