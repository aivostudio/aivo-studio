// api/jobs/create.js
export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import { requireAuth } from "../_lib/auth.js";
import { getRedis } from "../_kv.js"; // sende "../_kv" idi; path ES module ise .js gerekebilir

function firstQueryValue(v) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function normalizeApp(x) {
  return String(firstQueryValue(x) || "").trim().toLowerCase();
}

function safeJson(x, fallback) {
  try {
    if (x === undefined) return fallback;
    return x;
  } catch {
    return fallback;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  res.setHeader("Cache-Control", "no-store");

  const conn =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED;

  if (!conn) {
    return res.status(500).json({ ok: false, error: "missing_db_env" });
  }

  // AUTH
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

  const user_id = auth?.user_id ? String(auth.user_id) : null;
  if (!user_id) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: "missing_user_id",
      auth: auth || null,
    });
  }

  const body = req.body || {};

  // app/type
  const app = normalizeApp(body.app || body.type);
  const allowed = new Set(["hook", "social", "music", "video", "cover", "atmo"]);
  if (!app || !allowed.has(app)) {
    return res.status(400).json({ ok: false, error: "type_invalid" });
  }

  const provider = String(body.provider || "unknown").trim();
  const prompt = body.prompt ? String(body.prompt) : null;

  // meta: params + provider/prompt (sende pattern buydu)
  const params = safeJson(body.params, {}) || {};
  const meta = {
    ...(typeof params === "object" && params ? params : {}),
    provider,
    prompt,
  };

  // Idempotency (email değil user_id)
  const idemKey = String(req.headers["x-idempotency-key"] || "").trim();
  const redis = getRedis?.();
  if (idemKey && redis) {
    const idemRedisKey = `idem:${user_id}:${app}:${idemKey}`;
    const existing = await redis.get(idemRedisKey);
    if (existing) {
      return res.status(200).json({ ok: true, job_id: existing, reused: true });
    }
  }

  const sql = neon(conn);

  try {
    // jobs tablon: id(uuid), user_id(text), type(text), status(enum), created_at, app, meta(jsonb),
    // outputs(jsonb), error(text), updated_at, request_id(text), prompt(text), provider(text), deleted_at
    //
    // status default varsa yazmadan bırakmak en iyisi.
    // Eğer default YOKSA ve insert patlıyorsa, aşağıdaki satırı aç:
    // const status = "queued";

    const rows = await sql`
      insert into jobs (user_id, app, type, provider, prompt, meta, outputs, error, request_id, created_at, updated_at)
      values (
        ${user_id},
        ${app},
        ${app},
        ${provider},
        ${prompt},
        ${meta},
        ${[]},
        ${null},
        ${null},
        now(),
        now()
      )
      returning id
    `;

    const job_id = rows?.[0]?.id ? String(rows[0].id) : null;
    if (!job_id) {
      return res.status(500).json({ ok: false, error: "insert_failed" });
    }

    // idem kaydet
    if (idemKey && redis) {
      const idemRedisKey = `idem:${user_id}:${app}:${idemKey}`;
      await redis.set(idemRedisKey, job_id);
    }

    return res.status(200).json({
      ok: true,
      job_id,
      app,
      user_id,
      email: auth?.email || null,
      session: auth?.session || null,
    });
  } catch (err) {
    console.error("jobs/create error:", err);

    // Eğer burada "status cannot be null" gibi bir hata görürsen:
    // jobs tablosunda status default yok demektir.
    // O zaman insert'e status ekleyeceğiz (queued/processing vs).
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: String(err?.message || err),
    });
  }
}
