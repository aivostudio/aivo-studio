// /api/credits/add.js
import kvMod from "../_kv.js";

/**
 * Tek otorite session:
 * sess:{sid} -> { email: "...", ... }
 */
const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;
const kvGet = kv.kvGet;
const kvSet = kv.kvSet;
const kvIncr = kv.kvIncr;

async function getSession(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/aivo_sess=([^;]+)/);
  if (!match) return null;

  const sid = match[1];
  if (!sid || typeof kvGetJson !== "function") return null;

  const sess = await kvGetJson(`sess:${sid}`).catch(() => null);
  if (!sess || !sess.email) return null;

  return sess; // en az { email }
}

function isJson(req) {
  return String(req.headers["content-type"] || "")
    .toLowerCase()
    .includes("application/json");
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    if (!isJson(req)) {
      return res.status(415).json({ ok: false, error: "unsupported_content_type" });
    }

    // 🔐 AUTH
    const session = await getSession(req);
    if (!session) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const inc = Number(body.amount || 0);
    const oid = String(body.order_id || "").trim();

    if (!oid) {
      return res.status(400).json({ ok: false, error: "order_id_required" });
    }
    if (!Number.isFinite(inc) || inc <= 0) {
      return res.status(400).json({ ok: false, error: "amount_invalid" });
    }

    const email = String(session.email).trim().toLowerCase();
    if (!email.includes("@")) {
      return res.status(401).json({ ok: false, error: "unauthorized_bad_session" });
    }

    const creditKey = `credits:${email}`;

    // helper kontrolü
    if (typeof kvSet !== "function" || typeof kvGet !== "function" || typeof kvIncr !== "function") {
      return res.status(500).json({
        ok: false,
        error: "KV_HELPER_MISSING",
        detail: "kvSet/kvGet/kvIncr not found in api/_kv.js",
      });
    }

    // idempotency (aynı order bir kez uygulanır)
    const orderKey = `orders:applied:${oid}`;
    const ORDER_TTL_SECONDS = 90 * 24 * 60 * 60;

    // NX set: Upstash Redis REST set nx/ex destekli; helper'ımız kvSet() ops ile ex alıyor,
    // ama NX desteği yok. Bu yüzden basit bir "var mı" kontrolü + set yapıyoruz.
    // (Webhook'ta asıl idempotency'yi event.id veya session.id ile yapmanı öneririm.)
    const already = await kvGet(orderKey).catch(() => null);
    if (already) {
      const current = Number(await kvGet(creditKey).catch(() => 0)) || 0;
      return res.status(200).json({
        ok: true,
        already_applied: true,
        credits: current,
      });
    }

    await kvSet(orderKey, "1", { ex: ORDER_TTL_SECONDS });

    const newCredits = await kvIncr(creditKey, inc);

    return res.status(200).json({
      ok: true,
      already_applied: false,
      credits: Number(newCredits) || 0,
      email,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(e?.message || e),
    });
  }
}
