// api/music/status.js
// Vercel route: Direct TopMediai v3 tasks poll + normalize to audio.src
// + NEW: Ready MP3'leri R2'ye archive edip response'ta archive_url (stable) döndürür.
// + IMPORTANT: Multi-track (2 şarkı) UI'de aynı anda görünsün diye,
//   READY olmayan track'leri de outputs[] içinde url:null ile döndürür.
// - Accepts: job_id (internal job_...) OR provider_job_id/song_id OR ids=id1,id2
// - If internal, reads Redis jobs/<internal>/job.json to get provider_song_ids
// - Calls TopMediai: GET /v3/music/tasks?ids=id1,id2
// - Normalizes MULTI-TRACK output to: outputs[] + backward compat audio.src

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

    // direkt function export
    if (typeof mod === "function") return mod;

    // default function
    if (typeof mod?.default === "function") return mod.default;

    // olası isimler
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
  // outputs/music/<provider_job_id>/<trackId>.mp3
  return `outputs/music/${pj}/${tid}.mp3`;
}

function guessContentTypeFromUrl(url) {
  const u = String(url || "");
  if (u.includes(".mp3")) return "audio/mpeg";
  if (u.includes(".wav")) return "audio/wav";
  if (u.includes(".m4a")) return "audio/mp4";
  return "audio/mpeg";
}

module.exports = async (req, res) => {
  res.setHeader("x-aivo-status-build", "status-direct-v3-topmediai-tasks-2026-03-02-r2-archive-multitrack-always");

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

    // ✅ Neon jobs.id gibi UUID gelirse bunu da internal kabul et
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
          provider_job_id = String(mapObj?.provider_job_id || "").trim() || String(raw);

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

            provider_job_id = String(jobObj?.provider_job_id || "").trim() || provider_job_id;
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
    // 3) Normalize (MULTI-TRACK ALWAYS) + R2 Archive
    // ---------------------------------------------------------
    const arr = Array.isArray(top?.data)
      ? top.data
      : Array.isArray(top?.data?.data)
      ? top.data.data
      : [];

    let anyFail = false;

    const outputs = [];

    // R2 copy helper resolve (bir kere)
    const copyToR2 = resolveCopyToR2();

    // R2 copy yoksa zinciri “görünür” hata olarak işaretleyelim (sessiz geçmeyelim)
    let archiveWarning = null;
    if (!copyToR2) {
      archiveWarning = "missing_copy_to_r2_helper";
    }

    // Map: provider_song_id -> item (TopMediai bazen id'yi "id", bazen "song_id" içine koyuyor)
    const byId = new Map();
    for (const it of arr || []) {
      const id = String(it?.song_id || it?.id || "").trim();
      if (id) byId.set(id, it);
    }

    // IMPORTANT: outputs her zaman provider_song_ids sırasıyla döner (UI aynı anda 2 kart basar)
    for (const wantedId of provider_song_ids) {
      const item = byId.get(String(wantedId)) || null;

      const st = Number(item?.status);
      const trackId = String(item?.song_id || item?.id || wantedId || "").trim() || String(wantedId);
      const urlMp3 = item?.audio_url || item?.audio || item?.mp3 || item?.url || null;

      // TopMediai: status==0 => ready
      const ready = st === 0 && !!urlMp3;

      // fail kodları (geniş yakala)
      if (
        (Number.isFinite(st) && st < 0) ||
        String(item?.state || "").toUpperCase().includes("FAIL") ||
        String(item?.fail_reason || item?.failReason || "").trim()
      ) {
        anyFail = true;
      }

      // default (processing track)
      let finalUrl = null;
      let archive_url = null;

      if (ready && urlMp3) {
        finalUrl = urlMp3;

        // ✅ NEW: archive to R2 and return stable URL
        if (copyToR2) {
          const key = buildMusicR2Key({ provider_job_id, trackId });

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
              finalUrl = archive_url;
            } else {
              archiveWarning = archiveWarning || "copy_to_r2_no_url_returned";
            }
          } catch (e) {
            archiveWarning = `copy_to_r2_failed:${String(e?.message || e)}`;
          }
        }
      }

      outputs.push({
        type: "audio",
        // IMPORTANT:
        // - ready değilse url:null döner (UI kartı yine basar, sonra url dolunca günceller)
        // - ready ise url archive_url (varsa) yoksa provider url
        url: finalUrl,
        meta: {
          provider: "topmediai",
          trackId,
          status: Number.isFinite(st) ? st : null,
          ready: !!finalUrl,
          // debug için:
          audio_url: urlMp3 || null,
          archive_url: archive_url || null,
          archived_at: archive_url ? nowIso() : null,
          // UI isterse title/cover da okuyabilsin:
          title: item?.title || null,
          cover_url: item?.cover_url || item?.cover || null,
          duration: typeof item?.duration === "number" ? item.duration : null,
          fail_reason: item?.fail_reason || item?.failReason || null,
        },
      });
    }

    const readyCount = outputs.filter((o) => !!o.url).length;
    const allReady = outputs.length > 0 && readyCount === outputs.length;

    const data = {
      ok: true,
      provider: "topmediai",
      provider_job_id,
      provider_song_ids,
      internal_job_id: internal_job_id || null,
      state: allReady ? "completed" : anyFail ? "failed" : "processing",
      status: allReady ? "completed" : anyFail ? "failed" : "processing",
      outputs,
      topmediai: top,
      archive_warning: archiveWarning, // null ise OK
      ready_count: readyCount,
      total_count: outputs.length,
    };

    // Backward-compat: eski panel hâlâ data.audio.src arıyorsa diye
    // (Sadece en az bir ready varsa set ediyoruz; yoksa boş src istemiyoruz.)
    const firstReady = outputs.find((o) => !!o.url);
    if (firstReady) {
      data.audio = {
        src: firstReady.url,
        output_id: firstReady?.meta?.trackId || String(provider_job_id),
      };
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
