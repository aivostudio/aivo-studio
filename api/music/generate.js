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
  try { return JSON.parse(s); } catch { return null; }
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

    // ✅ internal id bizde kalsın (R2 path /files/play bununla çalışıyor)
    const internal_job_id = `job_${uuidLike()}`;

    // ✅ worker’a gerçek üretimi başlat
    const workerOrigin =
      process.env.ARCHIVE_WORKER_ORIGIN ||
      "https://aivo-archive-worker.aivostudioapp.workers.dev";

    const workerUrl = `${workerOrigin}/api/music/generate`;

    const wr = await fetch(workerUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({
        prompt,
        // ✅ worker tarafında mapping/track için gönderiyoruz
        internal_job_id,
      }),
    });

    const wtext = await wr.text();
    const wjson = safeParseJson(wtext);

    if (!wr.ok || !wjson || wjson.ok === false) {
      // internal job'ı UI'ya döndürelim ki tek kart basıp düzgün hata gösterebilsin
      return safeJson(res, {
        ok: false,
        error: "worker_generate_failed",
        state: "failed",
        provider_job_id: null,
        internal_job_id,
        worker_status: wr.status,
        sample: wtext.slice(0, 400),
      }, 200);
    }

    // ✅ provider_job_id worker’dan gelmeli (en kritik nokta)
    const provider_job_id = String(
      wjson.provider_job_id ||
      wjson.providerJobId ||
      wjson.job_id ||
      wjson.id ||
      ""
    ).trim();

    if (!provider_job_id) {
      return safeJson(res, {
        ok: false,
        error: "worker_missing_provider_job_id",
        sample: wjson,
      }, 200);
    }

    // ✅ NEW: TopMediai v3 -> 2 song id (worker bunu döndürecek)
    const provider_song_ids_raw =
      wjson.provider_song_ids ||
      wjson.providerSongIds ||
      wjson.song_ids ||
      wjson.songIds ||
      wjson?.topmediai?.data?.song_ids ||
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
        // ✅ NEW
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
        // ✅ NEW
        provider_song_ids: provider_song_ids.length ? provider_song_ids : undefined,
        internal_job_id,
        state: "queued",
        prompt: prompt || null,
        created_at: nowISO(),
        // worker debug
        worker: {
          origin: workerOrigin,
          resp: wjson,
        },
      })
    );

    // 3) job meta + job status
    const jobObj = {
      id: internal_job_id,
      kind: "music",
      provider_job_id,
      // ✅ NEW
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
      // ✅ NEW: UI/worker/debug için dönelim
      provider_song_ids: provider_song_ids.length ? provider_song_ids : undefined,
      internal_job_id,
      keys: { mapKey, jobMetaKey, outputsIndexKey, providerMapKey },
      worker: { ok: true },
    });
  } catch (err) {
    console.error("music/generate error:", err);
    return safeJson(res, { ok: false, error: "server_error", message: String(err?.message || err) }, 500);
  }
};
