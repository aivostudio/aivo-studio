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

    // ✅ TopMediai ile gerçek üretimi başlat (worker yerine)
    const TOPMEDIAI_API_KEY = process.env.TOPMEDIAI_API_KEY;
    if (!TOPMEDIAI_API_KEY) {
      return safeJson(res, { ok: false, error: "missing_topmediai_api_key" }, 200);
    }

    // Not: TopMediai submit endpoint
    const topUrl = "https://api.topmediai.com/v2/submit";

    const tr = await fetch(topUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "accept": "application/json",
        "x-api-key": TOPMEDIAI_API_KEY,
      },
      body: JSON.stringify({
        is_auto: 1,
        model_version: body.model_version || "v3.5",
        prompt,
        lyrics: String(body.lyrics || "").trim(),
        title: String(body.title || "AIVO Music").slice(0, 80),
        instrumental: body.instrumental ? 1 : 0,
        continue_at: 0,
        continue_song_id: "",
        // debug/trace (TopMediai ignore edebilir)
        internal_job_id,
      }),
    });

    const ttext = await tr.text();
    const tjson = safeParseJson(ttext);

    if (!tr.ok || !tjson || tjson.ok === false) {
      // provider çalışmadıysa bile job açalım ama ERROR dönelim (UI boşa poll etmesin)
      return safeJson(res, {
        ok: false,
        error: "topmediai_generate_failed",
        topmediai_status: tr.status,
        sample: ttext.slice(0, 400),
      }, 200);
    }

    // ✅ provider_job_id TopMediai’den gelmeli (en kritik nokta) => song_id
    const provider_job_id = String(
      tjson.song_id ||
      tjson.data?.song_id ||
      tjson.result?.song_id ||
      tjson.job_id ||
      tjson.id ||
      ""
    ).trim();

    if (!provider_job_id) {
      return safeJson(res, {
        ok: false,
        error: "topmediai_missing_provider_job_id",
        sample: tjson,
      }, 200);
    }

    // KV keys
    const mapKey = `providers/music/${provider_job_id}.json`;
    const jobMetaKey = `jobs/${internal_job_id}/job.json`;
    const outputsIndexKey = `jobs/${internal_job_id}/outputs/index.json`;
    const jobKey = `job:${internal_job_id}`;
    const providerMapKey = `provider_map:${provider_job_id}`;

    // 1) provider -> internal mapping (status/finalize buradan bulacak)
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
        // provider debug (worker alanını bozmadan aynı yerde tutuyoruz)
        worker: {
          origin: "topmediai",
          resp: tjson,
        },
      })
    );

    // 3) job meta + job status
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

    // 4) outputs index boş başlasın (finalize dolduracak)
    await redis.set(outputsIndexKey, JSON.stringify({ outputs: [] }));

    // =========================================================
    // ✅ TEMP DEMO FINALIZE (pipeline testi)
    // R2’de hazır olan bir MP3’e bağlayıp output oluşturur.
    // Böylece status->audio.src dolar, kart "Hazır" olur.
    //
    // NOT: Bunu gerçek üretim bağlanınca kaldıracağız.
    // =========================================================
    try {
      const origin = getOrigin(req);

      // R2’de mevcut demo mp3 (senin yüklediğin dosya)
      const file_key = "/files/a1b2c3.mp3";

      await fetch(`${origin}/api/music/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider_job_id,
          internal_job_id,
          file_key,
          file_name: "demo.mp3",
          mime: "audio/mpeg",
        }),
      });
    } catch (e) {
      console.warn("[music.generate] TEMP finalize failed:", e);
      // TEMP: finalize patlasa bile generate cevabını döndürelim.
    }

    return safeJson(res, {
      ok: true,
      state: "queued",
      provider_job_id,
      internal_job_id,
      keys: { mapKey, jobMetaKey, outputsIndexKey, providerMapKey },
      worker: { ok: true },
    });
  } catch (err) {
    console.error("music/generate error:", err);
    return safeJson(res, { ok: false, error: "server_error", message: String(err?.message || err) }, 500);
  }
};
