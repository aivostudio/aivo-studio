const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const { neon } = require("@neondatabase/serverless");
const { randomUUID } = require("node:crypto");
const { kvGetJson } = require("../_kv");

const MAX_JOBS_PER_RUN = 5;
const CLAIM_TTL_MINUTES = 5;
const COVER_PUSH_START_AT = "2026-08-11T00:12:00.000Z";

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

function cleanSessionToken(raw) {
  let value = clean(raw);
  if (!value) return "";

  try {
    value = decodeURIComponent(value);
  } catch (_) {}

  if (value.startsWith('"') && value.endsWith('"')) {
    value = value.slice(1, -1);
  }

  if (value.startsWith("s:")) value = value.slice(2);
  return clean(value);
}

async function resolveEmailFromStoredSession(rawUserId) {
  const raw = clean(rawUserId);
  if (!raw) return "";

  const directEmail = normalizeEmail(raw);
  if (directEmail.includes("@")) return directEmail;

  const token = cleanSessionToken(raw);
  if (!token) return "";

  try {
    const sess = await kvGetJson(`sess:${token}`);
    const email = normalizeEmail(sess?.email);
    if (email.includes("@")) return email;
  } catch (_) {}

  const secret = clean(process.env.JWT_SECRET);
  if (!secret) return "";

  try {
    const payload = jwt.verify(token, secret);
    const email = normalizeEmail(
      payload?.email ||
      payload?.user?.email ||
      (String(payload?.sub || "").includes("@") ? payload.sub : "")
    );

    return email.includes("@") ? email : "";
  } catch (_) {
    return "";
  }
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

function getCoverUrl(row) {
  const outputs = Array.isArray(row?.outputs) ? row.outputs : [];
  const first = outputs.find((item) => item && (item.url || item.image_url || item.imageUrl));

  return clean(
    first?.url ||
    first?.image_url ||
    first?.imageUrl ||
    row?.meta?.r2_url ||
    row?.meta?.fal_url
  );
}

async function listCandidateJobs(sql) {
  const rows = await sql`
    select
      id::text as id,
      user_id,
      request_id,
      status,
      provider,
      meta,
      outputs,
      created_at
    from jobs
    where lower(app) = 'cover'
      and lower(coalesce(provider, '')) = 'fal'
      and deleted_at is null
      and created_at >= ${COVER_PUSH_START_AT}::timestamptz
      and coalesce(meta->>'completion_push_sent_at', '') = ''
      and lower(coalesce(status::text, '')) = 'completed'
    order by created_at asc
    limit ${MAX_JOBS_PER_RUN}
  `;

  return Array.isArray(rows) ? rows : [];
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
      and lower(app) = 'cover'
      and lower(coalesce(provider, '')) = 'fal'
      and deleted_at is null
      and lower(coalesce(status::text, '')) = 'completed'
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
      and lower(app) = 'cover'
      and meta->>'completion_push_claim_id' = ${claimId}
  `;
}

async function findIosTokensForUser(email) {
  const target = normalizeEmail(email);
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
    const recordUser = normalizeEmail(record.user_id || record.user_uuid || record.email);

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
      title: "Your cover is ready 🖼️",
      body: "Your AI cover generation is complete. Open AIVO to view it.",
    };
  }

  return {
    title: "Kapağın hazır 🖼️",
    body: "AI kapak üretimin tamamlandı. Görmek için AIVO'yu aç.",
  };
}

async function sendCoverReadyPush(req, tokenRecord, row) {
  getFirebaseApp();
  const copy = localizedCopy(tokenRecord.lang);
  const coverUrl = getCoverUrl(row);
  const imageUrl = `${getOrigin(req)}/api/push/cover-icon`;

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
      app: "cover",
      job_id: clean(row?.id),
      cover_url: coverUrl,
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
    if (!conn) return res.status(500).json({ ok: false, error: "missing_db_env" });

    const sql = neon(conn);
    const candidates = await listCandidateJobs(sql);
    const summary = {
      checked: candidates.length,
      ready: 0,
      pushed: 0,
      no_user: 0,
      no_token: 0,
      failed: 0,
      skipped: 0,
    };

    for (const row of candidates) {
      let claimId = "";

      try {
        const coverUrl = getCoverUrl(row);
        if (!coverUrl) {
          summary.skipped += 1;
          continue;
        }

        const email = await resolveEmailFromStoredSession(row.user_id);
        if (!email) {
          summary.no_user += 1;
          continue;
        }

        summary.ready += 1;
        claimId = randomUUID();

        const claimed = await claimReadyJob(sql, row.id, claimId);
        if (!claimed || !getCoverUrl(claimed)) {
          summary.skipped += 1;
          continue;
        }

        const tokens = await findIosTokensForUser(email);

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
            const messageId = await sendCoverReadyPush(req, tokenRecord, {
              ...row,
              status: claimed.status || row.status,
              meta: claimed.meta || row.meta || {},
              outputs: claimed.outputs || row.outputs || [],
            });
            results.push({ ok: true, message_id: messageId });
          } catch (error) {
            results.push({ ok: false, error: clean(error?.message || error) || "send_failed" });
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
          completion_push_last_error: results[0]?.error || "all_push_sends_failed",
        });
      } catch (error) {
        summary.failed += 1;
        console.error("[cover-completions] job failed", row?.id, error);

        try {
          if (claimId) {
            await releaseClaim(sql, row.id, claimId, {
              completion_push_last_attempt_at: nowIso(),
              completion_push_last_error: clean(error?.message || error) || "job_processing_failed",
            });
          }
        } catch (_) {}
      }
    }

    console.log("[cover-completions]", summary);
    return res.status(200).json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cover-completions] fatal", error);
    return res.status(500).json({
      ok: false,
      error: "server_error",
      message: clean(error?.message || error) || "unknown_error",
    });
  }
};
