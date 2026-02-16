// /api/jobs/list.js
// Lists user jobs from Postgres (source of truth)

const { neon } = require("@neondatabase/serverless");
const { requireAuth } = require("../_lib/auth");

function firstQueryValue(v) {
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

module.exports = async (req, res) => {
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

  let auth = null;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: String(e?.message || e),
    });
  }

  if (!auth?.user_id) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
    });
  }

  const sql = neon(conn);

  try {
    const rows = await sql`
      select
        id,
        user_id,
        app,
        status,
        prompt,
        meta,
        outputs,
        error,
        created_at,
        updated_at
      from jobs
      where app = ${app}
        and user_id::text = ${String(auth.user_id)}
      order by created_at desc
      limit 50
    `;

    return res.status(200).json({
      ok: true,
      app,
      user_id: auth.user_id,
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
    console.error("jobs/list failed:", e);
    return res.status(500).json({
      ok: false,
      error: "list_failed",
      message: String(e?.message || e),
    });
  }
};
