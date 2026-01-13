// api/_kv.js
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
      "Upstash KV env missing: define REST URL + TOKEN. " +
        "Expected one of: KV_REST_API_URL / KV_REST_API_TOKEN (or UPSTASH_* variants)."
    );
  }

  _redis = new Redis({ url, token });
  return _redis;
}

/* =========================
   SIMPLE KV HELPERS
   ========================= */

async function kvGet(key) {
  const r = getRedis();
  return await r.get(key);
}

// opts: { ex: seconds } (optional)
// note: if value is object/array, prefer kvSetJson or pass a string explicitly.
async function kvSet(key, value, opts) {
  const r = getRedis();

  const ex =
    opts && Number.isFinite(Number(opts.ex)) && Number(opts.ex) > 0
      ? Number(opts.ex)
      : null;

  if (ex) return await r.set(key, value, { ex });
  return await r.set(key, value);
}

async function kvDel(key) {
  const r = getRedis();
  return await r.del(key);
}

async function kvIncr(key, by = 1) {
  const r = getRedis();
  return await r.incrby(key, Number(by) || 1);
}

/** JSON convenience */
async function kvGetJson(key) {
  const v = await kvGet(key);
  if (v == null) return null;

  // Upstash bazen obj döndürebilir
  if (typeof v === "object") return v;

  const s = String(v);
  try {
    return JSON.parse(s);
  } catch (_) {
    // İstersen burada "return null" olarak bırakabiliriz.
    return null;
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
