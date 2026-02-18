export const config = { runtime: "nodejs" };

// /pages/api/providers/fal/video/create.js
import { sql } from "@vercel/postgres";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};

    const {
      // app'i çağıran yerden gönder (atmo / video vs.)
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
    } = body;

    if (!prompt && !multi_prompt) {
      return res.status(400).json({ ok: false, error: "missing_prompt" });
    }

    if (!process.env.FAL_KEY) {
      return res.status(500).json({ ok: false, error: "missing_fal_key" });
    }

    // ✅ Kling v3 Pro Text-to-Video (queue submit)
    const falUrl =
      "https://queue.fal.run/fal-ai/kling-video/v3/pro/text-to-video";

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
    } catch {
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

    // best-effort user (opsiyonel)
    const user_email =
      req.headers["x-user-email"] || req.headers["x-aivo-email"] || null;

    const user_uuid =
      req.headers["x-user-uuid"] || req.headers["x-aivo-user-uuid"] || null;

    let internal_job_id = null;

    if (request_id) {
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

      try {
        const row = await sql`
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
            now(), now()
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

        internal_job_id = row?.rows?.[0]?.id || row?.[0]?.id || null;
      } catch (dbErr) {
        // DB yazamazsak bile Fal request_id’i döndür (UI list boş kalabilir)
        console.error("[fal.video.create] DB upsert failed:", dbErr);
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
  } catch (e) {
    console.error("[fal.video.create] crashed:", e);
    return res.status(500).json({
      ok: false,
      error: "internal_error",
      message: String(e?.message || e),
    });
  }
}
