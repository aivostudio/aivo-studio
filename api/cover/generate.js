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

  const body = req.body || {};
  const prompt = String(body.prompt || "").trim();
  const style = body.style ?? null;
  const quality = String(body.quality || "artist").trim();
  const ratio = String(body.ratio || "1:1").trim();
  const imageUrl = String(body.imageUrl || "").trim();

  if (!prompt) {
    return res.status(400).json({ ok: false, error: "prompt_empty" });
  }

  if (!imageUrl) {
    return res.status(400).json({ ok: false, error: "image_url_empty" });
  }

  const sql = neon(conn);

  try {
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

    const metaSafe = {
      app: "cover",
      kind: "cover_image",
      provider: "fal",
      prompt,
      style,
      quality,
      ratio,
    };

    const outputsSafe = [
      {
        type: "image",
        url: imageUrl,
        meta: {
          app: "cover",
          prompt,
          style,
          quality,
          ratio,
        },
      },
    ];

    const inserted = await sql`
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
        'cover',
        'cover',
        'ready',
        ${prompt},
        ${metaSafe},
        ${JSON.stringify(outputsSafe)}::jsonb,
        now(),
        now()
      )
      returning id, user_uuid, app, status, created_at, outputs
    `;

    const job_id = String(inserted[0].id);

    return res.status(200).json({
      ok: true,
      job_id,
      user_uuid: inserted[0].user_uuid,
      app: inserted[0].app,
      status: inserted[0].status,
      created_at: inserted[0].created_at,
      imageUrl,
    });
  } catch (e) {
    console.error("cover generate failed:", e);
    return res.status(500).json({
      ok: false,
      error: "create_failed",
      message: String(e?.message || e),
    });
  }
}
