export const config = { runtime: "nodejs" };

import authModule from "../../../_lib/auth.js";
import { buildAdFilmMusicPrompt } from "../../../_lib/ad-film-music-prompt.js";

const { requireAuth } = authModule;
const MODEL_ID = "fal-ai/stable-audio-3/small/music/text-to-audio";
const MODEL_URL = `https://queue.fal.run/${MODEL_ID}`;

function safeBody(req) {
  return req.body && typeof req.body === "object" ? req.body : {};
}

function pick(obj, paths) {
  for (const path of paths) {
    const parts = path.split(".");
    let current = obj;
    let found = true;

    for (const part of parts) {
      if (!current || typeof current !== "object" || !(part in current)) {
        found = false;
        break;
      }
      current = current[part];
    }

    if (found && current != null) return current;
  }
  return null;
}

function extractQueueUrls(data) {
  const statusUrl = pick(data, [
    "status_url",
    "statusUrl",
    "urls.status",
    "links.status",
    "data.status_url",
    "result.status_url",
  ]);

  const responseUrl = pick(data, [
    "response_url",
    "responseUrl",
    "urls.response",
    "links.response",
    "data.response_url",
    "result.response_url",
  ]);

  return {
    statusUrl:
      typeof statusUrl === "string" && statusUrl.trim()
        ? statusUrl.trim()
        : null,
    responseUrl:
      typeof responseUrl === "string" && responseUrl.trim()
        ? responseUrl.trim()
        : null,
  };
}

function isMock(req, body) {
  const queryValue = Array.isArray(req.query?.mock)
    ? req.query.mock[0]
    : req.query?.mock;
  const headerValue = String(req.headers["x-aivo-mock"] || "").toLowerCase();

  return (
    body.mock === true ||
    String(queryValue || "") === "1" ||
    headerValue === "1" ||
    headerValue === "true"
  );
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (error) {
    return res.status(401).json({
      ok: false,
      error: "unauthorized",
      message: String(error?.message || error),
    });
  }

  if (!auth?.email) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const body = safeBody(req);
  const music = buildAdFilmMusicPrompt({
    productName: body.productName,
    brandName: body.brandName,
    description: body.description,
    targetAudience: body.targetAudience,
    cta: body.cta,
    voiceStyle: body.voiceStyle,
    visualStyle: body.visualStyle,
    duration: body.duration,
    musicStyle: body.musicStyle,
    musicEnergy: body.musicEnergy,
    voiceEnabled: body.voiceEnabled,
  });

  const requestMeta = {
    kind: "ad_film_music",
    provider: "fal",
    engine: MODEL_ID,
    duration: music.duration,
    requested_style: music.requestedStyle,
    requested_energy: music.requestedEnergy,
    resolved_style: music.resolvedStyle,
    resolved_energy: music.resolvedEnergy,
    automatic_reason: music.automaticReason,
    voice_enabled: music.voiceEnabled,
  };

  if (isMock(req, body)) {
    return res.status(200).json({
      ok: true,
      mock: true,
      provider: "fal",
      status: "COMPLETED",
      request_id: `mock_ad_music_${Date.now()}`,
      status_url: null,
      response_url: null,
      audio_url: "https://aivo.tr/media/demo-audio.mp3",
      outputs: [
        {
          type: "audio",
          url: "https://aivo.tr/media/demo-audio.mp3",
          meta: requestMeta,
        },
      ],
      prompt: music.prompt,
      negative_prompt: music.negativePrompt,
      meta: requestMeta,
    });
  }

  const falKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!falKey) {
    return res.status(500).json({ ok: false, error: "missing_fal_key" });
  }

  const payload = {
    prompt: music.prompt,
    negative_prompt: music.negativePrompt,
    duration: music.duration,
    num_inference_steps: 8,
    guidance_scale: 1,
    enable_prompt_expansion: true,
    enable_safety_checker: true,
    sync_mode: false,
    output_format: "wav",
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  let response;
  try {
    response = await fetch(MODEL_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${falKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeout);
    return res.status(504).json({
      ok: false,
      provider: "fal",
      error: "fal_timeout_or_network_error",
      message: String(error?.message || error),
    });
  } finally {
    clearTimeout(timeout);
  }

  const rawText = await response.text().catch(() => "");
  let data;
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { raw: rawText };
  }

  if (!response.ok) {
    return res.status(response.status).json({
      ok: false,
      provider: "fal",
      error: "fal_error",
      fal_status: response.status,
      fal_response: data,
    });
  }

  const requestId =
    data?.request_id || data?.requestId || data?.id || data?._id || null;
  const { statusUrl, responseUrl } = extractQueueUrls(data);

  return res.status(200).json({
    ok: true,
    provider: "fal",
    status: "IN_QUEUE",
    request_id: requestId,
    status_url: statusUrl,
    response_url: responseUrl,
    prompt: music.prompt,
    negative_prompt: music.negativePrompt,
    meta: requestMeta,
    raw: data,
  });
}
