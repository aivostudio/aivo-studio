const { getRedis, kvGetJson, kvSetJson } = require('../_kv');
const authModule = require('../_lib/auth.js');
const { requireAuth } = authModule;

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function normalizePlatform(platform) {
  const value = String(platform || '').toLowerCase().trim();

  if (value === 'ios') return 'ios';
  if (value === 'android') return 'android';
  if (value === 'web') return 'web';

  return null;
}

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

  if (lang === 'tr') return 'tr';
  if (lang === 'en') return 'en';
  if (lang.startsWith('tr')) return 'tr';
  if (lang.startsWith('en')) return 'en';

  return 'tr';
}

function tokenKey(deviceToken) {
  return `push:token:${deviceToken}`;
}

function allTokensKey() {
  return 'push:tokens:all';
}

function userIdTokensKey(userId) {
  return `push:user_id:${userId}:tokens`;
}

function userUuidTokensKey(userUuid) {
  return `push:user_uuid:${userUuid}:tokens`;
}

function isInvalidPushTokenForPlatform(platform, deviceToken) {
  const token = String(deviceToken || '').trim();

  if (!token) return true;

  if (token === 'test-token-123') return true;

  if (platform === 'ios') {
    const isApnsHexToken = /^[a-fA-F0-9]{64,}$/.test(token);
    if (isApnsHexToken) return true;

    const looksLikeFcmToken = token.includes(':') && token.length > 80;
    if (!looksLikeFcmToken) return true;
  }

  return false;
}

function hasGrantedPermission(permissionStatus) {
  return String(permissionStatus || '').toLowerCase().trim() === 'granted';
}

async function updateUserTokenIndexes({
  existing,
  userId,
  userUuid,
  deviceToken,
  permissionStatus
}) {
  const redis = getRedis();

  const oldUserId = safeString(existing && existing.user_id);
  const oldUserUuid = safeString(existing && existing.user_uuid);

  if (oldUserId && oldUserId !== userId) {
    await redis.srem(userIdTokensKey(oldUserId), deviceToken);
  }

  if (oldUserUuid && oldUserUuid !== userUuid) {
    await redis.srem(userUuidTokensKey(oldUserUuid), deviceToken);
  }

  if (!hasGrantedPermission(permissionStatus)) {
    if (oldUserId) {
      await redis.srem(userIdTokensKey(oldUserId), deviceToken);
    }

    if (oldUserUuid) {
      await redis.srem(userUuidTokensKey(oldUserUuid), deviceToken);
    }

    return;
  }

  if (userId) {
    await redis.sadd(userIdTokensKey(userId), deviceToken);
  }

  if (userUuid) {
    await redis.sadd(userUuidTokensKey(userUuid), deviceToken);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, {
      ok: false,
      error: 'method_not_allowed'
    });
  }

  try {
    const body = req.body || {};

    const auth = await requireAuth(req);
    const authenticatedEmail = normalizeEmail(auth && auth.email);

    if (!auth || !authenticatedEmail) {
      return json(res, 401, {
        ok: false,
        error: 'unauthorized'
      });
    }

    const userId = authenticatedEmail;
    const userUuid = safeString(auth.user_id) || authenticatedEmail;
    const platform = normalizePlatform(body.platform);
    const deviceToken = safeString(body.device_token);
    const permissionStatus = safeString(body.permission_status) || 'granted';
    const deviceId = safeString(body.device_id);
    const app = safeString(body.app) || 'aivo';
    const lang = normalizeLang(body.lang || body.language || body.locale);

    if (!platform) {
      return json(res, 400, {
        ok: false,
        error: 'invalid_platform'
      });
    }

    if (!deviceToken) {
      return json(res, 400, {
        ok: false,
        error: 'missing_device_token'
      });
    }

    if (isInvalidPushTokenForPlatform(platform, deviceToken)) {
      return json(res, 400, {
        ok: false,
        error: 'invalid_device_token'
      });
    }

    const now = new Date().toISOString();

    const tokenRecord = {
      user_id: userId,
      user_uuid: userUuid,
      platform,
      device_token: deviceToken,
      permission_status: permissionStatus,
      app,
      lang,
      device_id: deviceId,
      user_agent: req.headers['user-agent'] || null,
      last_seen_at: now,
      revoked_at: null,
      identity_source: 'authenticated_session',
      meta: body.meta && typeof body.meta === 'object' ? body.meta : {},
      updated_at: now
    };

    const existing = await kvGetJson(tokenKey(deviceToken));

    const mergedRecord = {
      ...(existing && typeof existing === 'object' ? existing : {}),
      ...tokenRecord,
      created_at:
        existing && existing.created_at
          ? existing.created_at
          : now
    };

    await updateUserTokenIndexes({
      existing,
      userId,
      userUuid,
      deviceToken,
      permissionStatus
    });

    await kvSetJson(tokenKey(deviceToken), mergedRecord);

    const allCurrentList = await kvGetJson(allTokensKey());
    const allTokensRaw = Array.isArray(allCurrentList) ? allCurrentList : [];

    const allTokens = allTokensRaw.filter(function(token) {
      const value = String(token || '').trim();

      if (!value) return false;
      if (value === 'test-token-123') return false;
      if (/^[a-fA-F0-9]{64,}$/.test(value)) return false;

      return true;
    });

    if (!allTokens.includes(deviceToken)) {
      allTokens.push(deviceToken);
    }

    await kvSetJson(allTokensKey(), allTokens);

    return json(res, 200, {
      ok: true,
      token: mergedRecord
    });
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: 'server_error',
      message: err && err.message ? err.message : 'Unknown error'
    });
  }
}
