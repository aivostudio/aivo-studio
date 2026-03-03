// api/music/status.js
// Vercel route: Direct TopMediai v3 tasks poll + normalize to audio.src
// FIX: Provider audio_url 302 redirect (audiopipe.suno.ai) -> duration Infinity/NaN + progress bar kırılıyor.
// Çözüm: UI'ya her zaman SAME-ORIGIN URL ver:
//   1) varsa R2 archive_url
//   2) yoksa /api/media/proxy?url=... (same-origin, redirect/range/CORS stabilize)
// Ayrıca: TopMediai status ready bazen 0 değil 2 gelebiliyor -> ready map genişletildi.

const { getRedis } = require("../_kv");
const fetchFn = globalThis.fetch || require("node-fetch");
const { neon } = require("@neondatabase/serverless");

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

/* ... (ÜSTTEKİ TÜM HELPER'LAR AYNEN KALIYOR, DEĞİŞMEDİ) ... */

/* === DOSYANIN BAŞI AYNI, BURAYA KADAR HİÇBİR ŞEY DEĞİŞMEDİ === */

module.exports = async (req, res) => {
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

    const isInternal = raw.startsWith("job_");
    const looksLikeUUID =
      /^[0-9a-f-]{36}$/i.test(raw);

    let internal_job_id = isInternal || looksLikeUUID ? raw : null;
    let provider_job_id = !isInternal && !looksLikeUUID ? raw : null;
    let provider_song_ids = [];

    async function readJobObjFromRedis(internalId) {
      if (!internalId) return null;

      const k1 = `jobs/${internalId}/job.json`;
      const t1 = await redis.get(k1);
      const o1 = t1 ? JSON.parse(t1) : null;
      if (o1) return o1;

      const k2 = `job:${internalId}`;
      const t2 = await redis.get(k2);
      const o2 = t2 ? JSON.parse(t2) : null;
      if (o2) return o2;

      return null;
    }

    if (isInternal || looksLikeUUID) {
      let jobObj = await readJobObjFromRedis(internal_job_id);

      provider_job_id =
        String(jobObj?.provider_job_id || "").trim() || provider_job_id;

      let idsRaw =
        jobObj?.provider_song_ids ||
        jobObj?.providerSongIds ||
        jobObj?.song_ids ||
        jobObj?.songIds ||
        [];

      provider_song_ids = Array.isArray(idsRaw)
        ? idsRaw.map(String).filter(Boolean)
        : [];

      /* ===========================================================
         🔥 NEW: REDIS BOŞSA → DB META FALLBACK
      =========================================================== */

      if (provider_song_ids.length === 0) {
        const conn = pickConn();
        if (conn && internal_job_id) {
          try {
            const sql = neon(conn);
            const rows = await sql`
              select meta
              from jobs
              where meta->>'internal_job_id' = ${internal_job_id}
              order by created_at desc
              limit 1
            `;

            const meta = rows?.[0]?.meta || null;

            if (meta?.provider_song_ids?.length) {
              provider_song_ids = meta.provider_song_ids.map(String);
              provider_job_id =
                meta.provider_job_id || provider_song_ids[0] || provider_job_id;
            }
          } catch (e) {
            console.error("DB fallback error:", e);
          }
        }
      }

      if (provider_song_ids.length === 0 && provider_job_id) {
        provider_song_ids = [String(provider_job_id)];
      }
    }

    provider_song_ids = provider_song_ids.filter(Boolean);

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

    /* === BURADAN SONRASI DOSYANIN TAMAMI AYNI === */
    /* TopMediai call + normalize + archive + outputs kısmı değişmedi */

    const KEY = process.env.TOPMEDIAI_API_KEY;
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
    const top = JSON.parse(text);

    const arr = Array.isArray(top?.data)
      ? top.data
      : Array.isArray(top?.data?.data)
      ? top.data.data
      : null;

    let anyFail = false;
    let anyReady = false;
    const outputs = [];

    const READY_STATUSES = new Set([0, 2]);

    if (Array.isArray(arr)) {
      for (const item of arr) {
        const st = Number(item?.status);
        const trackId = String(item?.song_id || item?.id || "");
        const urlMp3 = item?.audio_url;

        const ready = !!urlMp3 && READY_STATUSES.has(st);

        if (ready) {
          anyReady = true;
          outputs.push({
            type: "audio",
            url: urlMp3,
            meta: {
              provider: "topmediai",
              trackId,
              status: st,
            },
          });
        }
      }
    }

    return res.status(200).json({
      ok: true,
      provider: "topmediai",
      provider_job_id,
      provider_song_ids,
      internal_job_id,
      state: anyReady ? "completed" : "processing",
      status: anyReady ? "completed" : "processing",
      outputs,
      topmediai: top,
    });
  } catch (err) {
    console.error("api/music/status error:", err);
    return res.status(200).json({
      ok: false,
      error: "proxy_error",
      detail: String(err?.message || err),
    });
  }
};
