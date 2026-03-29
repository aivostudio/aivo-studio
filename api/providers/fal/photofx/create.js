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

function mapResolution(v) {
  const s = String(v || "").trim().toLowerCase();
  if (["1080p", "1440p", "2160p"].includes(s)) return s;
  return "1080p";
}

function mapFps(v) {
  const n = Number(v);
  if ([24, 25, 48, 50].includes(n)) return n;
  return 25;
}

function normalizePublicMediaUrl(raw) {
  const input = String(raw || "").trim();
  if (!input) return "";

  const publicBase = String(
    process.env.R2_PUBLIC_BASE_URL ||
      process.env.R2_PUBLIC_BASE ||
      "https://media.aivo.tr"
  )
    .trim()
    .replace(/\/$/, "");

  try {
    const u = new URL(input);

    if (/^pub-[^.]+\.r2\.dev$/i.test(u.hostname)) {
      return `${publicBase}${u.pathname}`;
    }

    if (u.hostname === "media.aivo.tr") {
      return `${publicBase}${u.pathname}`;
    }

    return input;
  } catch {
    if (input.startsWith("/uploads/")) {
      return `${publicBase}${input}`;
    }

    if (input.startsWith("uploads/")) {
      return `${publicBase}/${input}`;
    }

    return input;
  }
}

function toArray(v) {
  return Array.isArray(v) ? v : [];
}

function uniqStrings(arr = []) {
  return [...new Set(arr.map((x) => String(x || "").trim()).filter(Boolean))];
}

function normalizeStyleKey(v) {
  return String(v || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
}

const PHOTOFX_HIDDEN_STYLE_PROMPTS = {
  "neon-pulse":
    "premium neon glow lines, rhythmic electric pulse energy, clean futuristic light streaks, vibrant nightclub color contrast, stylish high-end music video atmosphere, no smoke explosion, no fire, no messy particles",
  "shake-edit":
    "strong rhythmic micro camera shake, punch-in impact hits, fast edit energy, aggressive frame vibration, music-video-style page shake, sharp motion accents, intense visual hit feeling, no face distortion, no body warping, no identity change",
   "glitch-scan":
    "sharp glitch impact flashes, sudden electric screen crack feeling, aggressive frame tearing, strong horizontal and vertical split-screen distortion, brief RGB channel separation, harsh digital shock bursts, fast stutter cuts, intense screen jitter, lightning-like glitch strikes, cinematic signal break effect, keep the subject visible and recognizable, do not turn the whole frame into abstract noise, no fire, no smoke, no fantasy particles",
  "split-flash":
    "hard flash bursts, split-frame edit feeling, sharp white exposure hits, fast contrast pops, punchy transition impact, premium commercial edit energy, aggressive visual emphasis, no smoke, no fire, no extra objects",
  "cinematic-zoom":
    "premium cinematic push-in, dramatic focus pull, immersive framing, elegant camera pressure, polished film-trailer motion, high-end visual tension, clean luxury video feel, no chaotic movement, no distortion",
  "aura-glow":
    "soft luminous aura around the subject, dreamy bloom light, elegant ethereal glow, premium mystical atmosphere, smooth cinematic softness, high-end fantasy portrait motion, no fire, no heavy smoke, no glitch artifacts",
  "fire-edge":
    "intense edge fire glow, ember-lit contour highlights, aggressive cinematic heat energy, premium flame rim light, powerful dramatic warmth, high-impact visual tension, no random explosions, no laser beams, no smoke cloud blocking the face",
  "dark-trap-motion":
    "dark luxury trap atmosphere, shadow-heavy music video tone, bold cinematic darkness, moody contrast, gritty premium nightlife energy, dramatic attitude, subtle menace, no fantasy glow, no cheerful colors, no soft dreamy haze",
  "smoke-fog":
    "cinematic low-lying smoke, controlled drifting fog layers, moody stage haze behind and around the subject, soft atmospheric depth, clean premium mist, luxury nightclub smoke feeling, keep the face visible, no heavy white cloud, no smoke explosion, no fire",
  "festival-laser":
    "powerful clean concert laser beams behind the subject, sharp parallel laser rays, sweeping nightclub backlight, premium festival stage look, intense beam geometry, high-energy performance atmosphere, luxury concert visual, no flames, no fireballs, no pyrotechnics, no smoke explosion",
};

const MOTION_LEVEL_PROMPTS = {
  soft: "keep movement soft, minimal, smooth, and natural",
  balanced: "use balanced motion with clear but controlled animation",
  strong: "use stronger motion with dynamic camera energy and more visible movement",
};

const EFFECT_STRENGTH_PROMPTS = {
  low: "keep the overall stylization light, clean, and restrained",
  medium: "make the stylization clearly visible but controlled and tasteful",
  high: "make the stylization stronger, more noticeable, and more impactful",
};

const COLOR_MOOD_PROMPTS = {
  original: "keep colors close to the original image with a clean premium finish",
  cool: "use slightly cool cinematic tones",
  warm: "use slightly warm cinematic tones",
  neon: "use vivid neon-inspired colors with stylish contrast",
  dark: "use darker contrast-heavy grading with moody shadows",
  cinematic: "use polished cinematic color grading",
};

const TRANSITION_SPEED_PROMPTS = {
  slow: "use slower transition pacing and calmer visual rhythm",
  normal: "use normal transition pacing with smooth continuity",
  fast: "use faster transition pacing with punchier visual rhythm",
};

const ZOOM_LEVEL_PROMPTS = {
  none: "avoid dramatic zoom behavior and keep framing stable",
  low: "use very subtle zoom movement",
  normal: "use moderate cinematic zoom movement",
  high: "use stronger zoom emphasis with more dramatic push-in feeling",
};

function buildPrompt({
  prompt,
  preset,
  styles,
  motion_level,
  effect_strength,
  color_mood,
  transition_speed,
  zoom_level,
}) {
  const userPrompt = String(prompt || "").trim();

  const normalizedPreset = normalizeStyleKey(preset);
  const normalizedStyles = uniqStrings(
    []
      .concat(normalizedPreset ? [normalizedPreset] : [])
      .concat(toArray(styles).map(normalizeStyleKey))
  );

  const hiddenStyleParts = normalizedStyles
    .map((key) => PHOTOFX_HIDDEN_STYLE_PROMPTS[key])
    .filter(Boolean);

  const parts = [
    "Animate a single still photo into a short social-media-ready video clip.",
    userPrompt || "Create a short stylized motion clip from the source image.",
    MOTION_LEVEL_PROMPTS[String(motion_level || "").trim()] ||
      "use balanced motion with clear but controlled animation",
    EFFECT_STRENGTH_PROMPTS[String(effect_strength || "").trim()] ||
      "make the stylization clearly visible but controlled and tasteful",
    COLOR_MOOD_PROMPTS[String(color_mood || "").trim()] ||
      "keep colors close to the original image with a clean premium finish",
    TRANSITION_SPEED_PROMPTS[String(transition_speed || "").trim()] ||
      "use normal transition pacing with smooth continuity",
    ZOOM_LEVEL_PROMPTS[String(zoom_level || "").trim()] ||
      "use moderate cinematic zoom movement",
    ...hiddenStyleParts,
    "Preserve subject identity, facial consistency, and overall likeness.",
    "Keep motion believable, clean, and visually coherent.",
    "No text, no subtitles, no logo, no watermark.",
  ];

  return uniqStrings(parts).join(" ");
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

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

  const conn = pickConn();
  if (!conn) {
    return res.status(500).json({ ok: false, error: "missing_db_env" });
  }
  const sql = neon(conn);

  const body = safeJson(req);
  const incomingJobId = body.job_id ? String(body.job_id) : null;
  const app = "photofx";

  const image_url_raw =
    pick(body, ["image_url", "imageUrl", "input.image_url", "input.imageUrl"]) ||
    null;

  if (!image_url_raw || !String(image_url_raw).trim()) {
    return res.status(400).json({ ok: false, error: "missing_image_url" });
  }

  const image_url = normalizePublicMediaUrl(String(image_url_raw).trim());

  const quality = "fast";
  const falUrl = "https://queue.fal.run/fal-ai/ltx-2.3/image-to-video/fast";
  const engineLabel = "fast";

  const metaInput = body.meta && typeof body.meta === "object" ? body.meta : {};

  const preset = String(
    body.preset || pick(metaInput, ["preset"]) || "neon-pulse"
  ).trim();

  const styles = uniqStrings(
    []
      .concat(toArray(body.styles))
      .concat(toArray(body.selected_styles))
      .concat(toArray(body.selectedStyles))
      .concat(toArray(pick(body, ["effects.styles"])))
      .concat(toArray(pick(metaInput, ["styles"])))
      .concat(toArray(pick(metaInput, ["effects.styles"])))
  ).map(normalizeStyleKey);

  const aspect_ratio = mapAspectRatio(body.aspect_ratio || body.aspectRatio);
  const duration = mapDuration(body.duration, false);
  const resolution = mapResolution(body.resolution || body.output_resolution);
  const fps = mapFps(body.fps);

  const motion_level = String(
    body.motion_level ||
      body.motionLevel ||
      pick(metaInput, ["motion_level", "motionLevel"]) ||
      "balanced"
  ).trim();

  const effect_strength = String(
    body.effect_strength ||
      body.effectStrength ||
      pick(metaInput, ["effect_strength", "effectStrength"]) ||
      "medium"
  ).trim();

  const color_mood = String(
    body.color_mood ||
      body.colorMood ||
      pick(metaInput, ["color_mood", "colorMood"]) ||
      "original"
  ).trim();

  const transition_speed = String(
    body.transition_speed ||
      body.transitionSpeed ||
      pick(metaInput, ["transition_speed", "transitionSpeed"]) ||
      "normal"
  ).trim();

  const zoom_level = String(
    body.zoom_level ||
      body.zoomLevel ||
      pick(metaInput, ["zoom_level", "zoomLevel"]) ||
      "normal"
  ).trim();

  const prompt = buildPrompt({
    prompt: body.prompt,
    preset,
    styles,
    motion_level,
    effect_strength,
    color_mood,
    transition_speed,
    zoom_level,
  });

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

  const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!FAL_KEY) {
    return res.status(500).json({ ok: false, error: "missing_fal_key" });
  }

  const falBody = {
    image_url: String(image_url).trim(),
    prompt,
    duration,
    aspect_ratio,
    resolution,
    fps,
    generate_audio: false,
  };

  console.log("[photofx:create] falBody =", JSON.stringify(falBody, null, 2));

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
    styles,
    image_url: String(image_url_raw).trim(),
    image_url_fal: String(image_url).trim(),
    aspect_ratio,
    duration,
    resolution,
    fps,
    motion_level,
    effect_strength,
    color_mood,
    transition_speed,
    zoom_level,
    final_prompt: prompt,

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
