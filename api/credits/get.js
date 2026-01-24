import { requireAuth } from "../_lib/auth.js";
import { Redis } from "@upstash/redis";

export default async function handler(req, res) {
  try {
    const s = requireAuth(req, res);
    if (!s) return;

    const redis = Redis.fromEnv();
    const key = `credits:${s.sub}`;

    const credits = Number(await redis.get(key)) || 0;

    return res.status(200).json({
      ok: true,
      credits
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "server_error",
      detail: String(e?.message || e)
    });
  }
}
