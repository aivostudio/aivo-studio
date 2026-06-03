const admin = require('firebase-admin');
const { kvGetJson, kvSetJson } = require('../../_kv');

function json(res, status, payload) {
  return res.status(status).json(payload);
}

function getAllowedAdmins() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(v => v.trim().toLowerCase())
    .filter(Boolean);
}

function isAdmin(email) {
  if (!email) return false;
  return getAllowedAdmins().includes(
    String(email).trim().toLowerCase()
  );
}

function allTokensKey() {
  return 'push:tokens:all';
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

async function sendToToken(token, title, message, imageUrl) {
  getFirebaseApp();

  const cleanImageUrl = String(imageUrl || '').trim();

  const payload = {
    token,
    android: {
      notification: {
        title,
        body: message,
        imageUrl: cleanImageUrl || undefined
      }
    },
    apns: {
      headers: {
        'apns-push-type': 'alert',
        'apns-priority': '10'
      },
      payload: {
        aps: {
          alert: {
            title,
            body: message
          },
          'mutable-content': 1,
          sound: 'default'
        }
      },
      fcmOptions: {
        imageUrl: cleanImageUrl || undefined
      }
    },
    data: {
      source: 'aivo_admin_campaign',
      click_action: 'open_app',
      imageUrl: cleanImageUrl,
      image: cleanImageUrl
    }
  };

  return await admin.messaging().send(payload);
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

    const email = String(
      req.body?.email ||
      req.query?.email ||
      ''
    ).trim().toLowerCase();

    if (!isAdmin(email)) {
      return json(res, 403, {
        ok: false,
        error: 'not_admin'
      });
    }

    const title = String(
      req.body?.title || ''
    ).trim();

      const message = String(
      req.body?.message || ''
    ).trim();

    const imageUrl = String(
      req.body?.imageUrl || ''
    ).trim();

    if (!title) {
      return json(res, 400, {
        ok: false,
        error: 'missing_title'
      });
    }

    if (!message) {
      return json(res, 400, {
        ok: false,
        error: 'missing_message'
      });
    }

    const tokens = await kvGetJson(allTokensKey());

    const tokenList = Array.isArray(tokens)
      ? tokens.filter(Boolean)
      : [];

    if (!tokenList.length) {
      return json(res, 200, {
        ok: true,
        title,
        message,
        imageUrl,
        total_tokens: 0,
        sent: 0,
        failed: 0,
        results: []
      });
    }

    const results = [];

    for (const token of tokenList) {
      try {
            const messageId = await sendToToken(
          token,
          title,
          message,
          imageUrl
        );

        results.push({
          token,
          ok: true,
          message_id: messageId
        });
      } catch (err) {
        results.push({
          token,
          ok: false,
          error: err?.message || 'send_failed'
        });
      }
    }

 const sent = results.filter(item => item.ok).length;
const failed = results.length - sent;

const cleanedTokenList = tokenList.filter(function(token) {
  const result = results.find(item => item.token === token);

  if (!result) return false;
  if (result.ok) return true;

  const error = String(result.error || '');

  if (error.includes('not a valid FCM registration token')) return false;
  if (error.includes('Requested entity was not found')) return false;
  if (/^[a-fA-F0-9]{64,}$/.test(String(token || '').trim())) return false;

  return true;
});

if (cleanedTokenList.length !== tokenList.length) {
  await kvSetJson(allTokensKey(), cleanedTokenList);
}

return json(res, 200, {
  ok: true,
  title,
  message,
  imageUrl,
  total_tokens: tokenList.length,
  active_tokens: cleanedTokenList.length,
  cleaned_tokens: tokenList.length - cleanedTokenList.length,
  sent,
  failed,
  results
});
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: 'server_error',
      message: err?.message || 'unknown_error'
    });
  }
};
