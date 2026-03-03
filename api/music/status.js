// api/music/status.js
// Vercel route: Direct TopMediai v3 tasks poll + normalize to audio.src
// FIX: Provider audio_url 302 redirect (audiopipe.suno.ai) -> duration Infinity/NaN + progress bar kırılıyor.
// Çözüm: UI'ya her zaman SAME-ORIGIN URL ver:
//   1) varsa R2 archive_url
//   2) yoksa /api/media/proxy?url=... (same-origin, redirect/range/CORS stabilize)
// Ayrıca: TopMediai status ready bazen 0 değil 2 gelebiliyor -> ready map genişletildi.

const { getRedis } = require("../_kv");
const fetchFn = globalThis.fetch || require("node-fetch");

/**
 * copy-to-r2 helper'ını esnek resolve ediyoruz.
 * Beklenen: api/_lib/copy-to-r2.js içinde "url -> R2" kopyalayan bir fonksiyon.
 */
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

    if (candidates.length) return candidates[0];
    return null;
  } catch {
    return null;
  }
}

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

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return null;
  }
}

function buildMusicR2Key({ provider_job_id, trackId }) {
  const pj = String(provider_job_id || "unknown").trim() || "unknown";
  const tid = String(trackId || "track").trim() || "track";
  return `outputs/music/${pj}/${tid}.mp3`;
}

function guessContentTypeFromUrl(url) {
  const u = String(url || "");
  if (u.includes(".mp3")) return "audio/mpeg";
  if (u.includes(".wav")) return "audio/wav";
  if (u.includes(".m4a")) return "audio/mp4";
  return "audio/mpeg";
}

function getBaseUrl(req) {
  const proto =
    (req.headers["x-forwarded-proto"] ? String(req.headers["x-forwarded-proto"]) : "")
      .split(",")[0]
      .trim() || "https";
  const host = (req.headers["x-forwarded-host"] ? String(req.headers["x-forwarded-host"]) : "") ||
    (req.headers.host ? String(req.headers.host) : "");
  return `${proto}://${host}`;
}

function toProxyUrl(req, rawUrl) {
  const base = getBaseUrl(req);
  const u = String(rawUrl || "").trim();
  if (!u) return null;
  return `${base}/api/media/proxy?url=${encodeURIComponent(u)}`;
}

module.exports = async (req, res) => {
  // build stamp
  res.setHeader(
    "x-aivo-status-build",
    "status-direct-v3-topmediai-tasks-2026-03-02-r2-archive-no-redirect"
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

    // ---------------------------------------------------------
    // 1) Resolve song ids
    // ---------------------------------------------------------
    const isInternal = raw.startsWith("job_");
    const looksLikeUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

    let internal_job_id = isInternal || looksLikeUUID ? raw : null;
    let provider_job_id = !isInternal && !looksLikeUUID ? raw : null;
    let provider_song_ids = [];

   async function readJobObjFromRedis(internalId) {
  if (!internalId) return null;

  const normalize = (v) =>
    v && typeof v === "object" && v.result ? v.result : v;

  const k1 = `jobs/${internalId}/job.json`;
  const t1raw = await redis.get(k1);
  const t1 = normalize(t1raw);
  const o1 = t1 ? safeJsonParse(t1) : null;
  if (o1) return o1;

  const k2 = `job:${internalId}`;
  const t2raw = await redis.get(k2);
  const t2 = normalize(t2raw);
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
       const normalized =
  mapText && typeof mapText === "object" && mapText.result
    ? mapText.result
    : mapText;

const mapObj = normalized ? safeJsonParse(normalized) : null;

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
    // 3) Normalize (MULTI-TRACK) + R2 Archive + SAME-ORIGIN URL
    // ---------------------------------------------------------
    const arr = Array.isArray(top?.data)
      ? top.data
      : Array.isArray(top?.data?.data)
      ? top.data.data
      : null;

    let anyFail = false;
    let anyReady = false;

    const outputs = [];

    const copyToR2 = resolveCopyToR2();
    let archiveWarning = null;
    if (!copyToR2) archiveWarning = "missing_copy_to_r2_helper";

    // Ready mapping:
    // - bazı örneklerde status:0 ready
    // - bazılarında status:2 iken audio_url dolu (senin screenshot)
    // - audio_url varsa ve status 0/2 ise ready kabul edeceğiz.
    const READY_STATUSES = new Set([0, 2]);

    if (Array.isArray(arr) && arr.length) {
      for (const item of arr) {
        const st = Number(item?.status);
        const trackId = String(item?.song_id || item?.id || "").trim() || null;
        const urlMp3 = item?.audio_url || item?.audio || item?.mp3 || item?.url || null;

        const ready = !!urlMp3 && (READY_STATUSES.has(st) || !Number.isFinite(st));

        if (st < 0 || String(item?.state || "").toUpperCase().includes("FAIL")) {
          anyFail = true;
        }

        if (ready && urlMp3) {
          anyReady = true;

          // default: SAME-ORIGIN proxy URL (redirect/range/CORS stabilize)
          let finalUrl = toProxyUrl(req, urlMp3);

          // optional: archive to R2 (stable) -> finalUrl becomes archive_url if produced
          let archive_url = null;

          if (copyToR2) {
            const key = buildMusicR2Key({ provider_job_id, trackId: trackId || provider_job_id });

            try {
              const result = await copyToR2({
                url: urlMp3,
                key,
                contentType: guessContentTypeFromUrl(urlMp3),
              });

              archive_url =
                (typeof result === "string" ? result : null) ||
                result?.public_url ||
                result?.url ||
                result?.archive_url ||
                null;

              if (archive_url) {
                finalUrl = archive_url; // ✅ UI artık R2 URL görür
              } else {
                archiveWarning = archiveWarning || "copy_to_r2_no_url_returned";
              }
            } catch (e) {
              archiveWarning = `copy_to_r2_failed:${String(e?.message || e)}`;
            }
          }

          outputs.push({
            type: "audio",
            url: finalUrl, // ✅ SAME-ORIGIN proxy OR R2 archive
            meta: {
              provider: "topmediai",
              trackId: trackId || null,
              status: st,
              audio_url: urlMp3, // debug: provider url (redirect olabilir)
              archive_url: archive_url, // varsa
              archived_at: archive_url ? nowIso() : null,
              // provider duration bazen -1 geliyor, yine de meta'ya koyuyoruz (UI isterse kullanır)
              duration: typeof item?.duration === "number" ? item.duration : null,
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
      archive_warning: archiveWarning,
    };

    // Backward-compat: eski panel hâlâ data.audio.src arıyorsa
    if (outputs.length) {
      data.audio = {
        src: outputs[0].url, // ✅ artık provider değil: proxy/R2
        output_id: outputs[0]?.meta?.trackId || String(provider_job_id),
        duration: outputs[0]?.meta?.duration ?? null,
      };
    }

    if (anyFail) {
      data.state = "failed";
      data.status = "failed";
    } else if (anyReady) {
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
