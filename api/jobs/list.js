import { neon } from "@neondatabase/serverless";
import { getUserFromRequest } from "../_lib/auth.js";

export default async function handler(req, res) {
  try {
    const { app } = req.query;

    if (!app) {
      return res.status(400).json({ ok: false, error: "missing_app" });
    }

    const user = await getUserFromRequest(req);
    const user_id = user?.id || user?.user_id || null;

    if (!user_id) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const conn =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    const sql = neon(conn);

    const rows = await sql`
      select id, user_id, app, status, prompt, meta, outputs, error, created_at, updated_at
      from jobs
      where app = ${app}
        and user_id = ${user_id}
      order by created_at desc
      limit 50
    `;

    return res.status(200).json({
      ok: true,
      app,
      items: rows.map(r => ({
        job_id: r.id,          // UUID = resmi job_id
        user_id: r.user_id,
        app: r.app,
        status: r.status,
        state:
          r.status === "completed" ? "COMPLETED" :
          r.status === "failed" ? "FAILED" :
          r.status === "running" ? "RUNNING" :
          "PENDING",
        prompt: r.prompt || null,
        meta: r.meta || null,
        outputs: r.outputs || [],
        error: r.error || null,
        created_at: r.created_at,
        updated_at: r.updated_at
      }))
    });

  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "list_failed",
      message: String(e?.message || e)
    });
  }
}
