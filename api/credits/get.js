// /api/credits/get.js  (TEK OTORİTE: session -> email -> redis credits)
import kvMod from "../_kv.js";
import { Redis } from "@upstash/redis";

const kv = kvMod?.default || kvMod || {};
const kvGetJson = kv.kvGetJson;

function json(res, code, obj) {
  res.status(code).setHeader("content-type", "application/json").end(JSON.stringify(obj));
}

function safeStr(v) { return String(v == null ? "" : v).trim(); }
function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

function readCookie(req, name) {
  const raw = String(req.headers.cookie || "");
  const parts = raw.split(";").map(s => s.trim());
  for (const p of parts) {
    const i = p.indexOf("=");
    if (i > -1) {
      const k = p.slice(0, i);
      const v = p.slice(i + 1);
      if (k === name) return v;
    }
  }
  return "";
}

export default async function handler(req, res) {
  try {
    if (typeof kvGetJson !== "function") {
      return json(res, 503, { ok: false, error: "kv_not_available" });
    }

    // 1) session cookie (yeni + legacy)
    const sid =
      safeStr(readCookie(req, "aivo_sess")) ||
      safeStr(readCookie(req, "aivo_session"));

    if (!sid) return json(res, 401, { ok: false, error: "unauthorized" });

    // 2) session -> email
    const sess = await kvGetJson(`sess:${sid}`).catch(() => null);
    const email = safeStr(sess?.email).toLowerCase();
    if (!email) return json(res, 401, { ok: false, error: "unauthorized" });

    // 3) redis credits:{email}
    const redis = Redis.fromEnv();
    const creditsKey = `credits:${email}`;
    const credits = toInt(await redis.get(creditsKey));

    return json(res, 200, { ok: true, email, credits });
  } catch (e) {
    return json(res, 500, { ok: false, error: "server_error", detail: safeStr(e?.message || e) });
  }
}
