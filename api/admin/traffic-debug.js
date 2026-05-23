// api/admin/traffic-debug.js

const { getRedis } = require("../_kv.js");

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "method_not_allowed"
      });
    }

    const day = String(req.query.day || new Date().toISOString().slice(0, 10))
      .trim()
      .slice(0, 10);

    const limit = Math.min(
      Math.max(Number(req.query.limit || 50), 1),
      200
    );

    const redis = getRedis();
    const key = `traffic:day:${day}:debug`;

    const rawItems = await redis.lrange(key, 0, limit - 1);

    const items = rawItems.map((item) => {
      if (typeof item === "object" && item !== null) {
        return item;
      }

      try {
        return JSON.parse(String(item));
      } catch (_) {
        return {
          raw: String(item)
        };
      }
    });

    return res.status(200).json({
      ok: true,
      day,
      key,
      count: items.length,
      items
    });
  } catch (err) {
    return res.status(200).json({
      ok: false,
      error: "traffic_debug_failed"
    });
  }
}
