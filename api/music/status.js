// api/music/status.js
// Vercel route: Direct TopMediai v3 tasks poll + normalize to audio.src
// - Accepts: job_id (internal job_...) OR provider_job_id/song_id OR ids=id1,id2
// - If internal, reads Redis jobs/<internal>/job.json to get provider_song_ids
// - Calls TopMediai: GET /v3/music/tasks?ids=id1,id2
// - Normalizes MULTI-TRACK output to: outputs[] + backward compat audio.src

const { getRedis } = require("../_kv");
const fetchFn = globalThis.fetch || require("node-fetch");

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();
  for (const x of arr || []) {
    const s = String(x || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader("x-aivo-status-build", "status-direct-v3-topmediai-tasks-2026-02-23");

  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const raw = String(
      req.query.job_id ||
        req.query.provider_job_id ||
        req.query.providerJobId ||
        req.query.song_id ||
        req.query.songId ||
        req.query.ids || // opsiyonel: ids=id1,id2
        ""
    ).trim();

    if (!raw) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    const redis = getRedis();

 // ---------------------------------------------------------
// 1) Resolve song ids
// ---------------------------------------------------------
const isInternal = raw.startsWith("job_");

// ✅ NEW: Neon jobs.id gibi UUID gelirse bunu da internal kabul et
const looksLikeUUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

let internal_job_id = isInternal || looksLikeUUID ? raw : null;
let provider_job_id = !isInternal && !looksLikeUUID ? raw : null; // tek id gelirse
let provider_song_ids = [];

// küçük helper: internal id'den redis job obj bul (iki farklı key ihtimali için)
async function readJobObjFromRedis(internalId) {
  if (!internalId) return null;

  // 1) canonical path
  const k1 = `jobs/${internalId}/job.json`;
  const t1 = await redis.get(k1);
  const o1 = t1 ? safeJsonParse(t1) : null;
  if (o1) return o1;

  // 2) legacy / alternate key
  const k2 = `job:${internalId}`;
  const t2 = await redis.get(k2);
  const o2 = t2 ? safeJsonParse(t2) : null;
  if (o2) return o2;

  return null;
}

if (isInternal || looksLikeUUID) {
  // ✅ Redis’ten job meta oku (jobs/<internal>/job.json veya job:<internal>)
  const jobObj = await readJobObjFromRedis(internal_job_id);

  provider_job_id = String(jobObj?.provider_job_id || "").trim() || provider_job_id;

  const idsRaw =
    jobObj?.provider_song_ids ||
    jobObj?.providerSongIds ||
    jobObj?.song_ids ||
    jobObj?.songIds ||
    [];

  provider_song_ids = Array.isArray(idsRaw) ? uniqStrings(idsRaw) : [];

  // fallback: provider_song_ids yoksa provider_job_id’yi song id gibi kullan
  if (provider_song_ids.length === 0 && provider_job_id) {
    provider_song_ids = [String(provider_job_id)];
  }
} else {
  // raw virgüllü geldiyse (ids)
  if (raw.includes(",")) {
    provider_song_ids = uniqStrings(raw.split(","));
    provider_job_id = provider_song_ids[0] || provider_job_id;
  } else {
    // ✅ provider_job_id ile gelindiyse önce provider_map'ten internal + song_ids çöz
    const providerMapKey = `provider_map:${raw}`;
    const mapText = await redis.get(providerMapKey);
    const mapObj = mapText ? safeJsonParse(mapText) : null;

    if (mapObj?.internal_job_id) {
      internal_job_id = String(mapObj.internal_job_id).trim() || null;

      // 1) map'ten song_ids al
      const mapIdsRaw =
        mapObj?.provider_song_ids ||
        mapObj?.providerSongIds ||
        mapObj?.song_ids ||
        mapObj?.songIds ||
        [];

      provider_song_ids = Array.isArray(mapIdsRaw) ? uniqStrings(mapIdsRaw) : [];
      provider_job_id =
        String(mapObj?.provider_job_id || "").trim() || String(raw);

      // 2) job meta varsa, daha canonical olanı merge et
      if (internal_job_id) {
        const jobObj = await readJobObjFromRedis(internal_job_id);

        const idsRaw =
          jobObj?.provider_song_ids ||
          jobObj?.providerSongIds ||
          jobObj?.song_ids ||
          jobObj?.songIds ||
          [];

        const jobIds = Array.isArray(idsRaw) ? uniqStrings(idsRaw) : [];
        if (jobIds.length) {
          provider_song_ids = uniqStrings([...(provider_song_ids || []), ...jobIds]);
        }

        provider_job_id =
          String(jobObj?.provider_job_id || "").trim() || provider_job_id;
      }

      // 3) fallback
      if (provider_song_ids.length === 0 && provider_job_id) {
        provider_song_ids = [String(provider_job_id)];
      }
    } else {
      // tek id: song_id kabul et (eski davranış)
      provider_song_ids = [String(raw)];
      provider_job_id = String(raw);
    }
  }
}

provider_song_ids = uniqStrings(provider_song_ids);

if (provider_song_ids.length === 0) {
  return res.status(200).json({
    ok: false,
    error: "missing_provider_song_ids",
    state: "processing",
    status: "processing",
    provider_job_id: provider_job_id || null,
    internal_job_id: internal_job_id || null,
  });
}
    // ---------------------------------------------------------
    // 2) Call TopMediai v3 tasks
    // ---------------------------------------------------------
    const KEY = process.env.TOPMEDIAI_API_KEY;
    if (!KEY) {
      return res.status(200).json({
        ok: false,
        error: "missing_topmediai_api_key",
        state: "processing",
        status: "processing",
        provider_job_id,
        provider_song_ids,
        internal_job_id,
      });
    }

    const idsParam = provider_song_ids.join(",");
    const url = `https://api.topmediai.com/v3/music/tasks?ids=${encodeURIComponent(idsParam)}`;

    const r = await fetchFn(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-key": KEY,
      },
    });

    const text = await r.text();
    const top = safeJsonParse(text);

    if (!top) {
      return res.status(200).json({
        ok: false,
        error: "upstream_non_json",
        state: "processing",
        status: "processing",
        provider_job_id,
        provider_song_ids,
        internal_job_id,
        upstream_status: r.status,
        upstream_preview: String(text || "").slice(0, 400),
      });
    }

    // ---------------------------------------------------------
    // 3) Normalize (MULTI-TRACK)
    // ---------------------------------------------------------
    const arr = Array.isArray(top?.data)
      ? top.data
      : Array.isArray(top?.data?.data)
      ? top.data.data
      : null;

    let anyFail = false;
    let anyReady = false;

    const outputs = [];

    if (Array.isArray(arr) && arr.length) {
      for (const item of arr) {
        const st = Number(item?.status);

        const trackId = String(item?.song_id || item?.id || "").trim() || null;
        const urlMp3 =
          item?.audio_url || item?.audio || item?.mp3 || item?.url || null;

        // status==0 => ready (TopMediai’de)
        const ready = st === 0;

        // fail kodları (geniş yakala)
        if (st < 0 || String(item?.state || "").toUpperCase().includes("FAIL")) {
          anyFail = true;
        }

        if (ready && urlMp3) {
          anyReady = true;
          outputs.push({
            type: "audio",
            url: urlMp3,
            meta: {
              provider: "topmediai",
              trackId: trackId || null,
              status: st,
            },
          });
        }
      }
    }

    const data = {
      ok: true,
      provider: "topmediai",
      provider_job_id,
      provider_song_ids,
      internal_job_id: internal_job_id || null,
      state: "processing",
      status: "processing",
      outputs,
      topmediai: top,
    };

    // Backward-compat: eski panel hâlâ data.audio.src arıyorsa diye
    if (outputs.length) {
      data.audio = {
        src: outputs[0].url,
        output_id: outputs[0]?.meta?.trackId || String(provider_job_id),
      };
    }

    if (anyFail) {
      data.state = "failed";
      data.status = "failed";
    } else if (anyReady) {
      // en az 1 parça hazırsa completed diyelim (UI “hazır” görsün)
      data.state = "completed";
      data.status = "completed";
    } else {
      data.state = "processing";
      data.status = "processing";
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error("api/music/status error:", err);
    return res.status(200).json({
      ok: false,
      error: "proxy_error",
      state: "processing",
      status: "processing",
      detail: String(err?.message || err),
    });
  }
};
