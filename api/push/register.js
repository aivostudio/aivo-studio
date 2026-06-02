const { kvGetJson, kvSetJson } = require('../_kv');

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

function tokenKey(deviceToken) {
  return `push:token:${deviceToken}`;
}

function allTokensKey() {
  return 'push:tokens:all';
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

    const userId = safeString(body.user_id);
    const userUuid = safeString(body.user_uuid);
    const platform = normalizePlatform(body.platform);
    const deviceToken = safeString(body.device_token);
    const permissionStatus = safeString(body.permission_status) || 'granted';
    const deviceId = safeString(body.device_id);
    const app = safeString(body.app) || 'aivo';

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

    const now = new Date().toISOString();

    const tokenRecord = {
      user_id: userId,
      user_uuid: userUuid,
      platform,
      device_token: deviceToken,
      permission_status: permissionStatus,
      app,
      device_id: deviceId,
      user_agent: req.headers['user-agent'] || null,
      last_seen_at: now,
      revoked_at: null,
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

    await kvSetJson(tokenKey(deviceToken), mergedRecord);

    const allCurrentList = await kvGetJson(allTokensKey());
    const allTokens = Array.isArray(allCurrentList) ? allCurrentList : [];

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
