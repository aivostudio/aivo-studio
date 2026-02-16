// /api/jobs/list.js
export const config = {
  runtime: "nodejs",
};

import { neon } from "@neondatabase/serverless";
import { requireAuth } from "../_lib/auth.js";

function normalizeApp(x) {
  return String(x || "").trim().toLowerCase();
}

function mapState(statusRaw) {
  const s = String(statusRaw || "").toLowerCase();
  if (["completed", "ready", "succeeded"].includes(s)) return "COMPLETED";
  if (["failed", "error", "canceled", "cancelled"].includes(s)) return "FAILED";
  if (["running", "processing", "in_progress"].includes(s)) return "RUNNING";
  return "PENDING";
}

function safeHeaderLen(v) {
  if (!v) return 0;
  try {
    return String(v).length;
  } catch {
    return 0;
  }
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
      return res.status(500).json({
        ok: false,
        error: "missing_db_env",
      });
    }

    // --- COOKIE VISIBILITY (SAFE DEBUG) ---
    const headersObj = req?.headers || {};
    const headerCookieA = headersObj?.cookie || "";
    const headerCookieB = headersObj?.["cookie"] || "";
    const hasHeadersGet = typeof headersObj?.get === "function";
    const headerCookieC = hasHeadersGet ? headersObj.get("cookie") || "" : "";

    const cookieDebug = {
      has_req_cookies_object: Boolean(req?.cookies && typeof req.cookies === "object"),
      req_cookie_keys: req?.cookies && typeof req.cookies === "object" ? Object.keys(req.cookies).slice(0, 20) : [],
      has_headers_cookie_prop: Boolean(headersObj?.cookie),
      headers_cookie_len: safeHeaderLen(headerCookieA),
      has_headers_bracket_cookie: Boolean(headersObj?.["cookie"]),
      headers_bracket_cookie_len: safeHeaderLen(headerCookieB),
      has_headers_get: hasHeadersGet,
      headers_get_cookie_len: safeHeaderLen(headerCookieC),
      header_keys_sample: Object.keys(headersObj || {}).slice(0, 30),
      host: headersObj?.host || null,
      origin: headersObj?.origin || null,
      referer: headersObj?.referer || null,
    };

    // AUTH
    const auth = await requireAuth(req);
    const user_id = auth?.user_id || null;

    // DEBUG MODE
    if (String(req.query.debug || "") === "1") {
      return res.status(200).json({
        ok: true,
        debug: true,
        conn_present: Boolean(conn),
        cookie_debug: cookieDebug,
        auth_object: auth,
        user_id,
      });
    }

    if (!user_id) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
      });
    }

    const sql = neon(conn);

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
