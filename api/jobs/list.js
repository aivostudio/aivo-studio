// /api/jobs/list.js
export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import authModule from "../_lib/auth.js";
const { requireAuth } = authModule;


function firstQueryValue(v) {
  // app=video&app=cover gibi durumlarda array gelebilir
  if (Array.isArray(v)) return v[0];
  return v;
}

function normalizeApp(x) {
  return String(firstQueryValue(x) || "").trim().toLowerCase();
}

function mapState(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (["completed", "ready", "succeeded"].includes(s)) return "COMPLETED";
  if (["failed", "error", "canceled", "cancelled"].includes(s)) return "FAILED";
  if (["running", "processing", "in_progress"].includes(s)) return "RUNNING";
  return "PENDING";
}

function isAuthError(e) {
  const msg = String(e?.message || e || "");
  // requireAuth içinde bunları fırlatıyorsan 401'e çevirelim
  return (
    msg.includes("unauthorized") ||
    msg.includes("Unauthorized") ||
    msg.includes("AUTH") ||
    msg.includes("missing_session")
  );
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

  // AUTH (401'e normalize)
  let auth = null;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    console.warn("[jobs/list] auth failed:", e);
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: String(e?.message || e),
    });
  }

  const user_id = auth?.user_id ? String(auth.user_id) : null;
  const email = auth?.email ? String(auth.email) : null;
  const legacy_user_id = email ? `${email}:jobs` : null;

  // DEBUG MODE
  if (String(firstQueryValue(req.query?.debug) || "") === "1") {
    return res.status(200).json({
      ok: true,
      debug: true,
      conn_present: Boolean(conn),
      auth_object: auth || null,
      user_id,
      email,
      legacy_user_id,
      app,
    });
  }

  if (!user_id && !email) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      auth_object: auth || null,
    });
  }

  const sql = neon(conn);

  // ✅ sadece dolu olan kimlikleri OR'a sok
  const ids = [user_id, email, legacy_user_id].filter(Boolean);

  try {
 const rows = await sql`
  select id, user_id, app, status, prompt, meta, outputs, error, created_at, updated_at
  from jobs
  where app = ${app}
    and deleted_at is null
    and user_id::text = any(${ids}::text[])
  order by created_at desc
  limit 50
`;


    return res.status(200).json({
      ok: true,
      app,
      auth: true,
      user_id: user_id || null,
      email: email || null,
      items: rows.map((r) => ({
        job_id: r.id,
        user_id: r.user_id,
        app: r.app,
        status: r.status,
        state: mapState(r.status),
        prompt: r.prompt || null,
        meta: r.meta || null,
        outputs: r.outputs || [],
        error: r.error || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    });
  } catch (e) {
    console.error("jobs/list list_failed:", e);

    // auth ile ilgili bir hata burada patlarsa da 401
    if (isAuthError(e)) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: String(e?.message || e),
      });
    }

    return res.status(500).json({
      ok: false,
      error: "list_failed",
      message: String(e?.message || e),
      stack: String(e?.stack || ""),
    });
  }
}
