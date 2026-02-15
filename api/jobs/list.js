// /api/jobs/list.js
import { neon } from "@neondatabase/serverless";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

// Bizde cookie adları karışık olabiliyor. Hepsini dene:
const COOKIE_CANDIDATES = ["aivo_session_jwt", "aivo_session", "aivo_sess"];

function parseCookies(req) {
  const header = req.headers?.cookie || "";
  return Object.fromEntries(
    header
      .split(";")
      .map((v) => {
        const i = v.indexOf("=");
        if (i === -1) return null;
        const k = v.slice(0, i).trim();
        const val = decodeURIComponent(v.slice(i + 1));
        return [k, val];
      })
      .filter(Boolean)
  );
}

function looksLikeJWT(token) {
  // JWT: header.payload.signature => 2 nokta
  return typeof token === "string" && token.split(".").length === 3;
}

function extractUserIdFromJwtPayload(payload) {
  return (
    payload?.user_id ||
    payload?.id ||
    payload?.sub ||
    payload?.user?.id ||
    null
  );
}

function tryGetUserId(req) {
  try {
    if (!JWT_SECRET) return null;

    const cookies = parseCookies(req);
    const token =
      COOKIE_CANDIDATES.map((k) => cookies[k]).find(Boolean) || null;

    if (!token) return null;

    // Cookie JWT değilse (opaque session id gibi) burada auth saymayalım
    if (!looksLikeJWT(token)) return null;

    const payload = jwt.verify(token, JWT_SECRET);
    return extractUserIdFromJwtPayload(payload);
  } catch {
    // invalid token -> auth yokmuş gibi davran (401 verme, list çalışsın)
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

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

    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      ok: true,
      app,
      auth: auth_ok,
      user_id: auth_ok ? String(user_id) : null,
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
