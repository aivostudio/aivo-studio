// /api/jobs/list.js
export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import authModule from "../_lib/auth.js";
const { requireAuth } = authModule;

function firstQueryValue(v) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function normalizeApp(x) {
  return String(firstQueryValue(x) || "")
    .trim()
    .toLowerCase();
}

function mapState(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();

  if (["completed", "ready", "succeeded", "done"].includes(s)) return "COMPLETED";
  if (["failed", "error", "canceled", "cancelled"].includes(s)) return "FAILED";
  if (["running", "processing", "in_progress"].includes(s)) return "RUNNING";

  return "PENDING";
}

function pickUrl(x) {
  if (!x) return null;
  return (
    x.archive_url ||
    x.url ||
    x.raw_url ||
    x.src ||
    x.video_url ||
    x.download_url ||
    null
  );
}

function isPersistentAtmoReady(row) {
  const app = String(row?.app || row?.type || row?.meta?.app || "").toLowerCase();
  if (app !== "atmo") return true;

  const outputs = Array.isArray(row?.outputs) ? row.outputs : [];
  const finalMetaUrl = String(row?.meta?.final_video_url || "").trim();

  if (finalMetaUrl.includes("media.aivo.tr/outputs/")) return true;

  const finalOut = outputs.find(
    (o) =>
      String(o?.type || "").toLowerCase() === "video" &&
      o?.meta?.is_final === true
  );

  const finalOutUrl = String(pickUrl(finalOut) || "").trim();
  if (finalOutUrl.includes("media.aivo.tr/outputs/")) return true;

  const anyVideo = outputs.find(
    (o) => String(o?.type || "").toLowerCase() === "video"
  );

  const anyVideoUrl = String(pickUrl(anyVideo) || "").trim();
  if (anyVideoUrl.includes("media.aivo.tr/outputs/")) return true;

  return false;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const app = normalizeApp(req.query?.app);
  if (!app) {
    return res.status(400).json({ ok: false, error: "missing_app" });
  }

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
    // 🔥 CANONICAL USER RESOLVE
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

    // 🔥 BACKWARD COMPAT QUERY
    // Some old jobs may have only user_id=email
    // New jobs should always have user_uuid filled
    const rows = await sql`
      select id, user_id, user_uuid, app, type, status, prompt, meta, outputs, error, created_at, updated_at
      from jobs
      where app = ${app}
        and deleted_at is null
        and (
          user_uuid = ${user_uuid}::uuid
          OR user_id = ${email}
        )
      order by created_at desc
      limit 50
    `;

 return res.status(200).json({
  ok: true,
  app,
  auth: true,
  user_uuid,
  email,
  count: rows.length,
  items: rows.map((r) => {
    const app = String(r.app || r.type || r.meta?.app || "").toLowerCase();
    const rawStatus = String(r.status || "").toLowerCase();

    const normalizedStatus =
      app === "atmo" &&
      ["completed", "ready", "succeeded", "done"].includes(rawStatus) &&
      !isPersistentAtmoReady(r)
        ? "processing"
        : r.status;

    return {
      job_id: r.id,
      user_id: r.user_id || null,
      user_uuid: r.user_uuid || null,
      app: r.app,
      type: r.type || r.app || null,
      status: normalizedStatus,
      state: mapState(normalizedStatus),
      prompt: r.prompt || null,
      meta: r.meta || null,
      outputs: Array.isArray(r.outputs) ? r.outputs : [],
      error: r.error || null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }),
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
