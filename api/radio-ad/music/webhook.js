// api/radio-ad/music/webhook.js
export const config = { runtime: "nodejs" };
export const maxDuration = 60;

import crypto from "crypto";
import jwt from "jsonwebtoken";
import { neon } from "@neondatabase/serverless";
import { putObject } from "../../_lib/r2.js";
import {
  getRadioProject,
  mediaPrefix,
  saveRadioProject,
  sendJson,
} from "../../_lib/radio-ad-projects.js";

const PIPELINE_VERSION = "radio-music-v2";
const OUTPUT_FORMAT = "mp3";
const OUTPUT_BITRATE = "320k";
const MAX_BYTES = 80 * 1024 * 1024;

function clean(value, max = 1800) {
  return String(value ?? "").trim().slice(0, max);
}

function lower(value) {
  return clean(value, 300).toLowerCase();
}

function safeEqual(a, b) {
  const left = Buffer.from(clean(a, 300));
  const right = Buffer.from(clean(b, 300));
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function pick(data, keys) {
  for (const key of keys) {
    let current = data;
    let valid = true;
    for (const part of key.split(".")) {
      if (!current || typeof current !== "object" || !(part in current)) {
        valid = false;
        break;
      }
      current = current[part];
    }
    if (valid && current != null) return current;
  }
  return null;
}

function audioFile(payload) {
  const item = pick(payload, [
    "audio",
    "output.audio",
    "data.audio",
    "result.audio",
    "response.audio",
  ]);

  if (item && typeof item === "object" && /^https:\/\//i.test(String(item.url || ""))) {
    return {
      url: String(item.url),
      contentType: clean(item.content_type || item.contentType, 100),
      fileName: clean(item.file_name || item.fileName, 180),
    };
  }

  const url = pick(payload, [
    "audio_url",
    "output.audio_url",
    "data.audio_url",
    "result.audio_url",
    "response.audio_url",
  ]);

  return /^https:\/\//i.test(String(url || ""))
    ? { url: String(url), contentType: "", fileName: "" }
    : null;
}

function getOrigin(req) {
  const proto = clean(req.headers["x-forwarded-proto"], 40).split(",")[0] || "https";
  const host =
    clean(req.headers["x-forwarded-host"], 300).split(",")[0] ||
    clean(req.headers.host, 300);
  return host ? `${proto}://${host}` : "https://aivo.tr";
}

function getConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ""
  );
}

async function resolveProjectEmail(project) {
  const userId = clean(project?.userId, 240);
  if (!userId) return "";
  if (userId.includes("@")) return lower(userId);

  const conn = getConn();
  if (!conn) return "";
  const sql = neon(conn);
  const rows = await sql`
    select email
    from users
    where id::text = ${userId}
    limit 1
  `;
  return lower(rows?.[0]?.email);
}

function internalSessionCookie(email) {
  const secret = clean(process.env.JWT_SECRET, 4000);
  if (!secret || !email) return "";
  const token = jwt.sign(
    { email, role: "user", source: "radioad_music_webhook" },
    secret,
    { expiresIn: "5m" }
  );
  return `aivo_session=${encodeURIComponent(token)}`;
}

async function triggerFinal(req, project, email) {
  const cookie = internalSessionCookie(email);
  if (!cookie) return { ok: false, status: 0, data: { error: "missing_internal_auth" } };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 13000);
  try {
    const response = await fetch(`${getOrigin(req)}/api/radio-ad/final/create`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie,
        "x-aivo-internal-source": "radioad-music-webhook",
      },
      body: JSON.stringify({ projectId: project.id }),
      cache: "no-store",
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    if (error?.name === "AbortError") {
      return { ok: false, status: 0, data: { error: "final_trigger_timeout" } };
    }
    return {
      ok: false,
      status: 0,
      data: { error: clean(error?.message || error, 900) || "final_trigger_failed" },
    };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    }

    const projectId = clean(req.query?.projectId, 120);
    const token = clean(req.query?.token, 300);
    if (!projectId || !token) {
      return sendJson(res, 400, { ok: false, error: "missing_webhook_identity" });
    }

    let project = await getRadioProject(projectId);
    if (!project) return sendJson(res, 404, { ok: false, error: "project_not_found" });

    const generation = project.musicGeneration || {};
    if (!safeEqual(token, generation.webhookToken)) {
      return sendJson(res, 401, { ok: false, error: "invalid_webhook_token" });
    }

    const requestId = clean(req.body?.request_id || req.body?.requestId, 240);
    const headerRequestId = clean(req.headers["x-fal-webhook-request-id"], 240);
    const activeRequestId = clean(generation.requestId, 240);

    if (!requestId || !activeRequestId) {
      return sendJson(res, 400, { ok: false, error: "missing_request_id" });
    }

    if ((headerRequestId && headerRequestId !== requestId) || requestId !== activeRequestId) {
      console.log("[radio-ad/music/webhook] stale webhook ignored", {
        projectId,
        requestId,
        activeRequestId,
      });
      return sendJson(res, 200, { ok: true, status: "STALE_IGNORED" });
    }

    if (project.final?.url) {
      return sendJson(res, 200, {
        ok: true,
        status: "COMPLETED",
        final: project.final,
      });
    }

    const webhookStatus = clean(req.body?.status, 40).toUpperCase();
    if (webhookStatus === "ERROR") {
      const now = new Date().toISOString();
      const message = clean(req.body?.error || req.body?.payload_error || "music_generation_failed", 900);
      const user = {
        userId: project.userId,
        ownerHash: project.ownerHash,
        email: project.userId?.includes?.("@") ? lower(project.userId) : null,
        role: "user",
      };
      const failed = await saveRadioProject(user, {
        ...project,
        status: "draft",
        music: { ...(project.music || {}), audio: null },
        musicGeneration: {
          ...generation,
          status: "failed",
          updatedAt: now,
          completedAt: now,
          error: message,
          webhookCompletedAt: now,
        },
        final: null,
        finalGeneration: null,
      });
      return sendJson(res, 200, {
        ok: true,
        status: "FAILED",
        error: message,
        project_id: failed.id,
      });
    }

    if (webhookStatus !== "OK") {
      return sendJson(res, 400, { ok: false, error: "invalid_webhook_status" });
    }

    const user = {
      userId: project.userId,
      ownerHash: project.ownerHash,
      email: project.userId?.includes?.("@") ? lower(project.userId) : null,
      role: "user",
    };

    if (!project.music?.audio?.url || project.music?.audio?.pipelineVersion !== PIPELINE_VERSION) {
      const file = audioFile(req.body?.payload || {});
      if (!file?.url) {
        console.error("[radio-ad/music/webhook] missing audio payload", projectId, requestId);
        return sendJson(res, 422, { ok: false, error: "webhook_audio_missing" });
      }

      const remote = await fetch(file.url, { cache: "no-store", redirect: "follow" });
      if (!remote.ok) {
        return sendJson(res, 502, { ok: false, error: "music_download_failed" });
      }

      const body = Buffer.from(await remote.arrayBuffer());
      if (!body.length || body.length > MAX_BYTES) {
        return sendJson(res, 413, { ok: false, error: "invalid_music_size" });
      }

      const now = new Date().toISOString();
      const objectKey = `${mediaPrefix(user, projectId)}music/generated-v2-webhook-${Date.now()}.mp3`;
      const storedUrl = await putObject({
        key: objectKey,
        body,
        contentType: "audio/mpeg",
        cacheControl: "public, max-age=31536000, immutable",
        contentDisposition: "inline",
      });

      const duration = Number(generation.meta?.duration || project.output?.duration || 10);
      const audio = {
        url: storedUrl,
        contentType: "audio/mpeg",
        generated: true,
        createdAt: now,
        engine: generation.model,
        pipelineVersion: PIPELINE_VERSION,
        signature: generation.signature,
        seed: generation.seed || null,
        duration,
        outputFormat: OUTPUT_FORMAT,
        bitrate: generation.bitrate || OUTPUT_BITRATE,
        style: generation.meta?.resolvedStyle || project.music?.style || "auto",
        energy: generation.meta?.resolvedEnergy || project.music?.energy || "balanced",
      };

      project = await saveRadioProject(user, {
        ...project,
        status: "draft",
        music: { ...(project.music || {}), audio },
        musicGeneration: {
          ...generation,
          status: "completed",
          updatedAt: now,
          completedAt: now,
          error: null,
          webhookCompletedAt: now,
        },
        final: null,
        finalGeneration: null,
      });
    }

    const email = await resolveProjectEmail(project);
    if (!email) {
      console.error("[radio-ad/music/webhook] missing project email", projectId);
      return sendJson(res, 200, {
        ok: true,
        status: "MUSIC_COMPLETED",
        final_triggered: false,
        fallback: "radioad-background-cron",
      });
    }

    const finalResult = await triggerFinal(req, project, email);
    console.log("[radio-ad/music/webhook]", {
      projectId,
      requestId,
      music: "completed",
      final_http_status: finalResult.status,
      final_status: finalResult.data?.status || finalResult.data?.error || null,
    });

    return sendJson(res, 200, {
      ok: true,
      status: finalResult.data?.status || "MUSIC_COMPLETED",
      final_triggered: finalResult.ok,
      final_http_status: finalResult.status,
    });
  } catch (error) {
    console.error("[radio-ad/music/webhook]", error);
    return sendJson(res, 500, {
      ok: false,
      error: "server_error",
      message: clean(error?.message || error, 900),
    });
  }
}
