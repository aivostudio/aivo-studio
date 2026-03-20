// api/auth/reset.js
import bcrypt from "bcryptjs";
import kvMod from "../_kv.js";

const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;
const kvSetJson = kv.kvSetJson;
const kvDel =
  kv.kvDel || kv.kvDelKey || kv.kvDelSafe || kv.kvDelJson || null;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

const normalizeEmail = (v) => String(v || "").trim().toLowerCase();

async function delSafe(key) {
  try {
    if (typeof kvDel === "function") return await kvDel(key);
  } catch (_) {}
  return null;
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

    const body = await readJson(req);
    if (!body) {
      return json(res, 400, { ok: false, error: "invalid_json" });
    }

    const token = String(body.token || "").trim();
    const password = String(body.password || "");

    if (!token || token.length < 16) {
      return json(res, 400, { ok: false, error: "invalid_token" });
    }

    if (!password || password.length < 8) {
      return json(res, 400, { ok: false, error: "weak_password" });
    }

    const resetKey = `reset:${token}`;
    const rec = await kvGetJson(resetKey).catch(() => null);

    if (!rec || typeof rec !== "object") {
      return json(res, 400, { ok: false, error: "invalid_or_expired_token" });
    }

    const email = normalizeEmail(rec.email);
    if (!email || !email.includes("@")) {
      await delSafe(resetKey);
      return json(res, 400, { ok: false, error: "bad_reset_payload" });
    }

    const userKey = `user:${email}`;
    const existing = await kvGetJson(userKey).catch(() => null);

    if (!existing || typeof existing !== "object") {
      await delSafe(resetKey);
      return json(res, 404, { ok: false, error: "user_not_found" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const next = {
      ...existing,
      email,
      passwordHash,
      updatedAt: Date.now(),
    };

    await kvSetJson(userKey, next);
    await delSafe(resetKey);

    return json(res, 200, { ok: true });
  } catch (e) {
    return json(res, 500, {
      ok: false,
      error: "reset_failed",
      message: String(e?.message || e),
    });
  }
}
