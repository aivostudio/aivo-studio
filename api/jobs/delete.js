// /api/jobs/list.js
export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import { requireAuth } from "../_lib/auth.js";

function normalizeApp(x) {
  return String(x || "").trim().toLowerCase();
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  try {
    const conn =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    // AUTH
    const auth = await requireAuth(req);
    const user_id = auth?.user_id ? String(auth.user_id) : null;
    const email = auth?.email ? String(auth.email) : null;
    const legacy_user_id = email ? `${email}:jobs` : null;

    if (!user_id && !email) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const app = normalizeApp(req.query.app);
    if (!app) {
      return res.status(400).json({ ok: false, error: "missing_app" });
    }

    const sql = neon(conn);

    // ✅ SOFT DELETE FILTER EKLENDİ
    const rows = await sql`
      select *
      from jobs
      where app = ${app}
        and deleted_at is null
        and (
          user_id::text = ${user_id || ""}
          or user_id::text = ${email || ""}
          or user_id::text = ${legacy_user_id || ""}
        )
      order by created_at desc
      limit 100
    `;

    return res.status(200).json({
      ok: true,
      app,
      auth: true,
      user_uuid: user_id,
      email,
      items: rows || [],
    });

  } catch (e) {
    console.error("jobs/list failed:", e);
    return res.status(500).json({
      ok: false,
      error: "list_failed",
      message: String(e?.message || e),
    });
  }
}
