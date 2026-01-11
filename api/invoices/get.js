// /api/invoices/get.js

const REST_URL =
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.UPSTASH_KV_REST_API_URL ||
  process.env.KV_REST_API_URL ||
  "";

const REST_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  process.env.UPSTASH_KV_REST_API_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  "";

async function redisCmd(cmd, ...args) {
  if (!REST_URL || !REST_TOKEN) {
    throw new Error("KV_REDIS_REST_ENV_MISSING");
  }
  const url = `${REST_URL}/${cmd}/${args.map(a => encodeURIComponent(String(a))).join("/")}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${REST_TOKEN}` },
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || j?.message || `REDIS_${cmd}_FAILED`);
  return j?.result;
}

function safeEmail(v) {
  const e = String(v || "").trim().toLowerCase();
  if (!e || !e.includes("@")) return "";
  return e;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ ok: false, error: "METHOD_NOT_ALLOWED" });
    }

    const email = safeEmail(req.query?.email);
    if (!email) {
      return res.status(400).json({ ok: false, error: "EMAIL_REQUIRED" });
    }

    // önce v1 dene
    const key1 = `AIVO_INVOICES:${email}`;
    const key2 = `AIVO_INVOICES_V2:${email}`;

    let raw = null;
    try {
      raw = await redisCmd("get", key1);
    } catch (_) {
      raw = null;
    }

    if (!raw) {
      try {
        raw = await redisCmd("get", key2);
      } catch (_) {
        raw = null;
      }
    }

    if (!raw) {
      return res.status(200).json({ ok: true, email, invoices: [] });
    }

    let invoices = [];
    try {
      invoices = JSON.parse(raw) || [];
    } catch {
      invoices = [];
    }

    return res.status(200).json({ ok: true, email, invoices });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "INVOICES_GET_FAILED" });
  }
}
