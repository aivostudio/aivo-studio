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

  // --- auth (create-atmo ile aynı mantık) ---
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
  const style = body.style ? String(body.style) : null;
  const quality = body.quality ? String(body.quality) : null;
  const n = Number(body.n || 1);
  const ratio = body.ratio ? String(body.ratio) : "1:1";

  if (!prompt) {
    return res.status(400).json({ ok: false, error: "Prompt boş" });
  }

  const sql = neon(conn);

  try {
    // canonical user resolve
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

    // mock görsel (şimdilik)
    const seed = encodeURIComponent(prompt.slice(0, 120));
    const imageUrl = `https://picsum.photos/seed/${seed}/768/768`;

    const metaSafe = {
      app: "cover",
      kind: "cover_image",
      provider: "mock",
      prompt,
      style,
      quality,
      n,
      ratio,
      email,
      mock: true,
    };

    const outputs = [
      {
        type: "image",
        url: imageUrl,
        meta: {
          app: "cover",
          kind: "image",
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
        ${JSON.stringify(metaSafe)}::jsonb,
        ${JSON.stringify(outputs)}::jsonb,
        now(),
        now()
      )
      returning id, user_uuid, app, status, created_at
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
      prompt,
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
