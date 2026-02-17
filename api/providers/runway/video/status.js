import { neon } from "@neondatabase/serverless";

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  try {
    const RUNWAYML_API_SECRET = process.env.RUNWAYML_API_SECRET;
    const conn =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    if (!RUNWAYML_API_SECRET) {
      return res.status(500).json({ ok: false, error: "missing_RUNWAYML_API_SECRET" });
    }
    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    const request_id = req.query.request_id;
    const job_id = req.query.job_id;

    if (!request_id || !job_id) {
      return res.status(400).json({ ok: false, error: "missing_request_id_or_job_id" });
    }

    const sql = neon(conn);

    /* 1️⃣ Runway poll */
    const r = await fetch(
      `https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(request_id)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${RUNWAYML_API_SECRET}`,
          "X-Runway-Version": "2024-11-06",
        },
      }
    );

    const data = await r.json().catch(() => ({}));

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: "runway_status_failed",
        details: data,
      });
    }

    const st = String(data.status || data.state || "").toUpperCase();

    let state = "RUNNING";
    if (["SUCCEEDED", "COMPLETED"].includes(st)) state = "COMPLETED";
    if (["FAILED", "ERROR"].includes(st)) state = "FAILED";
    if (["IN_QUEUE", "QUEUED", "PENDING"].includes(st)) state = "RUNNING";

    /* 2️⃣ Video URL yakala */
    let video_url = null;
    const output = data.output || data.outputs || data.result;

    if (typeof output === "string" && output.startsWith("http")) {
      video_url = output;
    }

    if (Array.isArray(output)) {
      const hit = output.find(
        (x) =>
          (typeof x === "string" && x.startsWith("http")) ||
          (x?.url && String(x.url).startsWith("http"))
      );
      video_url = typeof hit === "string" ? hit : hit?.url || null;
    }

    if (!video_url && data?.output?.video_url) {
      video_url = data.output.video_url;
    }

    /* 3️⃣ DB UPDATE (source of truth) */
    if (state === "COMPLETED" && video_url) {
      await sql`
        update jobs
        set
          status = 'COMPLETED',
          outputs = jsonb_build_array(
            jsonb_build_object(
              'type','video',
              'url',${video_url},
              'meta', jsonb_build_object('app','video','provider','runway')
            )
          ),
          updated_at = now()
        where id = ${job_id}
      `;
    }

    if (state === "FAILED") {
      await sql`
        update jobs
        set status = 'FAILED',
            updated_at = now()
        where id = ${job_id}
      `;
    }

    /* 4️⃣ UI response format */
    const outputs =
      state === "COMPLETED" && video_url
        ? [{ type: "video", url: video_url }]
        : [];

    return res.status(200).json({
      ok: true,
      job_id,
      request_id,
      state,
      outputs,
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
    });
  }
}
