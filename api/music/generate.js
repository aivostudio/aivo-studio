// api/music/generate.js
// ✅ KV (Redis) + ✅ Neon jobs INSERT (skeleton)
// - Generates internal_job_id (job_...)
// - Calls TopMediai create via /api/providers/topmediai/music/create
// - Writes mapping + job meta to Redis
// - Inserts a row into Neon `jobs` table (best-effort auth)

export const config = { runtime: "nodejs" };

const { getRedis } = require("../_kv");
const fetchFn = globalThis.fetch || require("node-fetch");
const { neon } = require("@neondatabase/serverless");

// NOTE: auth modülü sende bazı endpointlerde ESM, bazı yerde CJS görünüyor.
// Burada CJS require ile güvenli alıyoruz:
let requireAuth = null;
try {
  const authModule = require("../_lib/auth.js");
  requireAuth = authModule?.requireAuth || authModule?.default?.requireAuth || null;
} catch {
  requireAuth = null;
}

function nowISO() {
  return new Date().toISOString();
}

function uuidLike() {
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function safeJson(res, obj, code = 200) {
  return res.status(code).json(obj);
}

function safeParseJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function getOrigin(req) {
  const proto =
    (req.headers["x-forwarded-proto"] || "").toString().split(",")[0].trim() || "https";
  const host =
    (req.headers["x-forwarded-host"] || "").toString().split(",")[0].trim() ||
    (req.headers.host || "").toString().trim();

  return host ? `${proto}://${host}` : "https://aivo.tr";
}

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

function cookieValue(cookieHeader, name) {
  const s = String(cookieHeader || "");
  const parts = s.split(";").map((x) => x.trim());
  for (const p of parts) {
    if (!p) continue;
    const i = p.indexOf("=");
    if (i < 0) continue;
    const k = p.slice(0, i).trim();
    const v = p.slice(i + 1).trim();
    if (k === name) return v;
  }
  return "";
}

module.exports = async (req, res) => {
  try {
    if (req.method === "OPTIONS") return res.status(204).end();

    if (req.method !== "POST") {
      return safeJson(res, { ok: false, error: "method_not_allowed" }, 405);
    }

    const redis = getRedis();
    const body = req.body || {};
    const prompt = String(body.prompt || body.text || "").trim();

    if (!prompt) {
      return safeJson(res, { ok: false, error: "missing_prompt" }, 400);
    }

    // UI'dan gelen ek alanlar
    const title = String(body.title || "").trim();
    const lyrics = String(body.lyrics || "").trim();
    const vocal = String(body.vocal || "").trim();
    const mood = String(body.mood || "").trim();

    let mode = String(body.mode || "").trim();
    if (!mode) {
      mode = vocal === "Enstrümantal (Vokalsiz)" ? "instrumental" : "vocals";
    }

    // ✅ internal id bizde kalsın (UI + KV mapping için)
    const internal_job_id = `job_${uuidLike()}`;

    // ✅ TopMediai create'i direkt Vercel üzerinden çağır
    const origin = getOrigin(req);
    const providerCreateUrl = `${origin}/api/providers/topmediai/music/create`;

    // Provider payload
    const providerPayload = { prompt };
    if (title) providerPayload.title = title;
    if (lyrics) providerPayload.lyrics = lyrics;
    if (mode) providerPayload.mode = mode;
    if (vocal) providerPayload.vocal = vocal;
    if (mood) providerPayload.mood = mood;

    let pr;
    try {
      pr = await fetchFn(providerCreateUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify(providerPayload),
      });
    } catch (e) {
      return safeJson(
        res,
        {
          ok: false,
          error: "provider_create_fetch_failed",
          internal_job_id,
          detail: String(e?.message || e),
          provider_create_url: providerCreateUrl,
        },
        200
      );
    }

    const ptext = await pr.text();
    const pjson = safeParseJson(ptext);

    if (!pr.ok || !pjson || pjson.ok === false) {
      return safeJson(
        res,
        {
          ok: false,
          error: "provider_create_failed",
          internal_job_id,
          provider_status: pr.status,
          provider_create_url: providerCreateUrl,
          sample: String(ptext || "").slice(0, 1000),
          provider_response: pjson,
        },
        200
      );
    }

    const provider_job_id = String(pjson.provider_job_id || pjson.job_id || pjson.id || "").trim();
    if (!provider_job_id) {
      return safeJson(
        res,
        {
          ok: false,
          error: "provider_missing_provider_job_id",
          internal_job_id,
          provider_create_url: providerCreateUrl,
          provider_response: pjson,
        },
        200
      );
    }

    // ✅ NEW: 2 song id (tracks ids)
    const provider_song_ids_raw =
      pjson.provider_song_ids ||
      pjson.providerSongIds ||
      pjson.song_ids ||
      pjson.songIds ||
      pjson?.topmediai?.data?.song_ids ||
      [];

    const provider_song_ids = Array.isArray(provider_song_ids_raw)
      ? provider_song_ids_raw.map((x) => String(x)).filter(Boolean)
      : [];

    // KV keys
    const mapKey = `providers/music/${provider_job_id}.json`;
    const jobMetaKey = `jobs/${internal_job_id}/job.json`;
    const outputsIndexKey = `jobs/${internal_job_id}/outputs/index.json`;
    const jobKey = `job:${internal_job_id}`;
    const providerMapKey = `provider_map:${provider_job_id}`;

    // 1) provider -> internal mapping
    await redis.set(
      providerMapKey,
      JSON.stringify({
        provider_job_id,
        internal_job_id,
        created_at: nowISO(),
        provider_song_ids: provider_song_ids.length ? provider_song_ids : undefined,
      })
    );

    // 2) provider meta (debug)
    await redis.set(
      mapKey,
      JSON.stringify({
        ok: true,
        kind: "music",
        provider_job_id,
        provider_song_ids: provider_song_ids.length ? provider_song_ids : undefined,
        internal_job_id,
        state: "queued",
        prompt: prompt || null,
        created_at: nowISO(),
        provider: {
          create_url: providerCreateUrl,
          resp: pjson,
        },
      })
    );

    // 3) job meta KV
    const jobObj = {
      id: internal_job_id,
      kind: "music",
      provider_job_id,
      provider_song_ids: provider_song_ids.length ? provider_song_ids : undefined,
      status: "processing",
      state: "queued",
      prompt: prompt || null,
      title: title || null,
      lyrics: lyrics || null,
      mode: mode || null,
      vocal: vocal || null,
      mood: mood || null,
      created_at: nowISO(),
      updated_at: nowISO(),
      outputs: [],
      // db_job_id aşağıda doldurulacak
      db_job_id: null,
    };

    await redis.set(jobMetaKey, JSON.stringify(jobObj));
    await redis.set(jobKey, JSON.stringify(jobObj));

    // 4) outputs index boş başlasın
    await redis.set(outputsIndexKey, JSON.stringify({ outputs: [] }));

    // ---------------------------------------------------------
    // ✅ 5) NEON INSERT (jobs table) — skeleton kayıt
    // ---------------------------------------------------------
    const conn = pickConn();
    let db_job_id = null;
    let db_insert_ok = false;
    let db_insert_error = null;

    if (!conn) {
      db_insert_error = "missing_db_env";
    } else {
      const sql = neon(conn);

      // best-effort auth: email/user_id yakalarsak ilişkilendiririz
      let auth = null;
      try {
        if (typeof requireAuth === "function") {
          auth = await requireAuth(req);
        }
      } catch {
        auth = null;
      }

      const email = auth?.email ? String(auth.email) : "";
      const user_id =
        email ||
        (auth?.user_id ? String(auth.user_id) : "") ||
        (cookieValue(req.headers?.cookie, "aivo_session")
          ? `sess:${cookieValue(req.headers?.cookie, "aivo_session").slice(0, 16)}`
          : "unknown");

      const meta = {
        provider: "topmediai",
        prompt,
        provider_job_id,
        provider_song_ids: provider_song_ids.length ? provider_song_ids : undefined,
        internal_job_id, // KV id
        title: title || undefined,
        lyrics: lyrics || undefined,
        mode: mode || undefined,
        vocal: vocal || undefined,
        mood: mood || undefined,
      };

      try {
        // status sütununda default yoksa queued yazmak güvenli.
        const rows = await sql`
          insert into jobs (user_id, app, type, provider, prompt, meta, outputs, error, request_id, status, created_at, updated_at)
          values (
            ${user_id},
            ${"music"},
            ${"music"},
            ${"topmediai"},
            ${prompt},
            ${meta},
            ${[]},
            ${null},
            ${provider_job_id},
            ${"queued"},
            now(),
            now()
          )
          returning id
        `;

        db_job_id = rows?.[0]?.id ? String(rows[0].id) : null;
        db_insert_ok = !!db_job_id;

        // KV job obj içine db id ekleyelim (status/update adımında lazım olacak)
        if (db_job_id) {
          jobObj.db_job_id = db_job_id;
          jobObj.updated_at = nowISO();
          await redis.set(jobMetaKey, JSON.stringify(jobObj));
          await redis.set(jobKey, JSON.stringify(jobObj));
        }
      } catch (e) {
        db_insert_ok = false;
        db_insert_error = String(e?.message || e);
      }
    }

    // ✅ response: internal_job_id (KV) + db_job_id (Neon)
    return safeJson(res, {
      ok: true,
      state: "queued",
      provider_job_id,
      provider_song_ids: provider_song_ids.length ? provider_song_ids : undefined,
      internal_job_id,
      db_job_id: db_job_id || null,
      db: {
        ok: db_insert_ok,
        error: db_insert_ok ? null : db_insert_error,
      },
      keys: { mapKey, jobMetaKey, outputsIndexKey, providerMapKey },
      provider: { ok: true, create_url: providerCreateUrl },
    });
  } catch (err) {
    console.error("music/generate error:", err);
    return safeJson(
      res,
      { ok: false, error: "server_error", message: String(err?.message || err) },
      500
    );
  }
};
