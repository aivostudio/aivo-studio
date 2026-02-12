import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  try {
    const { app } = req.query;

    if (!app) {
      return res.status(400).json({ ok: false, error: "missing_app" });
    }

    const sql = neon(process.env.POSTGRES_URL_NON_POOLING);

    // TODO: gerçek user_id auth middleware'den alınmalı
    const user_id = req.headers["x-user-id"] || "dev-user";

    const rows = await sql`
      select id, app, status, prompt, outputs, created_at, updated_at
      from jobs
      where user_id = ${user_id}
      and app = ${app}
      order by created_at desc
      limit 50
    `;

    return res.status(200).json({
      ok: true,
      app,
      items: rows.map(r => ({
        job_id: r.id,                 // UUID = resmi job_id
        app: r.app,
        status: r.status,
        state:
          r.status === "completed" ? "COMPLETED" :
          r.status === "failed" ? "FAILED" :
          r.status === "running" ? "RUNNING" :
          "PENDING",
        outputs: r.outputs || [],
        created_at: r.created_at,
        updated_at: r.updated_at
      }))
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "list_failed",
      message: String(e.message || e)
    });
  }
}
