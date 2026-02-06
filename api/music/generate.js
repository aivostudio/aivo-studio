// api/music/generate.js
const { getRedis } = require("../_kv");

function nowISO() {
  return new Date().toISOString();
}

function uuidLike() {
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeJson(res, obj, code = 200) {
  return res.status(code).json(obj);
}

module.exports = async (req, res) => {
  try {
    // CORS/preflight
    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method !== "POST") {
      return safeJson(res, { ok: false, error: "method_not_allowed" }, 405);
    }

    const redis = getRedis();
    const body = req.body || {};

    // UI bazen prompt gönderiyor, bazen boş gelebilir
    const prompt = String(body.prompt || body.text || "").trim();

    // id’ler
    const internal_job_id = `job_${uuidLike()}`;
    const provider_job_id = `prov_music_${uuidLike()}`;

    // KV keys (UI debug için)
    const mapKey = `providers/music/${provider_job_id}.json`;
    const jobMetaKey = `jobs/${internal_job_id}/job.json`;
    const outputsIndexKey = `jobs/${internal_job_id}/outputs/index.json`;
    const jobKey = `job:${internal_job_id}`;
    const providerMapKey = `provider_map:${provider_job_id}`;

    // 1) provider -> internal mapping (status/finalize buradan buluyor)
    await redis.set(
      providerMapKey,
      JSON.stringify({ provider_job_id, internal_job_id, created_at: nowISO() })
    );

    // 2) provider meta (debug)
    await redis.set(
      mapKey,
      JSON.stringify({
        ok: true,
        kind: "music",
        provider_job_id,
        internal_job_id,
        state: "queued",
        prompt: prompt || null,
        created_at: nowISO(),
      })
    );

    // 3) job meta + job status (status.js bunu okuyor)
    const jobObj = {
      id: internal_job_id,
      kind: "music",
      provider_job_id,
      status: "processing",
      state: "queued",
      prompt: prompt || null,
      created_at: nowISO(),
      updated_at: nowISO(),
      outputs: [],
    };

    await redis.set(jobMetaKey, JSON.stringify(jobObj));
    await redis.set(jobKey, JSON.stringify(jobObj));

    // 4) outputs index boş başlasın
    await redis.set(outputsIndexKey, JSON.stringify({ outputs: [] }));

    // TODO: Burada gerçek motor kuyruğuna gönderme olacak (şimdilik sadece job açıyoruz)

    return safeJson(res, {
      ok: true,
      state: "queued",
      provider_job_id,
      internal_job_id,
      keys: { mapKey, jobMetaKey, outputsIndexKey },
    });
  } catch (err) {
    console.error("music/generate error:", err);
    return safeJson(res, { ok: false, error: "server_error" }, 500);
  }
};
