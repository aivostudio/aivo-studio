const { neon } = require("@neondatabase/serverless");
const { getRedis } = require("../_kv");
const fetchFn = globalThis.fetch || require("node-fetch");

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

function safeJsonParse(s) {
  if (s && typeof s === "object") return s;
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

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return null;
  }
}

function getBaseUrl(req) {
  const proto =
    (req.headers["x-forwarded-proto"]
      ? String(req.headers["x-forwarded-proto"])
      : ""
    )
      .split(",")[0]
      .trim() || "https";

  const host =
    (req.headers["x-forwarded-host"]
      ? String(req.headers["x-forwarded-host"])
      : "") ||
    (req.headers.host ? String(req.headers.host) : "");

  return `${proto}://${host}`;
}

function toProxyUrl(req, rawUrl) {
  const base = getBaseUrl(req);
  const u = String(rawUrl || "").trim();
  if (!u) return null;
  return `${base}/api/media/proxy?url=${encodeURIComponent(u)}`;
}

async function readJobObjFromDB(internalId) {
  const conn = pickConn();
  if (!conn || !internalId) return null;

  try {
    const sql = neon(conn);

    const rows = await sql`
      select request_id, meta
      from jobs
      where meta->>'internal_job_id' = ${internalId}
      order by created_at desc
      limit 1
    `;

    const row = rows?.[0];
    if (!row) return null;

    const provider_job_id = row.request_id ? String(row.request_id) : "";
    const meta = row.meta || {};

    const idsRaw =
      meta.provider_song_ids ||
      meta.providerSongIds ||
      meta.song_ids ||
      meta.songIds ||
      [];

    const provider_song_ids = Array.isArray(idsRaw)
      ? idsRaw.map((x) => String(x)).filter(Boolean)
      : [];

    return {
      provider_job_id: provider_job_id || null,
      provider_song_ids: provider_song_ids.length ? provider_song_ids : null,
    };
  } catch {
    return null;
  }
}

async function readRedisJson(redis, key) {
  try {
    const raw = await redis.get(key);
    const normalized =
      raw && typeof raw === "object" && raw.result ? raw.result : raw;
    return normalized ? safeJsonParse(normalized) : null;
  } catch {
    return null;
  }
}

async function readJobObjFromRedis(redis, internalId) {
  if (!internalId) return null;

  const fromJobsPath = await readRedisJson(redis, `jobs/${internalId}/job.json`);
  if (fromJobsPath) return fromJobsPath;

  const fromJobKey = await readRedisJson(redis, `job:${internalId}`);
  if (fromJobKey) return fromJobKey;

  return null;
}

module.exports = async (req, res) => {
  res.setHeader(
    "x-aivo-status-build",
    "music-status-clean-v2-same-origin-proxy-all-tracks-ready"
  );

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
        req.query.ids ||
        ""
    ).trim();

    if (!raw) {
      return res.status(400).json({ ok: false, error: "missing_job_id" });
    }

    const redis = getRedis();

    const isInternal = raw.startsWith("job_");
    const looksLikeUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        raw
      );

    let internal_job_id = isInternal || looksLikeUUID ? raw : null;
    let provider_job_id = !isInternal && !looksLikeUUID ? raw : null;
    let provider_song_ids = [];

    if (isInternal || looksLikeUUID) {
      const jobObj = await readJobObjFromRedis(redis, internal_job_id);

      if (jobObj) {
        provider_job_id =
          String(jobObj?.provider_job_id || "").trim() || provider_job_id;

        const idsRaw =
          jobObj?.provider_song_ids ||
          jobObj?.providerSongIds ||
          jobObj?.song_ids ||
          jobObj?.songIds ||
          [];

        provider_song_ids = Array.isArray(idsRaw) ? uniqStrings(idsRaw) : [];
      }

      if (!provider_job_id || provider_song_ids.length === 0) {
        const dbObj = await readJobObjFromDB(internal_job_id);
        if (dbObj) {
          provider_job_id =
            String(dbObj?.provider_job_id || "").trim() || provider_job_id;

          const dbIds = Array.isArray(dbObj?.provider_song_ids)
            ? uniqStrings(dbObj.provider_song_ids)
            : [];

          if (dbIds.length) provider_song_ids = dbIds;
        }
      }

      if ((!provider_job_id || provider_song_ids.length === 0) && internal_job_id) {
        const internalMap = await readRedisJson(redis, `internal_map:${internal_job_id}`);
        if (internalMap) {
          provider_job_id =
            String(internalMap?.provider_job_id || "").trim() || provider_job_id;

          const mapIdsRaw =
            internalMap?.provider_song_ids ||
            internalMap?.providerSongIds ||
            internalMap?.song_ids ||
            internalMap?.songIds ||
            [];

          const mapIds = Array.isArray(mapIdsRaw) ? uniqStrings(mapIdsRaw) : [];
          if (mapIds.length) provider_song_ids = mapIds;
        }
      }

      if (provider_song_ids.length === 0 && provider_job_id) {
        provider_song_ids = [String(provider_job_id)];
      }
    } else {
      if (raw.includes(",")) {
        provider_song_ids = uniqStrings(raw.split(","));
        provider_job_id = provider_song_ids[0] || provider_job_id;
      } else {
        const providerMap = await readRedisJson(redis, `provider_map:${raw}`);

        if (providerMap?.internal_job_id) {
          internal_job_id =
            String(providerMap.internal_job_id || "").trim() || null;
          provider_job_id =
            String(providerMap.provider_job_id || "").trim() || String(raw);

          const mapIdsRaw =
            providerMap?.provider_song_ids ||
            providerMap?.providerSongIds ||
            providerMap?.song_ids ||
            providerMap?.songIds ||
            [];

          provider_song_ids = Array.isArray(mapIdsRaw)
            ? uniqStrings(mapIdsRaw)
            : [];

          if (internal_job_id) {
            const jobObj = await readJobObjFromRedis(redis, internal_job_id);

            if (jobObj) {
              const jobIdsRaw =
                jobObj?.provider_song_ids ||
                jobObj?.providerSongIds ||
                jobObj?.song_ids ||
                jobObj?.songIds ||
                [];

              const jobIds = Array.isArray(jobIdsRaw)
                ? uniqStrings(jobIdsRaw)
                : [];

              if (jobIds.length) {
                provider_song_ids = uniqStrings([
                  ...(provider_song_ids || []),
                  ...jobIds,
                ]);
              }

              provider_job_id =
                String(jobObj?.provider_job_id || "").trim() || provider_job_id;
            }

            if ((!provider_job_id || provider_song_ids.length === 0) && internal_job_id) {
              const internalMap = await readRedisJson(
                redis,
                `internal_map:${internal_job_id}`
              );

              if (internalMap) {
                provider_job_id =
                  String(internalMap?.provider_job_id || "").trim() ||
                  provider_job_id;

                const internalIdsRaw =
                  internalMap?.provider_song_ids ||
                  internalMap?.providerSongIds ||
                  internalMap?.song_ids ||
                  internalMap?.songIds ||
                  [];

                const internalIds = Array.isArray(internalIdsRaw)
                  ? uniqStrings(internalIdsRaw)
                  : [];

                if (internalIds.length) {
                  provider_song_ids = uniqStrings([
                    ...(provider_song_ids || []),
                    ...internalIds,
                  ]);
                }
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
    const url = `https://api.topmediai.com/v3/music/tasks?ids=${encodeURIComponent(
      idsParam
    )}`;

    const upstreamRes = await fetchFn(url, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-key": KEY,
      },
    });

    const upstreamText = await upstreamRes.text();
    const top = safeJsonParse(upstreamText);

    if (!top) {
      return res.status(200).json({
        ok: false,
        error: "upstream_non_json",
        state: "processing",
        status: "processing",
        provider_job_id,
        provider_song_ids,
        internal_job_id,
        upstream_status: upstreamRes.status,
        upstream_preview: String(upstreamText || "").slice(0, 400),
      });
    }

    const arr = Array.isArray(top?.data)
      ? top.data
      : Array.isArray(top?.data?.data)
      ? top.data.data
      : [];

    const READY_STATUSES = new Set([0, 2]);
    let anyFail = false;

    const readyOutputs = [];
    const seenReadyTrackIds = new Set();

    for (const item of arr) {
      const st = Number(item?.status);
      const stateText = String(item?.state || "").toUpperCase();
      const trackId = String(item?.song_id || item?.id || "").trim() || null;
      const rawAudioUrl =
        item?.audio_url || item?.audio || item?.mp3 || item?.url || null;

      if (st < 0 || stateText.includes("FAIL")) {
        anyFail = true;
      }

      const isReady =
        !!rawAudioUrl && (READY_STATUSES.has(st) || !Number.isFinite(st));

      if (!isReady || !trackId) continue;

      seenReadyTrackIds.add(trackId);

      readyOutputs.push({
        type: "audio",
        url: toProxyUrl(req, rawAudioUrl),
        meta: {
          provider: "topmediai",
          trackId,
          status: st,
          audio_url: rawAudioUrl,
          archive_url: null,
          archived_at: null,
          duration:
            typeof item?.duration === "number" ? item.duration : null,
        },
      });
    }

    const expectedTrackIds = uniqStrings(provider_song_ids);
    const allReady =
      expectedTrackIds.length > 0 &&
      expectedTrackIds.every((id) => seenReadyTrackIds.has(String(id)));

    const outputs = allReady ? readyOutputs : [];

    const data = {
      ok: true,
      provider: "topmediai",
      provider_job_id,
      provider_song_ids,
      internal_job_id: internal_job_id || null,
      state: allReady ? "ready" : anyFail ? "failed" : "processing",
      status: allReady ? "ready" : anyFail ? "failed" : "processing",
      outputs,
      topmediai: top,
    };

    if (allReady && outputs.length) {
      data.audio = {
        src: outputs[0].url,
        output_id: outputs[0]?.meta?.trackId || String(provider_job_id),
        duration: outputs[0]?.meta?.duration ?? null,
      };
    }

    try {
      const conn = pickConn();
      if (conn && provider_job_id) {
        const sql = neon(conn);

        const mergedMeta = {
          ...(Array.isArray(top?.data) && top.data[0]
            ? { topmediai_first: top.data[0] }
            : {}),
          provider_job_id: provider_job_id || null,
          provider_song_ids: provider_song_ids || [],
          internal_job_id: internal_job_id || null,
          audio_src:
            data.audio?.src ||
            outputs?.[0]?.url ||
            "",
        };

        await sql`
          update jobs
          set
            status = ${data.status || "processing"},
            outputs = ${Array.isArray(data.outputs) ? data.outputs : []},
            meta = coalesce(meta, '{}'::jsonb) || ${mergedMeta}::jsonb,
            updated_at = now()
          where app = ${"music"}
            and deleted_at is null
            and (
              request_id = ${String(provider_job_id)}
              or meta->>'provider_job_id' = ${String(provider_job_id)}
              or meta->>'internal_job_id' = ${String(internal_job_id || "")}
            )
        `;
      }
    } catch (e) {
      console.warn("[api/music/status] db sync failed", e);
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
