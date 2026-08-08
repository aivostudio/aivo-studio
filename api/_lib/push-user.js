const admin = require('firebase-admin');
const { getRedis, kvGetJson, kvSetJson } = require('../_kv.js');

function safeString(value) {
  const text = String(value || '').trim();
  return text || null;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return email || null;
}

function normalizeLang(value) {
  const lang = String(value || '').toLowerCase().trim();

  if (lang === 'en' || lang.startsWith('en')) return 'en';
  return 'tr';
}

function tokenKey(deviceToken) {
  return `push:token:${deviceToken}`;
}

function userIdTokensKey(userId) {
  return `push:user_id:${userId}:tokens`;
}

function userUuidTokensKey(userUuid) {
  return `push:user_uuid:${userUuid}:tokens`;
}

function completionLockKey(idempotencyKey) {
  return `push:delivery:${idempotencyKey}`;
}

function getFirebasePrivateKey() {
  return String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

function getFirebaseApp() {
  if (admin.apps.length) return admin.app();

  const projectId = safeString(process.env.FIREBASE_PROJECT_ID);
  const clientEmail = safeString(process.env.FIREBASE_CLIENT_EMAIL);
  const privateKey = getFirebasePrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('missing_firebase_env');
  }

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey
    })
  });
}

function isGrantedRecord(record) {
  if (!record || typeof record !== 'object') return false;

  const permission = String(record.permission_status || '')
    .toLowerCase()
    .trim();

  if (permission !== 'granted') return false;
  if (record.revoked_at) return false;

  return true;
}

function recordBelongsToTarget(record, userId, userUuid) {
  if (!record || typeof record !== 'object') return false;

  const recordUserId = normalizeEmail(record.user_id);
  const recordUserUuid = safeString(record.user_uuid);

  if (userId && recordUserId !== userId) return false;
  if (userUuid && recordUserUuid !== userUuid) return false;

  return !!(userId || userUuid);
}

function isPermanentFcmTokenError(err) {
  const code = String(err && err.code ? err.code : '');
  const message = String(err && err.message ? err.message : '');

  if (code === 'messaging/registration-token-not-registered') return true;
  if (code === 'messaging/invalid-registration-token') return true;
  if (message.includes('NotRegistered')) return true;
  if (message.includes('not a valid FCM registration token')) return true;
  if (message.includes('Requested entity was not found')) return true;

  return false;
}

function stringifyData(data) {
  const input = data && typeof data === 'object' ? data : {};
  const output = {};

  for (const [key, value] of Object.entries(input)) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'string') {
      output[key] = value;
      continue;
    }

    if (typeof value === 'object') {
      output[key] = JSON.stringify(value);
      continue;
    }

    output[key] = String(value);
  }

  return output;
}

function pickLocalizedCopy(lang, copy) {
  const isEnglish = lang === 'en';

  const preferredTitle = isEnglish ? copy.titleEn : copy.titleTr;
  const preferredBody = isEnglish ? copy.bodyEn : copy.bodyTr;
  const fallbackTitle = isEnglish ? copy.titleTr : copy.titleEn;
  const fallbackBody = isEnglish ? copy.bodyTr : copy.bodyEn;

  return {
    title: preferredTitle || fallbackTitle,
    body: preferredBody || fallbackBody
  };
}

async function loadTargetTokens(redis, userId, userUuid) {
  const tokenSet = new Set();

  if (userId) {
    const byUserId = await redis.smembers(userIdTokensKey(userId));
    for (const token of Array.isArray(byUserId) ? byUserId : []) {
      const cleanToken = safeString(token);
      if (cleanToken) tokenSet.add(cleanToken);
    }
  }

  if (userUuid) {
    const byUserUuid = await redis.smembers(userUuidTokensKey(userUuid));
    for (const token of Array.isArray(byUserUuid) ? byUserUuid : []) {
      const cleanToken = safeString(token);
      if (cleanToken) tokenSet.add(cleanToken);
    }
  }

  return Array.from(tokenSet);
}

async function removeTokenFromTargetIndexes(redis, token, userId, userUuid) {
  if (userId) {
    await redis.srem(userIdTokensKey(userId), token);
  }

  if (userUuid) {
    await redis.srem(userUuidTokensKey(userUuid), token);
  }
}

async function revokeInvalidToken(redis, token, record, userId, userUuid) {
  await removeTokenFromTargetIndexes(redis, token, userId, userUuid);

  const recordUserId = normalizeEmail(record && record.user_id);
  const recordUserUuid = safeString(record && record.user_uuid);

  if (recordUserId && recordUserId !== userId) {
    await redis.srem(userIdTokensKey(recordUserId), token);
  }

  if (recordUserUuid && recordUserUuid !== userUuid) {
    await redis.srem(userUuidTokensKey(recordUserUuid), token);
  }

  if (record && typeof record === 'object') {
    const now = new Date().toISOString();

    await kvSetJson(tokenKey(token), {
      ...record,
      permission_status: 'revoked',
      revoked_at: now,
      updated_at: now,
      revoke_reason: 'invalid_fcm_token'
    });
  }
}

async function sendFirebaseMessage({ token, title, body, imageUrl, data }) {
  getFirebaseApp();

  const cleanImageUrl = safeString(imageUrl);

  const message = {
    token,
    notification: {
      title,
      body,
      imageUrl: cleanImageUrl || undefined
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        imageUrl: cleanImageUrl || undefined
      }
    },
    apns: {
      headers: {
        'apns-priority': '10'
      },
      payload: {
        aps: {
          sound: 'default',
          'mutable-content': 1
        }
      },
      fcmOptions: {
        imageUrl: cleanImageUrl || undefined
      }
    },
    data: stringifyData({
      ...data,
      click_action: data && data.click_action ? data.click_action : 'open_app',
      imageUrl: cleanImageUrl || '',
      image: cleanImageUrl || ''
    })
  };

  return await admin.messaging().send(message);
}

async function acquireDeliveryLock(redis, idempotencyKey, ttlSeconds) {
  if (!idempotencyKey) return true;

  const ttl = Number.isFinite(Number(ttlSeconds)) && Number(ttlSeconds) > 0
    ? Math.floor(Number(ttlSeconds))
    : 604800;

  const result = await redis.set(
    completionLockKey(idempotencyKey),
    new Date().toISOString(),
    { nx: true, ex: ttl }
  );

  return result === 'OK';
}

async function releaseDeliveryLock(redis, idempotencyKey) {
  if (!idempotencyKey) return;
  await redis.del(completionLockKey(idempotencyKey));
}

async function sendPushToUser(options = {}) {
  const redis = getRedis();

  const userId = normalizeEmail(options.userId || options.user_id);
  const userUuid = safeString(options.userUuid || options.user_uuid);

  if (!userId && !userUuid) {
    throw new Error('push_target_user_required');
  }

  const copy = {
    titleTr: safeString(options.titleTr || options.title_tr),
    bodyTr: safeString(options.bodyTr || options.body_tr || options.messageTr || options.message_tr),
    titleEn: safeString(options.titleEn || options.title_en),
    bodyEn: safeString(options.bodyEn || options.body_en || options.messageEn || options.message_en)
  };

  const hasTrCopy = !!(copy.titleTr && copy.bodyTr);
  const hasEnCopy = !!(copy.titleEn && copy.bodyEn);

  if (!hasTrCopy && !hasEnCopy) {
    throw new Error('push_localized_copy_required');
  }

  const source = safeString(options.source) || 'aivo_generation_complete';
  const imageUrl = safeString(options.imageUrl || options.image_url);
  const idempotencyKey = safeString(options.idempotencyKey || options.idempotency_key);

  const lockAcquired = await acquireDeliveryLock(
    redis,
    idempotencyKey,
    options.idempotencyTtlSeconds || options.idempotency_ttl_seconds
  );

  if (!lockAcquired) {
    return {
      ok: true,
      duplicate: true,
      sent: 0,
      failed: 0,
      invalid_tokens_removed: 0
    };
  }

  try {
    const indexedTokens = await loadTargetTokens(redis, userId, userUuid);

    if (!indexedTokens.length) {
      await releaseDeliveryLock(redis, idempotencyKey);

      return {
        ok: true,
        duplicate: false,
        sent: 0,
        failed: 0,
        invalid_tokens_removed: 0,
        reason: 'no_registered_devices'
      };
    }

    const results = [];
    let invalidTokensRemoved = 0;

    for (const token of indexedTokens) {
      const record = await kvGetJson(tokenKey(token));

      if (!recordBelongsToTarget(record, userId, userUuid)) {
        await removeTokenFromTargetIndexes(redis, token, userId, userUuid);

        results.push({
          ok: true,
          skipped: true,
          reason: 'stale_or_wrong_user_index'
        });
        continue;
      }

      if (!isGrantedRecord(record)) {
        await removeTokenFromTargetIndexes(redis, token, userId, userUuid);

        results.push({
          ok: true,
          skipped: true,
          reason: 'permission_not_granted'
        });
        continue;
      }

      const lang = normalizeLang(record.lang);
      const localized = pickLocalizedCopy(lang, copy);

      try {
        const messageId = await sendFirebaseMessage({
          token,
          title: localized.title,
          body: localized.body,
          imageUrl,
          data: {
            ...(options.data && typeof options.data === 'object' ? options.data : {}),
            source
          }
        });

        results.push({
          ok: true,
          lang,
          platform: safeString(record.platform),
          message_id: messageId
        });
      } catch (err) {
        const permanentTokenError = isPermanentFcmTokenError(err);

        if (permanentTokenError) {
          await revokeInvalidToken(redis, token, record, userId, userUuid);
          invalidTokensRemoved += 1;
        }

        results.push({
          ok: false,
          lang,
          platform: safeString(record.platform),
          permanent_token_error: permanentTokenError,
          error: String(err && (err.code || err.message) ? (err.code || err.message) : 'send_failed')
        });
      }
    }

    const sent = results.filter(item => item && item.ok && item.skipped !== true).length;
    const failed = results.filter(item => item && item.ok === false).length;
    const skipped = results.filter(item => item && item.skipped === true).length;

    if (sent === 0) {
      await releaseDeliveryLock(redis, idempotencyKey);
    }

    return {
      ok: failed === 0 || sent > 0,
      duplicate: false,
      indexed_tokens: indexedTokens.length,
      sent,
      failed,
      skipped,
      invalid_tokens_removed: invalidTokensRemoved,
      results
    };
  } catch (err) {
    await releaseDeliveryLock(redis, idempotencyKey).catch(() => null);
    throw err;
  }
}

module.exports = {
  sendPushToUser
};
