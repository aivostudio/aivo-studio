const { neon } = require("@neondatabase/serverless");
const { getRedis } = require("../_kv");

const fetchFn = globalThis.fetch || require("node-fetch");

// api/music/status.js
// Vercel route: Direct TopMediai v3 tasks poll + normalize to audio.src
// - Ready: status 0/2 + audio URL
// - Failed: status 3, negative status, fail_code/fail_reason, FAIL/ERROR state
// - Ready output is exposed through R2 archive URL or same-origin media proxy
// - Completed and failed states are synchronized to Neon

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
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

    const providerJobId = row.request_id ? String(row.request_id) : "";
    const meta = row.meta || {};

    const idsRaw =
      meta.provider_song_ids ||
      meta.providerSongIds ||
      meta.song_ids ||
      meta.songIds ||
      [];

    const providerSongIds = Array.isArray(idsRaw)
      ? idsRaw.map((value) => String(value || "").trim()).filter(Boolean)
      : [];

    return {
      provider_job_id: providerJobId || null,
      provider_song_ids: providerSongIds.length ? providerSongIds : null,
    };
  } catch {
    return null;
  }
}

function resolveCopyToR2() {
  try {
    // eslint-disable-next-line import/no-dynamic-require
    const mod = require("../_lib/copy-to-r2");

    if (typeof mod === "function") return mod;
    if (typeof mod?.default === "function") return mod.default;

    const candidates = [
      mod?.copyToR2,
      mod?.copyURLToR2,
      mod?.copyUrlToR2,
      mod?.copy_to_r2,
      mod?.copy,
      mod?.copyFromUrlToR2,
      mod?.copyFromURLToR2,
    ].filter((fn) => typeof fn === "function");

    return candidates[0] || null;
  } catch {
    return null;
  }
}

function unwrapRedisValue(value) {
  return value && typeof value === "object" && value.result
    ? value.result
    : value;
}

function safeJsonParse(value) {
  if (value && typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function uniqStrings(values) {
  const output = [];
  const seen = new Set();

  for (const value of values || []) {
    const clean = String(value || "").trim();
    if (!clean || seen.has(clean)) continue;

    seen.add(clean);
    output.push(clean);
  }

  return output;
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return null;
  }
}

function buildMusicR2Key({ provider_job_id, trackId }) {
  const providerJobId =
    String(provider_job_id || "unknown").trim() || "unknown";
  const safeTrackId = String(trackId || "track").trim() || "track";

  return `outputs/music/${providerJobId}/${safeTrackId}.mp3`;
}

function guessContentTypeFromUrl(url) {
  const value = String(url || "").toLowerCase();

  if (value.includes(".wav")) return "audio/wav";
  if (value.includes(".m4a")) return "audio/mp4";
  return "audio/mpeg";
}

function getBaseUrl(req) {
  const proto =
    String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim() || "https";

  const host =
    String(req.headers["x-forwarded-host"] || "").trim() ||
    String(req.headers.host || "").trim();

  return `${proto}://${host}`;
}

function toProxyUrl(req, rawUrl) {
  const cleanUrl = String(rawUrl || "").trim();
  if (!cleanUrl) return null;

  return `${getBaseUrl(req)}/api/media/proxy?url=${encodeURIComponent(
    cleanUrl
  )}`;
}

function normalizeProviderArray(top) {
  if (Array.isArray(top?.data)) return top.data;
  if (Array.isArray(top?.data?.data)) return top.data.data;
  return [];
}

function readTopLevelProviderFailure(top, httpStatus) {
  const providerStatus = Number(top?.status);
  const message = String(
    top?.message || top?.error || top?.msg || ""
  ).trim();

  const clientHttpFailure =
    Number.isFinite(Number(httpStatus)) &&
    Number(httpStatus) >= 400 &&
    Number(httpStatus) < 500;

  const providerRejected =
    Number.isFinite(providerStatus) &&
    providerStatus !== 0 &&
    Boolean(message);

  if (!clientHttpFailure && !providerRejected) return null;

  return {
    track_id: null,
    status: Number.isFinite(providerStatus) ? providerStatus : null,
    state: "failed",
    fail_code: Number.isFinite(providerStatus) ? String(providerStatus) : null,
    fail_reason:
      message ||
      `TopMediai status request failed with HTTP ${httpStatus}.`,
  };
}

function getTrackId(item) {
  return String(item?.song_id || item?.songId || item?.id || "").trim() || null;
}

function getAudioUrl(item) {
  return (
    item?.audio_url ||
    item?.audioUrl ||
    item?.audio ||
    item?.mp3 ||
    item?.url ||
    null
  );
}

function readFailure(item) {
  const status = Number(item?.status);
  const state = String(item?.state || "").trim();
  const failCodeRaw = item?.fail_code ?? item?.failCode ?? null;
  const failReason = String(
    item?.fail_reason || item?.failReason || ""
  ).trim();

  const hasFailCode =
    failCodeRaw !== null &&
    failCodeRaw !== undefined &&
    String(failCodeRaw).trim() !== "" &&
    String(failCodeRaw).trim() !== "0";

  const failed =
    status === 3 ||
    (Number.isFinite(status) && status < 0) ||
    hasFailCode ||
    Boolean(failReason) ||
    /FAIL|FAILED|ERROR/i.test(state);

  if (!failed) return null;

  return {
    track_id: getTrackId(item),
    status: Number.isFinite(status) ? status : null,
    state: state || null,
    fail_code: hasFailCode ? String(failCodeRaw) : null,
    fail_reason: failReason || "Müzik üretimi sağlayıcı tarafından reddedildi.",
  };
}

async function syncJobRecord({
  status,
  outputs,
  provider_job_id,
  provider_song_ids,
  internal_job_id,
  topmediai,
  failures,
}) {
  if (!status || !["completed", "failed"].includes(status)) return;

  const conn = pickConn();
  if (!conn) return;

  try {
    const sql = neon(conn);

    const mergedMeta = {
      ...(topmediai?.data?.[0]
        ? { topmediai_first: topmediai.data[0] }
        : {}),
      provider_job_id: provider_job_id || null,
      provider_song_ids: provider_song_ids || [],
      internal_job_id: internal_job_id || null,
      audio_src:
        outputs?.[0]?.url ||
        outputs?.[0]?.meta?.archive_url ||
        outputs?.[0]?.meta?.audio_url ||
        "",
      provider_failures: failures || [],
    };

    if (internal_job_id) {
      await sql`
        update jobs
        set
          status = ${status},
          outputs = ${Array.isArray(outputs) ? outputs : []},
          meta = coalesce(meta, '{}'::jsonb) || ${mergedMeta}::jsonb,
          updated_at = now()
        where app = ${"music"}
          and deleted_at is null
          and (
            meta->>'internal_job_id' = ${internal_job_id}
            or request_id = ${provider_job_id || ""}
          )
      `;

      return;
    }

    if (provider_job_id) {
      await sql`
        update jobs
        set
          status = ${status},
          outputs = ${Array.isArray(outputs) ? outputs : []},
          meta = coalesce(meta, '{}'::jsonb) || ${mergedMeta}::jsonb,
          updated_at = now()
        where app = ${"music"}
          and deleted_at is null
          and (
            request_id = ${provider_job_id}
            or meta->>'provider_job_id' = ${provider_job_id}
          )
      `;
    }
  } catch (error) {
    console.warn("[api/music/status] db sync failed", error);
  }
}

module.exports = async (req, res) => {
  res.setHeader(
    "x-aivo-status-build",
    "status-direct-v3-topmediai-tasks-2026-07-23-failed-state-fix"
  );

  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed",
      });
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
      return res.status(400).json({
        ok: false,
        error: "missing_job_id",
      });
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

    async function readJobObjFromRedis(internalId) {
      if (!internalId) return null;

      const firstKey = `jobs/${internalId}/job.json`;
      const firstRaw = unwrapRedisValue(await redis.get(firstKey));
      const firstObject = firstRaw ? safeJsonParse(firstRaw) : null;
      if (firstObject) return firstObject;

      const secondKey = `job:${internalId}`;
      const secondRaw = unwrapRedisValue(await redis.get(secondKey));
      const secondObject = secondRaw ? safeJsonParse(secondRaw) : null;

      return secondObject || null;
    }

    if (isInternal || looksLikeUUID) {
      let jobObj = await readJobObjFromRedis(internal_job_id);

      if (!jobObj) {
        jobObj = await readJobObjFromDB(internal_job_id);
      }

      if (!jobObj && String(req.query.probe || "") === "1") {
        const firstKey = `jobs/${internal_job_id}/job.json`;
        const secondKey = `job:${internal_job_id}`;
        const firstValue = await redis.get(firstKey);
        const secondValue = await redis.get(secondKey);

        return res.status(200).json({
          ok: false,
          error: "debug_kv_missing_job",
          internal_job_id,
          debug: {
            first_key: firstKey,
            first_exists: Boolean(firstValue),
            first_sample: String(firstValue || "").slice(0, 300),
            second_key: secondKey,
            second_exists: Boolean(secondValue),
            second_sample: String(secondValue || "").slice(0, 300),
          },
        });
      }

      provider_job_id =
        String(jobObj?.provider_job_id || "").trim() || provider_job_id;

      const idsRaw =
        jobObj?.provider_song_ids ||
        jobObj?.providerSongIds ||
        jobObj?.song_ids ||
        jobObj?.songIds ||
        [];

      provider_song_ids = Array.isArray(idsRaw) ? uniqStrings(idsRaw) : [];

      if (!provider_song_ids.length && provider_job_id) {
        provider_song_ids = [String(provider_job_id)];
      }

      if (isInternal && (!provider_job_id || !provider_song_ids.length)) {
        const keys = await redis.keys("provider_map:*");

        for (const key of keys) {
          const rawMap = unwrapRedisValue(await redis.get(key));
          const mapObj = rawMap ? safeJsonParse(rawMap) : null;

          if (mapObj?.internal_job_id !== internal_job_id) continue;

          provider_job_id =
            String(mapObj?.provider_job_id || "").trim() || null;

          const mapIdsRaw =
            mapObj?.provider_song_ids ||
            mapObj?.providerSongIds ||
            mapObj?.song_ids ||
            mapObj?.songIds ||
            [];

          provider_song_ids = Array.isArray(mapIdsRaw)
            ? uniqStrings(mapIdsRaw)
            : [];

          break;
        }
      }
    } else if (raw.includes(",")) {
      provider_song_ids = uniqStrings(raw.split(","));
      provider_job_id = provider_song_ids[0] || provider_job_id;
    } else {
      const providerMapKey = `provider_map:${raw}`;
      const mapRaw = unwrapRedisValue(await redis.get(providerMapKey));
      const mapObj = mapRaw ? safeJsonParse(mapRaw) : null;

      if (mapObj?.internal_job_id) {
        internal_job_id = String(mapObj.internal_job_id).trim() || null;

        const mapIdsRaw =
          mapObj?.provider_song_ids ||
          mapObj?.providerSongIds ||
          mapObj?.song_ids ||
          mapObj?.songIds ||
          [];

        provider_song_ids = Array.isArray(mapIdsRaw)
          ? uniqStrings(mapIdsRaw)
          : [];

        provider_job_id =
          String(mapObj?.provider_job_id || "").trim() || String(raw);

        if (internal_job_id) {
          let jobObj = await readJobObjFromRedis(internal_job_id);

          if (!jobObj) {
            jobObj = await readJobObjFromDB(internal_job_id);
          }

          if (
            (!jobObj ||
              (!jobObj.provider_job_id && !jobObj.provider_song_ids)) &&
            internal_job_id
          ) {
            const internalMapRaw = unwrapRedisValue(
              await redis.get(`internal_map:${internal_job_id}`)
            );
            const internalMap = internalMapRaw
              ? safeJsonParse(internalMapRaw)
              : null;

            if (internalMap) {
              provider_job_id =
                String(internalMap.provider_job_id || "").trim() ||
                provider_job_id;

              const internalIdsRaw =
                internalMap.provider_song_ids ||
                internalMap.providerSongIds ||
                internalMap.song_ids ||
                internalMap.songIds ||
                [];

              if (Array.isArray(internalIdsRaw)) {
                provider_song_ids = uniqStrings(internalIdsRaw);
              }
            }
          }

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
              ...provider_song_ids,
              ...jobIds,
            ]);
          }

          provider_job_id =
            String(jobObj?.provider_job_id || "").trim() || provider_job_id;
        }

        if (!provider_song_ids.length && provider_job_id) {
          provider_song_ids = [String(provider_job_id)];
        }
      } else {
        provider_song_ids = [String(raw)];
        provider_job_id = String(raw);
      }
    }

    provider_song_ids = uniqStrings(provider_song_ids);

    if (!provider_song_ids.length) {
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
    const providerUrl = `https://api.topmediai.com/v3/music/tasks?ids=${encodeURIComponent(
      idsParam
    )}`;

    const providerResponse = await fetchFn(providerUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-api-key": KEY,
      },
    });

    const providerText = await providerResponse.text();
    const top = safeJsonParse(providerText);

    if (!top) {
      return res.status(200).json({
        ok: false,
        error: "upstream_non_json",
        state: "processing",
        status: "processing",
        provider_job_id,
        provider_song_ids,
        internal_job_id,
        upstream_status: providerResponse.status,
        upstream_preview: String(providerText || "").slice(0, 400),
      });
    }

    const providerItems = normalizeProviderArray(top);
    const topLevelFailure = readTopLevelProviderFailure(
      top,
      providerResponse.status
    );

    if (topLevelFailure && providerItems.length === 0) {
      const failedData = {
        ok: true,
        provider: "topmediai",
        provider_job_id,
        provider_song_ids,
        internal_job_id: internal_job_id || null,
        state: "failed",
        status: "failed",
        outputs: [],
        failures: [topLevelFailure],
        error: "provider_status_request_failed",
        message: topLevelFailure.fail_reason,
        fail_code: topLevelFailure.fail_code,
        topmediai: top,
        archive_warning: null,
      };

      await syncJobRecord({
        status: "failed",
        outputs: [],
        provider_job_id,
        provider_song_ids,
        internal_job_id,
        topmediai: top,
        failures: [topLevelFailure],
      });

      return res.status(200).json(failedData);
    }

    const outputs = [];
    const failures = [];
    const copyToR2 = resolveCopyToR2();

    let archiveWarning = copyToR2 ? null : "missing_copy_to_r2_helper";
    let anyReady = false;
    let anyProcessing = false;

    const READY_STATUSES = new Set([0, 2]);

    for (const item of providerItems) {
      const statusNumber = Number(item?.status);
      const trackId = getTrackId(item);
      const audioUrl = getAudioUrl(item);
      const failure = readFailure(item);

      if (failure) {
        failures.push(failure);
        continue;
      }

      const ready =
        Boolean(audioUrl) &&
        (READY_STATUSES.has(statusNumber) || !Number.isFinite(statusNumber));

      if (!ready) {
        anyProcessing = true;
        continue;
      }

      anyReady = true;

      let finalUrl = toProxyUrl(req, audioUrl);
      let archiveUrl = null;

      if (copyToR2) {
        const key = buildMusicR2Key({
          provider_job_id,
          trackId: trackId || provider_job_id,
        });

        try {
          const result = await copyToR2({
            url: audioUrl,
            key,
            contentType: guessContentTypeFromUrl(audioUrl),
          });

          archiveUrl =
            (typeof result === "string" ? result : null) ||
            result?.public_url ||
            result?.url ||
            result?.archive_url ||
            null;

          if (archiveUrl) {
            finalUrl = archiveUrl;
          } else {
            archiveWarning = archiveWarning || "copy_to_r2_no_url_returned";
          }
        } catch (error) {
          archiveWarning = `copy_to_r2_failed:${String(
            error?.message || error
          )}`;
        }
      }

      outputs.push({
        type: "audio",
        url: finalUrl,
        meta: {
          provider: "topmediai",
          trackId: trackId || null,
          status: Number.isFinite(statusNumber) ? statusNumber : null,
          audio_url: audioUrl,
          archive_url: archiveUrl,
          archived_at: archiveUrl ? nowIso() : null,
          duration:
            typeof item?.duration === "number" ? item.duration : null,
        },
      });
    }

    let normalizedStatus = "processing";

    // A successful output must not be hidden because the sibling track failed.
    if (anyReady) {
      normalizedStatus = "completed";
    } else if (failures.length > 0 && !anyProcessing) {
      normalizedStatus = "failed";
    } else if (failures.length > 0 && providerItems.length === failures.length) {
      normalizedStatus = "failed";
    }

    const firstFailure = failures[0] || null;

    const data = {
      ok: true,
      provider: "topmediai",
      provider_job_id,
      provider_song_ids,
      internal_job_id: internal_job_id || null,
      state: normalizedStatus,
      status: normalizedStatus,
      outputs,
      failures,
      topmediai: top,
      archive_warning: archiveWarning,
      ...(normalizedStatus === "failed"
        ? {
            error: "provider_generation_failed",
            message:
              firstFailure?.fail_reason ||
              "Müzik üretimi sağlayıcı tarafından başarısız olarak işaretlendi.",
            fail_code: firstFailure?.fail_code || null,
          }
        : {}),
    };

    if (outputs.length) {
      data.audio = {
        src: outputs[0].url,
        output_id: outputs[0]?.meta?.trackId || String(provider_job_id),
        duration: outputs[0]?.meta?.duration ?? null,
      };
    }

    await syncJobRecord({
      status: normalizedStatus,
      outputs,
      provider_job_id,
      provider_song_ids,
      internal_job_id,
      topmediai: top,
      failures,
    });

    return res.status(200).json(data);
  } catch (error) {
    console.error("api/music/status error:", error);

    return res.status(200).json({
      ok: false,
      error: "proxy_error",
      state: "processing",
      status: "processing",
      detail: String(error?.message || error),
    });
  }
};
