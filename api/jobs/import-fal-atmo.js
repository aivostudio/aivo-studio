import { query } from "../../lib/db.js"; // senin db helper neyse onu kullan
import fetch from "node-fetch";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const { request_ids } = req.body || {};
    if (!Array.isArray(request_ids) || !request_ids.length) {
      return res.status(400).json({ ok: false, error: "missing_request_ids" });
    }

    const results = [];

    for (const request_id of request_ids) {
      // 1️⃣ Fal status çek
      const r = await fetch(
        `${process.env.BASE_URL}/api/providers/fal/video/status?request_id=${request_id}&app=atmo`
      );

      const j = await r.json();

      if (!j?.ok || j?.status !== "COMPLETED") {
        results.push({ request_id, imported: false, reason: "not_completed" });
        continue;
      }

      const videoUrl =
        j?.video?.url ||
        j?.outputs?.[0]?.url ||
        null;

      if (!videoUrl) {
        results.push({ request_id, imported: false, reason: "no_url" });
        continue;
      }

      // 2️⃣ DB insert
      await query(`
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
          $1,
          'atmo',
          'atmo',
          'COMPLETED',
          $2,
          $3,
          NOW()
        )
      `, [
        req.user?.email || "harunerkezen@gmail.com",
        JSON.stringify([
          {
            type: "video",
            url: videoUrl,
            meta: { app: "atmo" }
          }
        ]),
        JSON.stringify({
          provider: "fal",
          provider_request_id: request_id
        })
      ]);

      results.push({ request_id, imported: true });
    }

    return res.json({ ok: true, results });

  } catch (err) {
    console.error("IMPORT FAL ATMO ERROR:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}
