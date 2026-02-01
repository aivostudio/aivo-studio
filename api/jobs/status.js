// api/jobs/status.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const job_id = String(req.query.job_id || "").trim();
    if (!job_id) return res.status(400).json({ ok: false, error: "job_id_required" });

    // 1) Redis/KV bağlantısı alınamıyorsa -> 503 (500 değil)
    let redis;
    try {
      redis = getRedis();
    } catch (e) {
      console.error("jobs/status getRedis failed:", e);
      return res.status(503).json({
        ok: false,
        error: "kv_unavailable",
        detail: "getRedis_throw",
      });
    }

    if (!redis || typeof redis.get !== "function") {
      console.error("jobs/status redis missing or invalid:", redis);
      return res.status(503).json({
        ok: false,
        error: "kv_unavailable",
        detail: "redis_invalid",
      });
    }

    // 2) Key varyasyonları (prod’da bazen farklı yazılmış olabiliyor)
    const keysToTry = [
      `job:${job_id}`,
      `job_${job_id}`,
      `job:${job_id.replace(/^job_/, "")}`,
      `job:${job_id.replace(/^job-/, "")}`,
      `job:${job_id.replace(/^job/, "")}`,
    ];

    let raw = null;
    for (const k of keysToTry) {
      try {
        raw = await redis.get(k);
      } catch (e) {
        console.error("jobs/status redis.get failed:", { key: k, err: e });
        return res.status(503).json({
          ok: false,
          error: "kv_unavailable",
          detail: "redis_get_throw",
        });
      }
      if (raw) break;
    }

    if (!raw) return res.status(404).json({ ok: false, error: "job_not_found" });

    // 3) JSON parse patlamasın
    let job = null;
    if (typeof raw === "string") {
      try {
        job = JSON.parse(raw);
      } catch (e) {
        // raw JSON değilse bile endpoint çökmesin
        job = { raw };
      }
    } else {
      // Bazı client’lar object döndürebilir
      job = raw;
    }

    return res.status(200).json({ ok: true, job });
  } catch (err) {
    console.error("jobs/status fatal error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
