// /api/invoices/get.js
/**
 * =========================================================
 * AIVO — INVOICES GET (FAZ 1 / READ ONLY)
 * =========================================================
 *
 * AMAÇ:
 * - UI/AUTH'a dokunmadan, server (KV) üzerindeki faturaları güvenli şekilde okumak.
 * - verify-session'ın yazdığı key ile birebir aynı key'den okumak (write == read).
 *
 * SINGLE SOURCE OF TRUTH:
 * - invoices:{email}  -> JSON array (append-only)
 *
 * ENDPOINT:
 * - GET /api/invoices/get?email=...
 *
 * RESPONSE:
 * - { ok: true, email, invoices: [...] }
 *
 * NOT:
 * - Bu endpoint yazma yapmaz. Sadece okur.
 */

const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();

    // query: /api/invoices/get?email=...
    const email = String(req.query?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    const key = `invoices:${email}`;

    const raw = await redis.get(key);

    let invoices = [];
    if (raw) {
      try {
        const parsed = typeof raw === "object" ? raw : JSON.parse(String(raw));
        invoices = Array.isArray(parsed) ? parsed : [];
      } catch (_) {
        invoices = [];
      }
    }

    // Stabil sıralama garantisi (en yeni en üstte)
    invoices.sort((a, b) => {
      const ta = Number(a?.createdAt || a?.created || 0) || 0;
      const tb = Number(b?.createdAt || b?.created || 0) || 0;
      return tb - ta;
    });

    return res.json({ ok: true, email, invoices });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
