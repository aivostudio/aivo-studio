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

function safeParseJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getOrigin(req) {
  const proto =
    (req.headers["x-forwarded-proto"] || "").toString().split(",")[0].trim() ||
    "https";
  const host =
    (req.headers["x-forwarded-host"] || "").toString().split(",")[0].trim() ||
    (req.headers.host || "").toString().trim();

  return host ? `${proto}://${host}` : "https://aivo.tr";
}

module.exports = async (req, res) => {
  try {
    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method !== "POST") {
      return safeJson(res, { ok: false, error: "method_not_allowed" }, 405);
    }

    const redis = getRedis();
    const body = req.body || {};
    const prompt = String(body.prompt || body.text || "").trim();

    if (!prompt) {
      return safeJson(res, { ok: false, error: "missing_prompt" }, 400);
    }

    // ✅ internal id bizde kalsın (UI + KV mapping için)
    const internal_job_id = `job_${uuidLike()}`;

    // ✅ Worker'ı BYPASS: TopMediai create'i direkt Vercel üzerinden çağır
    const origin = getOrigin(req);
    const providerCreateUrl = `${origin}/api/providers/topmediai/music/create`;

    let pr;
    try {
      pr = await fetch(providerCreateUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({ prompt }),
      });
    } catch (e) {
      return safeJson(
        res,
        {
          ok: false,
          error: "provider_create_fetch_failed",
          internal_job_id,
          detail: String(e?.message || e),
          provider_create_url: providerCreateUrl,
        },
        200
      );
    }

    const ptext = await pr.text();
    const pjson = safeParseJson(ptext);

    if (!pr.ok || !pjson || pjson.ok === false) {
      return safeJson(
        res,
        {
          ok: false,
          error: "provider_create_failed",
          internal_job_id,
          provider_status: pr.status,
          provider_create_url: providerCreateUrl,
          sample: String(ptext || "").slice(0, 1000),
          provider_response: pjson,
        },
        200
      );
    }

    // ✅ provider_job_id artık Vercel provider endpoint'ten gelmeli
    const provider_job_id = String(pjson.provider_job_id || pjson.job_id || pjson.id || "").trim();
    if (!provider_job_id) {
      return safeJson(
        res,
        {
          ok: false,
          error: "provider_missing_provider_job_id",
          internal_job_id,
          provider_create_url: providerCreateUrl,
          provider_response: pjson,
        },
        200
      );
    }

    // ✅ NEW: 2 song id (tracks ids)
    const provider_song_ids_raw =
      pjson.provider_song_ids ||
      pjson.providerSongIds ||
      pjson.song_ids ||
      pjson.songIds ||
      pjson?.topmediai?.data?.song_ids ||
      [];

    const provider_song_ids = Array.isArray(provider_song_ids_raw)
      ? provider_song_ids_raw.map((x) => String(x)).filter(Boolean)
      : [];

    // KV keys
    const mapKey = `providers/music/${provider_job_id}.json`;
    const jobMetaKey = `jobs/${internal_job_id}/job.json`;
    const outputsIndexKey = `jobs/${internal_job_id}/outputs/index.json`;
    const jobKey = `job:${internal_job_id}`;
    const providerMapKey = `provider_map:${provider_job_id}`;

    // 1) provider -> internal mapping (status/finalize buradan bulacak)
    await redis.set(
      providerMapKey,
      JSON.stringify({
        provider_job_id,
        internal_job_id,
        created_at: nowISO(),
        provider_song_ids: provider_song_ids.length ? provider_song_ids : undefined,
      })
    );

    // 2) provider meta (debug)
    await redis.set(
      mapKey,
      JSON.stringify({
        ok: true,
        kind: "music",
        provider_job_id,
        provider_song_ids: provider_song_ids.length ? provider_song_ids : undefined,
        internal_job_id,
        state: "queued",
        prompt: prompt || null,
        created_at: nowISO(),
        provider: {
          create_url: providerCreateUrl,
          resp: pjson,
        },
      })
    );

    // 3) job meta + job status
    const jobObj = {
      id: internal_job_id,
      kind: "music",
      provider_job_id,
      provider_song_ids: provider_song_ids.length ? provider_song_ids : undefined,
      status: "processing",
      state: "queued",
      prompt: prompt || null,
      created_at: nowISO(),
      updated_at: nowISO(),
      outputs: [],
    };

    await redis.set(jobMetaKey, JSON.stringify(jobObj));
    await redis.set(jobKey, JSON.stringify(jobObj));

    // 4) outputs index boş başlasın (finalize dolduracak)
    await redis.set(outputsIndexKey, JSON.stringify({ outputs: [] }));

    return safeJson(res, {
      ok: true,
      state: "queued",
      provider_job_id,
      provider_song_ids: provider_song_ids.length ? provider_song_ids : undefined,
      internal_job_id,
      keys: { mapKey, jobMetaKey, outputsIndexKey, providerMapKey },
      provider: { ok: true, create_url: providerCreateUrl },
    });
  } catch (err) {
    console.error("music/generate error:", err);
    return safeJson(
      res,
      { ok: false, error: "server_error", message: String(err?.message || err) },
      500
    );
  }
};
