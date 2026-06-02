const { kvGetJson } = require('../../_kv');

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
      ? tokens
      : [];

    return json(res, 200, {
      ok: true,
      title,
      message,
      total_tokens: tokenList.length,
      tokens: tokenList
    });
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: 'server_error',
      message: err?.message || 'unknown_error'
    });
  }
};
