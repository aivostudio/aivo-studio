// api/music/status.js
// Vercel route: Direct TopMediai v3 tasks poll + normalize to audio.src
// - Accepts: job_id (internal job_...) OR provider_job_id/song_id
// - If internal, reads Redis jobs/<internal>/job.json to get provider_song_ids
// - Calls TopMediai: GET /v3/music/tasks?ids=id1,id2
// - When status==0 and audio_url exists => data.audio.src set + completed

const { getRedis } = require("../_kv");

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return null; }
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
  res.setHeader("x-aivo-status-build", "status-direct-v3-topmediai-tasks-2026-02-13");

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

    let internal_job_id = isInternal ? raw : null;
    let provider_job_id = !isInternal ? raw : null; // (legacy) tek id gelirse
    let provider_song_ids = [];

    if (isInternal) {
      // Redis’ten job meta oku: jobs/<internal>/job.json
      const jobMetaKey = `jobs/${internal_job_id}/job.json`;
      const jobText = await redis.get(jobMetaKey);
      const jobObj = jobText ? safeJsonParse(jobText) : null;

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
        // tek id: song_id kabul et
        provider_song_ids = [String(raw)];
        provider_job_id = String(raw);
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

    const r = await fetch(url, {
      method: "GET",
      headers: {
        "accept": "application/json",
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
        upstream_preview: String(text || "").slice(0, 200),
      });
    }

    // ---------------------------------------------------------
    // 3) Normalize
    // ---------------------------------------------------------
    const arr = Array.isArray(top?.data) ? top.data : (Array.isArray(top?.data?.data) ? top.data.data : null);

    // tasks item shape expected:
    // { status: 0, audio_url: "https://...mp3", song_id: "..." }
    let mp3 = null;
    let outId = null;

    let anyFail = false;
    let allReady = true;

    if (Array.isArray(arr) && arr.length) {
      for (const item of arr) {
        const st = Number(item?.status);
        const urlMp3 = item?.audio_url || item?.audio || item?.mp3 || item?.url || null;

        // status==0 => ready (TopMediai support dediği)
        const ready = st === 0;
        if (!ready) allReady = false;

        // bazı sistemlerde fail kodları olabilir; geniş yakala
        if (st < 0 || String(item?.state || "").toUpperCase().includes("FAIL")) {
          anyFail = true;
        }

        if (!mp3 && ready && urlMp3) {
          mp3 = urlMp3;
          outId = item?.song_id || item?.id || provider_job_id;
        }
      }
    } else {
      allReady = false;
    }

    const data = {
      ok: true,
      provider: "topmediai",
      provider_job_id,
      provider_song_ids,
      internal_job_id: internal_job_id || null,
      state: "processing",
      status: "processing",
      topmediai: top,
    };

    if (anyFail) {
      data.state = "failed";
      data.status = "failed";
    } else if (mp3) {
      data.audio = { src: mp3, output_id: outId || String(provider_job_id) };
      data.state = "completed";
      data.status = "completed";
    } else {
      // processing
      data.state = allReady ? "completed" : "processing";
      data.status = allReady ? "completed" : "processing";
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
