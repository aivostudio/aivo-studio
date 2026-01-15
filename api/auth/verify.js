// api/auth/verify.js

import crypto from "crypto";

// KV opsiyonel import (bağlı değilse patlamaz)
async function getKV() {
  try {
    const mod = await import("@vercel/kv");
    return mod.kv || null;
  } catch {
    return null;
  }
}

function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data, null, 2));
}

// ŞİMDİLİK MOCK USER CREATE
// 👉 Burayı sonra DB / gerçek user store’a bağlayacağız
async function createUser(payload) {
  // payload: { email, name, passwordHash, createdAt }
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
  if (!token) {
    return json(res, 400, { ok: false, error: "missing_token" });
  }

  const kv = await getKV();
  if (!kv) {
    return json(res, 503, {
      ok: false,
      error: "kv_not_available",
      hint: "Vercel KV bağlı değil",
    });
  }

  const key = `verify:${token}`;

  let raw;
  try {
    raw = await kv.get(key);
  } catch (err) {
    return json(res, 503, { ok: false, error: "kv_read_failed" });
  }

  if (!raw) {
    return json(res, 400, {
      ok: false,
      error: "invalid_or_expired_token",
    });
  }

  // KV string / object normalize
  let payload = raw;
  if (typeof raw === "string") {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = { email: raw };
    }
  }

  if (!payload?.email) {
    return json(res, 400, {
      ok: false,
      error: "bad_payload_missing_email",
    });
  }

  // USER CREATE
  let user;
  try {
    user = await createUser(payload);
  } catch {
    return json(res, 500, {
      ok: false,
      error: "user_create_failed",
    });
  }

  // TOKEN INVALIDATE
  try {
    await kv.del(key);
  } catch {
    // silinmese bile verify başarılı sayılır
  }

  return json(res, 200, {
    ok: true,
    verified: true,
    user,
  });
}
