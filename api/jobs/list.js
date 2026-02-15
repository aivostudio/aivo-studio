// /api/jobs/list.js
import { neon } from "@neondatabase/serverless";
import jwt from "jsonwebtoken";

// cookie adı fallback (sende network'te aivo_sess gördük)
const COOKIE_NAMES = ["aivo_sess", "aivo_session"];

const JWT_SECRET = process.env.JWT_SECRET;

function parseCookies(req) {
  const header = req.headers.cookie || "";
  if (!header) return {};
  return Object.fromEntries(
    header
      .split(";")
      .map((v) => {
        const i = v.indexOf("=");
        if (i === -1) return null;
        const k = v.slice(0, i).trim();
        const val = v.slice(i + 1).trim();
        try {
          return [k, decodeURIComponent(val)];
        } catch {
          return [k, val];
        }
      })
      .filter(Boolean)
  );
}

function getTokenFromCookies(req) {
  const cookies = parseCookies(req);
  for (const name of COOKIE_NAMES) {
    const token = cookies[name];
    if (token) return token;
  }
  return null;
}

function requireUserId(req) {
  if (!JWT_SECRET) {
    return { ok: false, status: 500, error: "missing_jwt_secret" };
  }

  const token = getTokenFromCookies(req);
  if (!token) {
    return { ok: false, status: 401, error: "missing_session_cookie" };
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user_id = payload?.user_id || payload?.id || payload?.sub || null;
    if (!user_id) {
      return { ok: false, status: 401, error: "missing_user_id_in_token" };
    }
    return { ok: true, user_id: String(user_id) };
  } catch (e) {
    return { ok: false, status: 401, error: "invalid_token" };
  }
}

export default async function handler(req, res) {
  try {
    const { app } = req.query;

    if (!app) {
      return res.status(400).json({ ok: false, error: "missing_app" });
    }

    // Basit app guard (istersen genişlet)
    const appKey = String(app).trim();
    if (!appKey || appKey.length > 50) {
      return res.status(400).json({ ok: false, error: "invalid_app" });
    }

    const conn =
      process.env.POSTGRES_URL_NON_POOLING ||
      process.env.DATABASE_URL ||
      process.env.POSTGRES_URL ||
      process.env.DATABASE_URL_UNPOOLED;

    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    // AUTH ZORUNLU ✅
    const auth = requireUserId(req);
    if (!auth.ok) {
      return res.status(auth.status).json({ ok: false, error: auth.error });
    }

    const sql = neon(conn);

    const rows = await sql`
      select id, user_id, app, status, prompt, meta, outputs, error, created_at, updated_at
      from jobs
      where app = ${appKey}
        and user_id = ${auth.user_id}
      order by created_at desc
      limit 50
    `;

    return res.status(200).json({
      ok: true,
      app: appKey,
      auth: true,
      user_id: auth.user_id,
      items: rows.map((r) => ({
        job_id: r.id,
        user_id: r.user_id,
        app: r.app,
        status: r.status,
        state:
          r.status === "completed"
            ? "COMPLETED"
            : r.status === "failed"
            ? "FAILED"
            : r.status === "running"
            ? "RUNNING"
            : "PENDING",
        prompt: r.prompt || null,
        meta: r.meta || null,
        outputs: r.outputs || [],
        error: r.error || null,
        created_at: r.created_at,
        updated_at: r.updated_at,
      })),
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "list_failed",
      message: String(e?.message || e),
    });
  }
}
