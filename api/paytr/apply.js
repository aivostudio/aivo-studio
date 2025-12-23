// /api/paytr/apply.js
// Kredi + fatura uygulama (idempotent + lock)
// Girdi: oid (order_id)
// Çıktı: ok, applied flags, credits_balance, invoice_id vs.

function json(res, code, data) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function safeJsonParse(x) {
  try {
    return JSON.parse(x);
  } catch {
    return null;
  }
}

async function kvCmd(path, { method = "GET", body } = {}) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;

  const url = `${process.env.KV_REST_API_URL}${path}`;
  const r = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!r.ok) return null;
  const data = await r.json().catch(() => null);
  return data && typeof data === "object" && "result" in data ? data.result : data;
}

async function kvGet(key) {
  const r = await kvCmd(`/get/${encodeURIComponent(key)}`);
  // bazen { value: ... } gibi wrap’li gelebiliyor
  if (r && typeof r === "object" && "value" in r) return r.value;
  return r;
}

async function kvSetJson(key, obj, { exSec } = {}) {
  // Upstash REST: POST body -> /set/<key> + body as last arg
  // EX gibi parametreleri query ile verebiliriz. :contentReference[oaicite:1]{index=1}
  const q = exSec ? `?EX=${encodeURIComponent(String(exSec))}` : "";
  const r = await kvCmd(`/set/${encodeURIComponent(key)}${q}`, { method: "POST", body: obj });
  return r;
}

async function kvSetNxLock(lockKey, lockValue, ttlSec) {
  // SET lockKey lockValue NX EX ttlSec :contentReference[oaicite:2]{index=2}
  const path =
    `/set/${encodeURIComponent(lockKey)}` +
    `/${encodeURIComponent(lockValue)}` +
    `/NX/EX/${encodeURIComponent(String(ttlSec))}`;
  const r = await kvCmd(path);
  // Redis SET NX başarısızsa null döner
  return r; // "OK" veya null
}

async function kvDel(key) {
  return kvCmd(`/del/${encodeURIComponent(key)}`);
}

async function kvIncrBy(key, by) {
  // INCRBY key by :contentReference[oaicite:3]{index=3}
  const path = `/incrby/${encodeURIComponent(key)}/${encodeURIComponent(String(by))}`;
  const r = await kvCmd(path);
  return r; // yeni değer (int)
}

async function kvLpush(key, valueObj) {
  // LPUSH key value (JSON -> POST body ile) :contentReference[oaicite:4]{index=4}
  const r = await kvCmd(`/lpush/${encodeURIComponent(key)}`, { method: "POST", body: valueObj });
  return r; // list length
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return json(res, 405, { ok: false, error: "METHOD_NOT_ALLOWED" });
  }

  const oid =
    (req.method === "GET" ? req.query?.oid : req.body?.oid) ||
    (req.method === "GET" ? req.query?.order_id : req.body?.order_id);

  if (!oid) return json(res, 400, { ok: false, error: "MISSING_OID" });

  const orderKey = `aivo:order:${oid}`;
  const initKey = `aivo:order_init:${oid}`;
  const lockKey = `aivo:lock:apply:${oid}`;

  // 1) Order var mı?
  const orderRaw = await kvGet(orderKey);
  const order = typeof orderRaw === "string" ? safeJsonParse(orderRaw) : orderRaw;

  if (!order) {
    return json(res, 404, { ok: false, error: "ORDER_NOT_FOUND", oid });
  }

  // 2) Paid mi?
  if (order.status !== "paid") {
    return json(res, 409, { ok: false, error: "ORDER_NOT_PAID", oid, status: order.status });
  }

  // 3) Init datasını (user bağlama) al
  const initRaw = await kvGet(initKey);
  const init = typeof initRaw === "string" ? safeJsonParse(initRaw) : initRaw;

  // user_id öncelikli, yoksa email ile ilerle
  const userId = init?.user_id || init?.uid || init?.email || order.user_id || order.email || null;
  if (!userId) {
    return json(res, 409, {
      ok: false,
      error: "USER_BINDING_MISSING",
      message: "init.js tarafında aivo:order_init:<oid> içine user_id/email yazılmalı.",
      oid,
    });
  }

  // 4) Zaten uygulanmış mı?
  const alreadyCredit = !!order.credit_applied;
  const alreadyInvoice = !!order.invoice_created;

  if (alreadyCredit && alreadyInvoice) {
    return json(res, 200, {
      ok: true,
      oid,
      status: order.status,
      plan: order.plan,
      credits: order.credits,
      amount: order.amount,
      credit_applied: true,
      invoice_created: true,
      user_id: userId,
      message: "ALREADY_APPLIED",
    });
  }

  // 5) Lock al (yarış durumuna karşı)
  const lockVal = `apply_${Date.now()}`;
  const lockOk = await kvSetNxLock(lockKey, lockVal, 30);
  if (!lockOk) {
    return json(res, 429, {
      ok: false,
      error: "APPLY_IN_PROGRESS",
      oid,
      message: "Aynı sipariş için apply işlemi zaten çalışıyor.",
    });
  }

  try {
    // Re-read (lock aldık ama yine de güncel flag’lere bak)
    const freshRaw = await kvGet(orderKey);
    const fresh = typeof freshRaw === "string" ? safeJsonParse(freshRaw) : freshRaw;
    if (!fresh) return json(res, 404, { ok: false, error: "ORDER_NOT_FOUND_AFTER_LOCK", oid });

    if (fresh.status !== "paid") {
      return json(res, 409, { ok: false, error: "ORDER_NOT_PAID", oid, status: fresh.status });
    }

    const creditsToAdd = Number(fresh.credits || init?.credits || 0);
    if (!Number.isFinite(creditsToAdd) || creditsToAdd <= 0) {
      return json(res, 409, { ok: false, error: "INVALID_CREDITS", oid, credits: fresh.credits });
    }

    // A) KREDİ UYGULA (idempotent)
    let newBalance = null;
    if (!fresh.credit_applied) {
      const creditsKey = `aivo:user:${userId}:credits`;
      newBalance = await kvIncrBy(creditsKey, creditsToAdd);

      fresh.credit_applied = true;
      fresh.credit_applied_at = new Date().toISOString();
      fresh.credit_user = userId;
      fresh.credit_balance_after = newBalance;
    } else {
      // balance'ı yine de okuyabiliriz (opsiyonel)
      const creditsKey = `aivo:user:${userId}:credits`;
      const balRaw = await kvGet(creditsKey);
      newBalance = Number(balRaw);
      if (!Number.isFinite(newBalance)) newBalance = null;
    }

    // B) FATURA OLUŞTUR (idempotent)
    let invoiceId = fresh.invoice_id || `inv_${oid}`;
    if (!fresh.invoice_created) {
      const invoiceKey = `aivo:invoice:${invoiceId}`;
      const invoiceObj = {
        invoice_id: invoiceId,
        oid,
        user_id: userId,
        plan: fresh.plan || init?.plan || null,
        credits: creditsToAdd,
        amount: fresh.amount || init?.amount || null,
        currency: fresh.currency || init?.currency || "TRY",
        paid_at: fresh.paid_at || fresh.paidAt || new Date().toISOString(),
        created_at: new Date().toISOString(),
        provider: "paytr",
      };

      // Faturayı tekil kaydet
      await kvSetJson(invoiceKey, invoiceObj);

      // Kullanıcının fatura listesine ekle (kartlar buradan beslenecek)
      const listKey = `aivo:user:${userId}:invoices`;
      await kvLpush(listKey, invoiceObj);

      fresh.invoice_created = true;
      fresh.invoice_created_at = new Date().toISOString();
      fresh.invoice_id = invoiceId;
    }

    // C) ORDER'I GÜNCELLE (flag’ler)
    await kvSetJson(orderKey, fresh);

    return json(res, 200, {
      ok: true,
      oid,
      status: fresh.status,
      plan: fresh.plan,
      credits: creditsToAdd,
      amount: fresh.amount,
      user_id: userId,
      credit_applied: !!fresh.credit_applied,
      invoice_created: !!fresh.invoice_created,
      credits_balance: newBalance,
      invoice_id: fresh.invoice_id || invoiceId,
      message: "APPLIED",
    });
  } catch (e) {
    return json(res, 500, { ok: false, error: "APPLY_FAILED", oid, detail: String(e?.message || e) });
  } finally {
    // lock cleanup (TTL zaten var ama temizlemek iyi)
    await kvDel(lockKey);
  }
}
