export const config = { runtime: "nodejs" };

// /pages/api/providers/fal/photofx/create.js
import { neon } from "@neondatabase/serverless";
import authModule from "../../../_lib/auth.js";
const { requireAuth } = authModule;

function pickConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function safeJson(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

function pick(obj, paths) {
  for (const p of paths) {
    const parts = p.split(".");
    let cur = obj;
    let ok = true;
    for (const k of parts) {
      if (!cur || typeof cur !== "object" || !(k in cur)) {
        ok = false;
        break;
      }
      cur = cur[k];
    }
    if (ok && cur != null) return cur;
  }
  return null;
}

function extractFalStatusUrl(data) {
  const direct =
    pick(data, [
      "status_url",
      "statusUrl",
      "response_url",
      "responseUrl",
      "urls.status",
      "urls.response",
      "links.status",
      "links.response",
      "data.status_url",
      "data.response_url",
      "result.status_url",
      "result.response_url",
    ]) || null;

  if (typeof direct === "string" && direct.trim()) return direct.trim();
  return null;
}

function mapAspectRatio(v) {
  const s = String(v || "").trim();
  if (["9:16", "1:1", "16:9", "auto"].includes(s)) return s;
  return "9:16";
}

function mapDuration(v, isPro = false) {
  const n = Number(v);

  if (isPro) {
    if ([6, 8, 10].includes(n)) return n;
    return 10;
  }

  if ([6, 8, 10, 12, 14, 16, 18, 20].includes(n)) return n;
  return 10;
}

function rewriteToFalFetchableUrl(rawUrl) {
  const input = String(rawUrl || "").trim();
  if (!input) return "";

  const falBase = String(
    process.env.R2_PUBLIC_BASE_FAL || process.env.R2_PUBLIC_BASE || ""
  )
    .trim()
    .replace(/\/$/, "");

  if (!falBase) return input;

  try {
    const u = new URL(input);

    if (u.hostname === "media.aivo.tr" && u.pathname.startsWith("/uploads/")) {
      return `${falBase}${u.pathname}`;
    }

    return input;
  } catch {
    if (input.startsWith("/uploads/")) {
      return `${falBase}${input}`;
    }
    return input;
  }
}

function buildPrompt({
  prompt,
  preset,
  motion_level,
  effect_strength,
  color_mood,
}) {
  if (prompt && String(prompt).trim()) return String(prompt).trim();

  const presetMap = {
    neon_pulse:
      "Neon light streaks, subtle glow, rhythmic energy, stylish social media edit.",
    shake_edit:
      "Micro camera shakes, punchy motion accents, aggressive rhythmic edit style.",
    glitch_scan:
      "Digital distortion, RGB split, glitch pulses, dark tech atmosphere.",
    split_flash:
      "Split-frame transitions, quick white flashes, attention-grabbing edit rhythm.",
    cinematic_zoom:
      "Slow cinematic zoom, subtle pan, elegant movement, emotional premium look.",
    aura_glow:
      "Soft glowing aura around the subject, dreamy energy halo, aesthetic motion.",
    fire_edge:
      "Hot glowing edges, ember energy, powerful dramatic look around the subject.",
    dark_trap_motion:
      "Dark contrast, hard motion language, sharp zoom accents, trap-style visual mood.",
  };

  const motionMap = {
    soft: "Soft and minimal movement.",
    balanced: "Balanced movement with clear motion feel.",
    strong: "Strong movement with more dynamic camera energy.",
  };

  const effectMap = {
    low: "Effects should stay light and clean.",
    medium: "Effects should be clearly visible but controlled.",
    high: "Effects should feel stronger and more noticeable.",
  };

  const colorMap = {
    original: "Keep colors close to original.",
    cool: "Use slightly cool cinematic tones.",
    warm: "Use slightly warm tones.",
    neon: "Use vivid neon-inspired colors.",
    dark: "Use darker contrast-heavy grading.",
    cinematic: "Use polished cinematic color grading.",
  };

  const parts = [
    "Animate a single still photo into a short social-media-ready video clip.",
    presetMap[String(preset || "").trim()] || "Stylized short motion clip.",
    motionMap[String(motion_level || "").trim()] || "Balanced movement.",
    effectMap[String(effect_strength || "").trim()] ||
      "Effects should be visible but tasteful.",
    colorMap[String(color_mood || "").trim()] || "Keep the overall look premium.",
    "Preserve subject identity and facial consistency.",
    "No text, no subtitles, no logo, no watermark.",
  ];

  return parts.join(" ");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // ---- AUTH ----
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

  // ---- DB ----
  const conn = pickConn();
  if (!conn) {
    return res.status(500).json({ ok: false, error: "missing_db_env" });
  }
  const sql = neon(conn);

  // ---- INPUT ----
  const body = safeJson(req);
  const incomingJobId = body.job_id ? String(body.job_id) : null;
  const app = "photofx";

  const image_url_raw =
    pick(body, ["image_url", "imageUrl", "input.image_url", "input.imageUrl"]) ||
    null;

  if (!image_url_raw || !String(image_url_raw).trim()) {
    return res.status(400).json({ ok: false, error: "missing_image_url" });
  }

  const image_url = rewriteToFalFetchableUrl(String(image_url_raw).trim());

  // ---- MOTOR SEÇİMİ ----
  // standard => Fast
  // premium  => Pro
  const quality = String(
    body.quality || body.tier || body.plan || "standard"
  ).toLowerCase();

  const isPro =
    quality === "premium" ||
    quality === "pro" ||
    quality === "premium_clip";

  const falUrl = isPro
    ? "https://queue.fal.run/fal-ai/ltx-2.3/image-to-video"
    : "https://queue.fal.run/fal-ai/ltx-2.3/image-to-video/fast";

  const engineLabel = isPro ? "pro" : "fast";

  const preset = String(body.preset || "neon_pulse").trim();
  const aspect_ratio = mapAspectRatio(body.aspect_ratio || body.aspectRatio);
  const duration = mapDuration(body.duration, isPro);
  const motion_level = String(
    body.motion_level || body.motionLevel || "balanced"
  ).trim();
  const effect_strength = String(
    body.effect_strength || body.effectStrength || "medium"
  ).trim();
  const color_mood = String(
    body.color_mood || body.colorMood || "original"
  ).trim();

  const prompt = buildPrompt({
    prompt: body.prompt,
    preset,
    motion_level,
    effect_strength,
    color_mood,
  });

  const metaInput = body.meta && typeof body.meta === "object" ? body.meta : {};

  const logo_url =
    pick(body, ["logo_url", "logoUrl"]) ||
    pick(metaInput, ["logo_url", "logoUrl"]) ||
    null;

  const logo_enabled_raw =
    pick(body, ["logo_enabled", "logoEnabled"]) ??
    pick(metaInput, ["logo_enabled", "logoEnabled"]) ??
    null;

  const logo_pos =
    pick(body, ["logo_pos", "logoPos"]) ||
    pick(metaInput, ["logo_pos", "logoPos"]) ||
    null;

  const logo_size =
    pick(body, ["logo_size", "logoSize"]) ||
    pick(metaInput, ["logo_size", "logoSize"]) ||
    null;

  const logo_opacity =
    pick(body, ["logo_opacity", "logoOpacity"]) ||
    pick(metaInput, ["logo_opacity", "logoOpacity"]) ||
    null;

  const audio_url_raw =
    pick(body, ["audio_url", "audioUrl", "audio.url"]) ||
    pick(metaInput, ["audio_url", "audioUrl", "audio.url"]) ||
    null;

  const audio_url = audio_url_raw ? String(audio_url_raw).trim() : null;
  const audio_mode = audio_url ? "embed" : null;
  const silent_copy = audio_url ? false : null;
  const logo_enabled =
    logo_enabled_raw == null ? Boolean(logo_url) : Boolean(logo_enabled_raw);

  // ---- canonical user_uuid resolve ----
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

  // ---- FAL KEY ----
  const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ ok: false, error: "missing_fal_key" });
  }

  const falBody = {
    image_url: String(image_url).trim(),
    prompt,
    duration,
    aspect_ratio,
    resolution: "1080p",
    fps: 25,
    generate_audio: false,
  };

  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);

  let r;
  try {
    r = await fetch(falUrl, {
      method: "POST",
      headers: {
        Authorization: `Key ${FAL_KEY}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(falBody),
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
  } finally {
    clearTimeout(t);
  }

  const text = await r.text().catch(() => "");
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { _non_json: text };
  }

  if (!r.ok) {
    return res.status(r.status).json({
      ok: false,
      provider: "fal",
      error: "fal_error",
      fal_status: r.status,
      image_url: String(image_url_raw).trim(),
      image_url_fal: String(image_url).trim(),
      fal_response: data,
    });
  }

  const request_id =
    data?.request_id || data?.requestId || data?.id || data?._id || null;

  const status_url = extractFalStatusUrl(data);

  const metaObj = {
    ...metaInput,
    app,
    kind: "photo_fx_clip",
    provider: "fal",
    engine: `ltx_image_to_video_${engineLabel}`,
    quality,
    request_id,
    preset,
    image_url: String(image_url_raw).trim(),
    image_url_fal: String(image_url).trim(),
    aspect_ratio,
    duration,
    motion_level,
    effect_strength,
    color_mood,

    ...(logo_url
      ? {
          logo_url,
          logo_enabled,
          ...(logo_pos ? { logo_pos } : {}),
          ...(logo_size ? { logo_size } : {}),
          ...(logo_opacity ? { logo_opacity } : {}),
        }
      : {}),

    ...(audio_url
      ? {
          audio_mode,
          audio_url,
          music_url: audio_url,
          silent_copy,
        }
      : {}),

    provider_response: {
      status_url: status_url || null,
      response_url: status_url || null,
      raw: {
        ...(data && typeof data === "object" ? data : { raw_text: text }),
        status_url: status_url || data?.status_url || data?.statusUrl || null,
        response_url:
          status_url || data?.response_url || data?.responseUrl || null,
      },
    },
  };

  // mevcut job update
  if (incomingJobId) {
    await sql`
      update jobs
      set status = 'processing',
          prompt = ${prompt},
          meta = ${JSON.stringify(metaObj)}::jsonb,
          updated_at = now()
      where id = ${incomingJobId}::uuid
        and user_uuid = ${user_uuid}::uuid
    `;

    return res.status(200).json({
      ok: true,
      provider: "fal",
      app,
      request_id,
      status_url: status_url || null,
      job_id: incomingJobId,
      image_url: String(image_url_raw).trim(),
      image_url_fal: String(image_url).trim(),
      raw: data,
      updated: true,
    });
  }

  // fallback insert
  const now = new Date().toISOString();
  const rows = await sql`
    insert into jobs (
      user_id, user_uuid, type, app, status, prompt, meta, outputs, created_at, updated_at
    )
    values (
      ${email},
      ${user_uuid}::uuid,
      ${app},
      ${app},
      ${"queued"},
      ${prompt},
      ${JSON.stringify(metaObj)}::jsonb,
      ${"[]"}::jsonb,
      ${now},
      ${now}
    )
    returning id
  `;

  return res.status(200).json({
    ok: true,
    provider: "fal",
    app,
    request_id,
    status_url: status_url || null,
    job_id: rows?.[0]?.id || null,
    image_url: String(image_url_raw).trim(),
    image_url_fal: String(image_url).trim(),
    raw: data,
    inserted: true,
  });
}
