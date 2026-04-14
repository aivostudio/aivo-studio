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

  const __t0 = Date.now();
  const __mark = (label) => {
    const ms = Date.now() - __t0;
    console.log(`[jobs/list][${app}] ${label} ${ms}ms`);
  };

  let auth;
  try {
    auth = await requireAuth(req);
    __mark("after requireAuth");
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
    const userRow = await sql`
      select id
      from users
      where email = ${email}
      limit 1
    `;
    __mark("after user lookup");

    if (!userRow.length) {
      return res.status(401).json({
        ok: false,
        error: "user_not_found",
        email,
      });
    }

    const user_uuid = String(userRow[0].id);

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
    __mark("after jobs query");

   const items = rows.map((r) => {
  const outputs = Array.isArray(r.outputs) ? r.outputs : [];
  const meta = (r.meta && typeof r.meta === "object") ? r.meta : {};

  const pickUrl = (o) =>
    String(o?.archive_url || o?.url || o?.raw_url || o?.src || "").trim();

  const pickVideoByVariant = (variant) => {
    const v = String(variant || "").toLowerCase().trim();
    const hit = outputs.find(
      (o) =>
        String(o?.type || "").toLowerCase() === "video" &&
        String(o?.meta?.variant || "").toLowerCase().trim() === v
    );
    return hit ? pickUrl(hit) : null;
  };

  const pickFinalFromOutputs = () => {
    const fin = outputs.find(
      (o) =>
        String(o?.type || "").toLowerCase() === "video" &&
        o?.meta?.is_final === true
    );
    if (fin) return pickUrl(fin);

    const overlay = pickVideoByVariant("logo_overlay");
    if (overlay) return overlay;

    const mux = pickVideoByVariant("mux");
    if (mux) return mux;

    const provider = pickVideoByVariant("provider");
    if (provider) return provider;

    const firstVideo = outputs.find(
      (o) => String(o?.type || "").toLowerCase() === "video"
    );
    return firstVideo ? pickUrl(firstVideo) : null;
  };

  const responseMeta = {
    ...meta,
    final_video_url:
      meta.final_video_url ||
      pickFinalFromOutputs() ||
      null,
    preview_video_url:
      meta.preview_video_url ||
      pickVideoByVariant("preview") ||
      null,
    muxed_url:
      meta.muxed_url ||
      pickVideoByVariant("mux") ||
      null,
    logo_overlay_url:
      meta.logo_overlay_url ||
      pickVideoByVariant("logo_overlay") ||
      null,
  };

  return {
    job_id: r.id,
    user_id: r.user_id || null,
    user_uuid: r.user_uuid || null,
    app: r.app,
    type: r.type || r.app || null,
    status: r.status,
    state: mapState(r.status),
    prompt: r.prompt || null,
    meta: responseMeta,
    outputs,
    error: r.error || null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
});

    __mark("before response");

    return res.status(200).json({
      ok: true,
      app,
      auth: true,
      user_uuid,
      email,
      count: items.length,
      items,
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
