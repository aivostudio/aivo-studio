// api/music/status.js
// Vercel route: Direct TopMediai v3 tasks poll + normalize to outputs[]
// + NEW: when READY -> write outputs/status into Neon jobs (DB source-of-truth)
// FIX(2026-02-26): UUID internal_job_id resolve MUST work even if Redis miss.
//   - If job_id looks like UUID: try Redis, if not found -> read from Neon jobs(id) and pull meta.provider_job_id + meta.provider_song_ids
//   - DB write: match by jobs.id (internal_job_id) OR meta provider keys

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

function looksLikeUUID(x) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(x || "").trim());
}

/* ---------------- DB helpers ---------------- */

async function readJobMetaFromDB(internalId) {
  const conn = getConn();
  if (!conn) return null;

  const sql = neon(conn);

  // We only need meta (and optionally outputs) to resolve provider ids.
  // jobs.id is UUID (Neon), app=music guard keeps it safe.
  const rows = await sql`
    select id, app, status, meta, outputs
    from jobs
    where deleted_at is null
      and app = 'music'
      and id = ${String(internalId)}
    limit 1
  `;

  if (!rows || !rows.length) return null;

  const row = rows[0] || {};
  const meta = row.meta || {};
  const outputs = row.outputs || [];

  // provider_song_ids could be in meta OR infer from outputs meta.trackId
  const provider_job_id = String(
    meta.provider_job_id ||
      meta.providerJobId ||
      meta.song_id ||
      meta.songId ||
      ""
  ).trim();

  const idsRaw =
    meta.provider_song_ids ||
    meta.providerSongIds ||
    meta.song_ids ||
    meta.songIds ||
    [];

  let provider_song_ids = Array.isArray(idsRaw) ? uniqStrings(idsRaw) : [];

  if (!provider_song_ids.length && Array.isArray(outputs) && outputs.length) {
    // try infer from outputs[].meta.trackId
    const inferred = [];
    for (const o of outputs) {
      const tid = o?.meta?.trackId || o?.meta?.track_id || null;
      if (tid != null) inferred.push(String(tid));
    }
    provider_song_ids = uniqStrings(inferred);
  }

  return {
    id: String(row.id || internalId),
    provider_job_id: provider_job_id || null,
    provider_song_ids,
    meta,
    outputs,
    status: row.status || null,
  };
}

// ✅ DB upsert (idempotent overwrite)
async function writeMusicResultToDB({ provider_job_id, internal_job_id, outputs, status }) {
  const conn = getConn();
  if (!conn) return { ok: false, error: "missing_db_env" };

  const sql = neon(conn);

  const outJson = Array.isArray(outputs) ? outputs : [];
  const internalId = String(internal_job_id || "").trim();
  const providerId = String(provider_job_id || "").trim();

  const rows = await sql`
    update jobs
    set
      status = ${String(status || "completed")},
      outputs = ${JSON.stringify(outJson)}::jsonb,
      updated_at = now()
    where deleted_at is null
      and app = 'music'
      and (
        -- ✅ FIX: if internal_job_id is a UUID, match jobs.id directly
        id = ${internalId}
        or meta->>'provider_job_id' = ${providerId}
        or meta->>'internal_job_id' = ${internalId}
      )
    returning id
  `;

  const updated = rows && rows.length ? String(rows[0].id) : null;
  return { ok: !!updated, job_id: updated };
}

/* ---------------- handler ---------------- */

module.exports = async (req, res) => {
  res.setHeader("x-aivo-status-build", "status-direct-v3-topmediai-tasks+dbwrite+uuiddbresolve-2026-02-26");

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
    const isUuid = looksLikeUUID(raw);

    let internal_job_id = (isInternal || isUuid) ? raw : null;
    let provider_job_id = (!isInternal && !isUuid) ? raw : null;
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

    if (isInternal || isUuid) {
      // 1A) try Redis first
      const jobObj = await readJobObjFromRedis(internal_job_id);

      if (jobObj) {
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
      } else if (isUuid) {
        // ✅ FIX: if Redis miss and UUID -> resolve from Neon DB by jobs.id
        const dbRow = await readJobMetaFromDB(internal_job_id);
        if (dbRow) {
          provider_job_id = String(dbRow.provider_job_id || "").trim() || provider_job_id;
          provider_song_ids = Array.isArray(dbRow.provider_song_ids) ? uniqStrings(dbRow.provider_song_ids) : [];

          if (provider_song_ids.length === 0 && provider_job_id) {
            provider_song_ids = [String(provider_job_id)];
          }
        }
      }
    } else {
      // raw is provider-ish
      if (raw.includes(",")) {
        provider_song_ids = uniqStrings(raw.split(","));
        provider_job_id = provider_song_ids[0] || provider_job_id;
      } else {
        // provider_map: provider_job_id -> internal_job_id + ids
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

          // try enrich from redis internal job object
          if (internal_job_id) {
            const jobObj = await readJobObjFromRedis(internal_job_id);

            if (jobObj) {
              const idsRaw =
                jobObj?.provider_song_ids ||
                jobObj?.providerSongIds ||
                jobObj?.song_ids ||
                jobObj?.songIds ||
                [];

              const jobIds = Array.isArray(idsRaw) ? uniqStrings(idsRaw) : [];
              if (jobIds.length) provider_song_ids = uniqStrings([...(provider_song_ids || []), ...jobIds]);

              provider_job_id = String(jobObj?.provider_job_id || "").trim() || provider_job_id;
            } else if (looksLikeUUID(internal_job_id)) {
              // if internal_job_id is uuid, try db resolve
              const dbRow = await readJobMetaFromDB(internal_job_id);
              if (dbRow) {
                const dbIds = Array.isArray(dbRow.provider_song_ids) ? uniqStrings(dbRow.provider_song_ids) : [];
                if (dbIds.length) provider_song_ids = uniqStrings([...(provider_song_ids || []), ...dbIds]);
                provider_job_id = String(dbRow.provider_job_id || "").trim() || provider_job_id;
              }
            }
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
      db: null,
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

      // ✅ WRITE TO NEON so /api/jobs/list?app=music shows it in Chrome too
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
