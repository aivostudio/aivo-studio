import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { request_ids } = req.body || {};
    if (!Array.isArray(request_ids) || !request_ids.length) {
      return res.status(400).json({ ok: false, error: "missing_request_ids" });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ ok: false, error: "missing_DATABASE_URL" });
    }

    const sql = neon(process.env.DATABASE_URL);

    const host = req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || "https";
    const base = `${proto}://${host}`;

    const results = [];

    for (const request_id of request_ids) {
      try {
        // Fal status çek
        const statusRes = await fetch(
          `${base}/api/providers/fal/video/status?request_id=${request_id}&app=atmo`
        );

        const statusJson = await statusRes.json();

        if (!statusJson?.ok || statusJson?.status !== "COMPLETED") {
          results.push({
            request_id,
            imported: false,
            reason: "not_completed",
          });
          continue;
        }

        const videoUrl =
          statusJson?.video?.url ||
          statusJson?.outputs?.[0]?.url ||
          null;

        if (!videoUrl) {
          results.push({
            request_id,
            imported: false,
            reason: "no_url",
          });
          continue;
        }

        // DB insert
        await sql`
          INSERT INTO jobs (
            job_id,
            user_id,
            app,
            type,
            status,
            outputs,
            meta,
            created_at
          )
          VALUES (
            gen_random_uuid(),
            ${"harunerkezen@gmail.com"},
            'atmo',
            'atmo',
            'COMPLETED',
            ${JSON.stringify([
              {
                type: "video",
                url: videoUrl,
                meta: { app: "atmo" },
              },
            ])},
            ${JSON.stringify({
              provider: "fal",
              provider_request_id: request_id,
            })},
            NOW()
          )
        `;

        results.push({ request_id, imported: true });

      } catch (innerErr) {
        console.error("Import error:", innerErr);
        results.push({
          request_id,
          imported: false,
          reason: "exception",
        });
      }
    }

    return res.json({ ok: true, results });

  } catch (err) {
    console.error("IMPORT FAL ATMO ERROR:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
