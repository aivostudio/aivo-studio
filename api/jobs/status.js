// api/jobs/status.js
const { getRedis } = require("../_kv");

module.exports = async (req, res) => {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const redis = getRedis();
    const job_id = String(req.query.job_id || "").trim();

    if (!job_id) return res.status(400).json({ ok: false, error: "job_id_required" });

    const raw = await redis.get(`job:${job_id}`);
    if (!raw) return res.status(404).json({ ok: false, error: "job_not_found" });

    const job = JSON.parse(raw);
    return res.status(200).json({ ok: true, job });
  } catch (err) {
    console.error("jobs/status error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
