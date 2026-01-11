// /api/invoices/get.js
const { getRedis } = require("../_kv");

/**
 * =========================================================
 * AIVO — Invoices Get (FAZ 1)
 * =========================================================
 * - Kaynak: invoices:${email}  (STRING -> JSON array)
 * - verify-session bunu yazar.
 * - UI sadece bunu okur.
 */

function safeJsonParse(v, fallback) {
  try {
    if (!v) return fallback;
    if (typeof v === "object") return v;
    return JSON.parse(String(v));
  } catch {
    return fallback;
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();

    // /api/invoices/get?email=...
    const email = String(req.query?.email || "").trim().toLowerCase();
    if (!email) return res.status(400).json({ ok: false, error: "email_required" });

    const key = `invoices:${email}`;

    let raw = null;
    try {
      raw = await redis.get(key);
    } catch (e) {
      // genelde WRONGTYPE -> çözüm: Upstash'ta DEL invoices:<email>
      return res.status(500).json({
        ok: false,
        error: "invoices_read_failed",
        message: String(e?.message || e),
        hint: `Upstash: DEL ${key}`,
      });
    }

    const arr = safeJsonParse(raw, []);
    const invoices = Array.isArray(arr) ? arr : [];

    return res.json({ ok: true, email, invoices });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
