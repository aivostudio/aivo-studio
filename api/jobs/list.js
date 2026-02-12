import { neon } from "@neondatabase/serverless";

// CommonJS helper'ı ESM içinde böyle alıyoruz:
import authPkg from "../_lib/auth.js";
const { requireAuth } = authPkg;

export default async function handler(req, res) {
  try {
    const { app } = req.query;

    if (!app) {
      return res.status(400).json({ ok: false, error: "missing_app" });
    }

    const payload = requireAuth(req, res);
    if (!payload) return; // requireAuth zaten 401/500 döndü

    // payload örn: { sub: userId/email, email, iat, exp }
    const user_id = payload.user_id || payload.id || payload.sub || null;
    if (!user_id) {
      return res.status(401).json({ ok: false, error: "unauthorized_missing_sub" });
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
        and user_id = ${String(user_id)}
      order by created_at desc
      limit 50
    `;

    return res.status(200).json({
      ok: true,
      app,
      items: rows.map(r => ({
        job_id: r.id,
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
