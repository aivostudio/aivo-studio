// api/jobs/status.js
const { getRedis } = require("../_kv");

function parseMaybeJSON(raw) {
  // Upstash/REST gibi client'lar bazen { data: ... } döndürebiliyor
  const v = raw && typeof raw === "object" && "data" in raw ? raw.data : raw;

  if (v == null) return null;

  // Zaten object ise parse etme
  if (typeof v === "object") return v;

  // Buffer / string normalize
  const s = Buffer.isBuffer(v) ? v.toString("utf8") : String(v);

  // Bazı clientlar düz string döndürebilir; JSON değilse fallback
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

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

    const job = parseMaybeJSON(raw);
    if (!job) {
      console.error("jobs/status invalid redis payload:", {
        type: typeof raw,
        keys: raw && typeof raw === "object" ? Object.keys(raw) : null,
        raw,
      });
      return res.status(500).json({ ok: false, error: "job_payload_invalid" });
    }

    return res.status(200).json({ ok: true, job });
  } catch (err) {
    console.error("jobs/status error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
