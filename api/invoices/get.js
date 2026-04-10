// /api/invoices/get.js
const { getRedis } = require("../_kv");

/**
 * =========================================================
 * AIVO — Invoices Get
 * =========================================================
 * Kaynak önceliği:
 * 1) invoices:${email}  -> Redis LIST (verify-session.js bunu LPUSH ile yazar)
 * 2) invoices:${email}  -> legacy STRING(JSON array) fallback
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

    const email = String(req.query?.email || "").trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ ok: false, error: "email_required" });
    }

    const key = `invoices:${email}`;

    let keyType = "none";
    try {
      keyType = await redis.type(key);
    } catch (e) {
      return res.status(500).json({
        ok: false,
        error: "invoices_type_failed",
        message: String(e?.message || e),
      });
    }

    // 1) Yeni format: Redis LIST
    if (keyType === "list") {
      try {
        const rows = await redis.lrange(key, 0, -1);
        const invoices = Array.isArray(rows)
          ? rows
              .map((row) => safeJsonParse(row, null))
              .filter((x) => x && typeof x === "object")
          : [];

        return res.json({ ok: true, email, invoices });
      } catch (e) {
        return res.status(500).json({
          ok: false,
          error: "invoices_list_read_failed",
          message: String(e?.message || e),
        });
      }
    }

    // 2) Legacy format: STRING(JSON array)
    if (keyType === "string") {
      try {
        const raw = await redis.get(key);
        const arr = safeJsonParse(raw, []);
        const invoices = Array.isArray(arr) ? arr : [];

        return res.json({ ok: true, email, invoices });
      } catch (e) {
        return res.status(500).json({
          ok: false,
          error: "invoices_string_read_failed",
          message: String(e?.message || e),
        });
      }
    }

    // 3) Hiç kayıt yok
    if (keyType === "none") {
      return res.json({ ok: true, email, invoices: [] });
    }

    // 4) Beklenmeyen tip
    return res.status(500).json({
      ok: false,
      error: "invoices_wrong_type",
      message: `Unexpected Redis type for ${key}: ${keyType}`,
      hint: `Upstash: DEL ${key}`,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: String(e?.message || e),
    });
  }
};
