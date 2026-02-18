export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import authModule from "../_lib/auth.js";
const { requireAuth } = authModule;

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

  const email = auth?.email ? String(auth.email) : null;

  if (!email) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: "missing_email",
    });
  }

  const sql = neon(conn);

  try {
    // 🔥 canonical user resolve
    const userRow = await sql`
      select id
      from users
      where email = ${email}
      limit 1
    `;

    if (!userRow.length) {
      return res.status(401).json({
        ok: false,
        error: "user_not_found",
        email,
      });
    }

    const user_uuid = String(userRow[0].id);

    const body = req.body || {};
    const prompt = body.prompt ? String(body.prompt) : null;
    const metaIn = body.meta || null;

    // ✅ meta'yı güvenli normalize et + atmo kimliğini garanti yaz
    const metaSafe = {
      ...(metaIn && typeof metaIn === "object" ? metaIn : {}),
      app: "atmo",
      kind: "atmo_video",
    };

    // 🔥 canonical job insert
    const rows = await sql`
      insert into jobs (
        user_id,
        user_uuid,
        type,
        app,
        status,
        prompt,
        meta,
        outputs,
        created_at,
        updated_at
      )
      values (
        ${email},
        ${user_uuid}::uuid,
        'atmo',
        'atmo',
        'queued',
        ${prompt},
        ${metaSafe},
        '[]'::jsonb,
        now(),
        now()
      )
      returning id, user_uuid, app, status, created_at
    `;

    return res.status(200).json({
      ok: true,
      job_id: rows[0].id,
      user_uuid: rows[0].user_uuid,
      app: rows[0].app,
      status: rows[0].status,
      created_at: rows[0].created_at,
    });
  } catch (e) {
    console.error("create-atmo failed:", e);
    return res.status(500).json({
      ok: false,
      error: "create_failed",
      message: String(e?.message || e),
    });
  }
}
