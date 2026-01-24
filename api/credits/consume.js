import { requireAuth } from "../_lib/auth.js";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false });
  }

  const s = requireAuth(req, res);
  if (!s) return;

  const { cost = 0, reason = "unknown" } = req.body || {};
  const need = Math.max(0, Number(cost) || 0);

  const key = `credits:${s.sub}`;
  const have = Number(await redis.get(key)) || 0;

  if (have < need) {
    return res.status(402).json({
      ok: false,
      error: "insufficient_credits",
      credits: have
    });
  }

  const next = have - need;
  await redis.set(key, next);

  return res.json({
    ok: true,
    credits: next,
    reason
  });
}
