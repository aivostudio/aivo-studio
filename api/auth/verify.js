// api/auth/verify.js
import crypto from "crypto";

// CommonJS helper'ı ESModule içinde kullanmak için:
import kvMod from "../_kv.js";
const { kvGetJson, kvDel } = kvMod;

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data, null, 2));
}

// Şimdilik mock user create (sonra gerçek store'a bağlayacağız)
async function createUser(payload) {
  return {
    id: crypto.randomUUID(),
    email: payload.email,
    created: true,
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { ok: false, error: "method_not_allowed" });
  }

  const token = (req.query?.token || "").toString().trim();
  if (!token) return json(res, 400, { ok: false, error: "missing_token" });

  const key = `verify:${token}`;

  let payload;
  try {
    payload = await kvGetJson(key);
  } catch (e) {
    // KV env eksikse buraya düşer (api/_kv.js throw atıyor)
    return json(res, 503, {
      ok: false,
      error: "kv_not_available",
      hint: e?.message || "kv error",
    });
  }

  if (!payload) {
    return json(res, 400, { ok: false, error: "invalid_or_expired_token" });
  }

  const email = (payload?.email || "").toString().trim().toLowerCase();
  if (!email) {
    return json(res, 400, { ok: false, error: "bad_payload_missing_email" });
  }

  let user;
  try {
    user = await createUser({ ...payload, email });
  } catch {
    return json(res, 500, { ok: false, error: "user_create_failed" });
  }

  // token invalidate
  try {
    await kvDel(key);
  } catch {
    // silinmese bile verify başarılı sayılabilir
  }

  return json(res, 200, { ok: true, verified: true, user });
}
