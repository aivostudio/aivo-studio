export const config = { runtime: "nodejs" };

import authModule from "../../../_lib/auth.js";
import { buildAdFilmMusicPrompt } from "../../../_lib/ad-film-music-prompt.js";

const { requireAuth } = authModule;
const MODEL_ID = "fal-ai/stable-audio-3/small/music/text-to-audio";
const MODEL_URL = `https://queue.fal.run/${MODEL_ID}`;

function bodyOf(req) {
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

function flag(req, body, queryName, headerName, bodyName) {
  const queryValue = Array.isArray(req.query?.[queryName])
    ? req.query[queryName][0]
    : req.query?.[queryName];
  const headerValue = String(req.headers[headerName] || "").toLowerCase();
  return (
    body[bodyName] === true ||
    String(queryValue || "") === "1" ||
    headerValue === "1" ||
    headerValue === "true"
  );
}

function requestHost(req) {
  return String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function isSameOriginPreview(req) {
  if (process.env.VERCEL_ENV !== "preview") return false;
  const host = requestHost(req);
  const source = String(req.headers.origin || req.headers.referer || "").trim();
  if (!host || !source) return false;
  try {
    if (new URL(source).host.toLowerCase() !== host) return false;
  } catch {
    return false;
  }
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}

function queueUrls(data) {
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
    statusUrl: typeof statusUrl === "string" ? statusUrl.trim() : null,
    responseUrl: typeof responseUrl === "string" ? responseUrl.trim() : null,
  };
}

async function authorize(req, previewRequest, mockRequest) {
  if ((previewRequest || mockRequest) && isSameOriginPreview(req)) {
    return { email: "ad-film-preview@aivo.local", preview: true };
  }
  return requireAuth(req);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const body = bodyOf(req);
    const previewRequest = flag(
      req,
      body,
      "preview_real_test",
      "x-aivo-preview-real-test",
      "previewRealTest"
    );
    const mockRequest = flag(req, body, "mock", "x-aivo-mock", "mock");

    let auth;
    try {
      auth = await authorize(req, previewRequest, mockRequest);
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

    const meta = {
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
      preview_real_test: previewRequest,
    };

    if (mockRequest) {
      return res.status(200).json({
        ok: true,
        mock: true,
        provider: "fal",
        status: "COMPLETED",
        request_id: `mock_ad_music_${Date.now()}`,
        status_url: null,
        response_url: null,
        audio_url: null,
        outputs: [],
        prompt: music.prompt,
        negative_prompt: music.negativePrompt,
        meta,
      });
    }

    const falKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
    if (!falKey) {
      return res.status(500).json({
        ok: false,
        error: "missing_fal_key",
        message: "FAL_KEY is not available in this Vercel environment.",
      });
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
        message:
          data?.detail?.[0]?.msg ||
          data?.detail ||
          data?.message ||
          data?.error ||
          `Fal returned HTTP ${response.status}`,
        fal_status: response.status,
        fal_response: data,
      });
    }

    const requestId =
      data?.request_id || data?.requestId || data?.id || data?._id || null;
    const { statusUrl, responseUrl } = queueUrls(data);

    if (!statusUrl && !responseUrl) {
      return res.status(502).json({
        ok: false,
        provider: "fal",
        error: "missing_fal_queue_urls",
        message: "Fal accepted the request but returned no queue URLs.",
        fal_response: data,
      });
    }

    return res.status(200).json({
      ok: true,
      provider: "fal",
      status: "IN_QUEUE",
      request_id: requestId,
      status_url: statusUrl,
      response_url: responseUrl,
      prompt: music.prompt,
      negative_prompt: music.negativePrompt,
      meta,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      provider: "fal",
      error: "server_error",
      message: String(error?.stack || error?.message || error),
    });
  }
}
