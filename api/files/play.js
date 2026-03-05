// api/files/play.js
export const config = { runtime: "nodejs" };

const { getRedis } = require("../_kv");

function safeJsonParse(x) {
  if (!x) return null;
  if (typeof x === "object") return x; // bazı KV wrapper'ları object döndürebiliyor
  try {
    return JSON.parse(x);
  } catch {
    return null;
  }
}

async function safeRedisGet(redis, key) {
  const v = await redis.get(key);
  // bazı KV wrapper’larında {result:"..."} gelebiliyor
  if (v && typeof v === "object" && "result" in v) return v.result;
  return v;
}

function getBaseUrl(req) {
  const proto =
    (req.headers["x-forwarded-proto"] ? String(req.headers["x-forwarded-proto"]) : "")
      .split(",")[0]
      .trim() || "https";
  const host =
    (req.headers["x-forwarded-host"] ? String(req.headers["x-forwarded-host"]) : "").split(",")[0].trim() ||
    (req.headers.host ? String(req.headers.host) : "");
  return `${proto}://${host}`;
}

module.exports = async (req, res) => {
  res.setHeader("x-aivo-files-play-build", "files-play-v1-redirect-to-media-proxy-2026-03-05");

  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return res.status(405).send("method_not_allowed");
    }

    const job_id = String(req.query.job_id || "").trim();
    const output_id = String(req.query.output_id || "").trim();

    if (!job_id || !output_id) {
      return res.status(400).send("missing_job_id_or_output_id");
    }

    const redis = getRedis();

    // finalize.js burada yazıyor:
    // outputMetaKey = `jobs/${internal_job_id}/outputs/${output_id}.json`
    const metaKey = `jobs/${job_id}/outputs/${output_id}.json`;
    const raw = await safeRedisGet(redis, metaKey);
    const meta = safeJsonParse(raw);

   const mp3_url = String(meta?.mp3_url || "").trim();
if (!mp3_url) {
  // DEBUG: KV’de gerçekten ne var görelim
  const rawType = raw === null ? "null" : Array.isArray(raw) ? "array" : typeof raw;

  return res.status(200).json({
    ok: false,
    error: "missing_mp3_url_in_meta",
    meta_key: metaKey,
    raw_type: rawType,
    raw_preview: rawType === "string" ? String(raw).slice(0, 500) : raw,
    meta: meta || null,
    meta_keys: meta && typeof meta === "object" ? Object.keys(meta).slice(0, 50) : [],
  });
}

    // same-origin olsun diye media proxy üzerinden yönlendiriyoruz
    const base = getBaseUrl(req);
    const redirectUrl = `${base}/api/media/proxy?url=${encodeURIComponent(mp3_url)}`;

    res.setHeader("cache-control", "no-store");
    res.setHeader("location", redirectUrl);
    return res.status(302).end();
  } catch (err) {
    console.error("api/files/play error:", err);
    return res.status(500).send("server_error");
  }
};
