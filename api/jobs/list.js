// api/jobs/list.js
import { neon } from "@neondatabase/serverless";
import { requireAuth } from "../_lib/auth.js";

function normalizeApp(x) {
  return String(x || "").trim().toLowerCase();
}

function mapState(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (s === "completed" || s === "ready" || s === "succeeded") return "COMPLETED";
  if (s === "failed" || s === "error" || s === "canceled" || s === "cancelled") return "FAILED";
  if (s === "running" || s === "processing" || s === "in_progress") return "RUNNING";
  return "PENDING";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    res.setHeader("Cache-Control", "no-store");

    const app = normalizeApp(req.query.app);
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

    const sql = neon(conn);

    // ✅ SAFE AUTH (hydrate spam kırılmasın)
    // requireAuth bazen 401 yazıp res'i bitirebilir.
    // Bu yüzden önce "soft" deniyoruz: hata olursa boş liste döneriz.
    let auth = null;
    try {
      auth = await requireAuth(req, {
        status: () => ({ json: () => null }),
      });
    } catch {
      auth = null;
    }

    // Auth yoksa / session yoksa -> boş liste dön (401 spam bitirir)
    if (!auth || !auth.email) {
      return res.status(200).json({
        ok: true,
        app,
        auth: false,
        user_id: null,
        items: [],
      });
    }

    // ⚠️ Geçici: DB'de user_id email ise doğru.
    // Eğer DB user_id UUID/int ise bunu auth.user_id'ye çevirmen gerekecek.
    const user_id = String(auth.user_id || auth.id || auth.email);

    const rows = await sql`
      select id, user_id, app, status, prompt, meta, outputs, error, created_at, updated_at
      from jobs
      where app = ${app}
        and user_id = ${user_id}
      order by created_at desc
      limit 50
    `;

    return res.status(200).json({
      ok: true,
      app,
      auth: true,
      user_id,
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
    return res.status(500).json({
      ok: false,
      error: "list_failed",
      message: String(e?.message || e),
    });
  }
}
