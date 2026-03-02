// api/music/status.js
// Vercel route: Direct TopMediai v3 tasks poll + normalize to audio.src
// READY algısı düzeltildi (status=2 + audio_url => ready)
// MP3 URL'leri: önce R2 archive, olmazsa same-origin proxy ile stabilize edilir.
// Ayrıca duration/topmediai.duration response'a taşınır (progress 0 kalmasın).

const { getRedis } = require("../_kv");
const fetchFn = globalThis.fetch || require("node-fetch");

/**
 * copy-to-r2 helper'ını esnek resolve ediyoruz.
 * Beklenen: api/_lib/copy-to-r2.js içinde "url -> R2" kopyalayan bir fonksiyon.
 * - export default olabilir
 * - module.exports = function olabilir
 * - { copyToR2 }, { copyUrlToR2 } vb olabilir
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

function isLikelyReadyStatus(st, hasAudioUrl) {
  // Sende gördüğümüz: status=4 => audio_url empty (processing)
  //                 status=2 => audio_url dolu (play ediliyor ama UI bar 0)
  // TopMediai dok/behavior farklı varyantlar gösterebiliyor; biz "audio_url varsa ready"yi esas alıyoruz.
  if (!hasAudioUrl) return false;
  if (st === 0) return true;
  if (st === 2) return true;
  // audio_url var ama farklı bir status gelirse de "ready" say (fail_code yoksa)
  return true;
}

function isFailStatus(st, item) {
  if (st < 0) return true;
  const stateStr = String(item?.state || "").toUpperCase();
  if (stateStr.includes("FAIL")) return true;
  if (item?.fail_code || item?.fail_reason) return true;
  return false;
}

function toNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

function clampPositiveDuration(d) {
  const n = toNum(d);
  if (!n) return null;
  if (n <= 0) return null;
  // bazen provider -1 döndürüyor
  return n;
}

function sameOriginProxyUrl(rawUrl) {
  const u = String(rawUrl || "").trim();
  if (!u) return null;
  // relative döndür (same-origin)
  return `/api/media/proxy?url=${encodeURIComponent(u)}`;
}

module.exports = async (req, res) => {
  res.setHeader("x-aivo-status-build", "status-direct-v3-topmediai-tasks-2026-03-02-r2-archive-proxy-ready2");

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
    // 3) Normalize (MULTI-TRACK) + R2 Archive + Proxy fallback
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
    if (!copyToR2) {
      archiveWarning = "missing_copy_to_r2_helper";
    }

    let bestDuration = null; // response seviyesinde de verelim (ilk track)
    let firstStableUrl = null;

    if (Array.isArray(arr) && arr.length) {
      for (const item of arr) {
        const st = Number(item?.status);
        const urlMp3 = item?.audio_url || item?.audio || item?.mp3 || item?.url || null;

        // song_id bazen uuid geliyor, bazen boş geliyor; id fallback'liyoruz
        const trackId =
          String(item?.song_id || "").trim() ||
          String(item?.id || "").trim() ||
          String(provider_job_id || "").trim() ||
          null;

        const durationSec = clampPositiveDuration(item?.duration);

        if (!bestDuration && durationSec) bestDuration = durationSec;

        if (isFailStatus(st, item)) {
          anyFail = true;
          continue;
        }

        const ready = isLikelyReadyStatus(st, !!urlMp3);

        if (ready && urlMp3) {
          anyReady = true;

          // 1) Stabil URL: önce R2 archive, olmazsa same-origin proxy
          let archive_url = null;
          let finalUrl = null;

          if (copyToR2) {
            const key = buildMusicR2Key({
              provider_job_id,
              trackId: trackId || provider_job_id,
            });

            try {
              // helper imzası farklı olabilir; object arg ile çağırıyoruz
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

              if (!archive_url) {
                archiveWarning = archiveWarning || "copy_to_r2_no_url_returned";
              }
            } catch (e) {
              archiveWarning = `copy_to_r2_failed:${String(e?.message || e)}`;
            }
          }

          // finalUrl seçimi:
          // - archive_url varsa onu kullan (en stabil)
          // - yoksa proxy kullan (302/cors/duration Infinity için)
          finalUrl = archive_url || sameOriginProxyUrl(urlMp3);

          if (!firstStableUrl) firstStableUrl = finalUrl;

          outputs.push({
            type: "audio",
            url: finalUrl,
            meta: {
              provider: "topmediai",
              trackId: trackId || null,
              status: st,
              duration: durationSec,
              audio_url: urlMp3, // debug
              archive_url: archive_url,
              archived_at: archive_url ? nowIso() : null,
              proxied: archive_url ? false : true,
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
      duration: bestDuration, // ✅ UI duration fallback
      topmediai: top,
      archive_warning: archiveWarning,
    };

    // Backward-compat: eski panel data.audio.src arıyor olabilir
    if (outputs.length) {
      data.audio = {
        src: outputs[0].url,
        output_id: outputs[0]?.meta?.trackId || String(provider_job_id),
        duration: outputs[0]?.meta?.duration || bestDuration || null,
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

    // ekstra debug: ilk stabil URL'i ayrıca koy (tek bakışta gör)
    if (firstStableUrl) data.stable_url = firstStableUrl;

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
