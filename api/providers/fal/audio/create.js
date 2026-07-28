export const config = { runtime: "nodejs" };

import crypto from "node:crypto";
import authModule from "../../../_lib/auth.js";
import { buildAdFilmMusicPrompt } from "../../../_lib/ad-film-music-prompt.js";

const { requireAuth } = authModule;
const MODEL_ID = "fal-ai/stable-audio-3/small/music/text-to-audio";
const MODEL_URL = `https://queue.fal.run/${MODEL_ID}`;
const PREVIEW_TEST_DURATION = 5;
const PREVIEW_RATE_WINDOW_MS = 10 * 60 * 1000;
const PREVIEW_RATE_LIMIT = 2;
const PREVIEW_TICKET_TTL_MS = 15 * 60 * 1000;

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

function readFlag(req, body, options) {
  const queryValue = Array.isArray(req.query?.[options.query])
    ? req.query[options.query][0]
    : req.query?.[options.query];
  const headerValue = String(req.headers[options.header] || "").toLowerCase();

  return (
    body[options.body] === true ||
    String(queryValue || "") === "1" ||
    headerValue === "1" ||
    headerValue === "true"
  );
}

function isMock(req, body) {
  return readFlag(req, body, {
    query: "mock",
    header: "x-aivo-mock",
    body: "mock",
  });
}

function isPreviewRealTest(req, body) {
  return readFlag(req, body, {
    query: "preview_real_test",
    header: "x-aivo-preview-real-test",
    body: "previewRealTest",
  });
}

function allowPreviewMock(mockRequest) {
  if (!mockRequest) return false;
  return (
    process.env.VERCEL_ENV === "preview" ||
    process.env.AIVO_AD_FILM_ALLOW_MOCK === "1"
  );
}

function requestHost(req) {
  return String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function requestIp(req) {
  return String(
    req.headers["x-forwarded-for"] ||
      req.headers["x-real-ip"] ||
      req.socket?.remoteAddress ||
      "unknown"
  )
    .split(",")[0]
    .trim();
}

function isSameOriginPreviewRequest(req) {
  if (process.env.VERCEL_ENV !== "preview") return false;

  const host = requestHost(req);
  if (!host) return false;

  const deploymentHost = String(process.env.VERCEL_URL || "")
    .trim()
    .toLowerCase();
  if (deploymentHost && host !== deploymentHost) return false;

  const source = String(req.headers.origin || req.headers.referer || "").trim();
  if (!source) return false;

  try {
    const sourceHost = new URL(source).host.toLowerCase();
    if (sourceHost !== host) return false;
  } catch {
    return false;
  }

  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}

function consumePreviewRateSlot(req) {
  const now = Date.now();
  const key = requestIp(req);
  const store =
    globalThis.__AIVO_AD_FILM_PREVIEW_MUSIC_RATE__ ||
    (globalThis.__AIVO_AD_FILM_PREVIEW_MUSIC_RATE__ = new Map());
  const active = (store.get(key) || []).filter(
    (timestamp) => now - timestamp < PREVIEW_RATE_WINDOW_MS
  );

  if (active.length >= PREVIEW_RATE_LIMIT) {
    const retryAfterMs = PREVIEW_RATE_WINDOW_MS - (now - active[0]);
    store.set(key, active);
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  active.push(now);
  store.set(key, active);
  return { ok: true, retryAfterSeconds: 0 };
}

function createPreviewTicket(url, falKey) {
  if (!url || !falKey) return null;
  const encodedPayload = Buffer.from(
    JSON.stringify({
      url,
      expiresAt: Date.now() + PREVIEW_TICKET_TTL_MS,
    }),
    "utf8"
  ).toString("base64url");
  const signature = crypto
    .createHmac("sha256", falKey)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${signature}`;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const body = safeBody(req);
  const previewRealRequest = isPreviewRealTest(req, body);
  const mockRequest = !previewRealRequest && isMock(req, body);
  const previewMock = allowPreviewMock(mockRequest);
  const previewReal = previewRealRequest && isSameOriginPreviewRequest(req);

  if (previewRealRequest && !previewReal) {
    return res.status(403).json({
      ok: false,
      error: "preview_real_test_not_allowed",
    });
  }

  if (previewReal) {
    const rate = consumePreviewRateSlot(req);
    if (!rate.ok) {
      res.setHeader("Retry-After", String(rate.retryAfterSeconds));
      return res.status(429).json({
        ok: false,
        error: "preview_test_rate_limited",
        retry_after_seconds: rate.retryAfterSeconds,
      });
    }
  }

  let auth = null;
  if (previewMock || previewReal) {
    auth = {
      email: previewReal
        ? "preview-real-test@aivo.local"
        : "preview-mock@aivo.local",
      preview: true,
    };
  } else {
    try {
      auth = await requireAuth(req);
    } catch (error) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        message: String(error?.message || error),
      });
    }
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
    duration: previewReal ? PREVIEW_TEST_DURATION : body.duration,
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
    preview_real_test: previewReal,
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
      meta: requestMeta,
      preview_auth_bypass: previewMock,
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
  const pollingUrl = statusUrl || responseUrl;
  const previewTicket = previewReal
    ? createPreviewTicket(pollingUrl, falKey)
    : null;

  return res.status(200).json({
    ok: true,
    provider: "fal",
    status: "IN_QUEUE",
    request_id: requestId,
    status_url: statusUrl,
    response_url: responseUrl,
    preview_ticket: previewTicket,
    preview_real_test: previewReal,
    prompt: music.prompt,
    negative_prompt: music.negativePrompt,
    meta: requestMeta,
    raw: data,
  });
}
