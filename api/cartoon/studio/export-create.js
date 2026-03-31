export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import authModule from "../../_lib/auth.js";

const { requireAuth } = authModule;

function safeText(value) {
  return String(value || "").trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeScene(scene, index) {
  return {
    order: safeNumber(scene?.order, index + 1),
    id: safeText(scene?.id),
    title: safeText(scene?.title || `Sahne ${index + 1}`),
    duration: safeNumber(scene?.duration, 0),
    videoUrl: safeText(scene?.videoUrl),
    fileName: safeText(scene?.fileName)
  };
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

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: String(e?.message || e)
    });
  }

  const email = safeText(auth?.email);
  if (!email) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: "missing_email"
    });
  }

  const body =
    typeof req.body === "string"
      ? JSON.parse(req.body || "{}")
      : (req.body || {});

  const exportBlock = body?.export || {};
  const audioBlock = body?.audio || {};
  const textBlock = body?.text || {};
  const brandingBlock = body?.branding || {};
  const coverBlock = body?.cover || {};
  const summaryBlock = body?.summary || {};

  const rawScenes = safeArray(exportBlock?.scenes);
  const scenes = rawScenes
    .map((scene, index) => normalizeScene(scene, index))
    .filter((scene) => scene.videoUrl);

  if (!scenes.length) {
    return res.status(400).json({
      ok: false,
      error: "scenes_empty"
    });
  }

  const format = safeText(exportBlock?.format || "16:9");
  const sceneCount = safeNumber(exportBlock?.sceneCount, scenes.length);
  const totalDuration = safeNumber(
    exportBlock?.totalDuration,
    scenes.reduce((sum, scene) => sum + safeNumber(scene.duration, 0), 0)
  );

  const title = safeText(textBlock?.title);
  const description = safeText(textBlock?.description);
  const subtitleMode = safeText(textBlock?.subtitleMode);

  const readyMusic = safeText(audioBlock?.readyMusic);
  const audioMode = safeText(audioBlock?.mode);
  const musicLevel = safeText(audioBlock?.musicLevel);

   const voiceFile = {
    hasFile: !!audioBlock?.voiceFile?.hasFile,
    name: safeText(audioBlock?.voiceFile?.name),
    type: safeText(audioBlock?.voiceFile?.type),
    size: safeNumber(audioBlock?.voiceFile?.size, 0),
    url: safeText(audioBlock?.voiceFile?.url),
    uploadStatus: safeText(audioBlock?.voiceFile?.uploadStatus)
  };

   const logoFile = {
    hasFile: !!brandingBlock?.logoFile?.hasFile,
    name: safeText(brandingBlock?.logoFile?.name),
    type: safeText(brandingBlock?.logoFile?.type),
    size: safeNumber(brandingBlock?.logoFile?.size, 0),
    url: safeText(brandingBlock?.logoFile?.url),
    uploadStatus: safeText(brandingBlock?.logoFile?.uploadStatus)
  };

 const watermarkMode = safeText(brandingBlock?.watermarkMode);
const logoPosition = safeText(brandingBlock?.logoPosition || "bottom-right");
const logoPos = safeText(brandingBlock?.logoPos || "br");
  const customCoverFile = {
    hasFile: !!coverBlock?.customCoverFile?.hasFile,
    name: safeText(coverBlock?.customCoverFile?.name),
    type: safeText(coverBlock?.customCoverFile?.type),
    size: safeNumber(coverBlock?.customCoverFile?.size, 0)
  };

  const videoFrame = safeText(coverBlock?.videoFrame);

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
        email
      });
    }

    const user_uuid = String(userRow[0].id);

    const metaSafe = {
      app: "cartoon",
      mode: "studio_export",
      format,
      title,
      description,
      subtitleMode,
      readyMusic,
      audioMode,
      musicLevel,
      voiceFile,
     logoFile,
     watermarkMode,
     logoPosition,
     logo_pos: logoPos,
     videoFrame,
      customCoverFile,
      summary: {
        sceneCount: safeNumber(summaryBlock?.sceneCount, sceneCount),
        totalDuration: safeNumber(summaryBlock?.totalDuration, totalDuration),
        format: safeText(summaryBlock?.format || format),
        hasLogo: !!summaryBlock?.hasLogo,
        hasVoiceFile: !!summaryBlock?.hasVoiceFile,
        hasCustomCover: !!summaryBlock?.hasCustomCover
      },
      scenes
    };

    const outputsSafe = [];

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
        'studio_export',
        'cartoon',
        'queued',
        ${title || description || 'cartoon studio export'},
        ${metaSafe},
        ${JSON.stringify(outputsSafe)}::jsonb,
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
      queued: true,
      sceneCount: scenes.length,
      totalDuration,
      format
    });
  } catch (e) {
    console.error("cartoon studio export create failed:", e);
    return res.status(500).json({
      ok: false,
      error: "create_failed",
      message: String(e?.message || e)
    });
  }
}
