// /api/paytr/notify.js
// PayTR Bildirim URL (callback/notify): hash doğrula + KV'ye order yaz (idempotent)
// Beklenti: PayTR bu endpoint'e POST (form-urlencoded) gönderir ve biz "OK" döneriz.

import crypto from "crypto";
import querystring from "querystring";

/* -------------------------------------------------------
   KV HELPERS (Vercel KV REST style: /get/<key>, /set/<key>)
   Not: Senin verify.js içindeki kvGet mantığı ile uyumlu.
------------------------------------------------------- */
async function kvGet(key) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;

  const url = `${process.env.KV_REST_API_URL}/get/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  if (!r.ok) return null;

  const data = await r.json().catch(() => null);
  // Upstash/Vercel KV REST genelde { result: ... } döner
  return data && typeof data === "object" && "result" in data ? data.result : data;
}

async function kvSet(key, value) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return { ok: false, skipped: true };

  const url = `${process.env.KV_REST_API_URL}/set/${encodeURIComponent(key)}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      "Content-Type": "application/json",
    },
    // Vercel KV REST /set çoğunlukla { value: ... } bekler.
    body: JSON.stringify({ value }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    return { ok: false, status: r.status, error: t || "KV_SET_FAILED" };
  }

  const data = await r.json().catch(() => ({}));
  return { ok: true, result: data };
}

/* -------------------------------------------------------
   BODY PARSER (PayTR -> form-urlencoded POST)
------------------------------------------------------- */
function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

async function readPost(req) {
  // Next.js bazen req.body’yi hazır verir; değilse raw alırız.
  if (req.body && typeof req.body === "object") return req.body;

  const raw = await readRawBody(req);
  // PayTR tipik olarak application/x-www-form-urlencoded
  return querystring.parse(raw);
}

/* -------------------------------------------------------
   PAYTR HASH VERIFY (iFrame API callback örneği)
   hash_str = merchant_oid + merchant_salt + status + total_amount
   hash = base64( HMAC_SHA256(merchant_key, hash_str) )
------------------------------------------------------- */
function computePaytrNotifyHash({ merchant_oid, status, total_amount }, merchantKey, merchantSalt) {
  const hashStr = String(merchant_oid || "") + String(merchantSalt || "") + String(status || "") + String(total_amount || "");
  return crypto.createHmac("sha256", merchantKey).update(hashStr).digest("base64");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });

  // Zorunlu env (canlıya geçince)
  const merchantKey = process.env.PAYTR_MERCHANT_KEY;
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT;

  // PAYTR_ENABLED: kapalıysa bile notify geliyorsa (prod testleri), yine OK dönmek daha güvenli.
  // Ama doğrulama yapmadan KV yazmayacağız.
  const enabled = String(process.env.PAYTR_ENABLED || "false") === "true";

  let post;
  try {
    post = await readPost(req);
  } catch (e) {
    // Body okunamadı -> PayTR tekrar dener. Yine de 200 OK dönmek yerine 400 verelim.
    return res.status(400).send("BAD_REQUEST");
  }

  // PayTR alanları (genel)
  const merchant_oid = post.merchant_oid;
  const status = post.status; // "success" / "failed" (iFrame/Direkt API)
  const total_amount = post.total_amount;
  const hash = post.hash;

  if (!merchant_oid || !status || !total_amount || !hash) {
    // Eksik payload: PayTR tekrar dener; ama burada net hata verelim.
    return res.status(400).send("MISSING_FIELDS");
  }

  // Hash doğrulama (enabled değilse de doğrulamayı dene; env yoksa doğrulama yapılamaz)
  if (!merchantKey || !merchantSalt) {
    // Secret yokken KV yazmayacağız. Yine de PayTR’nin kuyruğa alıp tekrar tekrar vurmasını istemiyorsak OK dönebilirsin.
    // Ancak güvenlik açısından KV yazmıyoruz.
    return res.status(200).send("OK");
  }

  const expected = computePaytrNotifyHash({ merchant_oid, status, total_amount }, merchantKey, merchantSalt);
  if (expected !== String(hash)) {
    // Bad hash: burada KV yazma. PayTR retry yapabilir; ama hatalı istekleri kabul etmemeliyiz.
    return res.status(400).send("BAD_HASH");
  }

  // Buradan sonrası: doğrulanmış notify.
  // Idempotent KV kayıt: aynı OID tekrar gelirse kredi vb. işlemler tekrar etmesin.
  const oid = String(merchant_oid);
  const orderKey = `aivo:order:${oid}`;

  try {
    const existing = await kvGet(orderKey);

    // Eğer daha önce PAID yazıldıysa: idempotent davran -> sadece OK dön.
    if (existing && typeof existing === "object") {
      if (existing.status === "paid") {
        return res.status(200).send("OK");
      }
      // paid değilse, success geldiyse güncelleme yapabiliriz.
    }

    // init tarafında önceden yazılmış bir taslak varsa çek (opsiyonel)
    // İstersen init.js içinde aivo:order_init:<oid> yazacağız; şimdilik varsa kullanır.
    const initKey = `aivo:order_init:${oid}`;
    const initData = await kvGet(initKey);

    const now = new Date().toISOString();

    const record = {
      oid,
      provider: "paytr",
      // status mapping
      status: status === "success" ? "paid" : "failed",
      total_amount: String(total_amount),
      currency: initData?.currency || "TRY",
      plan: initData?.plan || null,
      credits: initData?.credits || null,
      amount: initData?.amount || null, // plan fiyatı gibi
      created_at: existing?.created_at || initData?.created_at || now,
      updated_at: now,
      paid_at: status === "success" ? now : (existing?.paid_at || null),

      // idempotency / downstream işlem bayrakları
      credit_applied: existing?.credit_applied || false,
      invoice_created: existing?.invoice_created || false,

      // debug/trace (fazla büyütmemek için minimal)
      notify: {
        status: String(status),
        total_amount: String(total_amount),
        // istersen burada email/payment_type gibi alanları da saklayabilirsin
      },
    };

    // Eğer PAYTR_ENABLED=false iken bile notify gelirse:
    // - doğrulama OK olduğu için KV yazmak genelde faydalı (testte işe yarar).
    // - ama istersen burada enabled kontrolü koyup sadece OK dönebilirsin.
    // Ben KV yazmayı bırakıyorum çünkü senin hedefin “iskelet hazır + hızlı canlıya geçiş”.
    await kvSet(orderKey, record);

    return res.status(200).send("OK");
  } catch (e) {
    // PayTR’nin tekrar denemesini istemiyorsan OK dönebilirsin; ama KV yazılamadıysa order kaybolur.
    // Pratikte: log + OK (ama burada JSON dönmeyelim).
    return res.status(200).send("OK");
  }
}
