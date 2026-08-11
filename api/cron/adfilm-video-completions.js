import admin from "firebase-admin";
import jwt from "jsonwebtoken";
import { neon } from "@neondatabase/serverless";
import { createHash, randomUUID } from "node:crypto";
import kvModule from "../_kv.js";

export const config = { runtime: "nodejs" };
export const maxDuration = 300;

const kv = kvModule?.default || kvModule || {};
const getRedis = kv.getRedis;
const kvGetJson = kv.kvGetJson;

const PROJECT_MATCH = "adfilm:project:*";
const SCAN_CURSOR_KEY = "push:cron:adfilm-video:scan-cursor";
const MAX_PROJECTS_PER_RUN = 3;
const MAX_SCAN_PAGES = 40;
const SCAN_COUNT = 500;
const CLAIM_TTL_SECONDS = 6 * 60;
const SENT_TTL_SECONDS = 90 * 24 * 60 * 60;
const AD_FILM_PUSH_START_AT = "2026-08-11T13:28:00.000Z";
const FINAL_MIX_VERSION = 12;

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function lower(value) {
  return clean(value).toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeIdentity(value) {
  return clean(value).toLowerCase();
}

function normalizeLang(value) {
  return lower(value).startsWith("en") ? "en" : "tr";
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

function isAuthorizedCron(req) {
  const secret = clean(process.env.CRON_SECRET);
  if (!secret) return { ok: false, error: "missing_cron_secret" };
  if (clean(req.headers.authorization) !== `Bearer ${secret}`) {
    return { ok: false, error: "unauthorized" };
  }
  return { ok: true };
}

function getOrigin(req) {
  const proto = clean(req.headers["x-forwarded-proto"]).split(",")[0] || "https";
  const host =
    clean(req.headers["x-forwarded-host"]).split(",")[0] ||
    clean(req.headers.host);
  return host ? `${proto}://${host}` : "https://aivo.tr";
}

function getFirebaseApp() {
  if (admin.apps.length) return admin.app();

  const projectId = clean(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = clean(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = clean(process.env.FIREBASE_PRIVATE_KEY).replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("missing_firebase_env");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function projectKey(projectId) {
  return `adfilm:project:${clean(projectId)}`;
}

function generationFingerprint(project) {
  const generation = project?.generation || {};
  const raw = [
    clean(project?.id),
    clean(generation.requestId || generation.outputId),
    clean(generation.startedAt),
  ].join(":");

  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

function sentKey(project) {
  return `push:adfilm-video:sent:${generationFingerprint(project)}`;
}

function claimKey(project) {
  return `push:adfilm-video:claim:${generationFingerprint(project)}`;
}

function finalizeClaimKey(project) {
  return `push:adfilm-video:finalize-claim:${generationFingerprint(project)}`;
}

function generationStartedAfterCutoff(project) {
  const startedAt = Date.parse(clean(project?.generation?.startedAt));
  const cutoff = Date.parse(AD_FILM_PUSH_START_AT);
  return Number.isFinite(startedAt) && Number.isFinite(cutoff) && startedAt >= cutoff;
}

function terminalFailure(project) {
  const terminal = new Set(["failed", "error", "cancelled", "canceled"]);
  const statuses = [
    project?.status,
    project?.generation?.status,
    project?.avatar?.pipeline?.status,
    project?.generation?.finalization?.status,
    project?.finalization?.status,
  ].map(lower);
  return statuses.some((status) => terminal.has(status));
}

function outputVideoUrl(output) {
  return clean(output?.videoUrl || output?.video_url || output?.url);
}

function finalizationCompleted(project) {
  return (
    lower(project?.generation?.finalization?.status) === "completed" ||
    lower(project?.finalization?.status) === "completed"
  );
}

function isFinalizedOutput(project, output) {
  if (!output || !outputVideoUrl(output)) return false;
  if (clean(output.finalizedAt)) return true;
  if (Number(output.mixVersion || 0) >= FINAL_MIX_VERSION) return true;

  const generationId = clean(project?.generation?.outputId || project?.generation?.requestId);
  return finalizationCompleted(project) && clean(output.id) === generationId;
}

function pickFinalOutput(project) {
  const outputs = Array.isArray(project?.outputs)
    ? project.outputs.filter(Boolean)
    : [];

  const generationId = clean(
    project?.generation?.outputId ||
    project?.generation?.requestId
  );

  if (!generationId) return null;

  const currentOutput = outputs.find(
    (item) => clean(item?.id) === generationId
  );

  if (!currentOutput) return null;

  return isFinalizedOutput(project, currentOutput)
    ? currentOutput
    : null;
}

function isFinalReady(project) {
  if (!project || terminalFailure(project)) return false;
  return !!pickFinalOutput(project);
}

function shouldTrackProject(project) {
  if (!project || typeof project !== "object") return false;
  if (!clean(project.id)) return false;
  if (!clean(project?.generation?.requestId || project?.generation?.outputId)) return false;
  if (!generationStartedAfterCutoff(project)) return false;
  if (terminalFailure(project)) return false;

  const status = lower(project?.generation?.status);
  if (isFinalReady(project)) return true;
  return ["queued", "processing", "running", "completed"].includes(status);
}

function normalizeScanResult(result) {
  if (Array.isArray(result)) {
    return {
      cursor: clean(result[0]) || "0",
      keys: Array.isArray(result[1]) ? result[1].map(clean).filter(Boolean) : [],
    };
  }

  if (result && typeof result === "object") {
    const rawCursor = result.cursor ?? result[0];
    return {
      cursor: clean(rawCursor) || "0",
      keys: Array.isArray(result.keys ?? result[1])
        ? (result.keys ?? result[1]).map(clean).filter(Boolean)
        : [],
    };
  }

  return { cursor: "0", keys: [] };
}

async function readProjects(redis, keys) {
  if (!keys.length) return [];

  try {
    const values = await redis.mget(...keys);
    if (Array.isArray(values)) {
      return values.map((value) => {
        if (!value) return null;
        if (typeof value === "object") return value;
        try {
          return JSON.parse(String(value));
        } catch (_) {
          return null;
        }
      });
    }
  } catch (_) {}

  return Promise.all(
    keys.map((key) => kvGetJson(key).catch(() => null))
  );
}

async function listCandidateProjects(redis) {
  let cursor = clean(await redis.get(SCAN_CURSOR_KEY).catch(() => "0")) || "0";
  const candidates = [];

  for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
    const scanned = normalizeScanResult(
      await redis.scan(cursor, { match: PROJECT_MATCH, count: SCAN_COUNT })
    );
    cursor = scanned.cursor;

    const projects = await readProjects(redis, scanned.keys);

    for (const project of projects) {
      if (!shouldTrackProject(project)) continue;
      const alreadySent = await redis.exists(sentKey(project)).catch(() => 0);
      if (Number(alreadySent) > 0) continue;
      candidates.push(project);
      if (candidates.length >= MAX_PROJECTS_PER_RUN) break;
    }

    if (candidates.length >= MAX_PROJECTS_PER_RUN || cursor === "0") break;
  }

  await redis.set(SCAN_CURSOR_KEY, cursor, { ex: 24 * 60 * 60 }).catch(() => null);
  return candidates;
}

async function readProject(projectId) {
  return await kvGetJson(projectKey(projectId)).catch(() => null);
}

async function resolveProjectEmail(sql, project) {
  const userId = clean(project?.userId);
  if (!userId) return "";
  if (userId.includes("@")) return normalizeIdentity(userId);

  const rows = await sql`
    select email
    from users
    where id::text = ${userId}
    limit 1
  `;

  return normalizeIdentity(rows?.[0]?.email);
}

function internalSessionCookie(email) {
  const secret = clean(process.env.JWT_SECRET);
  if (!secret) throw new Error("missing_jwt_secret");
  if (!email || !email.includes("@")) throw new Error("missing_project_email");

  const token = jwt.sign(
    { email, role: "user", source: "adfilm_video_completion_cron" },
    secret,
    { expiresIn: "5m" }
  );

  return `aivo_session=${encodeURIComponent(token)}`;
}

async function pollAdFilmStatus(req, project, email) {
  const response = await fetch(
    `${getOrigin(req)}/api/ad-film/seedance/status?projectId=${encodeURIComponent(project.id)}`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: internalSessionCookie(email),
        "x-aivo-internal-source": "adfilm-video-completion-cron",
      },
      cache: "no-store",
    }
  );

  const data = await response.json().catch(() => null);
  return {
    ok: response.ok && data?.ok !== false,
    http_status: response.status,
    data,
  };
}

async function finalizeAdFilm(req, redis, project, email, outputId) {
  const lockKey = finalizeClaimKey(project);
  const lockId = randomUUID();
  const acquired = await redis
    .set(lockKey, lockId, { nx: true, ex: CLAIM_TTL_SECONDS })
    .catch(() => null);

  if (!acquired) {
    return { ok: false, http_status: 202, data: { error: "finalize_claimed" } };
  }

  try {
    const response = await fetch(`${getOrigin(req)}/api/ad-film/seedance/finalize`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        cookie: internalSessionCookie(email),
        "x-aivo-internal-source": "adfilm-video-completion-cron",
      },
      body: JSON.stringify({
        projectId: project.id,
        outputId: clean(outputId),
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);
    return {
      ok: response.ok && data?.ok !== false,
      http_status: response.status,
      data,
    };
  } finally {
    const owner = clean(await redis.get(lockKey).catch(() => ""));
    if (owner === lockId) await redis.del(lockKey).catch(() => null);
  }
}

async function findIosTokensForProject(project, email) {
  const targets = new Set(
    [project?.userId, email].map(normalizeIdentity).filter(Boolean)
  );
  if (!targets.size) return [];

  const all = await kvGetJson("push:tokens:all");
  const tokens = Array.isArray(all) ? all.map(clean).filter(Boolean) : [];
  const matched = [];

  for (const token of tokens) {
    const record = await kvGetJson(`push:token:${token}`);
    if (!record || typeof record !== "object") continue;

    const platform = lower(record.platform);
    const permission = lower(record.permission_status);
    const revokedAt = clean(record.revoked_at);
    const recordUser = normalizeIdentity(
      record.user_id || record.user_uuid || record.email
    );

    if (platform !== "ios") continue;
    if (permission && permission !== "granted") continue;
    if (revokedAt) continue;
    if (!targets.has(recordUser)) continue;

    matched.push({ token, lang: normalizeLang(record.lang) });
  }

  return matched;
}

function localizedCopy(lang) {
  if (lang === "en") {
    return {
      title: "Your ad film is ready",
      body: "Your AI advertising film is complete. Open AIVO to watch it.",
    };
  }

  return {
    title: "Reklam filmin hazır",
    body: "AI reklam filmin tamamlandı. İzlemek için AIVO'yu aç.",
  };
}

async function sendAdFilmReadyPush(req, tokenRecord, project, output) {
  getFirebaseApp();

  const copy = localizedCopy(tokenRecord.lang);
  const imageUrl = `${getOrigin(req)}/api/push/adfilm-video-icon`;
  const videoUrl = outputVideoUrl(output);

  return admin.messaging().send({
    token: tokenRecord.token,
    notification: {
      title: copy.title,
      body: copy.body,
      imageUrl,
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          "mutable-content": 1,
        },
      },
      fcmOptions: {
        imageUrl,
      },
    },
    data: {
      source: "aivo_generation_complete",
      app: "adfilm",
      mode: "video_ad",
      project_id: clean(project?.id),
      output_id: clean(output?.id),
      video_url: videoUrl,
      imageUrl,
      image: imageUrl,
      click_action: "open_app",
    },
  });
}

async function claimPush(redis, project) {
  const id = randomUUID();
  const key = claimKey(project);
  const acquired = await redis
    .set(key, id, { nx: true, ex: CLAIM_TTL_SECONDS })
    .catch(() => null);
  return acquired ? { id, key } : null;
}

async function releasePushClaim(redis, claim) {
  if (!claim) return;
  const owner = clean(await redis.get(claim.key).catch(() => ""));
  if (owner === claim.id) await redis.del(claim.key).catch(() => null);
}

async function markSent(redis, project, sentCount) {
  await redis.set(
    sentKey(project),
    JSON.stringify({
      sent_at: nowIso(),
      sent_count: sentCount,
      channel: "fcm",
      platform: "ios",
    }),
    { ex: SENT_TTL_SECONDS }
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const auth = isAuthorizedCron(req);
    if (!auth.ok) {
      return res
        .status(auth.error === "missing_cron_secret" ? 500 : 401)
        .json({ ok: false, error: auth.error });
    }

    if (typeof getRedis !== "function" || typeof kvGetJson !== "function") {
      return res.status(500).json({ ok: false, error: "kv_helpers_unavailable" });
    }

    const conn = getConn();
    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    if (!clean(process.env.JWT_SECRET)) {
      return res.status(500).json({ ok: false, error: "missing_jwt_secret" });
    }

    const redis = getRedis();
    const sql = neon(conn);
    const candidates = await listCandidateProjects(redis);

    const summary = {
      checked: candidates.length,
      ready: 0,
      finalized: 0,
      pushed: 0,
      processing: 0,
      failed: 0,
      no_output: 0,
      no_token: 0,
      skipped: 0,
    };

    for (const candidate of candidates) {
      let pushClaim = null;

      try {
        let project = await readProject(candidate.id);
        if (!project || terminalFailure(project)) {
          summary.failed += 1;
          continue;
        }

        const email = await resolveProjectEmail(sql, project);
        if (!email) {
          summary.failed += 1;
          console.error("[adfilm-video-completions] missing project email", project.id);
          continue;
        }

        let finalOutput = pickFinalOutput(project);

        if (!finalOutput) {
          const statusResult = await pollAdFilmStatus(req, project, email);

          if (!statusResult.ok) {
            if (statusResult.http_status >= 500) summary.failed += 1;
            else summary.processing += 1;
            continue;
          }

          if (clean(statusResult.data?.status).toUpperCase() === "FAILED") {
            summary.failed += 1;
            continue;
          }

          project = await readProject(project.id);
          if (!project || terminalFailure(project)) {
            summary.failed += 1;
            continue;
          }

          finalOutput = pickFinalOutput(project);

          if (!finalOutput) {
            const status = clean(statusResult.data?.status).toUpperCase();
            const providerVideoUrl = clean(statusResult.data?.video_url);

            if (status !== "COMPLETED" || !providerVideoUrl) {
              summary.processing += 1;
              continue;
            }

            const outputId = clean(
              statusResult.data?.activeOutputId ||
                statusResult.data?.generation?.outputId ||
                statusResult.data?.generation?.requestId ||
                project?.generation?.outputId ||
                project?.generation?.requestId
            );

            if (!outputId) {
              summary.no_output += 1;
              continue;
            }

            const finalized = await finalizeAdFilm(
              req,
              redis,
              project,
              email,
              outputId
            );

            if (!finalized.ok) {
              const error = clean(finalized.data?.error);
              if (
                finalized.http_status === 202 ||
                finalized.http_status === 425 ||
                error === "finalization_processing" ||
                error === "avatar_video_processing" ||
                error === "finalize_claimed"
              ) {
                summary.processing += 1;
              } else {
                summary.failed += 1;
              }
              continue;
            }

            summary.finalized += 1;
            project = finalized.data?.project || (await readProject(project.id));
            finalOutput = pickFinalOutput(project);
          }
        }

        if (!project || !finalOutput || !outputVideoUrl(finalOutput)) {
          summary.no_output += 1;
          continue;
        }

        summary.ready += 1;

        const alreadySent = await redis.exists(sentKey(project)).catch(() => 0);
        if (Number(alreadySent) > 0) {
          summary.skipped += 1;
          continue;
        }

        pushClaim = await claimPush(redis, project);
        if (!pushClaim) {
          summary.skipped += 1;
          continue;
        }

        const tokens = await findIosTokensForProject(project, email);
        if (!tokens.length) {
          summary.no_token += 1;
          await releasePushClaim(redis, pushClaim);
          pushClaim = null;
          continue;
        }

        const results = [];
        for (const tokenRecord of tokens) {
          try {
            const messageId = await sendAdFilmReadyPush(
              req,
              tokenRecord,
              project,
              finalOutput
            );
            results.push({ ok: true, message_id: messageId });
          } catch (error) {
            results.push({
              ok: false,
              error: clean(error?.message || error) || "send_failed",
            });
          }
        }

        const sent = results.filter((item) => item.ok).length;
        if (sent > 0) {
          await markSent(redis, project, sent);
          summary.pushed += 1;
          await releasePushClaim(redis, pushClaim);
          pushClaim = null;
          continue;
        }

        summary.failed += 1;
        await releasePushClaim(redis, pushClaim);
        pushClaim = null;
      } catch (error) {
        summary.failed += 1;
        console.error(
          "[adfilm-video-completions] project failed",
          candidate?.id,
          error
        );

        try {
          if (pushClaim) await releasePushClaim(redis, pushClaim);
        } catch (_) {}
      }
    }

    console.log("[adfilm-video-completions]", summary);
    return res.status(200).json({ ok: true, ...summary });
  } catch (error) {
    console.error("[adfilm-video-completions] fatal", error);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: clean(error?.message || error) || "unknown_error",
    });
  }
}
