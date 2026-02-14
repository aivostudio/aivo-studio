// /api/jobs/list.js
import crypto from "crypto";
import { neon } from "@neondatabase/serverless";
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;

// ✅ NEW cookie (KV session)
const COOKIE_KV = "aivo_sess";

// ✅ LEGACY cookie (JWT)
const COOKIE_JWT = "aivo_session";
const JWT_SECRET = process.env.JWT_SECRET;

/* -----------------------
   helpers (me.js ile aynı)
------------------------ */
function b64urlDecode(str) {
  str = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

function signHS256(data, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i === -1) return;
    const k = p.slice(0, i).trim();
    const v = p.slice(i + 1).trim();
    if (k) out[k] = v;
  });
  return out;
}

function verifyJWT(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;

  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = signHS256(data, secret);
  if (expected !== s) return null;

  const payload = JSON.parse(b64urlDecode(p));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return null;

  return payload;
}

// ✅ tek yerden user_id çöz: önce KV sess, sonra JWT legacy
async function tryGetUserId(req) {
  try {
    const cookies = parseCookies(req.headers.cookie);

    // 1) KV session
    const sid = cookies[COOKIE_KV];
    if (sid && typeof kvGetJson === "function") {
      const sess = await kvGetJson(`sess:${sid}`).catch(() => null);
      if (sess && typeof sess === "object" && sess.email) {
        return String(sess.email);
      }
    }

    // 2) JWT legacy
    const token = cookies[COOKIE_JWT];
    if (token && JWT_SECRET) {
      const payload = verifyJWT(token, JWT_SECRET);
      if (payload) {
        return (
          payload?.user_id ||
          payload?.id ||
          payload?.sub ||
          payload?.email ||
          null
        );
      }
    }
  } catch (_) {}

  return null;
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

    const user_id = await tryGetUserId(req);
    const auth_ok = !!user_id;

    // ✅ Tamamlanmış sayılacak statüler
    const DONE = ["completed", "succeeded", "ready"];

    const rows = auth_ok
      ? await sql`
          select id, user_id, type, status, created_at
          from jobs
          where type = ${String(app)}
            and user_id = ${String(user_id)}
            and status = any(${DONE}::text[])
          order by created_at desc
          limit 50
        `
      : await sql`
          select id, user_id, type, status, created_at
          from jobs
          where type = ${String(app)}
            and status = any(${DONE}::text[])
          order by created_at desc
          limit 50
        `;

    return res.status(200).json({
      ok: true,
      app: String(app),
      auth: auth_ok,
      items: (rows || []).map((r) => ({
        job_id: r.id,
        user_id: r.user_id,
        app: r.type, // 👈 DB’de column "type"
        status: r.status,
        state:
          r.status === "completed" ||
          r.status === "succeeded" ||
          r.status === "ready"
            ? "COMPLETED"
            : r.status === "failed"
            ? "FAILED"
            : r.status === "running"
            ? "RUNNING"
            : "PENDING",
        created_at: r.created_at,
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
