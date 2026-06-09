const { neon } = require("@neondatabase/serverless");
const authModule = require("../_lib/auth.js");

const requireAuth =
  authModule?.requireAuth ||
  authModule?.default?.requireAuth;

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

function safeText(v) {
  const s = String(v == null ? "" : v).trim();
  return s || null;
}

function safeJson(res, code, obj) {
  return res.status(code).json(obj);
}

function normalizeJson(value, fallback) {
  if (value == null) return fallback;

  if (typeof value === "object") {
    return value;
  }

  try {
    return JSON.parse(String(value));
  } catch (_) {
    return fallback;
  }
}

function isUuidLike(v) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(v || "")
  );
}

function pickUrlFromOutput(item) {
  if (!item || typeof item !== "object") return null;

  return (
    safeText(item.archive_url) ||
    safeText(item.url) ||
    safeText(item.raw_url) ||
    safeText(item.src) ||
    safeText(item.audio_url) ||
    safeText(item.video_url) ||
    safeText(item.image_url) ||
    null
  );
}

function pickOutputFromDb(outputs, meta) {
  const outputList = Array.isArray(outputs) ? outputs : [];
  const metaObj = meta && typeof meta === "object" ? meta : {};

  const directMetaUrl =
    safeText(metaObj.final_video_url) ||
    safeText(metaObj.final_image_url) ||
    safeText(metaObj.audio_src) ||
    safeText(metaObj.audio_url) ||
    safeText(metaObj.preview_video_url) ||
    safeText(metaObj.muxed_url) ||
    safeText(metaObj.logo_overlay_url) ||
    safeText(metaObj.output_url) ||
    safeText(metaObj.result_url) ||
    safeText(metaObj.image_url) ||
    safeText(metaObj.url);

  if (directMetaUrl) {
    return {
      url: directMetaUrl,
      source: "db_meta"
    };
  }

  const finalOutput = outputList.find((item) => item?.meta?.is_final === true);
  const finalOutputUrl = pickUrlFromOutput(finalOutput);

  if (finalOutputUrl) {
    return {
      url: finalOutputUrl,
      source: "db_outputs_final"
    };
  }

  for (const item of outputList) {
    const url = pickUrlFromOutput(item);
    if (url) {
      return {
        url,
        source: "db_outputs_first"
      };
    }
  }

  return {
    url: null,
    source: null
  };
}

function uniqStrings(arr) {
  const out = [];
  const seen = new Set();

  for (const item of Array.isArray(arr) ? arr : []) {
    const s = String(item || "").trim();
    if (!s) continue;
    if (seen.has(s)) continue;

    seen.add(s);
    out.push(s);
  }

  return out;
}

function pickProviderSongIds(job) {
  const meta = normalizeJson(job?.meta, {});

  const raw =
    meta.provider_song_ids ||
    meta.providerSongIds ||
    meta.song_ids ||
    meta.songIds ||
    meta?.topmediai?.provider_song_ids ||
    [];

  if (Array.isArray(raw)) {
    return uniqStrings(raw);
  }

  return [];
}

function pickProviderJobId(job) {
  const meta = normalizeJson(job?.meta, {});

  return (
    safeText(job?.request_id) ||
    safeText(meta.provider_job_id) ||
    safeText(meta.providerJobId) ||
    safeText(meta.topmediai_job_id) ||
    safeText(meta.topmediaiJobId) ||
    null
  );
}

function toProxyUrl(req, rawUrl) {
  const u = safeText(rawUrl);
  if (!u) return null;

  const proto =
    String(req.headers["x-forwarded-proto"] || "")
      .split(",")[0]
      .trim() || "https";

  const host =
    String(req.headers["x-forwarded-host"] || "")
      .split(",")[0]
      .trim() ||
    String(req.headers.host || "").trim();

  if (!host) return u;

  return `${proto}://${host}/api/media/proxy?url=${encodeURIComponent(u)}`;
}

async function resolveMusicFromTopMediai(req, job) {
  const key = process.env.TOPMEDIAI_API_KEY;
  if (!key) {
    return {
      ok: false,
      error: "missing_topmediai_api_key"
    };
  }

  let providerSongIds = pickProviderSongIds(job);
  const providerJobId = pickProviderJobId(job);

  if (!providerSongIds.length && providerJobId) {
    providerSongIds = [providerJobId];
  }

  providerSongIds = uniqStrings(providerSongIds);

  if (!providerSongIds.length) {
    return {
      ok: false,
      error: "missing_provider_song_ids",
      provider_job_id: providerJobId || null,
      provider_song_ids: []
    };
  }

  const idsParam = providerSongIds.join(",");
  const url = `https://api.topmediai.com/v3/music/tasks?ids=${encodeURIComponent(idsParam)}`;

  const r = await fetchFn(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      "x-api-key": key
    }
  });

  const text = await r.text();
  let json = null;

  try {
    json = JSON.parse(text);
  } catch (_) {
    json = null;
  }

  if (!r.ok || !json) {
    return {
      ok: false,
      error: "topmediai_fetch_failed",
      status: r.status,
      sample: String(text || "").slice(0, 500),
      provider_job_id: providerJobId || null,
      provider_song_ids: providerSongIds
    };
  }

  const arr = Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json?.data?.data)
    ? json.data.data
    : [];

  const outputs = [];

  for (const item of arr) {
    const audioUrl =
      safeText(item?.audio_url) ||
      safeText(item?.audio) ||
      safeText(item?.mp3) ||
      safeText(item?.url);

    if (!audioUrl) continue;

    const trackId =
      safeText(item?.song_id) ||
      safeText(item?.id) ||
      null;

    outputs.push({
      type: "audio",
      url: toProxyUrl(req, audioUrl) || audioUrl,
      raw_url: audioUrl,
      output_id: trackId,
      meta: {
        provider: "topmediai",
        trackId,
        status: item?.status ?? null,
        duration: typeof item?.duration === "number" ? item.duration : null
      }
    });
  }

  if (!outputs.length) {
    return {
      ok: false,
      error: "music_not_ready_or_no_output",
      provider_job_id: providerJobId || null,
      provider_song_ids: providerSongIds,
      topmediai: json
    };
  }

   return {
    ok: true,
    source: "topmediai_admin_resolve",
    provider_job_id: providerJobId || null,
    provider_song_ids: providerSongIds,
    output_url: outputs[0].raw_url || outputs[0].url,
    outputs,
    topmediai: json
  };
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      return res.status(204).end();
    }

    if (req.method !== "GET") {
      return safeJson(res, 405, {
        ok: false,
        error: "method_not_allowed"
      });
    }

    const conn = pickConn();
    if (!conn) {
      return safeJson(res, 500, {
        ok: false,
        error: "missing_db_env"
      });
    }

    if (typeof requireAuth !== "function") {
      return safeJson(res, 500, {
        ok: false,
        error: "require_auth_missing"
      });
    }

    try {
      await requireAuth(req);
    } catch (e) {
      return safeJson(res, 401, {
        ok: false,
        error: "unauthorized",
        message: String(e?.message || e)
      });
    }

    const jobId = safeText(req.query?.job_id || req.query?.jobId);
    if (!jobId) {
      return safeJson(res, 400, {
        ok: false,
        error: "missing_job_id"
      });
    }

    if (!isUuidLike(jobId)) {
      return safeJson(res, 400, {
        ok: false,
        error: "invalid_job_id"
      });
    }

    const sql = neon(conn);

    const rows = await sql`
      select
        id,
        user_id,
        app,
        type,
        provider,
        request_id,
        status,
        prompt,
        meta,
        outputs,
        error,
        created_at,
        updated_at
      from jobs
      where id = ${jobId}::uuid
      limit 1
    `;

    const job = rows?.[0] || null;

    if (!job) {
      return safeJson(res, 404, {
        ok: false,
        error: "job_not_found"
      });
    }

    const meta = normalizeJson(job.meta, {});
    const outputs = normalizeJson(job.outputs, []);
    const picked = pickOutputFromDb(outputs, meta);

    if (picked.url) {
      return safeJson(res, 200, {
        ok: true,
        found: true,
        source: picked.source,
        job_id: job.id,
        email: job.user_id || null,
        app: job.app || null,
        status: job.status || null,
        prompt: job.prompt || null,
        output_url: picked.url,
        outputs,
        meta
      });
    }

    const app = String(job.app || job.type || "").toLowerCase();

    if (app === "music") {
      const musicResolved = await resolveMusicFromTopMediai(req, job);

      if (musicResolved.ok) {
        return safeJson(res, 200, {
          ok: true,
          found: true,
          source: musicResolved.source,
          job_id: job.id,
          email: job.user_id || null,
          app: job.app || null,
          status: job.status || null,
          prompt: job.prompt || null,
          output_url: musicResolved.output_url,
          outputs: musicResolved.outputs,
          meta,
          provider_job_id: musicResolved.provider_job_id,
          provider_song_ids: musicResolved.provider_song_ids
        });
      }

      return safeJson(res, 200, {
        ok: true,
        found: false,
        source: "music_admin_resolve",
        job_id: job.id,
        email: job.user_id || null,
        app: job.app || null,
        status: job.status || null,
        prompt: job.prompt || null,
        output_url: null,
        outputs: [],
        meta,
        resolve_error: musicResolved.error || "music_output_not_found",
        provider_job_id: musicResolved.provider_job_id || null,
        provider_song_ids: musicResolved.provider_song_ids || []
      });
    }

    return safeJson(res, 200, {
      ok: true,
      found: false,
      source: "db_only",
      job_id: job.id,
      email: job.user_id || null,
      app: job.app || null,
      status: job.status || null,
      prompt: job.prompt || null,
      output_url: null,
      outputs,
      meta,
      message: "Bu job için DB içinde çıktı linki bulunamadı."
    });
  } catch (e) {
    console.error("admin/production-output-resolve failed:", e);

    return safeJson(res, 500, {
      ok: false,
      error: "production_output_resolve_failed",
      message: String(e?.message || e)
    });
  }
};
