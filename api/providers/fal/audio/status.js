export const config = { runtime: "nodejs" };

import crypto from "node:crypto";
import authModule from "../../../_lib/auth.js";

const { requireAuth } = authModule;

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

function normalizeStatus(value, audioUrl) {
  if (audioUrl) return "COMPLETED";
  const status = String(value || "").toUpperCase();
  if (["COMPLETED", "COMPLETE", "SUCCEEDED", "READY", "DONE"].includes(status)) return "COMPLETED";
  if (["IN_PROGRESS", "PROCESSING", "RUNNING", "STARTED"].includes(status)) return "RUNNING";
  if (["IN_QUEUE", "QUEUED", "PENDING"].includes(status)) return "IN_QUEUE";
  if (["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)) return "FAILED";
  return "UNKNOWN";
}

function extractAudio(anyJson) {
  if (!anyJson || typeof anyJson !== "object") return null;
  const audioObject = pick(anyJson, [
    "audio", "output.audio", "data.audio", "data.output.audio",
    "result.audio", "result.output.audio", "response.audio", "response.output.audio",
  ]);
  if (audioObject && typeof audioObject === "object") {
    const url = String(audioObject.url || "").trim();
    if (url.startsWith("http") || url.startsWith("data:")) {
      return {
        url,
        content_type: audioObject.content_type || audioObject.contentType || null,
        file_name: audioObject.file_name || audioObject.fileName || null,
        file_size: audioObject.file_size || audioObject.fileSize || null,
      };
    }
  }
  const directUrl = pick(anyJson, [
    "audio_url", "output.audio_url", "data.audio_url", "result.audio_url", "response.audio_url",
  ]);
  if (typeof directUrl === "string") {
    const url = directUrl.trim();
    if (url.startsWith("http") || url.startsWith("data:")) {
      return { url, content_type: null, file_name: null, file_size: null };
    }
  }
  if (Array.isArray(anyJson.outputs)) {
    const hit = anyJson.outputs.find((item) => {
      const url = String(item?.url || "");
      return item?.type === "audio" && (url.startsWith("http") || url.startsWith("data:"));
    });
    if (hit) {
      return {
        url: hit.url,
        content_type: hit.content_type || null,
        file_name: hit.file_name || null,
        file_size: hit.file_size || null,
      };
    }
  }
  return null;
}

function validateFalUrl(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { return null; }
  if (url.protocol !== "https:" || url.hostname !== "queue.fal.run") return null;
  return url.toString();
}

function resultUrlFromStatusUrl(statusUrl) {
  return String(statusUrl || "").replace(/\/status\/?(?:\?.*)?$/i, "");
}

async function fetchFalJson(url, falKey) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Key ${falKey}`, Accept: "application/json" },
  });
  const rawText = await response.text().catch(() => "");
  let data;
  try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { raw: rawText }; }
  return { response, data };
}

function requestHost(req) {
  return String(req.headers["x-forwarded-host"] || req.headers.host || "")
    .split(",")[0].trim().toLowerCase();
}

function isSameOriginPreviewRequest(req) {
  if (process.env.VERCEL_ENV !== "preview") return false;
  const host = requestHost(req);
  if (!host) return false;
  const source = String(req.headers.origin || req.headers.referer || "").trim();
  if (!source) return false;
  try {
    if (new URL(source).host.toLowerCase() !== host) return false;
  } catch {
    return false;
  }
  const fetchSite = String(req.headers["sec-fetch-site"] || "").toLowerCase();
  return !fetchSite || fetchSite === "same-origin" || fetchSite === "none";
}

function verifyPreviewTicket(ticket, falKey) {
  const raw = String(ticket || "").trim();
  const parts = raw.split(".");
  if (parts.length !== 2) return null;
  const [encodedPayload, suppliedSignature] = parts;
  const expectedSignature = crypto.createHmac("sha256", falKey).update(encodedPayload).digest("base64url");
  const expected = Buffer.from(expectedSignature);
  const supplied = Buffer.from(suppliedSignature);
  if (expected.length !== supplied.length) return null;
  if (!crypto.timingSafeEqual(expected, supplied)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")); } catch { return null; }
  if (!payload || Number(payload.expiresAt) < Date.now()) return null;
  return validateFalUrl(payload.url);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!["GET", "POST"].includes(req.method)) {
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const source = req.method === "GET" ? req.query || {} : req.body || {};
  const falKey = process.env.FAL_KEY || process.env.FAL_API_KEY;
  if (!falKey) return res.status(500).json({ ok: false, error: "missing_fal_key" });

  const previewTicket = source.preview_ticket || source.previewTicket;
  const previewStatusUrl = previewTicket ? verifyPreviewTicket(previewTicket, falKey) : null;
  const previewRequest = Boolean(previewTicket);

  if (previewRequest) {
    if (!previewStatusUrl || !isSameOriginPreviewRequest(req)) {
      return res.status(403).json({ ok: false, error: "invalid_preview_ticket" });
    }
  } else {
    let auth;
    try { auth = await requireAuth(req); }
    catch (error) {
      return res.status(401).json({ ok: false, error: "unauthorized", message: String(error?.message || error) });
    }
    if (!auth?.email) return res.status(401).json({ ok: false, error: "unauthorized" });
  }

  const rawStatusUrl = previewStatusUrl || source.status_url || source.statusUrl || source.response_url || source.responseUrl;
  const statusUrl = validateFalUrl(rawStatusUrl);
  if (!statusUrl) {
    return res.status(400).json({ ok: false, error: "invalid_or_missing_status_url" });
  }

  try {
    const first = await fetchFalJson(statusUrl, falKey);
    if (first.response.status === 404) {
      return res.status(200).json({ ok: true, provider: "fal", status: "FAILED", error: "fal_status_not_found", audio_url: null, outputs: [] });
    }
    if (!first.response.ok) {
      return res.status(200).json({ ok: false, provider: "fal", status: "UNKNOWN", error: "fal_status_error", fal_status: first.response.status, audio_url: null, outputs: [], fal: first.data });
    }

    const rawStatus = pick(first.data, ["status", "state", "data.status", "result.status"]);
    let audio = extractAudio(first.data);
    let resolvedPayload = null;
    let resolvedUrl = null;
    const normalizedBeforeResult = normalizeStatus(rawStatus, audio?.url);

    if (!audio && normalizedBeforeResult === "COMPLETED") {
      resolvedUrl = validateFalUrl(resultUrlFromStatusUrl(statusUrl));
      if (resolvedUrl) {
        const second = await fetchFalJson(resolvedUrl, falKey);
        resolvedPayload = second.data;
        if (second.response.ok) audio = extractAudio(second.data);
      }
    }

    const status = normalizeStatus(rawStatus, audio?.url);
    const meta = {
      kind: "ad_film_music",
      provider: "fal",
      engine: "fal-ai/stable-audio-3/small/music/text-to-audio",
      seed: pick(resolvedPayload, ["seed", "data.seed", "result.seed"]) || pick(first.data, ["seed", "data.seed", "result.seed"]) || null,
      prompt: pick(resolvedPayload, ["prompt", "data.prompt", "result.prompt"]) || pick(first.data, ["prompt", "data.prompt", "result.prompt"]) || null,
      content_type: audio?.content_type || null,
      file_name: audio?.file_name || null,
      file_size: audio?.file_size || null,
      preview_real_test: previewRequest,
    };
    const outputs = audio?.url ? [{ type: "audio", url: audio.url, meta }] : [];

    return res.status(200).json({
      ok: true,
      provider: "fal",
      status,
      audio_url: audio?.url || null,
      outputs,
      meta,
      fal: first.data,
      resolved_payload: resolvedPayload,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, provider: "fal", error: "server_error", message: String(error?.message || error) });
  }
}
