// /api/jobs/import-fal.js
// Mevcut Fal request_id'leri DB'ye job olarak import eder

const { Client } = require("pg");

module.exports = async function handler(req, res) {
  try {
    const { request_ids } = req.body || {};

    if (!Array.isArray(request_ids) || request_ids.length === 0) {
      return res.status(400).json({ ok: false, error: "missing_request_ids" });
    }

    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    const endpointMap = {
      pro: "fal-ai/kling-video/v3/pro/text-to-video",
      standard: "fal-ai/kling-video/v3/standard/text-to-video",
    };

    const db = new Client({
      connectionString:
        process.env.POSTGRES_URL_NON_POOLING ||
        process.env.DATABASE_URL ||
        process.env.POSTGRES_URL,
    });

    await db.connect();

    const imported = [];

    for (const rid of request_ids) {
      // Pro ve standard dene (hangisi ise 200 dönecek)
      let data = null;
      let usedEndpoint = null;

      for (const ep of Object.values(endpointMap)) {
        const url = `https://queue.fal.run/${ep}/requests/${rid}/status`;

        const r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Key ${FAL_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        if (r.ok) {
          data = await r.json();
          usedEndpoint = ep;
          break;
        }
      }

      if (!data?.video?.url) continue;

      const videoUrl = data.video.url;

      const result = await db.query(
        `
        INSERT INTO jobs (provider, app, status, meta, outputs, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
        `,
        [
          "fal",
          "atmo",
          "COMPLETED",
          { request_id: rid, endpoint: usedEndpoint },
          JSON.stringify([
            {
              type: "video",
              url: videoUrl,
              meta: { app: "atmo", provider: "fal" },
            },
          ]),
        ]
      );

      imported.push({ rid, job_id: result.rows[0].id });
    }

    await db.end();

    return res.json({ ok: true, imported });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e.message,
    });
  }
};
