// api/_kv.js
// Upstash/Vercel KV helper (Redis REST)
// Provides: getRedis, kvGet, kvSet, kvDel, kvIncr, kvGetJson, kvSetJson

const { Redis } = require("@upstash/redis");

let _redis;

/** env okumada boş string/undefined koruması */
function getEnv(name) {
  const v = process.env[name];
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

/** Vercel Storage / Upstash olası env isimleri */
function resolveUrlToken() {
  const url =
    getEnv("UPSTASH_KV_REST_API_URL") ||
    getEnv("KV_REST_API_URL") ||
    getEnv("UPSTASH_REDIS_REST_URL") ||
    getEnv("UPSTASH_REDIS_REST_API_URL");

  const token =
    getEnv("UPSTASH_KV_REST_API_TOKEN") ||
    getEnv("KV_REST_API_TOKEN") ||
    getEnv("UPSTASH_REDIS_REST_TOKEN") ||
    getEnv("UPSTASH_REDIS_REST_API_TOKEN");

  return { url, token };
}

function getRedis() {
  if (_redis) return _redis;

  const { url, token } = resolveUrlToken();
  if (!url || !token) {
    throw new Error(
      "Upstash KV env missing: REST URL/TOKEN not found. " +
        "Set KV_REST_API_URL + KV_REST_API_TOKEN (or UPSTASH_* equivalents) in Vercel env."
    );
  }

  _redis = new Redis({ url, token });
  return _redis;
}

/* =========================
   SIMPLE KV HELPERS
   ========================= */

async function kvGet(key) {
  if (!key) throw new Error("kvGet: key is required");
  const r = getRedis();
  return await r.get(key);
}

async function kvSet(key, value, opts) {
  if (!key) throw new Error("kvSet: key is required");
  const r = getRedis();

  // opts: { ex: seconds } (optional)
  const ex =
    opts && Number.isFinite(Number(opts.ex)) && Number(opts.ex) > 0
      ? Number(opts.ex)
      : null;

  if (ex) return await r.set(key, value, { ex });
  return await r.set(key, value);
}

async function kvDel(key) {
  if (!key) throw new Error("kvDel: key is required");
  const r = getRedis();
  return await r.del(key);
}

async function kvIncr(key, by = 1) {
  if (!key) throw new Error("kvIncr: key is required");
  const r = getRedis();
  return await r.incrby(key, Number(by) || 1);
}

/* =========================
   JSON CONVENIENCE
   ========================= */

async function kvGetJson(key) {
  const v = await kvGet(key);
  if (v == null) return null;

  // Upstash bazen obj döndürebilir
  if (typeof v === "object") return v;

  const s = String(v);
  try {
    return JSON.parse(s);
  } catch (_) {
    // Parse edilemiyorsa "bozuk/legacy" veri olabilir: var say.
    return { _raw: s };
  }
}

async function kvSetJson(key, obj, opts) {
  const payload = JSON.stringify(obj == null ? null : obj);
  return await kvSet(key, payload, opts);
}

module.exports = {
  getRedis,
  kvGet,
  kvSet,
  kvDel,
  kvIncr,
  kvGetJson,
  kvSetJson,
};
