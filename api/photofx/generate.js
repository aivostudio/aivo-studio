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
  const styles = Array.isArray(body.styles)
    ? body.styles.map((x) => String(x || "").trim()).filter(Boolean)
    : [];
  const style = String(body.style || styles[0] || "neon-pulse").trim();
  const quality = String(body.quality || "standard").trim();
  const ratio = String(body.ratio || "9:16").trim();
  const duration = String(body.duration || "10").trim();
  const motionLevel = String(body.motionLevel || "balanced").trim();
  const effectStrength = String(body.effectStrength || "medium").trim();
  const colorMood = String(body.colorMood || "original").trim();
  const transitionSpeed = String(body.transitionSpeed || "normal").trim();
  const includeAudio = !!body.includeAudio;
  const imageUrl = String(body.imageUrl || "").trim();
  const audioUrl = String(body.audioUrl || "").trim();
  const persistedAudioUrl = audio_url || audioUrl || null;
  const providerJobId = String(body.providerJobId || "").trim();
  const providerName = String(body.providerName || "fal").trim();
  const providerVariant = String(body.providerVariant || "").trim();
  const providerModel = String(body.providerModel || "").trim();
  const status = String(body.status || "processing").trim().toLowerCase();

  if (!prompt) {
    return res.status(400).json({ ok: false, error: "prompt_empty" });
  }

  if (!imageUrl) {
    return res.status(400).json({ ok: false, error: "image_url_empty" });
  }

  if (!providerJobId) {
    return res.status(400).json({ ok: false, error: "provider_job_id_empty" });
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
      app: "photofx",
      kind: "photofx_video",
      provider: providerName,
      providerJobId,
      providerVariant,
      model:
        providerModel ||
        (quality === "premium"
          ? "fal-ai/ltx-2.3/image-to-video/pro"
          : "fal-ai/ltx-2.3/image-to-video/fast"),
      prompt,
      style,
      styles,
      quality,
      ratio,
      duration,
      motionLevel,
      effectStrength,
      colorMood,
      transitionSpeed,
      includeAudio,
      imageUrl,
       audioUrl: persistedAudioUrl,
      audio_url: persistedAudioUrl,
      music_url: persistedAudioUrl,
    };

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
        'photofx',
        'photofx',
        ${status},
        ${prompt},
        ${metaSafe},
        '[]'::jsonb,
        now(),
        now()
      )
      returning id, user_uuid, app, status, created_at, outputs, meta
    `;

    const job_id = String(inserted[0].id);

    return res.status(200).json({
      ok: true,
      job_id,
      user_uuid: inserted[0].user_uuid,
      app: inserted[0].app,
      status: inserted[0].status,
      created_at: inserted[0].created_at,
      providerJobId,
    });
  } catch (e) {
    console.error("photofx generate failed:", e);
    return res.status(500).json({
      ok: false,
      error: "create_failed",
      message: String(e?.message || e),
    });
  }
}
