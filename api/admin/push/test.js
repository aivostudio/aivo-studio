const admin = require('firebase-admin');
const { kvGetJson } = require('../../_kv');

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function getAllowedAdmins() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(normalizeEmail)
    .filter(Boolean);
}

function isAdmin(email) {
  return getAllowedAdmins().includes(normalizeEmail(email));
}

function allTokensKey() {
  return 'push:tokens:all';
}

function tokenKey(deviceToken) {
  return `push:token:${deviceToken}`;
}

function getFirebasePrivateKey() {
  return String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
}

function getFirebaseApp() {
  if (admin.apps.length) return admin.app();

  const projectId = String(process.env.FIREBASE_PROJECT_ID || '').trim();
  const clientEmail = String(process.env.FIREBASE_CLIENT_EMAIL || '').trim();
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

function isUsableTokenRecord(record) {
  if (!record || typeof record !== 'object') return false;
  if (record.revoked_at) return false;

  const permission = String(record.permission_status || 'granted')
    .trim()
    .toLowerCase();

  return permission !== 'denied';
}

function recordTime(record) {
  const raw =
    record.last_seen_at ||
    record.updated_at ||
    record.created_at ||
    '';

  const parsed = Date.parse(String(raw || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function maskToken(token) {
  const value = String(token || '').trim();
  if (!value) return '';
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function validateHttpsImageUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch (_) {
    return null;
  }
}

async function findNewestAdminDevice(targetEmail) {
  const allTokens = await kvGetJson(allTokensKey());
  const tokenList = Array.isArray(allTokens)
    ? allTokens.map(token => String(token || '').trim()).filter(Boolean)
    : [];

  const matches = [];

  for (const token of tokenList) {
    const record = await kvGetJson(tokenKey(token));

    if (!isUsableTokenRecord(record)) continue;

    const recordEmail = normalizeEmail(
      record.user_id ||
      record.user_uuid ||
      record.email ||
      ''
    );

    if (recordEmail !== targetEmail) continue;

    matches.push({
      token,
      record,
      time: recordTime(record)
    });
  }

  matches.sort((a, b) => b.time - a.time);
  return matches[0] || null;
}

async function sendImageTest(token, title, message, imageUrl) {
  getFirebaseApp();

  const payload = {
    token,
    notification: {
      title,
      body: message,
      imageUrl
    },
    android: {
      notification: {
        imageUrl
      }
    },
    apns: {
      payload: {
        aps: {
          'mutable-content': 1
        }
      },
      fcmOptions: {
        imageUrl
      }
    },
    data: {
      source: 'aivo_admin_image_test',
      click_action: 'open_app',
      imageUrl,
      image: imageUrl
    }
  };

  return admin.messaging().send(payload);
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return json(res, 405, {
        ok: false,
        error: 'method_not_allowed'
      });
    }

    const email = normalizeEmail(
      req.body?.email ||
      req.query?.email ||
      ''
    );

    if (!isAdmin(email)) {
      return json(res, 403, {
        ok: false,
        error: 'not_admin'
      });
    }

    const targetEmail = normalizeEmail(req.body?.targetEmail || email);

    if (targetEmail !== email) {
      return json(res, 403, {
        ok: false,
        error: 'test_target_must_be_admin_account'
      });
    }

    const title = String(req.body?.title || '').trim();
    const message = String(req.body?.message || '').trim();
    const imageUrl = validateHttpsImageUrl(req.body?.imageUrl);

    if (!title || !message) {
      return json(res, 400, {
        ok: false,
        error: 'title_and_message_required'
      });
    }

    if (!imageUrl) {
      return json(res, 400, {
        ok: false,
        error: 'valid_https_image_url_required'
      });
    }

    const device = await findNewestAdminDevice(targetEmail);

    if (!device) {
      return json(res, 404, {
        ok: false,
        error: 'no_active_push_device_for_admin'
      });
    }

    const messageId = await sendImageTest(
      device.token,
      title,
      message,
      imageUrl
    );

    return json(res, 200, {
      ok: true,
      mode: 'single_device_image_test',
      target_email: targetEmail,
      platform: device.record?.platform || null,
      device_id: device.record?.device_id || null,
      token: maskToken(device.token),
      last_seen_at: device.record?.last_seen_at || null,
      imageUrl,
      message_id: messageId
    });
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: 'server_error',
      message: err?.message || 'unknown_error'
    });
  }
};
