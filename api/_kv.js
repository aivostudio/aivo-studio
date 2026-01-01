// api/_kv.js
const { Redis } = require("@upstash/redis");

let _redis;

/** env okumada boş string/undefined koruması */
function getEnv(name) {
  const v = process.env[name];
  return (typeof v === "string" && v.trim()) ? v.trim() : "";
}

/** Vercel Storage / Upstash olası env isimleri */
function resolveUrlToken() {
  const url =
    getEnv("UPSTASH_KV_REST_API_URL") ||
    getEnv("KV_REST_API_URL") ||
    getEnv("UPSTASH_REDIS_REST_URL");

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
    // Güvenli hata: prod’da sessizce yanlış çalışmasın
    throw new Error("Upstash KV env missing: REST URL/TOKEN not found.");
  }

  _redis = new Redis({ url, token });
  return _redis;
}

module.exports = { getRedis };
