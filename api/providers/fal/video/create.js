// /pages/api/providers/fal/video/create.js
import { sql } from "@vercel/postgres";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const {
      // 🔸 app'i çağıran yerden gönder (atmo / video vs.)
      // UI atmoysa body’ye app:"atmo" koy.
      app = "atmo",

      prompt,
      duration = 5,
      aspect_ratio = "9:16",

      // Kling v3 Pro defaults:
      generate_audio = true,
      shot_type = "customize",
      negative_prompt = "blur, distort, and low quality",
      cfg_scale = 0.5,

      // optional advanced:
      multi_prompt = null,
      voice_ids = null,
    } = req.body || {};

    if (!prompt && !multi_prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    if (!process.env.FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    // ✅ Kling v3 Pro Text-to-Video (queue submit)
    const falUrl = "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video";

    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 30000); // 30s

    let r;
    try {
      r = await fetch(falUrl, {
        method: "POST",
        headers: {
          Authorization: `Key ${process.env.FAL_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(multi_prompt ? { multi_prompt } : { prompt }),
          duration,
          aspect_ratio,
          generate_audio,
          shot_type,
          negative_prompt,
          cfg_scale,
          ...(Array.isArray(voice_ids) ? { voice_ids } : {}),
        }),
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(t);
      return res.status(504).json({
        ok: false,
        provider: "fal",
        error: "fal_timeout_or_network_error",
        message: e?.message || "unknown_fetch_error",
      });
    }

    clearTimeout(t);

    const text = await r.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = { _non_json: text };
    }

    if (!r.ok) {
      return res.status(500).json({
        ok: false,
        provider: "fal",
        error: "fal_error",
        fal_status: r.status,
        fal_response: data,
      });
    }

    // Queue response’tan request_id yakala
    const request_id =
      data?.request_id || data?.requestId || data?.id || data?._id || null;

    // ✅ DB’ye job aç (SOURCE OF TRUTH)
    // Not: auth/user alanlarını şimdilik best-effort alıyoruz.
    // İstersen burada kendi auth util’in varsa onunla user_uuid/email’i kesinleştirelim.
    let internal_job_id = null;

    if (request_id) {
      const nowIso = new Date().toISOString();

      // best-effort user
      const user_email =
        req.headers["x-user-email"] ||
        req.headers["x-aivo-email"] ||
        null;

      const user_uuid =
        req.headers["x-user-uuid"] ||
        req.headers["x-aivo-user-uuid"] ||
        null;

      const input = {
        app,
        prompt,
        multi_prompt,
        duration,
        aspect_ratio,
        generate_audio,
        shot_type,
        negative_prompt,
        cfg_scale,
        voice_ids,
      };

      // Bu UPSERT’in çalışması için ideal olan:
      // jobs tablosunda UNIQUE(provider, provider_job_id) constraint’i.
      // Yoksa, ilk denemede hata alırsan bana söyle — constraint SQL’ini de yollayayım.
      try {
        const row =
          await sql`
            insert into jobs (
              app, provider, provider_job_id,
              status, state,
              user_email, user_uuid,
              input_json, created_at, updated_at
            )
            values (
              ${app}, ${"fal"}, ${request_id},
              ${"queued"}, ${"processing"},
              ${user_email}, ${user_uuid},
              ${JSON.stringify(input)},
              ${nowIso}, ${nowIso}
            )
            on conflict (provider, provider_job_id)
            do update set
              app = excluded.app,
              status = excluded.status,
              state = excluded.state,
              user_email = coalesce(excluded.user_email, jobs.user_email),
              user_uuid = coalesce(excluded.user_uuid, jobs.user_uuid),
              input_json = excluded.input_json,
              updated_at = excluded.updated_at
            returning id
          `;

     let internal_job_id = null;

if (request_id) {
  try {
    const row = await db.query(
      `
      insert into jobs (provider, provider_job_id, app, state, status, input_json, created_at, updated_at, user_email, user_uuid)
      values ($1, $2, $3, $4, $5, $6, now(), now(), $7, $8)
      on conflict (provider, provider_job_id)
      do update set
        state = excluded.state,
        status = excluded.status,
        input_json = excluded.input_json,
        updated_at = excluded.updated_at,
        user_email = coalesce(excluded.user_email, jobs.user_email),
        user_uuid = coalesce(excluded.user_uuid, jobs.user_uuid)
      returning id
      `,
      [
        "fal",
        request_id,
        app,
        "processing",
        "processing",
        JSON.stringify(req.body || {}),
        userEmail || null,
        userUUID || null,
      ]
    );

    internal_job_id = row?.rows?.[0]?.id || null;
  } catch (dbErr) {
    // DB yazamazsak bile Fal request_id’i döndür (ama UI list boş kalır)
    console.error("[fal.video.create] DB upsert failed:", dbErr?.message || dbErr);
  }
}

return res.status(200).json({
  ok: true,
  provider: "fal",
  app,
  model: "fal-ai/kling-video/v3/pro/text-to-video",
  request_id,
  internal_job_id,
  status: data?.status || "IN_QUEUE",
  raw: data,
});
