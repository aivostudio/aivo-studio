// /api/jobs/delete.js
export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import { requireAuth } from "../_lib/auth.js";

function normalizeApp(x) {
  return String(x || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  try {
    const conn =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    if (!conn) return res.status(500).json({ ok: false, error: "missing_db_env" });

    // AUTH
    const auth = await requireAuth(req);
    const user_id = auth?.user_id ? String(auth.user_id) : null;
    const email = auth?.email ? String(auth.email) : null;
    const legacy_user_id = email ? `${email}:jobs` : null;

    if (!user_id && !email) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const body = req.body || {};
    const job_id = String(body.job_id || body.id || "").trim();
    const app = normalizeApp(body.app);

    if (!job_id) return res.status(400).json({ ok: false, error: "missing_job_id" });
    if (!app) return res.status(400).json({ ok: false, error: "missing_app" });

    const sql = neon(conn);

    // ✅ SOFT DELETE (kalıcı): deleted_at set
    // ✅ sadece kendi job'unu silebilir (user_id/email/legacy match)
    const rows = await sql`
      update jobs
      set deleted_at = now()::timestamp,
          updated_at = now()::timestamp
      where id = ${job_id}
        and app = ${app}
        and deleted_at is null
        and (
          user_id::text = ${user_id || ""}
          or user_id::text = ${email || ""}
          or user_id::text = ${legacy_user_id || ""}
        )
      returning id
    `;

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        ok: false,
        error: "not_found_or_forbidden",
        job_id,
        app,
      });
    }

    return res.status(200).json({ ok: true, job_id, app, deleted: true });
  } catch (e) {
    console.error("jobs/delete failed:", e);
    return res.status(500).json({
      ok: false,
      error: "delete_failed",
      message: String(e?.message || e),
      stack: String(e?.stack || ""),
    });
  }
}
