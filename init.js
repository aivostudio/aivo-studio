// /api/paytr/init.js
// PayTR iFrame API - Step 1: get-token (iframe_token)
// Vercel Serverless Function (Node.js)

import crypto from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
  }

  try {
    // 1) ENV zorunluları
    const merchant_id = process.env.PAYTR_MERCHANT_ID;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
    const test_mode = String(process.env.PAYTR_TEST_MODE ?? "1"); // 1=test, 0=live
    const baseUrl = process.env.APP_BASE_URL;

    if (!merchant_id || !merchant_key || !merchant_salt) {
      return res.status(500).json({
        ok: false,
        error: "Missing PayTR env vars: PAYTR_MERCHANT_ID / PAYTR_MERCHANT_KEY / PAYTR_MERCHANT_SALT",
      });
    }
    if (!baseUrl) {
      return res.status(500).json({
        ok: false,
        error: "Missing env var: APP_BASE_URL (example: https://your-vercel-domain)",
      });
    }

    // 2) Request body (front-end buraya plan/amount vb. gönderir)
    // Minimum örnek: { planCode: "pro", amountTL: 199, email: "x@y.com", userName:"Ad Soyad", phone:"05...", address:"..." }
    const {
      planCode = "pro",
      amountTL = 199,
      email,
      userName = "AIVO Kullanıcı",
      phone = "",
      address = "Türkiye",
      basket, // opsiyonel: kendi sepetini göndermek istersen
    } = req.body || {};

    if (!email) {
      return res.status(400).json({ ok: false, error: "email is required" });
    }

    // 3) user_ip: PayTR dış IP ister (local testlerde özellikle önemli)
    // PayTR dokümanında user_ip zorunlu alan. :contentReference[oaicite:2]{index=2}
    const xff = req.headers["x-forwarded-for"];
    const user_ip = Array.isArray(xff)
      ? xff[0]
      : (xff || "").split(",")[0].trim() || "127.0.0.1";

    // 4) merchant_oid: senin sipariş numaran (unique)
    // Örn: AIVO-20251223-<random>
    const merchant_oid = `AIVO-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${crypto
      .randomBytes(6)
      .toString("hex")}`;

    // 5) payment_amount: kuruş cinsinden (TL * 100)
    // PayTR dokümanında "Multiply by 100" diyor. :contentReference[oaicite:3]{index=3}
    const payment_amount = String(Math.round(Number(amountTL) * 100));

    // 6) user_basket: base64(json) formatı zorunlu
    // Dokümandaki örneğe uygun: [["Ürün", "18.00", 1], ...] :contentReference[oaicite:4]{index=4}
    const user_basket = (() => {
      if (basket && Array.isArray(basket) && basket.length) {
        return Buffer.from(JSON.stringify(basket)).toString("base64");
      }
      const defaultBasket = [[`AIVO ${String(planCode).toUpperCase()} Paket`, Number(amountTL).toFixed(2), 1]];
      return Buffer.from(JSON.stringify(defaultBasket)).toString("base64");
    })();

    // 7) Zorunlu / temel alanlar
    const no_installment = "0";
    const max_installment = "0";
    const currency = "TL";
    const timeout_limit = "30";
    const debug_on = "1";
    const lang = "tr";

    // 8) OK/FAIL URL (kullanıcı dönüş sayfaları)
    // Uyarı: kullanıcı buraya geldiğinde ödeme callback henüz kesinleşmemiş olabilir. :contentReference[oaicite:5]{index=5}
    const merchant_ok_url = `${baseUrl}/?paytr=ok&oid=${encodeURIComponent(merchant_oid)}`;
    const merchant_fail_url = `${baseUrl}/?paytr=fail&oid=${encodeURIComponent(merchant_oid)}`;

    // 9) paytr_token hesaplama (dokümandaki hash_str sırası ile)
    // hash_str = merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode :contentReference[oaicite:6]{index=6}
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

    // 10) PayTR get-token isteği (server-side POST)
    // URL: https://www.paytr.com/odeme/api/get-token :contentReference[oaicite:7]{index=7}
    const postVals = new URLSearchParams({
      merchant_id,
      user_ip,
      merchant_oid,
      email,
      payment_amount,
      paytr_token,
      user_basket,
      debug_on,
      no_installment,
      max_installment,
      user_name: userName,
      user_address: address,
      user_phone: phone,
      merchant_ok_url,
      merchant_fail_url,
      timeout_limit,
      currency,
      test_mode,
      lang,
      // iframe_v2: "1", // iFrame V2 kullanacaksan aç (opsiyonel) :contentReference[oaicite:8]{index=8}
    });

    const r = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: postVals,
    });

    const text = await r.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "PayTR response is not valid JSON",
        raw: text,
      });
    }

    if (data.status !== "success") {
      return res.status(400).json({
        ok: false,
        error: "PayTR get-token failed",
        reason: data.reason || "unknown",
        paytr: data,
      });
    }

    // 11) Front-end'in kullanacağı değerler:
    // token => iframe src: https://www.paytr.com/odeme/guvenli/<token> :contentReference[oaicite:9]{index=9}
    return res.status(200).json({
      ok: true,
      merchant_oid,
      token: data.token,
      iframeUrl: `https://www.paytr.com/odeme/guvenli/${data.token}`,
      amountTL: Number(amountTL),
      currency,
      test_mode: Number(test_mode),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      detail: err?.message || String(err),
    });
  }
}
