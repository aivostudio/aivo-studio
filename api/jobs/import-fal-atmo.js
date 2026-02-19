// /api/jobs/import-fal-atmo.js  (CommonJS)
// Tek seferlik import: Fal request_id -> (COMPLETED ise) video.url -> Neon jobs.outputs
// Not: Polling yok. Sadece bu endpoint çağrılınca Fal'a istek atar.

const { Client } = require("pg");

function pickDbUrl() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

function pickFalKey() {
  return process.env.FAL_KEY || process.env.FAL_API_KEY || "";
}

function nowIso() {
  return new Date().toISOString();
}

async function falStatus({ request_id, endpoint }) {
  const FAL_KEY = pickFalKey();
  if (!FAL_KEY) {
    return { ok: false, error: "missing_fal_key" };
  }

  // endpoint ASLA encode edilmez
  const base = `https://queue.fal.run/${String(endpoint).replace(/^\/+/, "")}`;
  const url = `${base}/requests/${encodeURIComponent(request_id)}/status`;

  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Key ${FAL_KEY}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({}),
  });

  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!r.ok) {
    return {
      ok: false,
      error: "fal_status_error",
      fal_status: r.status,
      request_id,
      endpoint,
      raw: data,
      debug_url: url,
    };
  }

  // Kling output: data.video.url
  const video_url =
    data?.video?.url ||
    data?.output?.video?.url ||
    data?.result?.video?.url ||
    null;

  const state = data?.status || data?.state || null; // örn: "COMPLETED", "IN_QUEUE", ...
  return { ok: true, request_id, endpoint, state, video_url, fal: data };
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const body = req.body || {};
    const request_ids = Array.isArray(body.request_ids) ? body.request_ids : [];
    if (!request_ids.length) {
      return res.status(400).json({ ok: false, error: "missing_request_ids" });
    }

    // Sende pro+standard karışık var. Burada request_id bazında endpoint seçiyoruz.
    // İstersen body.endpoints_by_id gönderebilirsin, yoksa default pro.
    const endpoints_by_id = body.endpoints_by_id || {};
    const default_endpoint =
      body.default_endpoint || "fal-ai/kling-video/v3/pro/text-to-video";

    // User bilgisi (senin mevcut API’lerde user_id / user_uuid var; yoksa fallback)
    const user_id =
      (req.headers["x-user-id"] || body.user_id || "").toString() ||
      (req.headers["x-user-email"] || "").toString() ||
      "";
    const user_uuid = (req.headers["x-user-uuid"] || body.user_uuid || "").toString();

    // DB bağlan
    const dbUrl = pickDbUrl();
    if (!dbUrl) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }
    const client = new Client({ connectionString: dbUrl });
    await client.connect();

    // jobs tablosu: (minimum varsayım)
    // job_id TEXT (uuid), app TEXT, type TEXT, status TEXT, state TEXT,
    // provider TEXT, provider_request_id TEXT,
    // prompt TEXT, outputs JSONB, meta JSONB,
    // user_id TEXT, user_uuid TEXT,
    // created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, error TEXT
    //
    // NOT: Eğer şema farklıysa, sadece aşağıdaki INSERT/UPDATE mapping’i uyarlarsın.

    const results = [];

    for (const ridRaw of request_ids) {
      const request_id = String(ridRaw || "").trim();
      if (!request_id) continue;

      const endpoint = endpoints_by_id[request_id] || default_endpoint;

      const st = await falStatus({ request_id, endpoint });
      if (!st.ok) {
        results.push({ request_id, imported: false, reason: st.error, details: st });
        continue;
      }

      const fal_state = st.state; // "COMPLETED" / "IN_QUEUE" / ...
      const video_url = st.video_url;

      const isCompleted = String(fal_state || "").toUpperCase() === "COMPLETED";
      if (!isCompleted || !video_url) {
        results.push({
          request_id,
          imported: false,
          reason: "not_completed",
          fal_state,
          has_video_url: !!video_url,
        });
        continue;
      }

      // outputs formatı (PPE/RightPanel için)
      const outputs = [
        {
          type: "video",
          url: video_url,
          meta: { app: "atmo", provider: "fal", endpoint },
        },
      ];

      // job_id: aynı request_id’yi job_id olarak kullanmak pratik (istersen uuid üret)
      const job_id = request_id;

      const meta = {
        app: "atmo",
        provider: "fal",
        endpoint,
        source: "import",
        imported_at: nowIso(),
      };

      const prompt =
        (st.fal && (st.fal.prompt || st.fal.input?.prompt || st.fal.input?.text)) ||
        null;

      // Upsert: aynı provider_request_id/app varsa update
      await client.query(
        `
        INSERT INTO jobs
          (job_id, app, type, status, state, provider, provider_request_id,
           prompt, outputs, meta, user_id, user_uuid, created_at, updated_at, error)
        VALUES
          ($1,   $2,  $3,   $4,     $5,    $6,      $7,
           $8,    $9::jsonb, $10::jsonb, $11,   $12,      NOW(),     NOW(),     NULL)
        ON CONFLICT (job_id)
        DO UPDATE SET
          status = EXCLUDED.status,
          state  = EXCLUDED.state,
          provider = EXCLUDED.provider,
          provider_request_id = EXCLUDED.provider_request_id,
          prompt = COALESCE(EXCLUDED.prompt, jobs.prompt),
          outputs = EXCLUDED.outputs,
          meta = (jobs.meta || EXCLUDED.meta),
          user_id = COALESCE(EXCLUDED.user_id, jobs.user_id),
          user_uuid = COALESCE(EXCLUDED.user_uuid, jobs.user_uuid),
          updated_at = NOW(),
          error = NULL
        `,
        [
          job_id,
          "atmo",
          "atmo",
          "ready",
          "ready",
          "fal",
          request_id,
          prompt,
          JSON.stringify(outputs),
          JSON.stringify(meta),
          user_id || null,
          user_uuid || null,
        ]
      );

      results.push({ request_id, imported: true, video_url });
    }

    await client.end();

    return res.status(200).json({
      ok: true,
      imported_count: results.filter((x) => x.imported).length,
      results,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e?.message || String(e),
    });
  }
};
