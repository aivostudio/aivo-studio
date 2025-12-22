
// /api/paytr/init.js
// PayTR iFrame API - Step 1: get-token (server-side)
// Docs: https://www.paytr.com/odeme/api/get-token  (PayTR Developer Portal)

import crypto from "crypto";

function getClientIp(req) {
  // Vercel/Proxy arkasında çoğu zaman burada olur
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) {
    return xff.split(",")[0].trim();
  }
  // fallback
  return req.socket?.remoteAddress || "127.0.0.1";
}

function base64(str) {
  return Buffer.from(str, "utf8").toString("base64");
}

function toFormUrlEncoded(obj) {
  const params = new URLSearchParams();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    params.append(k, String(v));
  });
  return params.toString();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const merchant_id = process.env.PAYTR_MERCHANT_ID;
    const merchant_key = process.env.PAYTR_MERCHANT_KEY;
    const merchant_salt = process.env.PAYTR_MERCHANT_SALT;
    const test_mode = process.env.PAYTR_TEST_MODE ?? "1";
    const appBaseUrl = process.env.APP_BASE_URL;

    if (!merchant_id || !merchant_key || !merchant_salt || !appBaseUrl) {
      return res.status(500).json({
        ok: false,
        error:
          "Missing ENV. Required: PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT, APP_BASE_URL",
      });
    }

    // Front-end'den beklediğimiz minimum veri
    // amount TRY cinsinden gelebilir (örn 199) veya kuruş (19900) — biz TRY kabul edip kuruşa çeviriyoruz.
    const {
      planCode, // örn: "AIVO_PRO"
      amountTRY, // örn: 199
      email,
      userName,
      userAddress,
      userPhone,
    } = req.body || {};

    if (!planCode || !amountTRY || !email) {
      return res.status(400).json({
        ok: false,
        error: "Missing fields. Required: planCode, amountTRY, email",
      });
    }

    // PayTR payment_amount: tutarı 100 ile çarpıp integer gönderiyoruz. :contentReference[oaicite:4]{index=4}
    const payment_amount = Math.round(Number(amountTRY) * 100);
    if (!Number.isFinite(payment_amount) || payment_amount <= 0) {
      return res.status(400).json({ ok: false, error: "Invalid amountTRY" });
    }

    const user_ip = getClientIp(req);

    // Sipariş no: benzersiz olmalı :contentReference[oaicite:5]{index=5}
    // AIVO'da ileride DB ile ilişkilendireceğiz. Şimdilik timestamp + random.
    const merchant_oid = `AIVO_${Date.now()}_${Math.random()
      .toString(16)
      .slice(2)}`;

    // user_basket: JSON array -> base64. :contentReference[oaicite:6]{index=6}
    // Minimal sepet: tek kalem (plan)
    const basket = JSON.stringify([[planCode, (Number(amountTRY)).toFixed(2), 1]]);
    const user_basket = base64(basket);

    // Taksit ayarları
    const no_installment = "0";
    const max_installment = "0";

    // Para birimi ve dil
    const currency = "TL";
    const lang = "tr";

    // Bu sayfalar "sipariş onay/iptal" için kullanılmaz, sadece bilgilendirme/yönlendirme içindir. :contentReference[oaicite:7]{index=7}
    const merchant_ok_url = `${appBaseUrl}/?paytr=ok&oid=${encodeURIComponent(
      merchant_oid
    )}`;
    const merchant_fail_url = `${appBaseUrl}/?paytr=fail&oid=${encodeURIComponent(
      merchant_oid
    )}`;

    const timeout_limit = "30";
    const debug_on = "1";

    // paytr_token hesaplama:
    // hashSTR = merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
    // paytr_token = base64(HMAC_SHA256(hashSTR + merchant_salt, merchant_key))
    // (PayTR örnek kod akışı) :contentReference[oaicite:8]{index=8}
    const hashStr =
      `${merchant_id}${user_ip}${merchant_oid}${email}${payment_amount}` +
      `${user_basket}${no_installment}${max_installment}${currency}${test_mode}`;

    const paytr_token = crypto
      .createHmac("sha256", merchant_key)
      .update(hashStr + merchant_salt)
      .digest("base64");

    // PayTR get-token çağrısı (server-side POST) :contentReference[oaicite:9]{index=9}
    const form = {
      merchant_id,
      user_ip,
      merchant_oid,
      email,
      payment_amount,
      currency,
      user_basket,
      no_installment,
      max_installment,
      paytr_token,
      user_name: userName || "AIVO User",
      user_address: userAddress || "N/A",
      user_phone: userPhone || "0000000000",
      merchant_ok_url,
      merchant_fail_url,
      test_mode,
      debug_on,
      timeout_limit,
      lang,

      // Eğer PayTR iFrame V2 kullanacaksan:
      // iframe_v2: 1,
    };

    const resp = await fetch("https://www.paytr.com/odeme/api/get-token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toFormUrlEncoded(form),
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return res.status(502).json({
        ok: false,
        error: "PayTR non-JSON response",
        raw: text,
      });
    }

    if (data.status !== "success") {
      return res.status(400).json({
        ok: false,
        error: "PayTR failed",
        reason: data.reason || "unknown",
        request_oid: merchant_oid,
      });
    }

    // Front-end'in kullanacağı token
    return res.status(200).json({
      ok: true,
      merchant_oid,
      token: data.token,
      iframe_src: `https://www.paytr.com/odeme/guvenli/${data.token}`,
      // İleride store/fatura için: plan + tutar gibi alanları da döndürebilirsin
      planCode,
      amountTRY: Number(amountTRY),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Server error",
      message: err?.message || String(err),
    });
  }
}
