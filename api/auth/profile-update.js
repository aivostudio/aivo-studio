// /api/auth/profile-update.js
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;
const kvSetJson = kv.kvSetJson;

const COOKIE_KV = "aivo_sess";

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;

  header.split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i === -1) return;
    const k = p.slice(0, i).trim();
    const v = p.slice(i + 1).trim();
    if (k) out[k] = v;
  });

  return out;
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function cleanText(v) {
  return String(v || "").trim();
}

async function readJson(req) {
  try {
    if (req.body && typeof req.body === "object") return req.body;

    const chunks = [];
    for await (const c of req) chunks.push(c);
    if (!chunks.length) return {};

    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return json(res, 405, { ok: false, error: "method_not_allowed" });
    }

    if (typeof kvGetJson !== "function" || typeof kvSetJson !== "function") {
      return json(res, 503, { ok: false, error: "kv_not_available" });
    }

    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies[COOKIE_KV];

    if (!sid) {
      return json(res, 401, { ok: false, error: "no_session" });
    }

    const sess = await kvGetJson(`sess:${sid}`).catch(() => null);
    if (!sess || typeof sess !== "object" || !sess.email) {
      return json(res, 401, { ok: false, error: "invalid_session" });
    }

    const email = normalizeEmail(sess.email);
    if (!email) {
      return json(res, 401, { ok: false, error: "invalid_session" });
    }

    const body = await readJson(req);
    if (!body) {
      return json(res, 400, { ok: false, error: "invalid_json" });
    }

    const name = cleanText(body.name);
    const surname = cleanText(body.surname);

    if (!name) {
      return json(res, 400, { ok: false, error: "name_required" });
    }

    const userKeyPrimary = `user:${email}`;
    const userKeyLegacy = `users:${email}`;

    const u1 = await kvGetJson(userKeyPrimary).catch(() => null);
    const u2 = await kvGetJson(userKeyLegacy).catch(() => null);

    const existingUser =
      u1 && typeof u1 === "object"
        ? u1
        : (u2 && typeof u2 === "object" ? u2 : null);

    if (!existingUser) {
      return json(res, 404, { ok: false, error: "user_not_found" });
    }

    const now = Date.now();

    const nextUser = {
      ...existingUser,
      email,
      name,
      surname,
      updatedAt: now,
    };

    await kvSetJson(userKeyPrimary, nextUser);

    if (u2 && typeof u2 === "object") {
      await kvSetJson(userKeyLegacy, {
        ...u2,
        email,
        name,
        surname,
        updatedAt: now,
      });
    }

    const list = await kvGetJson("users:list").catch(() => null);
    if (Array.isArray(list)) {
      const nextList = list.map((item) => {
        const itemEmail = normalizeEmail(item && item.email);
        if (itemEmail !== email) return item;

        return {
          ...item,
          name,
          surname,
          updatedAt: now,
        };
      });

      await kvSetJson("users:list", nextList);
    }

    return json(res, 200, {
      ok: true,
      user: {
        email,
        name,
        surname,
        role: nextUser.role || "user",
        verified: nextUser.verified === true,
        updatedAt: now,
      },
    });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "server_error",
      message: String(e?.message || e),
    });
  }
}
