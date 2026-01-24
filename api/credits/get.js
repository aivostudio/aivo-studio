import { requireAuth } from "../_lib/auth.js";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false });
  }

  const s = requireAuth(req, res);
  if (!s) return;

  const key = `credits:${s.sub}`;
  const credits = Number(await redis.get(key)) || 0;

  return res.json({
    ok: true,
    credits
  });
}
