const crypto = require('node:crypto');
const { neon } = require('@neondatabase/serverless');
const { sendPushToUser } = require('../../../_lib/push-user.js');

const JWKS_URL = 'https://rest.fal.ai/.well-known/jwks.json';
const JWKS_CACHE_MS = 24 * 60 * 60 * 1000;

const jwksState =
  globalThis.__AIVO_FAL_WEBHOOK_JWKS__ ||
  (globalThis.__AIVO_FAL_WEBHOOK_JWKS__ = {
    keys: null,
    fetchedAt: 0,
  });

function getConn() {
  return (
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

function safeString(value) {
  const text = String(value || '').trim();
  return text || null;
}

function getBaseUrl(req) {
  const proto =
    String(req.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim() || 'https';

  const host =
    String(req.headers['x-forwarded-host'] || '')
      .split(',')[0]
      .trim() || String(req.headers.host || '').trim();

  if (!host) throw new Error('missing_request_host');
  return `${proto}://${host}`;
}

async function readRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function getJwks() {
  const now = Date.now();

  if (
    Array.isArray(jwksState.keys) &&
    jwksState.keys.length &&
    now - Number(jwksState.fetchedAt || 0) < JWKS_CACHE_MS
  ) {
    return jwksState.keys;
  }

  const response = await fetch(JWKS_URL, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`fal_jwks_http_${response.status}`);
  }

  const body = await response.json();
  const keys = Array.isArray(body?.keys) ? body.keys : [];

  if (!keys.length) {
    throw new Error('fal_jwks_empty');
  }

  jwksState.keys = keys;
  jwksState.fetchedAt = now;
  return keys;
}

async function verifyFalWebhook(req, rawBody) {
  const requestId = safeString(req.headers['x-fal-webhook-request-id']);
  const userId = safeString(req.headers['x-fal-webhook-user-id']);
  const timestamp = safeString(req.headers['x-fal-webhook-timestamp']);
  const signatureHex = safeString(req.headers['x-fal-webhook-signature']);

  if (!requestId || !userId || !timestamp || !signatureHex) {
    return { ok: false, error: 'missing_fal_signature_headers' };
  }

  const timestampNumber = Number(timestamp);
  const nowSeconds = Math.floor(Date.now() / 1000);

  if (
    !Number.isFinite(timestampNumber) ||
    Math.abs(nowSeconds - timestampNumber) > 300
  ) {
    return { ok: false, error: 'fal_webhook_timestamp_invalid' };
  }

  if (!/^[0-9a-f]+$/i.test(signatureHex) || signatureHex.length % 2 !== 0) {
    return { ok: false, error: 'fal_webhook_signature_format_invalid' };
  }

  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const message = Buffer.from(
    [requestId, userId, timestamp, bodyHash].join('\n'),
    'utf8'
  );
  const signature = Buffer.from(signatureHex, 'hex');
  const keys = await getJwks();

  for (const keyInfo of keys) {
    const x = safeString(keyInfo?.x);
    if (!x) continue;

    try {
      const publicKey = crypto.createPublicKey({
        key: {
          kty: 'OKP',
          crv: 'Ed25519',
          x,
        },
        format: 'jwk',
      });

      if (crypto.verify(null, message, publicKey, signature)) {
        return { ok: true, requestId, userId, timestamp };
      }
    } catch (_) {}
  }

  return { ok: false, error: 'fal_webhook_signature_invalid' };
}

function pickFinalVideoUrl(job) {
  const meta = job?.meta && typeof job.meta === 'object' ? job.meta : {};
  const outputs = Array.isArray(job?.outputs) ? job.outputs : [];

  const direct = safeString(
    meta.final_video_url ||
      meta.logo_overlay_url ||
      meta.muxed_url ||
      meta.video_url
  );

  if (direct) return direct;

  const finalOutput = outputs.find(
    (item) =>
      String(item?.type || '').toLowerCase() === 'video' &&
      item?.meta?.is_final === true &&
      safeString(item?.url || item?.archive_url)
  );

  if (finalOutput) {
    return safeString(finalOutput.url || finalOutput.archive_url);
  }

  const firstVideo = outputs.find(
    (item) =>
      String(item?.type || '').toLowerCase() === 'video' &&
      safeString(item?.url || item?.archive_url)
  );

  return firstVideo
    ? safeString(firstVideo.url || firstVideo.archive_url)
    : null;
}

async function findAtmosphereJob(sql, requestId) {
  const rows = await sql`
    select id, user_id, user_uuid, app, status, meta, outputs
    from jobs
    where lower(app) = 'atmo'
      and deleted_at is null
      and (
        request_id = ${requestId}
        or meta->>'request_id' = ${requestId}
        or meta->'provider_response'->'raw'->>'request_id' = ${requestId}
      )
    order by created_at desc
    limit 1
  `;

  return rows?.[0] || null;
}

async function markFailed(sql, jobId, webhookPayload) {
  const webhookMeta = {
    fal_webhook: {
      status: 'ERROR',
      received_at: new Date().toISOString(),
      payload_error: webhookPayload?.payload_error || null,
      error: webhookPayload?.error || null,
    },
  };

  await sql`
    update jobs
    set status = 'error',
        meta = coalesce(meta, '{}'::jsonb) || ${JSON.stringify(webhookMeta)}::jsonb,
        updated_at = now()
    where id = ${String(jobId)}::uuid
  `;
}

async function runServerCompletion(req, jobId) {
  const url = `${getBaseUrl(req)}/api/jobs/status?job_id=${encodeURIComponent(
    String(jobId)
  )}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'x-aivo-completion-source': 'fal_webhook',
    },
    signal: AbortSignal.timeout(240000),
  });

  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!response.ok || body?.ok === false) {
    throw new Error(`jobs_status_completion_failed:${response.status}`);
  }

  return body;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  try {
    const rawBody = await readRawBody(req);
    const verification = await verifyFalWebhook(req, rawBody);

    if (!verification.ok) {
      return res.status(401).json({
        ok: false,
        error: verification.error || 'invalid_fal_webhook',
      });
    }

    let webhookPayload;
    try {
      webhookPayload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ ok: false, error: 'invalid_json' });
    }

    const requestId = safeString(webhookPayload?.request_id);
    const webhookStatus = String(webhookPayload?.status || '').toUpperCase().trim();

    if (!requestId || requestId !== verification.requestId) {
      return res.status(400).json({
        ok: false,
        error: 'fal_request_id_mismatch',
      });
    }

    const conn = getConn();
    if (!conn) {
      return res.status(500).json({ ok: false, error: 'missing_db_env' });
    }

    const sql = neon(conn);
    let job = await findAtmosphereJob(sql, requestId);

    if (!job) {
      return res.status(503).json({
        ok: false,
        error: 'job_not_ready_for_webhook',
        request_id: requestId,
      });
    }

    if (webhookStatus === 'ERROR') {
      await markFailed(sql, job.id, webhookPayload);

      return res.status(200).json({
        ok: true,
        handled: true,
        status: 'error',
        request_id: requestId,
        job_id: String(job.id),
      });
    }

    if (webhookStatus !== 'OK') {
      return res.status(400).json({
        ok: false,
        error: 'unsupported_fal_webhook_status',
        status: webhookStatus || null,
      });
    }

    await runServerCompletion(req, job.id);

    job = await findAtmosphereJob(sql, requestId);

    const dbStatus = String(job?.status || '').toLowerCase();
    const finalVideoUrl = pickFinalVideoUrl(job);

    if (dbStatus !== 'done' || !finalVideoUrl) {
      return res.status(500).json({
        ok: false,
        error: 'completion_not_finalized',
        request_id: requestId,
        job_id: job?.id ? String(job.id) : null,
        db_status: dbStatus || null,
      });
    }

    const pushResult = await sendPushToUser({
      userId: job.user_id,
      userUuid: job.user_uuid,
      titleTr: '🎬 Videon Hazır!',
      bodyTr: "AIVO'da oluşturduğun video tamamlandı. İzlemek için dokun.",
      titleEn: '🎬 Your Video Is Ready!',
      bodyEn: 'Your AIVO video is ready. Tap to watch.',
      source: 'aivo_generation_complete',
      idempotencyKey: `generation-complete:atmo:${String(job.id)}`,
      data: {
        job_id: String(job.id),
        module: 'atmo',
        type: 'video',
        target: 'productions',
      },
    });

    return res.status(200).json({
      ok: true,
      handled: true,
      status: 'completed',
      request_id: requestId,
      job_id: String(job.id),
      push: {
        duplicate: pushResult?.duplicate === true,
        sent: Number(pushResult?.sent || 0),
        failed: Number(pushResult?.failed || 0),
      },
    });
  } catch (error) {
    console.error('[fal/video/webhook]', error);

    return res.status(500).json({
      ok: false,
      error: 'webhook_processing_failed',
      message: String(error?.message || error),
    });
  }
};
