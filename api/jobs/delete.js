// /api/jobs/delete.js
export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import authModule from "../_lib/auth.js";
const { requireAuth } = authModule;

function normId(x) {
  return String(x || "").trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const conn =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED;

  if (!conn) {
    return res.status(500).json({ ok: false, error: "missing_db_env" });
  }

  // --- auth ---
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: String(e?.message || e),
    });
  }

  const user_id = auth?.user_id ? String(auth.user_id) : null;
  const email = auth?.email ? String(auth.email) : null;
  const legacy_user_id = email ? `${email}:jobs` : null;

  if (!user_id && !email) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  // body normalize
  let body = req.body || {};
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const job_id = normId(body.job_id || body.id || req.query.job_id || req.query.id);
  if (!job_id) {
    return res.status(400).json({ ok: false, error: "missing_job_id" });
  }

  const sql = neon(conn);

  try {
    // 1) soft delete: sadece bu kullanıcıya aitse
    const rows = await sql`
      update jobs
      set deleted_at = now(),
          updated_at = now()
      where id = ${job_id}::uuid
        and deleted_at is null
        and (
          user_id::text = ${user_id || ""}
          or user_id::text = ${email || ""}
          or user_id::text = ${legacy_user_id || ""}
        )
      returning id
    `;

    if (!rows?.length) {
      // job yok ya da kullanıcıya ait değil ya da zaten silinmiş
      return res.status(404).json({ ok: false, error: "not_found_or_not_owned", job_id });
    }

    return res.status(200).json({ ok: true, job_id: String(rows[0].id) });
  } catch (e) {
    console.error("jobs/delete failed:", e);
    return res.status(500).json({
      ok: false,
      error: "delete_failed",
      message: String(e?.message || e),
    });
  }
}
