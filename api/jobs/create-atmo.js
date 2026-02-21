export const config = { runtime: "nodejs" };

import { neon } from "@neondatabase/serverless";
import authModule from "../_lib/auth.js";
const { requireAuth } = authModule;

// küçük helper: bu deployment’da aynı host üzerinden iç endpoint çağırmak için
function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function pickRequestId(obj) {
  if (!obj || typeof obj !== "object") return null;
  return (
    obj.request_id ||
    obj.requestId ||
    obj.id ||
    obj.prediction_id ||
    obj.predictionId ||
    (obj.data && (obj.data.request_id || obj.data.requestId || obj.data.id)) ||
    null
  );
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

  // --- auth ---
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (e) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: String(e?.message || e),
    });
  }

  const email = auth?.email ? String(auth.email) : null;
  if (!email) {
    return res
      .status(401)
      .json({ ok: false, error: "unauthorized", message: "missing_email" });
  }

  const sql = neon(conn);

  try {
    // canonical user resolve
    const userRow = await sql`
      select id
      from users
      where email = ${email}
      limit 1
    `;

    if (!userRow.length) {
      return res.status(401).json({ ok: false, error: "user_not_found", email });
    }

    const user_uuid = String(userRow[0].id);

    // body normalize
    const body = req.body || {};
    const prompt = body.prompt ? String(body.prompt) : null;
    const metaIn = body.meta || null;

    // meta garanti: atmo kimliği
    // ✅ status.js / overlay otomasyonu için gerekli alanları meta'ya kaydediyoruz
    const metaSafe = {
      ...(metaIn && typeof metaIn === "object" ? metaIn : {}),
      app: "atmo",
      kind: "atmo_video",
      provider: "fal",

      // --- logo overlay inputs (kritik) ---
      logo_url: body.logo_url ?? null, // https://media.aivo.tr/uploads/tmp/...png
      logo_pos: body.logo_pos ?? null, // "br" | "bl" | "tr" | "tl"
      logo_size: body.logo_size ?? null, // "sm" | "md" | "lg" (UI ne gönderiyorsa)
      logo_opacity: body.logo_opacity ?? null, // 0..1

      // --- audio embed pipeline inputs (kritik) ---
      audio_mode: body.audio_mode ?? null, // "embed" | "none" | ...
      audio_url: body.audio_url ?? null, // https://media.aivo.tr/uploads/tmp/..mp3
      audio_trim: body.audio_trim ?? null, // { start, end } veya null
      silent_copy: body.silent_copy ?? null, // true/false
    };

    // 1) önce job row insert (queued)
    const inserted = await sql`
      insert into jobs (
        user_id,
        user_uuid,
        type,
        app,
        status,
        prompt,
        meta,
        outputs,
        created_at,
        updated_at
      )
      values (
        ${email},
        ${user_uuid}::uuid,
        'atmo',
        'atmo',
        'queued',
        ${prompt},
        ${metaSafe},
        '[]'::jsonb,
        now(),
        now()
      )
      returning id, user_uuid, app, status, created_at
    `;

    const job_id = String(inserted[0].id);

    // 2) Fal create çağrısı (internal endpoint)
    // Burada body’yi pass-through yapıyoruz: duration/camera/scene vs ne gönderiyorsan aynen gider.
    const baseUrl = getBaseUrl(req);

    const falCreateResp = await fetch(
      `${baseUrl}/api/providers/fal/video/create?app=atmo`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          // cookie forward: auth gerektiriyorsa iç endpoint de aynı session’ı görsün
          cookie: req.headers.cookie || "",
        },
        body: JSON.stringify({
          ...body,
          // job ile ilişkilendirme için (istersen create endpoint bunu loglayabilir)
          job_id,
          app: "atmo",
        }),
      }
    );

    const falText = await falCreateResp.text();
    let falJson = null;
    try {
      falJson = JSON.parse(falText);
    } catch {
      // fal endpoint bazen text döndürebilir; burada sadece debug için saklıyoruz
      falJson = { raw: falText };
    }

    if (!falCreateResp.ok || falJson?.ok === false) {
      // job'u error’a çek (en azından list’te “hata” görünsün)
      await sql`
        update jobs
        set status = 'error',
            error = ${JSON.stringify({
              error: "fal_create_failed",
              status: falCreateResp.status,
              body: falJson,
            })}::jsonb,
            updated_at = now()
        where id = ${job_id}::uuid
      `;

      return res.status(500).json({
        ok: false,
        error: "fal_create_failed",
        job_id,
        detail: falJson,
      });
    }

    const request_id = pickRequestId(falJson);

    // 3) request_id’yi job meta’ya yaz + status processing
    const metaWithReq = {
      ...(metaSafe || {}),
      provider_request_id: request_id,
      provider_response: falJson, // istersen sonra kaldırırız; debug için çok faydalı
    };

    await sql`
      update jobs
      set status = 'processing',
          meta = ${metaWithReq}::jsonb,
          updated_at = now()
      where id = ${job_id}::uuid
    `;

    // 4) response
    return res.status(200).json({
      ok: true,
      job_id,
      user_uuid: inserted[0].user_uuid,
      app: inserted[0].app,
      status: "processing",
      request_id,
      created_at: inserted[0].created_at,
    });
  } catch (e) {
    console.error("create-atmo failed:", e);
    return res.status(500).json({
      ok: false,
      error: "create_failed",
      message: String(e?.message || e),
    });
  }
}
