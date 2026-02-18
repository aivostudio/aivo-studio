// /api/jobs/import-video-urls.js
// Fal mp4 URL'lerini direkt DB'ye job olarak import eder (Fal status çağırmaz)

const { Client } = require("pg");

module.exports = async function handler(req, res) {
  try {
    const urls = req.body?.urls;

    if (!Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ ok: false, error: "missing_urls" });
    }

    const dbUrl =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    if (!dbUrl) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    const db = new Client({ connectionString: dbUrl });
    await db.connect();

    const imported = [];

    for (const u of urls) {
      const url = (u || "").toString().trim();
      if (!url.startsWith("http")) continue;
      if (!url.includes(".mp4")) continue;

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
          { imported_from: "manual_url" },
          JSON.stringify([
            {
              type: "video",
              url,
              meta: { app: "atmo", provider: "fal" },
            },
          ]),
        ]
      );

      imported.push({ url, job_id: result.rows[0].id });
    }

    await db.end();

    return res.json({ ok: true, imported_count: imported.length, imported });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: e.message,
    });
  }
};
