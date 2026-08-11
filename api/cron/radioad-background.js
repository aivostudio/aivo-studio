import jwt from "jsonwebtoken";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import kvModule from "../_kv.js";

export const config = { runtime: "nodejs" };
export const maxDuration = 300;

const kv = kvModule?.default || kvModule || {};
const getRedis = kv.getRedis;
const kvGetJson = kv.kvGetJson;

const PROJECT_MATCH = "radioad:project:*";
const SCAN_CURSOR_KEY = "radioad:background:scan-cursor";
const CLAIM_TTL_SECONDS = 55;
const MAX_PROJECTS_PER_RUN = 2;
const MAX_SCAN_PAGES = 30;
const SCAN_COUNT = 300;
const TAKEOVER_AFTER_MS = 30 * 1000;
const RADIO_BACKGROUND_START_AT = "2026-08-11T22:25:00.000Z";

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function lower(value) {
  return clean(value).toLowerCase();
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

function projectKey(projectId) {
  return `radioad:project:${clean(projectId)}`;
}

function claimKey(projectId) {
  return `radioad:background:claim:${clean(projectId)}`;
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

  return Promise.all(keys.map((key) => kvGetJson(key).catch(() => null)));
}

function startedAt(project) {
  return Date.parse(
    clean(
      project?.musicGeneration?.startedAt ||
      project?.finalGeneration?.startedAt ||
      project?.updatedAt
    )
  );
}

function isRecentEnough(project) {
  const start = startedAt(project);
  const cutoff = Date.parse(RADIO_BACKGROUND_START_AT);
  return Number.isFinite(start) && Number.isFinite(cutoff) && start >= cutoff;
}

function isStaleEnoughForTakeover(project) {
  const updated = Date.parse(clean(project?.updatedAt));
  if (!Number.isFinite(updated)) return true;
  return Date.now() - updated >= TAKEOVER_AFTER_MS;
}

function isReadyForBackground(project) {
  if (!project || typeof project !== "object") return false;
  if (!clean(project.id)) return false;
  if (!isRecentEnough(project)) return false;
  if (!isStaleEnoughForTakeover(project)) return false;
  if (lower(project.status) !== "processing") return false;
  if (clean(project?.final?.url)) return false;

  const finalStatus = lower(project?.finalGeneration?.status);
  if (finalStatus === "failed" || finalStatus === "completed") return false;
  if (finalStatus === "processing") return false;

  const narration = project?.narration?.audio;
  if (!narration?.url || narration.approved !== true || narration.mastered !== true) {
    return false;
  }

  const mode = lower(project?.music?.mode || "ai");
  if (mode === "off") return true;
  if (mode === "upload") return !!clean(project?.music?.upload?.url);

  if (clean(project?.music?.audio?.url)) return true;
  const generationStatus = lower(project?.musicGeneration?.status);
  return !!clean(project?.musicGeneration?.requestId) && ["queued", "processing"].includes(generationStatus);
}

async function listCandidates(redis) {
  let cursor = clean(await redis.get(SCAN_CURSOR_KEY).catch(() => "0")) || "0";
  const candidates = [];

  for (let page = 0; page < MAX_SCAN_PAGES; page += 1) {
    const scanned = normalizeScanResult(
      await redis.scan(cursor, { match: PROJECT_MATCH, count: SCAN_COUNT })
    );
    cursor = scanned.cursor;

    const projects = await readProjects(redis, scanned.keys);
    for (const project of projects) {
      if (!isReadyForBackground(project)) continue;
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
  if (userId.includes("@")) return lower(userId);

  const rows = await sql`
    select email
    from users
    where id::text = ${userId}
    limit 1
  `;

  return lower(rows?.[0]?.email);
}

function internalSessionCookie(email) {
  const secret = clean(process.env.JWT_SECRET);
  if (!secret) throw new Error("missing_jwt_secret");
  if (!email || !email.includes("@")) throw new Error("missing_project_email");

  const token = jwt.sign(
    { email, role: "user", source: "radioad_background_cron" },
    secret,
    { expiresIn: "5m" }
  );

  return `aivo_session=${encodeURIComponent(token)}`;
}

async function callJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  return {
    ok: response.ok && data?.ok !== false,
    status: response.status,
    data,
  };
}

async function pollMusic(req, project, email) {
  return callJson(
    `${getOrigin(req)}/api/radio-ad/music/status?projectId=${encodeURIComponent(project.id)}`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        cookie: internalSessionCookie(email),
        "x-aivo-internal-source": "radioad-background-cron",
      },
    }
  );
}

async function createFinal(req, project, email) {
  return callJson(`${getOrigin(req)}/api/radio-ad/final/create`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      cookie: internalSessionCookie(email),
      "x-aivo-internal-source": "radioad-background-cron",
    },
    body: JSON.stringify({ projectId: project.id }),
  });
}

async function acquireClaim(redis, projectId) {
  const id = randomUUID();
  const key = claimKey(projectId);
  const acquired = await redis.set(key, id, { nx: true, ex: CLAIM_TTL_SECONDS }).catch(() => null);
  return acquired ? { id, key } : null;
}

async function releaseClaim(redis, claim) {
  if (!claim) return;
  const owner = clean(await redis.get(claim.key).catch(() => ""));
  if (owner === claim.id) await redis.del(claim.key).catch(() => null);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ ok: false, error: "method_not_allowed" });
    }

    const auth = isAuthorizedCron(req);
    if (!auth.ok) {
      return res.status(auth.error === "missing_cron_secret" ? 500 : 401).json({
        ok: false,
        error: auth.error,
      });
    }

    if (typeof getRedis !== "function" || typeof kvGetJson !== "function") {
      return res.status(500).json({ ok: false, error: "kv_helpers_unavailable" });
    }

    const conn = getConn();
    if (!conn) return res.status(500).json({ ok: false, error: "missing_db_env" });
    if (!clean(process.env.JWT_SECRET)) {
      return res.status(500).json({ ok: false, error: "missing_jwt_secret" });
    }

    const redis = getRedis();
    const sql = neon(conn);
    const candidates = await listCandidates(redis);

    const summary = {
      checked: candidates.length,
      music_polled: 0,
      music_completed: 0,
      final_started: 0,
      completed: 0,
      processing: 0,
      failed: 0,
      skipped: 0,
    };

    for (const candidate of candidates) {
      let claim = null;

      try {
        claim = await acquireClaim(redis, candidate.id);
        if (!claim) {
          summary.skipped += 1;
          continue;
        }

        let project = await readProject(candidate.id);
        if (!project || !isReadyForBackground(project)) {
          summary.skipped += 1;
          continue;
        }

        const email = await resolveProjectEmail(sql, project);
        if (!email) {
          summary.failed += 1;
          console.error("[radioad-background] missing project email", project.id);
          continue;
        }

        const mode = lower(project?.music?.mode || "ai");
        if (mode === "ai" && !clean(project?.music?.audio?.url)) {
          summary.music_polled += 1;
          const musicResult = await pollMusic(req, project, email);

          if (!musicResult.ok) {
            if (musicResult.status >= 500) summary.failed += 1;
            else summary.processing += 1;
            continue;
          }

          const musicStatus = clean(musicResult.data?.status).toUpperCase();
          if (musicStatus === "FAILED") {
            summary.failed += 1;
            continue;
          }
          if (musicStatus !== "COMPLETED") {
            summary.processing += 1;
            continue;
          }

          summary.music_completed += 1;
          project = musicResult.data?.project || (await readProject(project.id));
        }

        if (!project || clean(project?.final?.url)) {
          summary.completed += 1;
          continue;
        }

        if (lower(project?.finalGeneration?.status) === "processing") {
          summary.processing += 1;
          continue;
        }

        summary.final_started += 1;
        const finalResult = await createFinal(req, project, email);

        if (!finalResult.ok) {
          if (finalResult.status >= 500) summary.failed += 1;
          else summary.processing += 1;
          continue;
        }

        const finalStatus = clean(finalResult.data?.status).toUpperCase();
        if (finalStatus === "COMPLETED" || clean(finalResult.data?.final?.url)) {
          summary.completed += 1;
        } else {
          summary.processing += 1;
        }
      } catch (error) {
        summary.failed += 1;
        console.error("[radioad-background] project failed", candidate?.id, error);
      } finally {
        try {
          await releaseClaim(redis, claim);
        } catch (_) {}
      }
    }

    console.log("[radioad-background]", summary);
    return res.status(200).json({ ok: true, ...summary });
  } catch (error) {
    console.error("[radioad-background] fatal", error);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: clean(error?.message || error) || "unknown_error",
    });
  }
}
