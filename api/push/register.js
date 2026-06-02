const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, {
      ok: false,
      error: 'method_not_allowed'
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(res, 500, {
      ok: false,
      error: 'missing_supabase_env'
    });
  }

  try {
    const body = req.body || {};

    const userId = body.user_id ? String(body.user_id).trim() : null;
    const userUuid = body.user_uuid ? String(body.user_uuid).trim() : null;
    const platform = normalizePlatform(body.platform);
    const deviceToken = body.device_token ? String(body.device_token).trim() : null;

    const permissionStatus = body.permission_status
      ? String(body.permission_status).trim()
      : 'granted';

    const deviceId = body.device_id ? String(body.device_id).trim() : null;
    const app = body.app ? String(body.app).trim() : 'aivo';

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

    const payload = {
      user_id: userId,
      user_uuid: userUuid,
      platform,
      device_token: deviceToken,
      permission_status: permissionStatus,
      app,
      device_id: deviceId,
      user_agent: req.headers['user-agent'] || null,
      last_seen_at: new Date().toISOString(),
      revoked_at: null,
      meta: body.meta && typeof body.meta === 'object' ? body.meta : {}
    };

    const response = await fetch(`${SUPABASE_URL}/rest/v1/push_tokens`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return json(res, response.status, {
        ok: false,
        error: 'push_token_save_failed',
        detail: data
      });
    }

    return json(res, 200, {
      ok: true,
      token: Array.isArray(data) ? data[0] : data
    });
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: 'server_error',
      message: err?.message || 'Unknown error'
    });
  }
}
