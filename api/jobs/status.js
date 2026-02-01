/********************  FILE: /api/jobs/status.js  ********************/
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const job_id = String(req.query.job_id || "").trim();
    if (!job_id) return res.status(400).json({ ok: false, error: "job_id_required" });

    // KV/Redis guard (KV yoksa 500 spam yerine kontrollü cevap)
    let redis = null;
    try {
      redis = getRedis && getRedis();
    } catch (e) {
      console.error("jobs/status getRedis failed:", e);
      return res.status(503).json({ ok: false, error: "kv_unavailable" });
    }

    if (!redis || typeof redis.get !== "function") {
      return res.status(503).json({ ok: false, error: "kv_unavailable" });
    }

    const raw = await redis.get(`job:${job_id}`);
    if (!raw) return res.status(404).json({ ok: false, error: "job_not_found" });

    let job = null;
    try {
      job = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      console.error("jobs/status JSON.parse failed:", e);
      return res.status(500).json({ ok: false, error: "bad_job_payload" });
    }

    return res.status(200).json({ ok: true, job });
  } catch (err) {
    console.error("jobs/status error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
