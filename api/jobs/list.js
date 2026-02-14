import { neon } from "@neondatabase/serverless";
import jwt from "jsonwebtoken";

const COOKIE_NAME = "aivo_session";
const JWT_SECRET = process.env.JWT_SECRET;

function parseCookies(req) {
  const header = req.headers.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map(v => {
        const i = v.indexOf("=");
        if (i === -1) return [];
        return [v.slice(0, i).trim(), decodeURIComponent(v.slice(i + 1))];
      })
      .filter(Boolean)
  );
}

function tryGetUserId(req) {
  try {
    const cookies = parseCookies(req);
    const token = cookies[COOKIE_NAME];
    if (!token) return null;
    if (!JWT_SECRET) return null; // secret yoksa auth kapalı say

    const payload = jwt.verify(token, JWT_SECRET);
    return payload?.user_id || payload?.id || payload?.sub || null;
  } catch {
    return null; // invalid token -> auth kapalı say
  }
}

export default async function handler(req, res) {
  try {
    const { app } = req.query;

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

    const user_id = tryGetUserId(req);
    const auth_ok = !!user_id;

    const rows = auth_ok
      ? await sql`
          select id, user_id, app, status, prompt, meta, outputs, error, created_at, updated_at
          from jobs
          where app = ${app}
            and user_id = ${String(user_id)}
          order by created_at desc
          limit 50
        `
      : await sql`
          select id, user_id, app, status, prompt, meta, outputs, error, created_at, updated_at
          from jobs
          where app = ${app}
          order by created_at desc
          limit 50
        `;

    return res.status(200).json({
      ok: true,
      app,
      auth: auth_ok,
      items: rows.map(r => ({
        job_id: r.id,
        user_id: r.user_id,
        app: r.app,
        status: r.status,
        state:
          r.status === "completed" ? "COMPLETED" :
          r.status === "failed" ? "FAILED" :
          r.status === "running" ? "RUNNING" :
          "PENDING",
        prompt: r.prompt || null,
        meta: r.meta || null,
        outputs: r.outputs || [],
        error: r.error || null,
        created_at: r.created_at,
        updated_at: r.updated_at
      }))
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "list_failed",
      message: String(e?.message || e)
    });
  }
}
