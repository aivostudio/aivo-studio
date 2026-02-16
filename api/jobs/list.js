// /api/jobs/list.js
export const config = {
  runtime: "nodejs",
};

import { neon } from "@neondatabase/serverless";
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;

const COOKIE_KV = "aivo_sess";

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

function cleanToken(raw) {
  if (!raw) return null;
  let t = String(raw).trim();

  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }

  if (/^bearer\s+/i.test(t)) {
    t = t.replace(/^bearer\s+/i, "").trim();
  }

  if (t.startsWith("s:")) {
    t = t.slice(2);
  }

  return t || null;
}

function parseCookiesFromReq(req) {
  // 1) Next/Vercel style: req.cookies (object)
  if (req?.cookies && typeof req.cookies === "object") {
    const out = {};
    for (const [k, v] of Object.entries(req.cookies)) {
      if (v == null) continue;
      out[String(k)] = String(v);
    }
    return out;
  }

  // 2) Node style: req.headers.cookie or req.headers["cookie"]
  const header =
    req?.headers?.cookie ||
    (req?.headers && req.headers["cookie"]) ||
    "";

  const out = {};
  String(header)
    .split(";")
    .forEach((part) => {
      const i = part.indexOf("=");
      if (i === -1) return;
      const k = part.slice(0, i).trim();
      const v = part.slice(i + 1).trim();
      if (!k) return;
      try {
        out[k] = decodeURIComponent(v);
      } catch {
        out[k] = v;
      }
    });
  return out;
}

function getDbConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    null
  );
}

async function getOrCreateUserIdByEmail(sql, email) {
  if (!email) return null;

  const rows = await sql`
    select id
    from users
    where email = ${email}
    limit 1
  `;
  if (rows?.[0]?.id) return rows[0].id;

  const inserted = await sql`
    insert into users (email, created_at)
    values (${email}, now())
    returning id
  `;
  return inserted?.[0]?.id || null;
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

    const conn = getDbConn();
    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    const sql = neon(conn);

    // --- AUTH (KV session cookie like /api/auth/me) ---
    const cookies = parseCookiesFromReq(req);
    const sid = cleanToken(cookies[COOKIE_KV]);
    const sid_present = Boolean(sid);

    let sess = null;
    let email = null;
    let user_id = null;

    if (sid_present) {
      if (typeof kvGetJson === "function") {
        sess = await kvGetJson(`sess:${sid}`).catch(() => null);
        email = sess?.email || null;
      }
      if (email) {
        user_id = await getOrCreateUserIdByEmail(sql, email);
      }
    }

    // DEBUG MODE
    if (String(req.query.debug || "") === "1") {
      return res.status(200).json({
        ok: true,
        debug: true,
        conn_present: true,
        kv_available: typeof kvGetJson === "function",
        cookie_debug: {
          has_req_cookies_object: Boolean(req?.cookies && typeof req.cookies === "object"),
          header_cookie_len: String(req?.headers?.cookie || req?.headers?.["cookie"] || "").length,
          cookie_keys: Object.keys(cookies || {}),
        },
        sid_present,
        sess_present: Boolean(sess && typeof sess === "object"),
        email: email || null,
        user_id: user_id || null,
      });
    }

    if (!user_id) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
      });
    }

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
      stack: String(e?.stack || ""),
    });
  }
}
