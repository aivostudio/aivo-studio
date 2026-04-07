export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import { requireAuth } from "../../../_lib/auth.js";

function safeString(value, fallback = "") {
  return String(value ?? fallback).trim();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function buildDefaultState() {
  return {
    format: "16:9",
    scenes: [],
    voice: {
      fileName: "",
      fileUrl: "",
      uploadStatus: "idle"
    },
    logo: {
      fileName: "",
      fileUrl: "",
      uploadStatus: "idle"
    }
  };
}

function normalizePayload(payload) {
  const root = safeObject(payload);

  return {
    format: safeString(root.format || "16:9", "16:9"),

    scenes: safeArray(root.scenes).map((scene, index) => ({
      id: safeString(scene?.id || `saved-${Date.now()}-${index + 1}`),
      title: safeString(scene?.title || "Sahne"),
      duration: Number(scene?.duration) || 0,
      included: !!scene?.included,
      videoUrl: safeString(scene?.videoUrl || ""),
      fileName: safeString(scene?.fileName || "")
    })),

    voice: {
      fileName: safeString(root?.voice?.fileName || ""),
      fileUrl: safeString(root?.voice?.fileUrl || ""),
      uploadStatus: safeString(root?.voice?.uploadStatus || "idle", "idle")
    },

    logo: {
      fileName: safeString(root?.logo?.fileName || ""),
      fileUrl: safeString(root?.logo?.fileUrl || ""),
      uploadStatus: safeString(root?.logo?.uploadStatus || "idle", "idle")
    }
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
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

  const sql = neon(conn);

  try {
    const rows = await sql`
      select payload
      from cartoon_studio_states
      where user_id = ${user_id}
        and app = ${"cartoon"}
        and mode = ${"studio"}
      limit 1
    `;

    const payload = rows?.[0]?.payload || null;
    const state = payload ? normalizePayload(payload) : buildDefaultState();

    return res.status(200).json({
      ok: true,
      ...state
    });
  } catch (err) {
    console.error("cartoon/studio/state/get error:", err);

    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(err?.message || err)
    });
  }
}
