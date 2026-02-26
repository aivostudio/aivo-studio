// api/music/status.js
// Vercel route: Direct TopMediai v3 tasks poll + normalize to outputs[]
// + NEW: when READY -> write outputs/status into Neon jobs (DB source-of-truth)

export const config = { runtime: "nodejs" };

const { getRedis } = require("../_kv");
const fetchFn = globalThis.fetch || require("node-fetch");
const { neon } = require("@neondatabase/serverless");

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

function getConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

// ✅ NEW: DB upsert (idempotent overwrite)
async function writeMusicResultToDB({ provider_job_id, internal_job_id, outputs, status }) {
  const conn = getConn();
  if (!conn) return { ok: false, error: "missing_db_env" };

  const sql = neon(conn);

  // jobs row’unu meta içinden yakalıyoruz:
  // - meta->>'provider_job_id' = '1338241'
  // - veya meta->>'internal_job_id' = 'job_....' (sende var)
  const outJson = Array.isArray(outputs) ? outputs : [];

  const rows = await sql`
    update jobs
    set
      status = ${String(status || "completed")},
      outputs = ${JSON.stringify(outJson)}::jsonb,
      updated_at = now()
    where deleted_at is null
      and app = 'music'
      and (
        meta->>'provider_job_id' = ${String(provider_job_id || "")}
        or meta->>'internal_job_id' = ${String(internal_job_id || "")}
      )
    returning id
  `;

  const updated = rows && rows.length ? String(rows[0].id) : null;
  return { ok: !!updated, job_id: updated };
}

module.exports = async (req, res) => {
  res.setHeader("x-aivo-status-build", "status-direct-v3-topmediai-tasks+dbwrite-2026-02-26");

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
        req.query.ids || // ids=id1,id2
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
    let provider_job_id = !isInternal && !looksLikeUUID ? raw : null;
    let provider_song_ids = [];

    async function readJobObjFromRedis(internalId) {
      if (!internalId) return null;

      const k1 = `jobs/${internalId}/job.json`;
      const t1 = await redis.get(k1);
      const o1 = t1 ? safeJsonParse(t1) : null;
      if (o1) return o1;

      const k2 = `job:${internalId}`;
      const t2 = await redis.get(k2);
      const o2 = t2 ? safeJsonParse(t2) : null;
      if (o2) return o2;

      return null;
    }

    if (isInternal || looksLikeUUID) {
      const jobObj = await readJobObjFromRedis(internal_job_id);

      provider_job_id = String(jobObj?.provider_job_id || "").trim() || provider_job_id;

      const idsRaw =
        jobObj?.provider_song_ids ||
        jobObj?.providerSongIds ||
        jobObj?.song_ids ||
        jobObj?.songIds ||
        [];

      provider_song_ids = Array.isArray(idsRaw) ? uniqStrings(idsRaw) : [];

      if (provider_song_ids.length === 0 && provider_job_id) {
        provider_song_ids = [String(provider_job_id)];
      }
    } else {
      if (raw.includes(",")) {
        provider_song_ids = uniqStrings(raw.split(","));
        provider_job_id = provider_song_ids[0] || provider_job_id;
      } else {
        const providerMapKey = `provider_map:${raw}`;
        const mapText = await redis.get(providerMapKey);
        const mapObj = mapText ? safeJsonParse(mapText) : null;

        if (mapObj?.internal_job_id) {
          internal_job_id = String(mapObj.internal_job_id).trim() || null;

          const mapIdsRaw =
            mapObj?.provider_song_ids ||
            mapObj?.providerSongIds ||
            mapObj?.song_ids ||
            mapObj?.songIds ||
            [];

          provider_song_ids = Array.isArray(mapIdsRaw) ? uniqStrings(mapIdsRaw) : [];
          provider_job_id = String(mapObj?.provider_job_id || "").trim() || String(raw);

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

            provider_job_id = String(jobObj?.provider_job_id || "").trim() || provider_job_id;
          }

          if (provider_song_ids.length === 0 && provider_job_id) {
            provider_song_ids = [String(provider_job_id)];
          }
        } else {
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
        const urlMp3 = item?.audio_url || item?.audio || item?.mp3 || item?.url || null;

        const ready = st === 0;

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
              app: "music",
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
      db: null, // ✅ NEW
    };

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
      data.state = "completed";
      data.status = "completed";

      // ✅ NEW: WRITE TO NEON so /api/jobs/list?app=music shows it in Chrome too
      try {
        data.db = await writeMusicResultToDB({
          provider_job_id,
          internal_job_id,
          outputs,
          status: "completed",
        });
      } catch (e) {
        data.db = { ok: false, error: "db_write_failed", detail: String(e?.message || e) };
      }
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
