const admin = require("firebase-admin");
const { neon } = require("@neondatabase/serverless");
const { randomUUID } = require("node:crypto");
const { kvGetJson } = require("../_kv");

const MAX_JOBS_PER_RUN = 3;
const CLAIM_TTL_MINUTES = 5;
const LIPSYNC_PUSH_START_AT = "2026-08-11T12:15:00.000Z";

function clean(value) {
  return String(value || "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEmail(value) {
  return clean(value).toLowerCase();
}

function normalizeLang(value) {
  return clean(value).toLowerCase().startsWith("en") ? "en" : "tr";
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

function pickVideoUrl(item) {
  return clean(
    item?.archive_url ||
      item?.url ||
      item?.video_url ||
      item?.meta?.archive_url ||
      item?.meta?.url ||
      item?.meta?.video_url
  );
}

function pickProviderVideoUrl(row) {
  const meta = row?.meta || {};
  const outputs = Array.isArray(row?.outputs) ? row.outputs : [];

  if (clean(meta.final_variant).toLowerCase() === "provider") {
    const explicit = clean(meta.final_video_url);
    if (explicit) return explicit;
  }

  const providerOutput = outputs.find((item) => {
    if (!item || clean(item.type).toLowerCase() !== "video") return false;
    return clean(item.meta?.variant).toLowerCase() === "provider" && !!pickVideoUrl(item);
  });

  return pickVideoUrl(providerOutput);
}

function pickFinalizedVideoUrl(row) {
  const meta = row?.meta || {};
  const outputs = Array.isArray(row?.outputs) ? row.outputs : [];

  if (clean(meta.final_variant).toLowerCase() === "finalized") {
    const explicit = clean(meta.final_video_url);
    if (explicit) return explicit;
  }

  const finalizedOutput = outputs.find((item) => {
    if (!item || clean(item.type).toLowerCase() !== "video") return false;
    const variant = clean(item.meta?.variant).toLowerCase();
    const isFinal = item.meta?.is_final === true;
    return variant === "finalized" && isFinal && !!pickVideoUrl(item);
  });

  if (finalizedOutput) return pickVideoUrl(finalizedOutput);

  const relaxedFinalizedOutput = outputs.find((item) => {
    if (!item || clean(item.type).toLowerCase() !== "video") return false;
    return clean(item.meta?.variant).toLowerCase() === "finalized" && !!pickVideoUrl(item);
  });

  return pickVideoUrl(relaxedFinalizedOutput);
}

function isProviderDone(row) {
  if (!row) return false;
  if (clean(row.status).toLowerCase() !== "done") return false;
  return !!pickProviderVideoUrl(row) || !!pickFinalizedVideoUrl(row);
}

function isReady(row) {
  if (!row) return false;
  if (clean(row.status).toLowerCase() !== "done") return false;
  return !!pickFinalizedVideoUrl(row);
}

async function listCandidateJobs(sql) {
  const rows = await sql`
    select
      id::text as id,
      user_id,
      status,
      meta,
      outputs,
      created_at
    from jobs
    where lower(app) = 'lipsync'
      and deleted_at is null
      and created_at >= ${LIPSYNC_PUSH_START_AT}::timestamptz
      and coalesce(meta->>'completion_push_sent_at', '') = ''
      and lower(coalesce(status::text, '')) in ('queued', 'processing', 'done')
    order by created_at asc
    limit ${MAX_JOBS_PER_RUN}
  `;

  return Array.isArray(rows) ? rows : [];
}

async function pollLipsyncStatus(req, jobId) {
  const response = await fetch(
    `${getOrigin(req)}/api/jobs/status?job_id=${encodeURIComponent(jobId)}`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        "x-aivo-internal-source": "lipsync-completion-cron",
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

async function finalizeLipsync(req, jobId) {
  const response = await fetch(`${getOrigin(req)}/api/lipsync/finalize`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-aivo-internal-source": "lipsync-completion-cron",
    },
    body: JSON.stringify({ job_id: jobId }),
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);

  return {
    ok: response.ok && data?.ok !== false,
    http_status: response.status,
    data,
  };
}

async function readJob(sql, jobId) {
  const rows = await sql`
    select
      id::text as id,
      user_id,
      status,
      meta,
      outputs,
      created_at
    from jobs
    where id = ${jobId}::uuid
      and lower(app) = 'lipsync'
      and deleted_at is null
    limit 1
  `;

  return rows?.[0] || null;
}

async function claimReadyJob(sql, jobId, claimId) {
  const patch = {
    completion_push_claimed_at: nowIso(),
    completion_push_claim_id: claimId,
  };

  const rows = await sql`
    update jobs
    set
      meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb,
      updated_at = now()
    where id = ${jobId}::uuid
      and lower(app) = 'lipsync'
      and deleted_at is null
      and lower(coalesce(status::text, '')) = 'done'
      and lower(coalesce(meta->>'final_variant', '')) = 'finalized'
      and coalesce(meta->>'final_video_url', '') <> ''
      and coalesce(meta->>'completion_push_sent_at', '') = ''
      and (
        coalesce(meta->>'completion_push_claimed_at', '') = ''
        or (meta->>'completion_push_claimed_at')::timestamptz < now() - (${CLAIM_TTL_MINUTES} * interval '1 minute')
      )
    returning id::text as id, user_id, status, meta, outputs
  `;

  return rows?.[0] || null;
}

async function releaseClaim(sql, jobId, claimId, patch) {
  const safePatch = patch && typeof patch === "object" ? patch : {};

  await sql`
    update jobs
    set
      meta = ((coalesce(meta, '{}'::jsonb) - 'completion_push_claimed_at') - 'completion_push_claim_id') || ${JSON.stringify(safePatch)}::jsonb,
      updated_at = now()
    where id = ${jobId}::uuid
      and lower(app) = 'lipsync'
      and meta->>'completion_push_claim_id' = ${claimId}
  `;
}

async function findIosTokensForUser(userId) {
  const target = normalizeEmail(userId);
  if (!target || !target.includes("@")) return [];

  const all = await kvGetJson("push:tokens:all");
  const tokens = Array.isArray(all) ? all.map(clean).filter(Boolean) : [];
  const matched = [];

  for (const token of tokens) {
    const record = await kvGetJson(`push:token:${token}`);
    if (!record || typeof record !== "object") continue;

    const platform = clean(record.platform).toLowerCase();
    const permission = clean(record.permission_status).toLowerCase();
    const revokedAt = clean(record.revoked_at);
    const recordUser = normalizeEmail(
      record.user_id || record.user_uuid || record.email
    );

    if (platform !== "ios") continue;
    if (permission && permission !== "granted") continue;
    if (revokedAt) continue;
    if (recordUser !== target) continue;

    matched.push({ token, lang: normalizeLang(record.lang) });
  }

  return matched;
}

function localizedCopy(lang) {
  if (lang === "en") {
    return {
      title: "Your lip sync video is ready",
      body: "Your AI lip sync video is complete. Open AIVO to watch it.",
    };
  }

  return {
    title: "Dudak senkron videon hazır",
    body: "AI dudak senkron videon tamamlandı. İzlemek için AIVO'yu aç.",
  };
}

async function sendLipsyncReadyPush(req, tokenRecord, row) {
  getFirebaseApp();

  const copy = localizedCopy(tokenRecord.lang);
  const imageUrl = `${getOrigin(req)}/api/push/lipsync-icon`;
  const videoUrl = pickFinalizedVideoUrl(row);

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
      app: "lipsync",
      mode: "lipsync",
      job_id: clean(row?.id),
      video_url: videoUrl,
      imageUrl,
      image: imageUrl,
      click_action: "open_app",
    },
  });
}

module.exports = async function handler(req, res) {
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

    const conn = getConn();
    if (!conn) {
      return res.status(500).json({ ok: false, error: "missing_db_env" });
    }

    const sql = neon(conn);
    const candidates = await listCandidateJobs(sql);

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
      let claimId = "";

      try {
        if (!isProviderDone(candidate) && !isReady(candidate)) {
          const polled = await pollLipsyncStatus(req, candidate.id);

          if (!polled.ok && polled.http_status >= 500) {
            summary.failed += 1;
            continue;
          }
        }

        let row = await readJob(sql, candidate.id);
        if (!row) {
          summary.skipped += 1;
          continue;
        }

        let status = clean(row.status).toLowerCase();
        if (status === "error" || status === "failed") {
          summary.failed += 1;
          continue;
        }

        if (!isProviderDone(row) && !isReady(row)) {
          summary.processing += 1;
          continue;
        }

        if (!isReady(row)) {
          const providerVideoUrl = pickProviderVideoUrl(row);
          if (!providerVideoUrl) {
            summary.no_output += 1;
            continue;
          }

          const finalized = await finalizeLipsync(req, row.id);
          if (!finalized.ok) {
            if (finalized.http_status >= 500) {
              summary.failed += 1;
            } else {
              summary.processing += 1;
            }
            continue;
          }

          summary.finalized += 1;
          row = await readJob(sql, row.id);

          if (!row) {
            summary.skipped += 1;
            continue;
          }

          status = clean(row.status).toLowerCase();
          if (status === "error" || status === "failed") {
            summary.failed += 1;
            continue;
          }
        }

        if (!isReady(row)) {
          summary.processing += 1;
          continue;
        }

        const videoUrl = pickFinalizedVideoUrl(row);
        if (!videoUrl) {
          summary.no_output += 1;
          continue;
        }

        summary.ready += 1;
        claimId = randomUUID();

        const claimed = await claimReadyJob(sql, row.id, claimId);
        if (!claimed) {
          summary.skipped += 1;
          continue;
        }

        const tokens = await findIosTokensForUser(claimed.user_id || row.user_id);

        if (!tokens.length) {
          summary.no_token += 1;
          await releaseClaim(sql, row.id, claimId, {
            completion_push_last_attempt_at: nowIso(),
            completion_push_last_error: "no_registered_ios_token",
          });
          continue;
        }

        const results = [];

        for (const tokenRecord of tokens) {
          try {
            const messageId = await sendLipsyncReadyPush(req, tokenRecord, {
              ...row,
              meta: claimed.meta || row.meta || {},
              outputs: claimed.outputs || row.outputs || [],
            });
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
          summary.pushed += 1;
          await releaseClaim(sql, row.id, claimId, {
            completion_push_sent_at: nowIso(),
            completion_push_channel: "fcm",
            completion_push_platform: "ios",
            completion_push_sent_count: sent,
            completion_push_last_error: null,
          });
          continue;
        }

        summary.failed += 1;
        await releaseClaim(sql, row.id, claimId, {
          completion_push_last_attempt_at: nowIso(),
          completion_push_last_error:
            results[0]?.error || "all_push_sends_failed",
        });
      } catch (error) {
        summary.failed += 1;
        console.error("[lipsync-completions] job failed", candidate?.id, error);

        try {
          if (claimId) {
            await releaseClaim(sql, candidate.id, claimId, {
              completion_push_last_attempt_at: nowIso(),
              completion_push_last_error:
                clean(error?.message || error) || "job_processing_failed",
            });
          }
        } catch (_) {}
      }
    }

    console.log("[lipsync-completions]", summary);
    return res.status(200).json({ ok: true, ...summary });
  } catch (error) {
    console.error("[lipsync-completions] fatal", error);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: clean(error?.message || error) || "unknown_error",
    });
  }
};
