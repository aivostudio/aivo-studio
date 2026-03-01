// api/music/status.js
// Vercel route: Direct TopMediai v3 tasks poll + normalize to audio.src
// - Accepts: job_id (internal job_...) OR provider_job_id/song_id OR ids=id1,id2
// - If internal, reads Redis jobs/<internal>/job.json to get provider_song_ids
// - Calls TopMediai: GET /v3/music/tasks?ids=id1,id2
// - Normalizes MULTI-TRACK output to: outputs[] + backward compat audio.src

const { getRedis } = require("../_kv");
const fetchFn = globalThis.fetch || require("node-fetch");

// ✅ R2 (Cloudflare R2 / S3 compatible) helpers (CommonJS)
const { S3Client, PutObjectCommand, HeadObjectCommand } = require("@aws-sdk/client-s3");

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

// =========================================================
// MUSIC ARCHIVE → R2 (via Redis cache)
// - READY olunca provider mp3’ü R2’ye PUT
// - Redis’e: music_archive:<trackId> = archive_url
// - Response’ta output.url => archive_url (başarılıysa)
// =========================================================
function getR2() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  const publicBase = process.env.R2_PUBLIC_BASE_URL;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    throw new Error("missing_r2_env");
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return { client, bucket, publicBase };
}

async function r2ObjectExists(client, bucket, key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

function normalizePublicBase(u) {
  return String(u || "").replace(/\/$/, "");
}

async function ensureMusicArchivedToR2({ redis, trackId, audioUrl }) {
  try {
    const tid = String(trackId || "").trim();
    const src = String(audioUrl || "").trim();
    if (!tid || !src) return "";

    // 1) Redis cache
    const cacheKey = `music_archive:${tid}`;
    const cached = await redis.get(cacheKey);
    if (cached && String(cached).startsWith("http")) return String(cached);

    // 2) R2 setup
    const { client, bucket, publicBase } = getR2();
    const key = `music/${tid}.mp3`;
    const publicUrl = `${normalizePublicBase(publicBase)}/${key}`;

    // 3) Already exists on R2?
    const exists = await r2ObjectExists(client, bucket, key);
    if (exists) {
      await redis.set(cacheKey, publicUrl);
      return publicUrl;
    }

    // 4) Download provider mp3 (follow redirects) -> PUT to R2
    const r = await fetchFn(src, { method: "GET" });
    if (!r || !r.ok) return "";

    // node-fetch (Buffer) / fetch (arrayBuffer) uyumlu
    let buf = null;

    if (typeof r.arrayBuffer === "function") {
      const ab = await r.arrayBuffer();
      buf = Buffer.from(ab);
    } else if (typeof r.buffer === "function") {
      buf = await r.buffer();
    }

    if (!buf || !buf.length) return "";

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buf,
        ContentType: "audio/mpeg",
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    // 5) Cache
    await redis.set(cacheKey, publicUrl);
    return publicUrl;
  } catch (e) {
    console.warn("[music:archive] ensureMusicArchivedToR2 failed", e?.message || e);
    return "";
  }
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
    // 3) Normalize (MULTI-TRACK) + ✅ R2 ARCHIVE ON READY
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

        // status==0 => ready (TopMediai’de)
        const ready = st === 0;

        // fail kodları (geniş yakala)
        if (st < 0 || String(item?.state || "").toUpperCase().includes("FAIL")) {
          anyFail = true;
        }

        if (ready && urlMp3) {
          anyReady = true;

          // ✅ READY -> R2 archive
          let finalUrl = urlMp3;
          let archiveUrl = "";

          if (trackId) {
            archiveUrl = await ensureMusicArchivedToR2({
              redis,
              trackId,
              audioUrl: urlMp3,
            });
            if (archiveUrl) finalUrl = archiveUrl;
          }

          outputs.push({
            type: "audio",
            url: finalUrl,
            meta: {
              provider: "topmediai",
              trackId: trackId || null,
              status: st,
              archive_url: archiveUrl || null,
              provider_url: urlMp3 || null,
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
        src: outputs[0].url, // ✅ artık archive_url (varsa) döner
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
