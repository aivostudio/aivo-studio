export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import { requireAuth } from "../../../_lib/auth.js";

function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildPayload(body) {
  return {
    app: "cartoon",
    mode: "studio",
    format: safeString(body?.format || "16:9", "16:9"),

    scenes: safeArray(body?.scenes).map((scene, index) => ({
      id: safeString(scene?.id || `scene-${Date.now()}-${index + 1}`),
      title: safeString(scene?.title || "Sahne"),
      duration: Number(scene?.duration) || 0,
      included: !!scene?.included,
      videoUrl: safeString(scene?.videoUrl || ""),
      fileName: safeString(scene?.fileName || "")
    })),

    voice: {
      fileName: safeString(body?.voice?.fileName || ""),
      fileUrl: safeString(body?.voice?.fileUrl || ""),
      uploadStatus: safeString(body?.voice?.uploadStatus || "idle", "idle")
    },

    logo: {
      fileName: safeString(body?.logo?.fileName || ""),
      fileUrl: safeString(body?.logo?.fileUrl || ""),
      uploadStatus: safeString(body?.logo?.uploadStatus || "idle", "idle")
    }
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

  let auth = null;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: String(e?.message || e)
    });
  }

  const user_id = auth?.user_id ? String(auth.user_id) : null;
  if (!user_id) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: "missing_user_id",
      auth: auth || null
    });
  }

  const body = req.body || {};
  const payload = buildPayload(body);
  const sql = neon(conn);

  try {
    await sql`
      insert into cartoon_studio_states (
        user_id,
        app,
        mode,
        payload,
        created_at,
        updated_at
      )
      values (
        ${user_id},
        ${"cartoon"},
        ${"studio"},
        ${payload},
        now(),
        now()
      )
      on conflict (user_id, app, mode)
      do update set
        payload = excluded.payload,
        updated_at = now()
    `;

    return res.status(200).json({
      ok: true,
      saved: true,
      app: "cartoon",
      mode: "studio"
    });
  } catch (err) {
    console.error("cartoon/studio/state/save error:", err);

    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(err?.message || err)
    });
  }
}
